"""Local chart and original-engine evidence service; no model inference."""

from fastapi import FastAPI
from src.api.v1.chart import router
from src.api.v1.evidence import router as evidence_router

app = FastAPI(title="Iktara chart service", version="0.1.0")
app.include_router(router)
app.include_router(evidence_router)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "iktara-chart"}
