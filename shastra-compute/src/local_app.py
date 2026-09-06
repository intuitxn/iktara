"""Local chart-only service. Model inference belongs to the Iktara agent server."""

from fastapi import FastAPI
from src.api.v1.chart import router

app = FastAPI(title="Iktara chart service", version="0.1.0")
app.include_router(router)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "iktara-chart"}
