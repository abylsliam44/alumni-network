from celery import Celery

from app.core.config import settings

celery_app = Celery(
    "alumni",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=[
        "app.tasks.resume",
        "app.tasks.opportunities",
        "app.tasks.recommendations",
    ],
)

celery_app.conf.update(
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    task_track_started=True,
    task_time_limit=900,
    task_soft_time_limit=840,
    broker_connection_retry_on_startup=True,
    worker_prefetch_multiplier=1,
    result_expires=3600,
    timezone="UTC",
    beat_schedule={
        "dispatch-queued-resume-jobs": {
            "task": "app.tasks.resume.dispatch_queued_resume_jobs",
            "schedule": 30.0,
            "options": {"queue": "resumes"},
        },
    },
    task_routes={
        "app.tasks.resume.*": {"queue": "resumes"},
        "app.tasks.opportunities.*": {"queue": "opportunities"},
        "app.tasks.recommendations.*": {"queue": "recommendations"},
    },
)
