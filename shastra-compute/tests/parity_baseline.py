"""Read-only regression checks against a separately executed upstream baseline.

Run: python -m unittest discover -s tests -p 'parity*.py' -v
Explicit baseline review: python tests/parity_baseline.py --record-upstream

Engine source and dependency versions are pinned byte-for-byte against the recorded
upstream baseline; only chart/evidence float values are compared with a small tolerance
(FLOAT_ABS_TOL/FLOAT_REL_TOL) because Moshier-mode Swiss Ephemeris results differ slightly
across CPU architectures (~1e-8..1e-7 degrees). Structure, keys, types, and non-float values
must still match exactly.
"""
from __future__ import annotations

import hashlib
import io
import json
import os
from datetime import datetime
from pathlib import Path
import subprocess
import sys
import tarfile
import tempfile
import unittest

PIN = "8485494f5cbfdd40b5dca578bfc2498974d7e118"
ROOT = Path(__file__).resolve().parents[2]
FIXTURE = Path(__file__).parent / "fixtures" / "upstream-8485494.json"
ENGINE_PATHS = ["shastra-compute/src/core", "shastra-compute/src/engines", "packages/astro-core", "packages/astro_core"]
CASES = [
    {"id": "delhi-exact-career", "date": "2000-01-01", "time": "12:00:00", "latitude": 28.61, "longitude": 77.21, "timezone": "Asia/Kolkata", "quality": "exact", "domain": "career", "query": "What can I reflect on about my career?"},
    {"id": "delhi-unknown-general", "date": "2000-01-01", "time": None, "latitude": 28.61, "longitude": 77.21, "timezone": "Asia/Kolkata", "quality": "unknown", "domain": "general", "query": "What patterns can I explore?"},
    {"id": "new-york-approximate-relationships", "date": "1995-07-15", "time": "08:30:00", "latitude": 40.7128, "longitude": -74.0060, "timezone": "America/New_York", "quality": "approximate", "domain": "relationships", "query": "What might I reflect on in relationships?"},
]


def run_worker(source: Path) -> dict:
    result = subprocess.run([sys.executable, str(Path(__file__).resolve()), "--worker", str(source)],
                            env={**os.environ, "PYTHONHASHSEED": "0"}, text=True, capture_output=True, check=True)
    return json.loads(result.stdout)


def worker(source: Path) -> dict:
    sys.path.insert(0, str(source / "shastra-compute"))
    from datetime import date, time, datetime, timezone
    from unittest.mock import patch
    import importlib.metadata
    import swisseph
    import pytz
    from src.core.calculator import ChartCalculator
    from src.engines.vedic import VedicEngine
    from src.engines.kp import KPEngine
    from src.engines.western import WesternEngine
    from src.engines.compare import CompareEngine

    class Clock(datetime):
        @classmethod
        def utcnow(cls):
            return cls(2026, 9, 6, 12, 0, 0)

    def compute(case):
        with patch("src.core.calculator.datetime", Clock):
            return ChartCalculator(ephe_path="/iktara-parity-no-external-ephemeris").compute_chart(
                date.fromisoformat(case["date"]), time.fromisoformat(case["time"]) if case["time"] else None,
                case["latitude"], case["longitude"], case["timezone"], case["quality"], "synthetic-fixture")

    def normal(value):
        if isinstance(value, float):
            return round(value, 8)
        if isinstance(value, dict):
            return {key: normal(item) for key, item in value.items()}
        if isinstance(value, list):
            return [normal(item) for item in value]
        if isinstance(value, str):
            try:
                instant = datetime.fromisoformat(value)
                if instant.tzinfo:
                    return instant.astimezone(timezone.utc).isoformat()
            except ValueError:
                pass
        return value

    engines = {"vedic": VedicEngine(), "kp": KPEngine(), "western": WesternEngine(), "compare": CompareEngine()}
    cases = []
    for case in CASES:
        chart = compute(case)
        cases.append({"input": case, "chart": normal(chart.model_dump(mode="json")),
                      "evidence": {name: normal(engine.extract_evidence(chart, case["domain"], case["query"]).model_dump(mode="json")) for name, engine in engines.items()}})
    utc_case = {**CASES[0], "timezone": "UTC", "time": "06:30:00"}
    utc_chart = compute(utc_case)
    unknown_noon = compute({**CASES[1], "time": "03:17:00"})
    errors = {}
    for name, changes in {"invalid_timezone": {"timezone": "Invalid/Nowhere"}, "invalid_quality": {"quality": "certain"}, "invalid_date": {"date": "2000-02-31"}, "invalid_time": {"time": "25:00:00"}}.items():
        try:
            compute({**CASES[0], **changes})
        except (ValueError, pytz.UnknownTimeZoneError) as exc:
            errors[name] = type(exc).__name__
        else:
            errors[name] = "NOT_REJECTED"
    return {"environment": {"python": ".".join(map(str, sys.version_info[:2])), "pyswisseph": importlib.metadata.version("pyswisseph"), "swisseph": swisseph.version, "pytz": importlib.metadata.version("pytz"), "pydantic": importlib.metadata.version("pydantic"), "hash_seed": "0", "computed_at": "2026-09-06T12:00:00", "ephemeris": "no external files; Swiss Ephemeris fallback"},
            "cases": cases, "timezone_equivalent_chart": normal(utc_chart.model_dump(mode="json")),
            "timezone_equivalent_evidence": {name: normal(engine.extract_evidence(utc_chart, "career", CASES[0]["query"]).model_dump(mode="json")) for name, engine in engines.items()},
            "unknown_ignores_supplied_time": normal(unknown_noon.model_dump(mode="json")), "invalid_inputs": errors}


def record_upstream():
    """Explicit offline snapshot from git's immutable upstream object, never local engines."""
    resolved = subprocess.check_output(["git", "rev-parse", f"{PIN}^{{commit}}"], cwd=ROOT, text=True).strip()
    if resolved != PIN:
        raise RuntimeError("Pinned upstream commit unavailable")
    archive = subprocess.check_output(["git", "archive", PIN, *ENGINE_PATHS], cwd=ROOT)
    with tempfile.TemporaryDirectory(prefix="iktara-upstream-parity-") as temp:
        with tarfile.open(fileobj=io.BytesIO(archive)) as bundle:
            bundle.extractall(temp, filter="data")
        baseline = run_worker(Path(temp))
        paths = subprocess.check_output(["git", "ls-tree", "-r", "--name-only", PIN, *ENGINE_PATHS], cwd=ROOT, text=True).splitlines()
        hashes = {path: hashlib.sha256(subprocess.check_output(["git", "show", f"{PIN}:{path}"], cwd=ROOT)).hexdigest() for path in paths}
    FIXTURE.parent.mkdir(parents=True, exist_ok=True)
    FIXTURE.write_text(json.dumps({"upstream": "https://github.com/Om2524/astropersonalised", "commit": PIN, "source_sha256": hashes, **baseline}, indent=2, sort_keys=True) + "\n")
    print(f"Recorded explicit upstream baseline: {FIXTURE}")


FLOAT_ABS_TOL = 1e-6  # degrees; platform float noise in Moshier-mode charts is ~1e-8..1e-7
FLOAT_REL_TOL = 1e-9
TIME_ABS_TOL = 1.0  # seconds; dasha period timestamps inherit the same platform float noise


def approx_diff(actual, expected, path="$", diffs=None):
    """Compare nested chart/evidence payloads: floats within tolerance, everything else exact.

    The pinned upstream baseline is recorded from byte-identical engine source with identical
    pinned dependency versions, but Swiss Ephemeris Moshier-mode results differ slightly by CPU
    architecture (libm/compiler), typically ~1e-8..1e-7 degrees. Structural differences (keys,
    types, list lengths, non-float values) still fail exactly.
    """
    if diffs is None:
        diffs = []
    if isinstance(actual, float) and isinstance(expected, float):
        scale = max(abs(actual), abs(expected), 1.0)
        delta = abs(actual - expected)
        if delta > max(FLOAT_ABS_TOL, FLOAT_REL_TOL * scale):
            diffs.append((path, actual, expected, delta))
        return diffs
    if type(actual) is not type(expected):
        diffs.append((path, actual, expected, None))
        return diffs
    if isinstance(expected, dict):
        if set(actual) != set(expected):
            diffs.append((path, sorted(actual), sorted(expected), None))
            return diffs
        for key in expected:
            approx_diff(actual[key], expected[key], f"{path}.{key}", diffs)
    elif isinstance(expected, list):
        if len(actual) != len(expected):
            diffs.append((path, f"length {len(actual)}", f"length {len(expected)}", None))
            return diffs
        for index, (item_a, item_e) in enumerate(zip(actual, expected)):
            approx_diff(item_a, item_e, f"{path}[{index}]", diffs)
    elif isinstance(expected, str):
        # Dasha period timestamps inherit platform float noise (~microseconds);
        # compare ISO datetimes within TIME_ABS_TOL, other strings exactly.
        try:
            instant_a = datetime.fromisoformat(actual)
            instant_e = datetime.fromisoformat(expected)
        except (ValueError, TypeError):
            if actual != expected:
                diffs.append((path, actual, expected, None))
        else:
            if abs((instant_a - instant_e).total_seconds()) > TIME_ABS_TOL:
                diffs.append((path, actual, expected, None))
    elif actual != expected:
        diffs.append((path, actual, expected, None))
    return diffs


def fail_diff(diffs):
    float_diffs = [d for d in diffs if isinstance(d[3], float)]
    maximum = max((d[3] for d in float_diffs), default=0)
    message = [f"{len(diffs)} value(s) differ ({len(float_diffs)} float, max float delta {maximum:.3e}):"]
    for path, actual, expected, _delta in diffs[:12]:
        message.append(f"  {path}: {actual!r} != {expected!r}")
    if len(diffs) > 12:
        message.append(f"  ... {len(diffs) - 12} more")
    return "\n".join(message)


class OriginalEngineParity(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.expected = json.loads(FIXTURE.read_text())
        cls.actual = run_worker(ROOT)

    def test_pinned_source_bytes(self):
        self.assertEqual(self.expected["commit"], PIN)
        paths = subprocess.check_output(["git", "ls-files", "--cached", "--others", "--exclude-standard", "--", *ENGINE_PATHS], cwd=ROOT, text=True).splitlines()
        self.assertEqual(set(paths), set(self.expected["source_sha256"]), "Engine file additions/removals require a reviewed upstream baseline")
        for path, expected in self.expected["source_sha256"].items():
            with self.subTest(path=path):
                file = ROOT / path
                data = os.readlink(file).encode() if file.is_symlink() else file.read_bytes()
                self.assertEqual(hashlib.sha256(data).hexdigest(), expected)

    def test_dependency_versions(self):
        self.assertEqual(self.actual["environment"], self.expected["environment"])

    def test_full_charts_and_four_engine_outputs(self):
        for expected, actual in zip(self.expected["cases"], self.actual["cases"], strict=True):
            with self.subTest(case=expected["input"]["id"]):
                self.assertEqual(actual["input"], expected["input"])
                diffs = approx_diff(actual["chart"], expected["chart"], "chart")
                if diffs:
                    self.fail(fail_diff(diffs))
                for method in ("vedic", "kp", "western", "compare"):
                    with self.subTest(method=method):
                        diffs = approx_diff(actual["evidence"][method], expected["evidence"][method], f"evidence.{method}")
                        if diffs:
                            self.fail(fail_diff(diffs))

    def test_compare_contains_exact_component_evidence(self):
        for case in self.actual["cases"]:
            for method in ("vedic", "kp", "western"):
                self.assertEqual(case["evidence"]["compare"][method], case["evidence"][method])

    def test_timezone_equivalence(self):
        self.assertEqual(self.actual["timezone_equivalent_chart"], self.actual["cases"][0]["chart"])
        self.assertEqual(self.actual["timezone_equivalent_evidence"], self.actual["cases"][0]["evidence"])

    def test_unknown_time_noon_fallback_and_flags(self):
        case = self.actual["cases"][1]
        self.assertEqual(case["chart"], self.actual["unknown_ignores_supplied_time"])
        self.assertEqual(case["chart"]["confidence_metadata"]["houses"], "unreliable")
        for method in ("vedic", "kp", "western"):
            self.assertTrue(case["evidence"][method]["uncertainty_flags"])

    def test_invalid_inputs_rejected_like_upstream(self):
        self.assertEqual(self.actual["invalid_inputs"], self.expected["invalid_inputs"])
        self.assertNotIn("NOT_REJECTED", self.actual["invalid_inputs"].values())


if __name__ == "__main__":
    if sys.argv[1:] == ["--record-upstream"]:
        record_upstream()
    elif len(sys.argv) == 3 and sys.argv[1] == "--worker":
        print(json.dumps(worker(Path(sys.argv[2]))))
    else:
        unittest.main()
