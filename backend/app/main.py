from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.ai_assessments import router as ai_assessments_router
from app.api.auth import router as auth_router
from app.api.health import router as health_router
from app.api.milestones import router as milestones_router
from app.api.projects import router as projects_router
from app.api.requirements import router as requirements_router
from app.api.tasks import router as tasks_router
from app.core.config import get_settings
from app.core.database import Base, engine
import app.models.entities  # noqa: F401

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="ProjectPilot AI API",
    description="Production-minded project tracking and local AI completion assessment API",
    version="1.0.0",
    lifespan=lifespan,
)

cors_origins = settings.cors_origin_list
allow_all = "*" in cors_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if allow_all else cors_origins,
    allow_origin_regex=".*" if allow_all else r"https://.*\.vercel\.app",
    allow_credentials=not allow_all,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(auth_router)
app.include_router(projects_router)
app.include_router(requirements_router)
app.include_router(milestones_router)
app.include_router(tasks_router)
app.include_router(ai_assessments_router)
