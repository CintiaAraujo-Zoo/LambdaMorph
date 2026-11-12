"""EchoMetrics 2.3: perimeter, independent EGS, manual muscle depth and export.
Runs with: python -m unittest discover -s tests -v
"""
import io
import math
import unittest
import openpyxl
from app import app


def point(x,y):
    return {'x':x,'y':y}


class MorphometryV23Tests(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()
        self.standard = {
            'scalePoints':[point(0,0),point(100,0)],
            'scaleLengthCm':1,
            'aolPoints':[point(0,0),point(100,0),point(100,50),point(0,50)],
            'fatMeasurements':[
                [point(0,0),point(10,0)],
                [point(0,10),point(20,10)],
                [point(0,20),point(30,20)],
            ],
            'depthPoints':[point(10,0),point(10,40)],
        }

    def test_three_fat_lines_perimeter_depth(self):
        r=self.client.post('/calculate',json=self.standard)
        self.assertEqual(r.status_code,200,r.get_data(as_text=True))
        obj=r.get_json()
        self.assertAlmostEqual(obj['aol_cm2'],0.5,places=3)
        self.assertAlmostEqual(obj['aol_perimeter_cm'],3.0,places=3)
        self.assertAlmostEqual(obj['muscle_depth_cm'],0.4,places=3)
        self.assertEqual(obj['fat_samples_n'],3)
        self.assertEqual(obj['fat_measurements_cm'],[0.1,0.2,0.3])
        self.assertAlmostEqual(obj['fat_mean_cm'],0.2,places=4)
        self.assertAlmostEqual(obj['fat_sd_cm'],0.1,places=4)
        self.assertAlmostEqual(obj['fat_thickness_cm'],0.2,places=3)

    def test_optional_depth_and_legacy_fat(self):
        payload={k:v for k,v in self.standard.items() if k not in ('depthPoints','fatMeasurements')}
        payload['fatPoints']=[point(0,0),point(10,0)]
        r=self.client.post('/calculate',json=payload)
        self.assertEqual(r.status_code,200,r.get_data(as_text=True))
        obj=r.get_json()
        self.assertIsNone(obj['muscle_depth_cm'])
        self.assertEqual(obj['fat_samples_n'],1)
        self.assertEqual(obj['fat_sd_cm'],0.0)

    def test_bad_egs_lines_rejected(self):
        for bad in ([],[[point(1,1)]],[[point(0,0),point(0,0)]],self.standard['fatMeasurements']*2):
            data={**self.standard, 'fatMeasurements':bad}
            r=self.client.post('/calculate',json=data)
            self.assertEqual(r.status_code,400,(bad,r.get_json()))

    def test_depth_one_point_rejected(self):
        r=self.client.post('/calculate',json={**self.standard,'depthPoints':[point(1,1)]})
        self.assertEqual(r.status_code,400)

    def test_export_contains_new_metrics_and_old_positions(self):
        r=self.client.post('/download_excel',json={'batchCode':'O1','rows':[{
            'imageCode':'OV001', 'animalId':'O01','sessionId':'D01','aol':0.5,
            'egs':0.2, 'pixelsPerCm':100, 'scaleLengthCm':1,
            'perimeterCm':3,'muscleDepthCm':0.4,
            'fatSamplesCm':[0.1,0.2,0.3], 'fatSdCm':0.1,'fatSamplesN':3
        }]})
        self.assertEqual(r.status_code,200)
        ws=openpyxl.load_workbook(io.BytesIO(r.data),data_only=True).active
        self.assertAlmostEqual(ws['E2'].value,0.5)
        self.assertAlmostEqual(ws['F2'].value,0.2)
        self.assertEqual(ws['L1'].value,'AOL perimeter (cm)')
        self.assertAlmostEqual(ws['L2'].value,3)
        self.assertAlmostEqual(ws['M2'].value,0.4)
        self.assertEqual([ws[f'{c}2'].value for c in 'NOP'],[0.1,0.2,0.3])
        self.assertAlmostEqual(ws['Q2'].value,0.1)
        self.assertEqual(ws['R2'].value,3)

    def test_page_has_new_inputs(self):
        resp=self.client.get('/')
        self.assertEqual(resp.status_code,200)
        html=resp.get_data(as_text=True)
        for token in ('id="fatMeasurementCount"','id="perimeterResult"',
                      'id="depthResult"','id="reviewFatSelect"',
                      'id="reviewEditDepth"','id="skipDepthButton"'):
            with self.subTest(token=token):self.assertIn(token,html)

if __name__ == '__main__':unittest.main()
