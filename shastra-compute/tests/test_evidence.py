import unittest
from datetime import date, time
from unittest.mock import patch
from fastapi.testclient import TestClient
from src.config import settings
from src.core.calculator import ChartCalculator
from src.local_app import app
from src.api.v1.evidence import ENGINES, ENGINE_REVISION


class EvidenceContractTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.chart = ChartCalculator().compute_chart(date(2000, 1, 1), time(12), 28.61, 77.21, "Asia/Kolkata", "exact")
        self.payload = {"chart": self.chart.model_dump(mode="json"), "query": "What career patterns can I reflect on?", "domain": "career"}

    def post(self, payload):
        with patch.object(settings, "api_key", "synthetic-test-key"):
            return self.client.post("/v1/evidence/extract", json=payload, headers={"X-API-Key": "synthetic-test-key"})

    def test_all_methods_preserve_raw_engine_output_and_traceable_ids(self):
        for method, engine in ENGINES.items():
            with self.subTest(method=method):
                result = self.post({**self.payload, "method": method})
                self.assertEqual(result.status_code, 200)
                value = result.json()
                self.assertEqual(value["evidence"], engine.extract_evidence(self.chart, "career", self.payload["query"]).model_dump(mode="json"))
                self.assertEqual(value["engine_revision"], ENGINE_REVISION)
                self.assertTrue(value["items"])
                self.assertEqual(value, self.post({**self.payload, "method": method}).json())
                self.assertTrue(all(item["id"].startswith("E-") for item in value["items"]))

    def test_auth_and_invalid_inputs(self):
        self.assertEqual(self.client.post("/v1/evidence/extract", json=self.payload).status_code, 422)
        with patch.object(settings, "api_key", "synthetic-test-key"):
            self.assertEqual(self.client.post("/v1/evidence/extract", json=self.payload, headers={"X-API-Key": "wrong"}).status_code, 401)
        for extra in ({"method": "shell"}, {"domain": "execute"}, {"owner": "other"}, {"query": " "}, {"chart": {}}, {"chart": {**self.payload["chart"], "houses_whole_sign": []}}):
            self.assertEqual(self.post({**self.payload, **extra}).status_code, 422)

    def test_uncertainty_and_historical_timing_are_explicit(self):
        self.payload["chart"]["birth_time_quality"] = "unknown"
        result = self.post(self.payload).json()
        limitations = " ".join(result["limitations"])
        self.assertIn("noon placeholder", limitations)
        self.assertIn("period at birth", limitations)
        self.assertIn("computation weekday", limitations)


if __name__ == "__main__":
    unittest.main()
