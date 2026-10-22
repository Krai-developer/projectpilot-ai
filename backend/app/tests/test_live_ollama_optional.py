import os
import pytest
from app.services.ollama_service import OllamaLocalService


@pytest.mark.skipif(
    os.getenv("RUN_LIVE_OLLAMA_TESTS") != "1",
    reason="Optional live local Ollama test skipped unless RUN_LIVE_OLLAMA_TESTS=1 is set.",
)
async def test_live_local_ollama_task_generation():
    service = OllamaLocalService()
    result, model_name = await service.generate_project_plan_suggestions(
        project_name="CLI Markdown Linter",
        project_description="A command-line tool in Python that checks markdown links and heading hierarchy.",
        project_objectives="Fast local CLI with zero external cloud dependencies and 90% pytest coverage.",
    )
    assert model_name
    assert len(result.requirements) > 0
    assert len(result.tasks) > 0
