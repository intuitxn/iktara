import unittest
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient
from src.config import settings
from src.local_app import app
from src.api.v1.local_chart import BirthLocation

PLACE={"latitude":28.61,"longitude":77.21,"timezone":"Asia/Kolkata","display_name":"Synthetic Delhi"}
class LocalChartTests(unittest.TestCase):
    def setUp(self):
        self.client=TestClient(app)
        self.data={"date_of_birth":"2000-01-01","time_of_birth":"12:00","birthplace":"Synthetic Delhi","birth_time_quality":"exact","location":PLACE}
    def post(self,data):
        with patch.object(settings,"api_key","synthetic"):
            return self.client.post('/v1/chart/compute',json=data,headers={"X-API-Key":"synthetic"})
    def test_selected_place_computes_without_network(self):
        with patch('src.api.v1.local_chart.lookup_places',new_callable=AsyncMock) as lookup:
            result=self.post(self.data)
            self.assertEqual(result.status_code,200)
            self.assertEqual(result.json()['timezone'],'Asia/Kolkata')
            lookup.assert_not_called()
    def test_invalid_date_time_and_location(self):
        for part in ({"date_of_birth":"2000-02-30"},{"date_of_birth":"2999-01-01"},{"time_of_birth":None},{"location":{**PLACE,"timezone":"Invalid/Zone"}},{"location":{**PLACE,"latitude":999}}):
            self.assertIn(self.post({**self.data,**part}).status_code,[400,422])
    def test_place_not_found_is_specific(self):
        with patch('src.api.v1.local_chart.lookup_places',new_callable=AsyncMock,return_value=[]):
            r=self.post({**self.data,"location":None})
            self.assertEqual(r.status_code,400)
            self.assertEqual(r.json()['detail']['code'],'PLACE_NOT_FOUND')
    def test_unknown_time_uses_preserved_calculator_flags(self):
        r=self.post({**self.data,"time_of_birth":None,"birth_time_quality":"unknown"})
        self.assertEqual(r.status_code,200)
        self.assertEqual(r.json()['chart']['birth_time_quality'],'unknown')
