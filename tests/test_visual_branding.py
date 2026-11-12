"""LambdaMorph visual assets: HTML/static wiring only; not measurement validation."""
import unittest
from app import app

class LambdaMorphVisualBrandTests(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    def test_header_keeps_accessible_name(self):
        html = self.client.get('/').get_data(as_text=True)
        self.assertIn('logo-lambdamorph', html)
        self.assertIn('LambdaMorph', html)
        self.assertIn('/static/img/lambdamorph/mark.png', html)
        self.assertIn('id="themeToggle"', html)
        self.assertIn('id="languageToggle"', html)

    def test_favicons_are_reachable(self):
        for path in ('/static/img/lambdamorph/favicon-32.png',
                     '/static/img/lambdamorph/favicon-48.png',
                     '/static/img/lambdamorph/favicon-180.png'):
            with self.subTest(path=path):
                response = self.client.get(path)
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.mimetype, 'image/png')

    def test_brand_css_reachable(self):
        response = self.client.get('/static/css/brand-v24.css')
        self.assertEqual(response.status_code, 200)
        self.assertIn(b'.logo-lambdamorph', response.data)
