"""EchoMetrics 2.4 UI wiring regression tests (not medical/measurement validation)."""
import unittest
from app import app


class EchoMetricsPreferencesTests(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    def test_theme_language_controls_and_assets(self):
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)
        html = response.get_data(as_text=True)
        for marker in ('id="themeToggle"', 'id="languageToggle"',
                       'theme-v24.css', 'preferences-v24.js', 'id="fatMeasurementCount"'):
            self.assertIn(marker, html)

    def test_theme_css_and_preferences_js_served(self):
        for path in ('/static/css/theme-v24.css', '/static/js/preferences-v24.js'):
            response = self.client.get(path)
            self.assertEqual(response.status_code, 200)
            self.assertGreater(len(response.data), 1000)
