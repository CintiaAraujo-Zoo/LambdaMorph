"""Run from the updated EchoMetrics repository: python -m unittest discover -s tests -v"""
import io
import unittest

import cv2
import numpy as np
import openpyxl
from app import app


class EchoMetricsV2Tests(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    @staticmethod
    def payload(scale_cm=2):
        return {
            'scalePoints': [{'x': 0, 'y': 0}, {'x': 100, 'y': 0}],
            'scaleLengthCm': scale_cm,
            'aolPoints': [
                {'x': 0, 'y': 0}, {'x': 100, 'y': 0},
                {'x': 100, 'y': 100}, {'x': 0, 'y': 100}],
            'fatPoints': [{'x': 0, 'y': 0}, {'x': 0, 'y': 10}],
        }

    def test_calibration_units_and_area(self):
        response = self.client.post('/calculate', json=self.payload())
        self.assertEqual(response.status_code, 200, response.get_json())
        data = response.get_json()
        self.assertAlmostEqual(data['pixels_per_cm'], 50, places=3)
        self.assertAlmostEqual(data['aol_cm2'], 4.0, places=3)
        self.assertAlmostEqual(data['fat_thickness_cm'], 0.2, places=3)
        self.assertAlmostEqual(data['fat_thickness_mm'], 2.0, places=3)

    def test_invalid_scale_is_rejected(self):
        response = self.client.post('/calculate', json=self.payload(scale_cm=0))
        self.assertEqual(response.status_code, 400)

    def test_invalid_fat_points_are_rejected(self):
        payload = self.payload()
        payload['fatPoints'] = []
        response = self.client.post('/calculate', json=payload)
        self.assertEqual(response.status_code, 400)

    def test_invalid_aol_is_rejected(self):
        payload = self.payload()
        payload['aolPoints'] = [{'x': 0, 'y': 0}, {'x': 1, 'y': 0}]
        response = self.client.post('/calculate', json=payload)
        self.assertEqual(response.status_code, 400)

    def test_png_upload_serve_discard(self):
        image = np.zeros((20, 20, 3), dtype=np.uint8)
        success, encoded = cv2.imencode('.png', image)
        self.assertTrue(success)
        response = self.client.post('/upload', data={'file': (io.BytesIO(encoded.tobytes()), 'test.png')})
        self.assertEqual(response.status_code, 200, response.get_json())
        token = response.get_json()['token']
        served = self.client.get('/image/' + token)
        self.assertEqual(served.status_code, 200)
        self.assertEqual(served.content_type, 'image/png')
        self.assertEqual(self.client.post('/discard/' + token).status_code, 200)
        self.assertEqual(self.client.get('/image/' + token).status_code, 404)

    def test_excel_metadata(self):
        response = self.client.post('/download_excel', json={
            'batchCode': 'SESSION01',
            'rows': [{
                'animalId': 'sheep_01', 'sessionId': 'day_01',
                'imageCode': 'S0101', 'originalFilename': 'image_01.jpg',
                'aol': 4.0, 'egs': 0.2,
                'pixelsPerCm': 50, 'scaleLengthCm': 2,
            }],
        })
        self.assertEqual(response.status_code, 200, response.get_json() if response.is_json else 'Excel response')
        wb = openpyxl.load_workbook(io.BytesIO(response.data), data_only=True)
        ws = wb.active
        self.assertEqual(ws['A2'].value, 'sheep_01')
        self.assertEqual(ws['B2'].value, 'day_01')
        self.assertEqual(ws['D2'].value, 'image_01.jpg')
        self.assertAlmostEqual(ws['E2'].value, 4.0)
        self.assertAlmostEqual(ws['F2'].value, 0.2)


if __name__ == '__main__':
    unittest.main()
