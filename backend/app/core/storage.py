import logging
import os
import shutil
import uuid
import boto3
from urllib.parse import unquote, urlparse, urlunparse
from botocore.client import Config
from botocore.exceptions import ClientError
from fastapi import HTTPException, Request, UploadFile
from pathlib import Path
from app.core.config import settings
<<<<<<< HEAD

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
=======

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
>>>>>>> origin/main
        
    return f"{STATIC_URL_PREFIX}/{sub_dir}/{unique_filename}"


def upload_bytes(
    content: bytes,
    file_name: str,
    file_type: str,
    bucket: str = None,
    prefix: str = "uploads",
    public_endpoint: str | None = None,
) -> dict:
    if not bucket:
        bucket = settings.MINIO_BUCKET

    s3_client = get_s3_client()

    try:
        s3_client.head_bucket(Bucket=bucket)
    except ClientError:
        try:
            s3_client.create_bucket(Bucket=bucket)
        except Exception as e:
            logger.error(f"Error creating bucket: {e}")

    normalized_prefix = (prefix or "uploads").strip("/")
    object_name = f"{normalized_prefix}/{uuid.uuid4()}/{file_name}"

    try:
        s3_client.put_object(
            Bucket=bucket,
            Key=object_name,
            Body=content,
            ContentType=file_type,
        )

        public_endpoint = _public_storage_endpoint(public_endpoint)
        return {
            "file_url": f"{public_endpoint}/{bucket}/{object_name}",
            "object_name": object_name,
        }
    except Exception as e:
        logger.error(f"Error uploading object to storage: {e}")
        raise HTTPException(status_code=500, detail="Could not upload file")
<<<<<<< HEAD

=======

>>>>>>> origin/main
def get_s3_client(public: bool = False, public_endpoint: str | None = None):
    endpoint_url = (
        _public_storage_endpoint(public_endpoint)
        if public
        else _normalize_endpoint(settings.MINIO_ENDPOINT, settings.MINIO_SECURE)
    )
    return boto3.client(
        "s3",
        endpoint_url=endpoint_url,
        aws_access_key_id=settings.MINIO_ACCESS_KEY,
        aws_secret_access_key=settings.MINIO_SECRET_KEY,
        config=Config(signature_version="s3v4"),
        region_name="us-east-1",  # MinIO default
    )


def _normalize_endpoint(endpoint: str, secure: bool = False) -> str:
    if endpoint.startswith("http://") or endpoint.startswith("https://"):
        return endpoint.rstrip("/")
    scheme = "https" if secure else "http"
    return f"{scheme}://{endpoint.rstrip('/')}"


def _public_storage_endpoint(public_endpoint: str | None = None) -> str:
    public_endpoint = public_endpoint or settings.MINIO_PUBLIC_ENDPOINT or settings.MINIO_ENDPOINT
    return _normalize_endpoint(public_endpoint, settings.MINIO_SECURE)


def infer_public_storage_endpoint(request: Request) -> str:
    if settings.MINIO_PUBLIC_ENDPOINT:
        return _public_storage_endpoint()

    origin = (request.headers.get("origin") or "").strip()
    if origin:
        parsed = urlparse(origin)
        if parsed.scheme and parsed.netloc:
            return f"{parsed.scheme}://{parsed.netloc}/storage"

    referer = (request.headers.get("referer") or "").strip()
    if referer:
        parsed = urlparse(referer)
        if parsed.scheme and parsed.netloc:
            return f"{parsed.scheme}://{parsed.netloc}/storage"

    forwarded_host = (request.headers.get("x-forwarded-host") or request.headers.get("host") or "").strip()
    if forwarded_host:
        forwarded_proto = (request.headers.get("x-forwarded-proto") or request.url.scheme or "http").strip()
        return f"{forwarded_proto}://{forwarded_host}/storage"

    return _public_storage_endpoint()


def _rewrite_to_public_endpoint(url: str) -> str:
    public = urlparse(_public_storage_endpoint())
    parsed = urlparse(url)
    return urlunparse(parsed._replace(scheme=public.scheme, netloc=public.netloc))


def extract_object_name(file_url: str, bucket: str = None) -> str:
    if not file_url:
        raise HTTPException(status_code=404, detail="Attachment not found")

    bucket = bucket or settings.MINIO_BUCKET
    path = unquote(urlparse(file_url).path or "").lstrip("/")
    bucket_prefix = f"{bucket}/"
    bucket_start = path.find(bucket_prefix)
    if bucket_start == -1:
        raise HTTPException(status_code=400, detail="Invalid attachment path")
    return path[bucket_start + len(bucket_prefix):]


def generate_presigned_download_url(
    file_url: str,
    bucket: str = None,
    download_name: str | None = None,
    as_attachment: bool = False,
    public_endpoint: str | None = None,
) -> str:
    bucket = bucket or settings.MINIO_BUCKET
    object_name = extract_object_name(file_url, bucket=bucket)
    s3_client = get_s3_client(public=True, public_endpoint=public_endpoint)

    params = {
        "Bucket": bucket,
        "Key": object_name,
    }
    if as_attachment and download_name:
        params["ResponseContentDisposition"] = f'attachment; filename="{download_name}"'

    try:
        url = s3_client.generate_presigned_url(
            "get_object",
            Params=params,
            ExpiresIn=300,
        )
        return url
    except Exception as e:
        logger.error(f"Error generating download URL: {e}")
        raise HTTPException(status_code=500, detail="Could not generate download URL")


def get_object_stream(file_url: str, bucket: str = None) -> dict:
    bucket = bucket or settings.MINIO_BUCKET
    object_name = extract_object_name(file_url, bucket=bucket)
    s3_client = get_s3_client()

    try:
        response = s3_client.get_object(Bucket=bucket, Key=object_name)
        return {
            "body": response["Body"],
            "content_type": response.get("ContentType") or "application/octet-stream",
            "content_length": response.get("ContentLength"),
        }
    except Exception as e:
        logger.error(f"Error fetching object from storage: {e}")
        raise HTTPException(status_code=404, detail="Attachment file not found")

def generate_presigned_url(
    file_name: str,
    file_type: str,
    bucket: str = None,
    prefix: str = "resumes",
    public_endpoint: str | None = None,
) -> dict:
<<<<<<< HEAD
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

    normalized_prefix = (prefix or "uploads").strip("/")
    object_name = f"{normalized_prefix}/{uuid.uuid4()}/{file_name}"
    
    try:
=======
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

    normalized_prefix = (prefix or "uploads").strip("/")
    object_name = f"{normalized_prefix}/{uuid.uuid4()}/{file_name}"
    
    try:
>>>>>>> origin/main
        presign_client = get_s3_client(public=True, public_endpoint=public_endpoint)
        url = presign_client.generate_presigned_url(
            "put_object",
            Params={
                "Bucket": bucket,
                "Key": object_name,
                "ContentType": file_type,
            },
            ExpiresIn=300,
        )

        public_endpoint = _public_storage_endpoint(public_endpoint)
        final_url = f"{public_endpoint}/{bucket}/{object_name}"

        return {
            "upload_url": url,
            "file_url": final_url,
            "object_name": object_name,
        }
    except Exception as e:
        logger.error(f"Error generating presigned URL: {e}")
        raise HTTPException(status_code=500, detail="Could not generate upload URL")
