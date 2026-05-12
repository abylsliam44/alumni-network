"""
RAG (Retrieval-Augmented Generation) Service for AITU Knowledge Base.

This service handles:
- PDF document processing and chunking
- Creating and storing embeddings in Qdrant
- Semantic search for relevant context
- Integration with the AI chat endpoint
"""
import logging
import hashlib
from typing import List, Optional
from pathlib import Path

import fitz  
from qdrant_client import QdrantClient
from qdrant_client.http import models as qmodels
from qdrant_client.http.exceptions import UnexpectedResponse
from sentence_transformers import SentenceTransformer

from app.core.config import settings

logger = logging.getLogger(__name__)

# Constants
COLLECTION_NAME = "aitu_knowledge_base"
CHUNK_SIZE = 500  # characters per chunk
CHUNK_OVERLAP = 50  # overlap between chunks
EMBEDDING_DIMENSION = 384  # paraphrase-multilingual-MiniLM-L12-v2 dimension (supports Russian + English)


class RAGService:
    """Service for RAG operations with Qdrant vector database."""

    _instance: Optional["RAGService"] = None
    _initialized: bool = False

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        if self._initialized:
            return

        self.qdrant_client: Optional[QdrantClient] = None
        self.embedding_model: Optional[SentenceTransformer] = None
        self._initialized = True

    def _get_qdrant_client(self) -> QdrantClient:
        """Lazy initialization of Qdrant client."""
        if self.qdrant_client is None:
            logger.info(f"Connecting to Qdrant at {settings.QDRANT_URL}")
            self.qdrant_client = QdrantClient(
                url=settings.QDRANT_URL,
                api_key=settings.QDRANT_API_KEY,
                timeout=30,
            )
        return self.qdrant_client

    def _get_embedding_model(self) -> SentenceTransformer:
        """Lazy initialization of embedding model."""
        if self.embedding_model is None:
            logger.info(f"Loading embedding model: {settings.EMBEDDING_MODEL}")
            self.embedding_model = SentenceTransformer(settings.EMBEDDING_MODEL)
        return self.embedding_model

    def ensure_collection(self) -> bool:
        """Create collection if it doesn't exist."""
        client = self._get_qdrant_client()

        try:
            collections = client.get_collections().collections
            exists = any(c.name == COLLECTION_NAME for c in collections)

            if not exists:
                logger.info(f"Creating collection: {COLLECTION_NAME}")
                client.create_collection(
                    collection_name=COLLECTION_NAME,
                    vectors_config=qmodels.VectorParams(
                        size=EMBEDDING_DIMENSION,
                        distance=qmodels.Distance.COSINE,
                    ),
                )
                logger.info(f"Collection {COLLECTION_NAME} created successfully")
            else:
                logger.info(f"Collection {COLLECTION_NAME} already exists")

            return True
        except Exception as e:
            logger.error(f"Failed to ensure collection: {e}")
            return False

    def _extract_text_from_pdf(self, pdf_path: str) -> str:
        """Extract text content from a PDF file."""
        logger.info(f"Extracting text from PDF: {pdf_path}")

        doc = fitz.open(pdf_path)
        text_parts = []

        for page_num, page in enumerate(doc):
            text = page.get_text()
            if text.strip():
                text_parts.append(f"[Page {page_num + 1}]\n{text}")

        doc.close()
        full_text = "\n\n".join(text_parts)
        logger.info(f"Extracted {len(full_text)} characters from PDF")
        return full_text

    def _chunk_text(self, text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> List[str]:
        """Split text into overlapping chunks."""
        if not text:
            return []

        # Clean text
        text = " ".join(text.split())

        chunks = []
        start = 0

        while start < len(text):
            end = start + chunk_size

            # Try to break at sentence boundary
            if end < len(text):
                # Look for sentence ending
                for punct in ['. ', '! ', '? ', '\n']:
                    last_punct = text[start:end].rfind(punct)
                    if last_punct > chunk_size // 2:
                        end = start + last_punct + 1
                        break

            chunk = text[start:end].strip()
            if chunk:
                chunks.append(chunk)

            start = end - overlap

        logger.info(f"Created {len(chunks)} chunks from text")
        return chunks

    def _generate_chunk_id(self, text: str, source: str, index: int) -> str:
        """Generate unique ID for a chunk."""
        content = f"{source}:{index}:{text[:100]}"
        return hashlib.md5(content.encode()).hexdigest()

    def index_pdf(self, pdf_path: str, source_name: Optional[str] = None) -> dict:
        """
        Process a PDF file and index it in Qdrant.

        Args:
            pdf_path: Path to the PDF file
            source_name: Optional name for the source (defaults to filename)

        Returns:
            dict with status and statistics
        """
        path = Path(pdf_path)
        if not path.exists():
            raise FileNotFoundError(f"PDF file not found: {pdf_path}")

        source = source_name or path.stem

        # Ensure collection exists
        self.ensure_collection()

        # Extract and chunk text
        text = self._extract_text_from_pdf(pdf_path)
        chunks = self._chunk_text(text)

        if not chunks:
            return {"status": "error", "message": "No text extracted from PDF"}

        # Generate embeddings
        model = self._get_embedding_model()
        logger.info(f"Generating embeddings for {len(chunks)} chunks...")
        embeddings = model.encode(chunks, show_progress_bar=True)

        # Prepare points for Qdrant
        points = []
        for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
            point_id = self._generate_chunk_id(chunk, source, i)
            points.append(
                qmodels.PointStruct(
                    id=point_id,
                    vector=embedding.tolist(),
                    payload={
                        "text": chunk,
                        "source": source,
                        "chunk_index": i,
                        "total_chunks": len(chunks),
                    },
                )
            )

        # Delete existing points from this source
        client = self._get_qdrant_client()
        try:
            client.delete(
                collection_name=COLLECTION_NAME,
                points_selector=qmodels.FilterSelector(
                    filter=qmodels.Filter(
                        must=[
                            qmodels.FieldCondition(
                                key="source",
                                match=qmodels.MatchValue(value=source),
                            )
                        ]
                    )
                ),
            )
            logger.info(f"Deleted existing chunks for source: {source}")
        except Exception as e:
            logger.warning(f"Could not delete existing points: {e}")

        # Upload points in batches
        batch_size = 100
        for i in range(0, len(points), batch_size):
            batch = points[i:i + batch_size]
            client.upsert(collection_name=COLLECTION_NAME, points=batch)
            logger.info(f"Uploaded batch {i // batch_size + 1}/{(len(points) + batch_size - 1) // batch_size}")

        logger.info(f"Successfully indexed {len(chunks)} chunks from {source}")

        return {
            "status": "success",
            "source": source,
            "chunks_indexed": len(chunks),
            "total_characters": len(text),
        }

    def search(self, query: str, top_k: int = 3) -> List[dict]:
        """
        Search for relevant context based on query.

        Args:
            query: User's question
            top_k: Number of results to return

        Returns:
            List of relevant text chunks with metadata
        """
        try:
            # Ensure collection exists
            client = self._get_qdrant_client()

            # Check if collection has any points
            try:
                collection_info = client.get_collection(COLLECTION_NAME)
                if collection_info.points_count == 0:
                    logger.info("Knowledge base is empty, no context available")
                    return []
            except UnexpectedResponse:
                logger.info("Collection does not exist yet")
                return []

            # Generate query embedding
            model = self._get_embedding_model()
            query_embedding = model.encode(query).tolist()

            # Search in Qdrant
            results = client.search(
                collection_name=COLLECTION_NAME,
                query_vector=query_embedding,
                limit=top_k,
                score_threshold=0.15,  # Lower threshold for Russian content matching
            )

            # Format results
            context_results = []
            for result in results:
                context_results.append({
                    "text": result.payload.get("text", ""),
                    "source": result.payload.get("source", "unknown"),
                    "score": result.score,
                    "chunk_index": result.payload.get("chunk_index", 0),
                })

            logger.info(f"Found {len(context_results)} relevant chunks for query")
            return context_results

        except Exception as e:
            logger.error(f"Search error: {e}")
            return []

    def get_context_for_prompt(self, query: str, max_context_length: int = 6000) -> str:
        """
        Get formatted context string for LLM prompt.

        Args:
            query: User's question
            max_context_length: Maximum characters for context

        Returns:
            Formatted context string
        """
        results = self.search(query, top_k=10)

        if not results:
            return ""

        context_parts = []
        total_length = 0

        for result in results:
            text = result["text"]
            source = result["source"]
            score = result["score"]

            # Format chunk with source
            formatted = f"[Source: {source}, relevance: {score:.2f}]\n{text}"

            if total_length + len(formatted) > max_context_length:
                break

            context_parts.append(formatted)
            total_length += len(formatted)

        if not context_parts:
            return ""

        return "\n\n---\n\n".join(context_parts)

    def get_stats(self) -> dict:
        """Get statistics about the knowledge base."""
        try:
            client = self._get_qdrant_client()
            collection_info = client.get_collection(COLLECTION_NAME)

            return {
                "status": "ok",
                "collection_name": COLLECTION_NAME,
                "total_points": collection_info.points_count,
                "vector_dimension": EMBEDDING_DIMENSION,
            }
        except UnexpectedResponse:
            return {
                "status": "empty",
                "collection_name": COLLECTION_NAME,
                "total_points": 0,
                "message": "Collection not yet created",
            }
        except Exception as e:
            return {
                "status": "error",
                "message": str(e),
            }

    def clear_knowledge_base(self) -> dict:
        """Clear all data from the knowledge base."""
        try:
            client = self._get_qdrant_client()
            client.delete_collection(COLLECTION_NAME)
            logger.info(f"Deleted collection: {COLLECTION_NAME}")
            return {"status": "success", "message": "Knowledge base cleared"}
        except Exception as e:
            logger.error(f"Failed to clear knowledge base: {e}")
            return {"status": "error", "message": str(e)}


# Global instance
rag_service = RAGService()
