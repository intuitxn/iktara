"""Product location selection; calculation stays in the preserved engine."""
import os
import asyncio
import time
from datetime import date
from typing import Literal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import httpx
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field, field_validator
from src.auth import ApiKeyAuth
from src.api.schemas.chart import ChartRequest, ChartResponse
from src.api.v1.chart import _chart_calculator, _geocoding_service

router = APIRouter()
_lock = asyncio.Lock()
_last_lookup = 0.0
_cache: dict[str, list[dict]] = {}

class BirthLocation(BaseModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    timezone: str = Field(max_length=80)
    display_name: str = Field(min_length=1, max_length=500)

    @field_validator("timezone")
    @classmethod
    def valid_timezone(cls, value):
        try:
            ZoneInfo(value)
        except (ZoneInfoNotFoundError, ValueError):
            raise ValueError("Choose a valid timezone")
        return value

class LocalChartRequest(ChartRequest):
    location: BirthLocation | None = None
    birth_time_quality: Literal["exact", "approximate", "unknown"] = "exact"

async def lookup_places(query: str) -> list[dict]:
    global _last_lookup
    key = query.strip().lower()
    async with _lock:
        if key in _cache:
            return _cache[key]
        await asyncio.sleep(max(0, 1.05 - (time.monotonic() - _last_lookup)))
        _last_lookup = time.monotonic()
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(os.environ.get("IKTARA_GEOCODING_URL", "https://nominatim.openstreetmap.org/search"), params={"q": query, "format": "json", "limit": 5}, headers={"User-Agent": "Iktara/1.0 (https://forsee.life)"}, timeout=12)
                response.raise_for_status()
                results = response.json()
        except (httpx.HTTPError, ValueError):
            raise HTTPException(503, detail={"code": "PLACE_LOOKUP_UNAVAILABLE"})
        places = []
        for item in results:
            lat, lon = float(item["lat"]), float(item["lon"])
            timezone = _geocoding_service.tf.timezone_at(lat=lat, lng=lon)
            if timezone:
                places.append(BirthLocation(latitude=lat, longitude=lon, timezone=timezone, display_name=item["display_name"]).model_dump())
        if len(_cache) >= 256:
            _cache.pop(next(iter(_cache)))
        _cache[key] = places
        return places

@router.get("/v1/places/search")
async def search_places(_auth: ApiKeyAuth, q: str = Query(min_length=2, max_length=200)):
    return {"places": await lookup_places(q)}

@router.post("/v1/chart/compute", response_model=ChartResponse)
async def compute_chart(req: LocalChartRequest, _auth: ApiKeyAuth):
    if req.date_of_birth > date.today() or (req.birth_time_quality != "unknown" and req.time_of_birth is None):
        raise HTTPException(400, detail={"code": "INVALID_BIRTH_DETAILS"})
    location = req.location
    if location is None:
        places = await lookup_places(req.birthplace)
        if not places:
            raise HTTPException(400, detail={"code": "PLACE_NOT_FOUND"})
        location = BirthLocation(**places[0])
    try:
        chart = _chart_calculator.compute_chart(date_of_birth=req.date_of_birth, time_of_birth=None if req.birth_time_quality == "unknown" else req.time_of_birth, latitude=location.latitude, longitude=location.longitude, timezone_str=location.timezone, birth_time_quality=req.birth_time_quality)
    except (ValueError, OverflowError):
        raise HTTPException(400, detail={"code": "INVALID_BIRTH_DETAILS"})
    return ChartResponse(chart=chart.model_dump(mode="json"), **location.model_dump())
