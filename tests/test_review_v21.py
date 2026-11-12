"""Regression tests for EchoMetrics 2.1 review & research metadata.
Installed into project's tests/ by the installer.
"""
import io
import unittest

import openpyxl
from app import app


class EchoMetricsReviewV21Tests(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    def test_review_controls_in_page(self):
        resp = self.client.get('/')
        self.assertEqual(resp.status_code, 200)
        page = resp.get_data(as_text=True)
        for marker in ('id="animalSpecies"', 'id="bodyCondition"',
                       'id="reviewMeasurementsButton"', 'id="reviewToolbar"',
                       'id="reviewSave"', 'id="reviewCancel"'):
            with self.subTest(marker=marker):
                self.assertIn(marker, page)

    def test_species_and_body_condition_exported_without_moving_measurements(self):
        resp = self.client.post('/download_excel', json={
            'batchCode': 'OVINOS',
            'rows': [{
                'imageCode': 'OV001', 'animalId': 'O01', 'sessionId': 'D01',
                'originalFilename': 'scan1.jpg', 'aol': 5.467, 'egs': 0.031,
                'pixelsPerCm': 103.044, 'scaleLengthCm': 1,
                'species': 'Ovine', 'bodyCondition': '2/5',
            }],
        })
        self.assertEqual(resp.status_code, 200)
        ws = openpyxl.load_workbook(io.BytesIO(resp.data), data_only=True).active
        self.assertAlmostEqual(ws['E2'].value, 5.467)
        self.assertAlmostEqual(ws['F2'].value, 0.031)
        self.assertEqual(ws['J1'].value, 'Species')
        self.assertEqual(ws['J2'].value, 'Ovine')
        self.assertEqual(ws['K1'].value, 'Body condition score')
        self.assertEqual(ws['K2'].value, '2/5')


if __name__ == '__main__':
    unittest.main()
