<<<<<<< HEAD
from fastapi import APIRouter
from app.api.v1.endpoints import auth, profile, directory, mentorship, jobs, events, messages, ai, connections, recommendations, notifications, videocall, job_chat, resumes, opportunities, projects

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(profile.router, prefix="/profile", tags=["profile"])
api_router.include_router(directory.router, prefix="/directory", tags=["directory"])
api_router.include_router(mentorship.router, prefix="/mentorship", tags=["mentorship"])
api_router.include_router(jobs.router, prefix="/jobs", tags=["jobs"])
api_router.include_router(events.router, prefix="/events", tags=["events"])
api_router.include_router(messages.router, prefix="/messages", tags=["messages"])
api_router.include_router(ai.router, prefix="/ai", tags=["ai"])
api_router.include_router(connections.router, prefix="/connections", tags=["connections"])
api_router.include_router(recommendations.router, prefix="/recommendations", tags=["recommendations"])
api_router.include_router(opportunities.router, prefix="/opportunities", tags=["opportunities"])
api_router.include_router(projects.router, prefix="/projects", tags=["projects"])
api_router.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
api_router.include_router(videocall.router, prefix="/videocall", tags=["videocall"])
api_router.include_router(job_chat.router, prefix="/job-chat", tags=["job-chat"])
api_router.include_router(resumes.router, prefix="/resumes", tags=["resumes"])

=======
from fastapi import APIRouter
from app.api.v1.endpoints import auth, profile, directory, mentorship, jobs, events, messages, ai, connections, recommendations, notifications, videocall, job_chat, resumes, opportunities

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(profile.router, prefix="/profile", tags=["profile"])
api_router.include_router(directory.router, prefix="/directory", tags=["directory"])
api_router.include_router(mentorship.router, prefix="/mentorship", tags=["mentorship"])
api_router.include_router(jobs.router, prefix="/jobs", tags=["jobs"])
api_router.include_router(events.router, prefix="/events", tags=["events"])
api_router.include_router(messages.router, prefix="/messages", tags=["messages"])
api_router.include_router(ai.router, prefix="/ai", tags=["ai"])
api_router.include_router(connections.router, prefix="/connections", tags=["connections"])
api_router.include_router(recommendations.router, prefix="/recommendations", tags=["recommendations"])
api_router.include_router(opportunities.router, prefix="/opportunities", tags=["opportunities"])
api_router.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
api_router.include_router(videocall.router, prefix="/videocall", tags=["videocall"])
api_router.include_router(job_chat.router, prefix="/job-chat", tags=["job-chat"])
api_router.include_router(resumes.router, prefix="/resumes", tags=["resumes"])

>>>>>>> origin/main
