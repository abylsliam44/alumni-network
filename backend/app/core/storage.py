import os
import uuid
import shutil
from fastapi import UploadFile
from pathlib import Path

UPLOAD_DIR = Path("/app/uploads")
STATIC_URL_PREFIX = "/static/uploads"

def init_storage():
    if not UPLOAD_DIR.exists():
        UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

async def save_upload_file(file: UploadFile, sub_dir: str = "misc") -> str:
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
