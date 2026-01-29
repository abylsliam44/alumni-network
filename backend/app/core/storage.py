import logging
import os
import uuid
import shutil
import boto3
from botocore.client import Config
from botocore.exceptions import ClientError
from fastapi import UploadFile, HTTPException
from pathlib import Path
from app.core.config import settings

logger = logging.getLogger(__name__)

# Use the configured upload directory, converting to Path object
UPLOAD_DIR = Path(settings.UPLOAD_DIR).resolve()
STATIC_URL_PREFIX = "/static"

def init_storage():
    if not UPLOAD_DIR.exists():
        UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

async def save_upload_file(file: UploadFile, sub_dir: str = "misc") -> str:
    """
    Legacy local file save. Prefer direct uploads to MinIO for new features.
    """
    init_storage()
    
    # Create sub-directory if needed
    target_dir = UPLOAD_DIR / sub_dir
    if not target_dir.exists():
        target_dir.mkdir(parents=True, exist_ok=True)
        
    # Generate unique filename
    file_ext = os.path.splitext(file.filename)[1]
    unique_filename = f"{uuid.uuid4()}{file_ext}"
    file_path = target_dir / unique_filename
    
    # Save file
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    return f"{STATIC_URL_PREFIX}/{sub_dir}/{unique_filename}"

def get_s3_client():
    return boto3.client(
        "s3",
        endpoint_url=f"http://{settings.MINIO_ENDPOINT}" if not settings.MINIO_ENDPOINT.startswith("http") else settings.MINIO_ENDPOINT,
        aws_access_key_id=settings.MINIO_ACCESS_KEY,
        aws_secret_access_key=settings.MINIO_SECRET_KEY,
        config=Config(signature_version="s3v4"),
        region_name="us-east-1",  # MinIO default
    )

def generate_presigned_url(file_name: str, file_type: str, bucket: str = None) -> dict:
    """
    Generate a presigned URL for PUT object.
    Returns dictionary with 'url' and 'fields' (fields empty for PUT usually, or we use generate_presigned_post).
    Here using generate_presigned_url for PUT.
    """
    if not bucket:
        bucket = settings.MINIO_BUCKET

    s3_client = get_s3_client()
    
    # Ensure bucket exists
    try:
        s3_client.head_bucket(Bucket=bucket)
    except ClientError:
        try:
            s3_client.create_bucket(Bucket=bucket)
        except Exception as e:
            logger.error(f"Error creating bucket: {e}")

    object_name = f"resumes/{uuid.uuid4()}/{file_name}"
    
    try:
        url = s3_client.generate_presigned_url(
            "put_object",
            Params={
                "Bucket": bucket,
                "Key": object_name,
                "ContentType": file_type,
            },
            ExpiresIn=3600,
        )
        # Store the final URL where the file will be accessible (publicly or via signed GET)
        # For MinIO in Docker, the 'url' returned might be internal hostname (http://minio:9000...).
        # We might need to adjust it for frontend.
        # But for presigned PUT, the frontend needs to reach minio.
        # If frontend is browser, it needs localhost:9000.
        # Simple hack: replace 'minio' with 'localhost' if dev.
        # But assumes user has mapped ports.
        
        # User specified "Frontend uploads directly".
        
        final_url = f"{settings.MINIO_ENDPOINT}/{bucket}/{object_name}"
        if not final_url.startswith("http"):
             final_url = f"http://{final_url}"
             
        return {"upload_url": url, "file_url": final_url, "object_name": object_name}
    except Exception as e:
        logger.error(f"Error generating presigned URL: {e}")
        raise HTTPException(status_code=500, detail="Could not generate upload URL")
