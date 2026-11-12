# EchoMetrics

**Interactive B-mode ultrasound measurements for livestock research**

EchoMetrics is an open-source web application for manually annotating B-mode ultrasound images and calculating the **longissimus dorsi cross-sectional area** (AOL/REA) and **subcutaneous fat thickness** (EGS/BFT). It is intended to support research workflows involving sheep, cattle, goats, and other livestock species.

The application runs in a web browser. Researchers can use the hosted version or run the Python/Flask application locally.

> **Research status:** Version 2.1 is under active development. Passing software tests does not establish anatomical accuracy, measurement repeatability, or agreement with reference methods. Measurements should be reviewed by a trained operator and validated for each intended research protocol.

## Try EchoMetrics

| Environment | Link | Notes |
| --- | --- | --- |
| Stable/original version (`main`) | [Open EchoMetrics](https://echometrics-m33u.onrender.com/) | Current production deployment |
| Development version (`develop-v2`) | [Open EchoMetrics 2.1](https://echometrics-v2-dev.onrender.com/) | Features undergoing user testing |
| Source code | [GitHub repository](https://github.com/CintiaAraujo-Zoo/EchoMetrics) | MIT licensed |

The development deployment uses Render's free service configuration and may take extra time to respond after a period of inactivity.

## Features in development version 2.1

- **Interactive annotation:** define an AOL contour and an EGS line by selecting and adjusting image points.
- **Flexible calibration:** specify the actual reference length in centimeters and mark its two endpoints on the image.
- **Review and edit:** reopen the most recent analysis, change scale/AOL/EGS points, cancel edits, or recalculate and save.
- **Individual and batch workflows:** analyze an image or accumulate measurements for an exportable batch.
- **Research metadata:** record animal ID, session ID, species, body condition score, original filename, and calibration information.
- **Exports:** download an annotated PNG and export batch results to an Excel workbook (`.xlsx`).
- **Browser-based interface:** guided measurement steps, zoom controls, and a responsive layout.

**Supported upload formats:** PNG, JPEG, BMP, and GIF; maximum file size: 20 MB. Animated GIFs and image formats should be tested before using them in a scientific dataset.

## Measurement workflow

1. **Import:** upload an ultrasound image and optionally enter the animal, session, species, and body condition information.
2. **Calibrate:** enter the known reference length (cm), then select its endpoints on the image scale. Confirm that the scale is valid for the image region being measured.
3. **Outline AOL:** trace the anatomical border of the *longissimus dorsi* muscle using adjustable points.
4. **Measure EGS:** select the two anatomical interfaces defining subcutaneous fat thickness for your protocol.
5. **Review:** inspect the annotated image and measurements; reopen and modify the annotations if necessary.
6. **Export:** save an annotated image and, in batch mode, download results and metadata in Excel format.

## How the measurements are calculated

For two calibration points separated by `d_scale_px` pixels and a known reference length `L_scale_cm`:

```text
pixels_per_cm = d_scale_px / L_scale_cm
AOL_cm2       = AOL_area_px2 / (pixels_per_cm ** 2)
EGS_cm        = d_fat_px / pixels_per_cm
EGS_mm        = EGS_cm * 10
```

AOL area is obtained from the annotated closed contour in image coordinates; EGS is the Euclidean distance between the selected fat-thickness endpoints. These formulas depend on **correct calibration and anatomical annotation**. The software does not currently perform automatic segmentation or determine whether a selected anatomical border is correct.

## Install locally

**Recommended environment:** Python 3.11.

```bash
git clone https://github.com/CintiaAraujo-Zoo/EchoMetrics.git
cd EchoMetrics
git switch develop-v2
python -m venv .venv
```

**Windows (PowerShell):**

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe app.py
```

**macOS/Linux:**

```bash
./.venv/bin/python -m pip install -r requirements.txt
./.venv/bin/python app.py
```

Open **http://127.0.0.1:5000** in your browser. To test the original released branch instead, switch to `main` before installation.

## Automated tests

From the project root, run:

```powershell
# Windows
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
```

```bash
# macOS / Linux
./.venv/bin/python -m unittest discover -s tests -v
```

The development branch includes tests for calculation input validation, calibration, file handling, Excel export, and the presence of review controls and research metadata. These are **software checks**, not an experimental validation study. Future validation should include intra-/inter-observer repeatability and comparison against a suitable reference method.

## Data handling and research limitations

- Uploaded images are temporarily held **in server memory** for processing and served using a generated token; the current application does not write them to permanent server storage. Tokens are discarded during normal workflows, and the backend includes cleanup logic.
- Batch results are held during the browser session and exported on demand. Do not use the application as your sole archive of raw images or completed measurements.
- Keep the **original image**, **annotation export**, **calibration reference**, **animal/session metadata**, and **analysis workbook** together in your research records.
- The tool does not replace operator training, anatomical quality control, or a formal method-validation study.
- Before uploading sensitive research images to any hosted service, ensure your data-sharing rules permit the upload. Running locally may be preferable for restricted datasets.

## Project structure

```text
EchoMetrics/
├── app.py                     # Flask routes, measurements, and export
├── requirements.txt           # Python dependencies
├── render.yaml                # Render deployment configuration
├── templates/
│   └── index.html             # Web interface
├── static/
│   ├── css/
│   │   ├── style.css
│   │   └── v2-ui.css
│   └── js/
│       ├── script.js
│       └── v2-ui.js
├── tests/                     # Automated checks (develop-v2)
├── LICENSE
└── README.md
```

## Roadmap

- Improve session persistence and resuming interrupted batch work.
- Add more comprehensive measurement traceability and export of annotation coordinates.
- Evaluate repeatability and agreement against expert/reference measurements.
- Explore assisted segmentation **only after** obtaining validated reference annotations.

Roadmap items are proposals, **not current features**.

## Citation

If using EchoMetrics in research, cite the software repository and identify the **version or commit** used for analysis. Until a versioned release or DOI is available, a suggested reference is:

> Araujo, C. M. (2026). *EchoMetrics: Interactive B-mode ultrasound measurements for livestock research* [Computer software]. GitHub. https://github.com/CintiaAraujo-Zoo/EchoMetrics

For reproducibility, also report the software version/commit, image acquisition protocol, calibration procedure, and annotation method in the manuscript.

## Author and license

**Cintia M. Araujo** — Universidade Estadual do Piauí (UESPI), Brazil.

Licensed under the [MIT License](LICENSE). Contributions and issue reports are welcome through the repository's GitHub interface.
