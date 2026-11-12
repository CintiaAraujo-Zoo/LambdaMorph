"""Branding checks; they do not validate numerical measurements."""
import unittest
from pathlib import Path
from app import app

ROOT = Path(__file__).resolve().parents[1]

class LambdaMorphBrandTests(unittest.TestCase):
    def test_homepage_brand_and_repo_link(self):
        with app.test_client() as client:
            resp = client.get('/')
            self.assertEqual(resp.status_code, 200)
            page = resp.get_data(as_text=True)
            self.assertIn('LambdaMorph 2.4', page)
            self.assertIn('LAMBDA / UESPI', page)
            self.assertIn('github.com/CintiaAraujo-Zoo/LambdaMorph', page)
            self.assertNotIn('github.com/CintiaAraujo-Zoo/EchoMetrics', page)

    def test_readme_and_measurement_backend_unchanged(self):
        readme = (ROOT / 'README.md').read_text(encoding='utf-8')
        self.assertIn('# LambdaMorph', readme)
        self.assertIn('formerly **EchoMetrics**', readme)
        backend = (ROOT / 'app.py').read_text(encoding='utf-8')
        self.assertIn('def calculate():', backend)
        self.assertIn('def download_excel():', backend)
