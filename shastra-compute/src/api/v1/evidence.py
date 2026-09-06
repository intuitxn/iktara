"""Product adapter for the preserved engines; adapted from engine-sharing.

No model inference or engine-rule changes happen at this boundary.
"""
import hashlib
import json
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, ConfigDict
from src.auth import ApiKeyAuth
from src.core.models.chart import CanonicalChart
from src.engines.vedic import VedicEngine
from src.engines.kp import KPEngine
from src.engines.western import WesternEngine
from src.engines.compare import CompareEngine

router = APIRouter(prefix="/v1/evidence", tags=["evidence"])
ENGINE_REVISION = "8485494f5cbfdd40b5dca578bfc2498974d7e118"
ENGINES = {"vedic": VedicEngine(), "kp": KPEngine(), "western": WesternEngine(), "compare": CompareEngine()}


class EvidenceRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    chart: CanonicalChart
    query: str = Field(min_length=1, max_length=4000)
    method: Literal["vedic", "kp", "western", "compare"] = "compare"
    domain: Literal["career", "relationships", "marriage", "family", "money", "health", "purpose", "personality", "education", "spirituality", "timing", "compatibility", "general"] = "general"


def digest(value: object) -> str:
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()).hexdigest()


@router.post("/extract")
async def extract(req: EvidenceRequest, _auth: ApiKeyAuth) -> dict:
    # CanonicalChart permits empty arrays; the original Vedic engine requires
    # twelve cusps. Reject incomplete snapshots before invoking preserved code.
    if (len(req.chart.houses_whole_sign) != 12 or len(req.chart.houses_placidus) != 12
            or not req.chart.sidereal_planets or not req.chart.tropical_planets
            or not req.query.strip()):
        raise HTTPException(422, "A complete computed chart and question are required.")
    raw = ENGINES[req.method].extract_evidence(req.chart, req.domain, req.query).model_dump(mode="json")
    chart_digest = digest(req.chart.model_dump(mode="json"))
    items = []
    systems = {key: raw[key] for key in ("vedic", "kp", "western")} if req.method == "compare" else {req.method: raw}
    if req.method == "compare":
        systems["compare"] = {key: value for key, value in raw.items() if key not in systems}
    for system, fields in systems.items():
        for kind, value in fields.items():
            if value is None or value == []:
                continue
            for detail in value if isinstance(value, list) else [value]:
                item_id = "E-" + digest([ENGINE_REVISION, chart_digest, req.domain, system, kind, detail])[:16]
                items.append({"id": item_id, "system": system, "kind": kind, "detail": detail})
    limitations = [
        "Astrology is a symbolic interpretive framework, not scientifically established prediction. Engine confidence scores are heuristics, not probabilities.",
        "No current transits are computed. Dasha evidence describes the period at birth, not the present day; do not infer upcoming events.",
        "The preserved KP day-lord rule uses the chart computation weekday, not the birth weekday. It is not reliable birth-day evidence.",
        "Some topics fall back to an engine's general house selection; Compare does not prove agreement or predictive accuracy.",
    ]
    if req.chart.birth_time_quality != "exact":
        limitations.append("Birth time is uncertain. House, ascendant, yoga and timing details may be unreliable; unknown time uses a noon placeholder. Do not assert these as personal facts.")
    result = {
        "schema_version": "iktara-evidence-v1", "engine_revision": ENGINE_REVISION,
        "method": req.method, "domain": req.domain,
        "birth_time_quality": req.chart.birth_time_quality,
        "chart_digest": chart_digest, "chart_snapshot": req.chart.model_dump(mode="json"),
        "items": items, "evidence": raw, "limitations": limitations,
    }
    return {"id": "reading-" + digest(result), **result}
