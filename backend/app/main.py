"""Select application mode before importing infrastructure-specific modules."""
import os

if os.getenv('ACADEMIC_NOSQL_MODE', '').lower() == 'true':
    from app.academic.main import app
else:
    from app.main_normal import app
