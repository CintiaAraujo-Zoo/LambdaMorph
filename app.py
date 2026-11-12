"""
EchoMetrics — Carcass Ultrasound Analyzer
Flask backend — stateless design (no files persisted on server).

Images are processed in memory and discarded immediately.
Excel files are generated on-demand and streamed directly to the browser.

Run locally:
    python app.py

Deploy (Render / production):
    gunicorn app:app --bind 0.0.0.0:10000
"""

import io
import os
import uuid
import math
import time
import threading

import cv2
import numpy as np
import openpyxl
from flask import Flask, Response, jsonify, render_template, request, url_for
from werkzeug.utils import secure_filename

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "bmp"}
MAX_UPLOAD_MB = 20

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = MAX_UPLOAD_MB * 1024 * 1024
app.config["DEBUG"] = os.environ.get("FLASK_DEBUG", "false").lower() == "true"

# Transient image cache: token -> (bytes, last_access_monotonic).
# Automatic cleanup avoids unbounded RAM use if a browser disconnects.
IMAGE_TTL_SECONDS = 30 * 60
MAX_IMAGE_CACHE_BYTES = 80 * 1024 * 1024
_image_store: dict[str, tuple[bytes, float]] = {}
_image_lock = threading.Lock()


def _cleanup_image_store(now: float) -> None:
    """Call with _image_lock held."""
    expired = [key for key, (_, ts) in _image_store.items()
               if now - ts > IMAGE_TTL_SECONDS]
    for key in expired:
        del _image_store[key]


def _finite_point(obj: dict) -> tuple[float, float]:
    if not isinstance(obj, dict):
        raise ValueError('A coordinate must be an object')
    x, y = float(obj['x']), float(obj['y'])
    if not (math.isfinite(x) and math.isfinite(y)):
        raise ValueError('Coordinates must be finite')
    if abs(x) > 1_000_000 or abs(y) > 1_000_000:
        raise ValueError('Coordinates exceed the supported range')
    return x, y


def _two_points(data: dict, key: str) -> tuple[tuple[float, float], tuple[float, float]]:
    points = data[key]
    if not isinstance(points, list) or len(points) != 2:
        raise ValueError(f'{key} needs two points')
    return _finite_point(points[0]), _finite_point(points[1])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def safe_batch_code(raw: str) -> str:
    cleaned = "".join(c for c in str(raw) if c.isalnum() or c == "_")
    return cleaned[:32] or "BATCH"


# ---------------------------------------------------------------------------
# Pages
# ---------------------------------------------------------------------------
@app.route("/")
def index():
    return render_template("index.html")


# ---------------------------------------------------------------------------
# API — image upload & serve
# ---------------------------------------------------------------------------
@app.route("/upload", methods=["POST"])
def upload_file():
    """
    Receives an image, stores it in memory with a random token,
    and returns a URL the canvas can use to display it.
    Nothing is written to disk.
    """
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    if not file or file.filename == "":
        return jsonify({"error": "No file selected"}), 400

    if not allowed_file(file.filename):
        return jsonify({"error": "File type not allowed"}), 400

    raw = file.read()
    if not raw:
        return jsonify({"error": "Empty image"}), 400
    # Validate decoding (reject mismatched extensions / corrupt content).
    extension = file.filename.rsplit('.', 1)[-1].lower()
    if extension == 'gif':
        if len(raw) < 10 or raw[:6] not in (b'GIF87a', b'GIF89a'):
            return jsonify({"error": "Invalid GIF image"}), 400
        width = int.from_bytes(raw[6:8], 'little')
        height = int.from_bytes(raw[8:10], 'little')
    else:
        decoded = cv2.imdecode(np.frombuffer(raw, dtype=np.uint8), cv2.IMREAD_UNCHANGED)
        if decoded is None or decoded.ndim < 2:
            return jsonify({"error": "Invalid or unsupported image"}), 400
        height, width = decoded.shape[:2]
    if width <= 0 or height <= 0 or width * height > 12_000_000:
        return jsonify({"error": "Image dimensions invalid or too large"}), 400

    token = uuid.uuid4().hex
    with _image_lock:
        now = time.monotonic()
        _cleanup_image_store(now)
        used = sum(len(item[0]) for item in _image_store.values())
        if used + len(raw) > MAX_IMAGE_CACHE_BYTES:
            return jsonify({"error": "Temporary image memory full; finish the current analysis and retry"}), 503
        _image_store[token] = (raw, now)

    return jsonify({
        "token": token,
        "url": url_for("serve_image", token=token),
    })


@app.route("/image/<token>")
def serve_image(token: str):
    """Serves a previously uploaded image from the in-memory store."""
    with _image_lock:
        now = time.monotonic()
        _cleanup_image_store(now)
        item = _image_store.get(token)
        if item is not None:
            _image_store[token] = (item[0], now)
    if item is None:
        return "Not found", 404
    data = item[0]
    mime = "image/jpeg"
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        mime = "image/png"
    elif data[:4] == b"GIF8":
        mime = "image/gif"
    elif data[:2] == b"BM":
        mime = "image/bmp"
    return Response(data, mimetype=mime)


@app.route("/discard/<token>", methods=["POST"])
def discard_image(token: str):
    """Frees an image from memory once analysis is complete."""
    with _image_lock:
        _image_store.pop(token, None)
    return jsonify({"ok": True})


# ---------------------------------------------------------------------------
# API — calculate
# ---------------------------------------------------------------------------
@app.route("/calculate", methods=["POST"])
def calculate():
    """
    Receives calibration points, AOL polygon, and fat measurement points.
    Returns AOL (cm²), EGS (cm), and calibration factor (px/cm).
    """
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Invalid JSON payload"}), 400

    try:
        p1s, p2s = _two_points(data, "scalePoints")
        dist_px = math.dist(p1s, p2s)
        if dist_px < 1:
            return jsonify({"error": "Calibration points are too close together"}), 400

        scale_cm = float(data.get("scaleLengthCm", 1.0))
        if not math.isfinite(scale_cm) or scale_cm <= 0 or scale_cm > 1000:
            return jsonify({"error": "Calibration length must be a positive finite number"}), 400
        pixels_per_cm = dist_px / scale_cm

        points = data["aolPoints"]
        if not isinstance(points, list) or len(points) < 3 or len(points) > 20_000:
            return jsonify({"error": "AOL contour needs between 3 and 20000 points"}), 400
        # float32 preserves subpixel coordinates (int32 truncated them).
        aol_pts = np.asarray([_finite_point(p) for p in points], dtype=np.float32)
        area_px = float(cv2.contourArea(aol_pts))
        if not math.isfinite(area_px) or area_px <= 0:
            return jsonify({"error": "AOL contour is degenerate"}), 400
        aol_cm2 = area_px / (pixels_per_cm ** 2)

        # Same vertices define both displayed closed polygon and calculation.
        perimeter_px = float(cv2.arcLength(aol_pts, True))
        perimeter_cm = perimeter_px / pixels_per_cm
        lines = data.get("fatMeasurements")
        if lines is None:
            lines = [data["fatPoints"]]   # compatibility with 2.1 clients
        if not isinstance(lines, list) or not 1 <= len(lines) <= 3:
            raise ValueError("fatMeasurements must contain 1 to 3 lines")
        fat_values = []
        for i, line in enumerate(lines):
            if not isinstance(line, list) or len(line) != 2:
                raise ValueError(f"EGS line {i+1} needs exactly two points")
            p1, p2 = _finite_point(line[0]), _finite_point(line[1])
            distance = math.dist(p1, p2) / pixels_per_cm
            if distance < 1e-7:
                raise ValueError(f"EGS line {i+1} is too short")
            fat_values.append(distance)
        fat_cm = sum(fat_values) / len(fat_values)
        # Sample SD, defined only when n > 1; n=1 returns 0 for display/export.
        fat_sd_cm = (sum((v-fat_cm)**2 for v in fat_values) / (len(fat_values)-1))**0.5 if len(fat_values) > 1 else 0.0
        depth = data.get("depthPoints")
        depth_cm = None
        if depth is not None:
            if not isinstance(depth, list) or len(depth) != 2:
                raise ValueError("depthPoints must contain exactly two points")
            p1d, p2d = _finite_point(depth[0]), _finite_point(depth[1])
            depth_cm = math.dist(p1d, p2d) / pixels_per_cm
            if depth_cm < 1e-7:
                raise ValueError("Depth line is too short")
        if not all(math.isfinite(v) for v in (aol_cm2, perimeter_cm, fat_cm, fat_sd_cm)):
            raise ValueError("Non-finite result")

        return jsonify({
            "aol_cm2": round(aol_cm2, 3),
            "aol_perimeter_cm": round(perimeter_cm, 3),
            "muscle_depth_cm": round(depth_cm, 3) if depth_cm is not None else None,
            "fat_thickness_cm": round(fat_cm, 3),  # legacy output: EGS mean
            "fat_thickness_mm": round(fat_cm * 10, 3),
            "fat_measurements_cm": [round(v, 4) for v in fat_values],
            "fat_mean_cm": round(fat_cm, 4),
            "fat_sd_cm": round(fat_sd_cm, 4),
            "fat_samples_n": len(fat_values),
            "pixels_per_cm": round(pixels_per_cm, 3),
            "scale_length_cm": scale_cm,
        })

    except (KeyError, IndexError, TypeError, ValueError, OverflowError) as exc:
        return jsonify({"error": f"Invalid measurement data: {exc}"}), 400
    except Exception:
        app.logger.exception('Unexpected error during measurement')
        return jsonify({"error": "Unexpected calculation error"}), 500


# ---------------------------------------------------------------------------
# API — download Excel
# ---------------------------------------------------------------------------
@app.route("/download_excel", methods=["POST"])
def download_excel():
    """
    Receives all batch rows as JSON and returns a ready-to-download Excel file.
    Generated entirely in memory — nothing saved on the server.

    Expected body:
        {
            "batchCode": "LOTE01",
            "rows": [
                {"imageCode": "LOTE0101", "aol": 12.3, "egs": 0.4},
                ...
            ]
        }
    """
    data = request.get_json(silent=True)
    if not data or not data.get("rows"):
        return jsonify({"error": "No data to export"}), 400

    batch_code = safe_batch_code(data.get("batchCode", "BATCH"))

    try:
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Results"
        if not isinstance(data['rows'], list) or len(data['rows']) > 10000:
            return jsonify({"error": "Invalid row count for Excel export"}), 400
        def excel_text(value):
            text = str(value or '')[:255]
            return "'" + text if text.startswith(('=', '+', '-', '@')) else text

        def optional_number(value):
            if value is None or value == '':
                return None
            number = float(value)
            if not math.isfinite(number):
                raise ValueError('Non-finite optional Excel field')
            return number

        ws.append(["Animal ID", "Session ID", "Image", "Original filename", "AOL (cm²)", "EGS (cm)",
                   "EGS (mm)", "Calibration (px/cm)", "Scale length (cm)",
                   "Species", "Body condition score",
                   "AOL perimeter (cm)", "Muscle depth (cm)",
                   "EGS 1 (cm)", "EGS 2 (cm)", "EGS 3 (cm)",
                   "EGS SD (cm)", "EGS n"])
        for row in data["rows"]:
            aol = float(row["aol"])
            egs = float(row["egs"])
            if not (math.isfinite(aol) and math.isfinite(egs)):
                raise ValueError('Non-finite measurement in export')
            ws.append([
                excel_text(row.get("animalId", "")),
                excel_text(row.get("sessionId", "")),
                excel_text(row.get("imageCode", "")),
                excel_text(row.get("originalFilename", "")),
                aol,
                egs,
                round(egs * 10, 3),
                float(row.get("pixelsPerCm", 0)) or None,
                float(row.get("scaleLengthCm", 0)) or None,
                excel_text(row.get("species", "")),
                excel_text(row.get("bodyCondition", "")),
                optional_number(row.get("perimeterCm")),
                optional_number(row.get("muscleDepthCm")),
                *[optional_number((row.get("fatSamplesCm") or [])[i])
                  if i < len(row.get("fatSamplesCm") or []) else None
                  for i in range(3)],
                optional_number(row.get("fatSdCm")),
                optional_number(row.get("fatSamplesN")),
            ])
        ws.freeze_panes = 'A2'
        ws.auto_filter.ref = ws.dimensions
        for col, width in {'A': 22, 'B': 22, 'C': 20, 'D': 30, 'E': 16,
                           'F': 16, 'G': 16, 'H': 26, 'I': 22, 'J': 20, 'K': 24,
                           'L': 22, 'M': 22, 'N': 19, 'O': 19, 'P': 19,
                           'Q': 20, 'R': 13}.items():
            ws.column_dimensions[col].width = width

        buf = io.BytesIO()
        wb.save(buf)
        buf.seek(0)

        return Response(
            buf.getvalue(),
            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": f'attachment; filename="{batch_code}_results.xlsx"'
            },
        )

    except Exception as exc:
        return jsonify({"error": f"Excel generation error: {exc}"}), 500


# ---------------------------------------------------------------------------
# Error handlers
# ---------------------------------------------------------------------------
@app.errorhandler(413)
def file_too_large(e):
    return jsonify({"error": f"File exceeds the {MAX_UPLOAD_MB} MB limit"}), 413


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=app.config["DEBUG"])
