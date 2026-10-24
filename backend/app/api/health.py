from datetime import datetime, timezone
import httpx
from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db

router = APIRouter(tags=["System Health"])


@router.get("/")
def root():
    return {
        "status": "online",
        "service": "ProjectPilot AI API",
        "health_endpoint": "/api/health",
        "docs_endpoint": "/docs",
    }


@router.get("/api/health")
def check_health(db: Session = Depends(get_db)):
    db_ok = False
    try:
        db.execute(text("SELECT 1"))
        db_ok = True
    except Exception:
        db_ok = False

    return {
        "status": "healthy" if db_ok else "degraded",
        "database": "connected" if db_ok else "error",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "service": "projectpilot-ai-backend",
    }


@router.get("/api/health/ai")
async def check_ai_health():
    settings = get_settings()
    base_url = settings.ollama_base_url.rstrip("/")
    configured_model = settings.ollama_model
    available_models: list[str] = []
    ollama_reachable = False
    model_ready = False
    active_model = configured_model
    error_detail = None

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{base_url}/api/tags")
            if resp.status_code == 200:
                ollama_reachable = True
                data = resp.json()
                models = data.get("models", [])
                available_models = [m.get("name", "") for m in models if isinstance(m, dict) and m.get("name")]
                model_ready = any(
                    m == configured_model or m.startswith(f"{configured_model}:")
                    for m in available_models
                )
                # If configured model is not found but another local model is installed, auto-select it
                if not model_ready and available_models:
                    active_model = available_models[0]
                    model_ready = True
            else:
                error_detail = f"Ollama returned HTTP {resp.status_code}"
    except Exception as exc:
        error_detail = f"Local Ollama service unreachable at {base_url}: {str(exc)}"

    return {
        "status": "available" if (ollama_reachable and model_ready) else ("model_missing" if ollama_reachable else "unavailable"),
        "ollama_reachable": ollama_reachable,
        "model_ready": model_ready,
        "configured_model": active_model,
        "ollama_base_url": base_url,
        "available_models": available_models,
        "fallback_mode": "deterministic_rules_active",
        "error": error_detail,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
