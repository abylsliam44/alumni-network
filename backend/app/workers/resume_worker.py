import asyncio
import logging
import os

from app.core.database import AsyncSessionLocal
from app.services.resume_processing import claim_next_resume_job, process_resume_job

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("resume-worker")

POLL_INTERVAL_SECONDS = float(os.getenv("RESUME_WORKER_POLL_INTERVAL_SECONDS", "3"))


async def worker_loop() -> None:
    logger.info("Resume worker started with poll interval %.1fs", POLL_INTERVAL_SECONDS)

    while True:
        processed = False
        async with AsyncSessionLocal() as db:
            job = await claim_next_resume_job(db)
            if job:
                processed = True
                logger.info("Processing resume job %s (%s)", job.id, job.job_type)
                await process_resume_job(db, job)

        if not processed:
            await asyncio.sleep(POLL_INTERVAL_SECONDS)


def main() -> None:
    asyncio.run(worker_loop())


if __name__ == "__main__":
    main()
