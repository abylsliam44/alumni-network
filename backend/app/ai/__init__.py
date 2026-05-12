"""
AI module for AITU Alumni Network.

This module contains:
- RAG (Retrieval-Augmented Generation) service for knowledge base
- People recommendations engine
"""

from app.ai.rag_service import rag_service, RAGService

__all__ = ["rag_service", "RAGService"]
