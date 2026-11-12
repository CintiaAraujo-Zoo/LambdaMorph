/* LambdaMorph 2.3 - repeat EGS / perimeter / muscle depth */
/* LambdaMorph 2.2 - ROI drawing tools */
/* LambdaMorph 2.1 - annotation review */
/**
 * LambdaMorph — client-side analysis logic
 *
 * Architecture: stateless backend.
 * - Uploaded images are stored in server memory with a token and discarded after use.
 * - Batch results accumulate in JS (batchRows array).
 * - Excel is generated server-side on demand and downloaded directly by the browser.
 *
 * Keyboard shortcuts (modal open):
 *   Escape     → close modal
 *   Backspace  → undo last point
 *   Enter      → confirm shape
 *
 * Right-click on canvas → undo last point
 */

document.addEventListener('DOMContentLoaded', () => {

    // -----------------------------------------------------------------------
    // DOM references
    // -----------------------------------------------------------------------
    const imageLoader         = document.getElementById('imageLoader');
    const resetButton         = document.getElementById('resetButton');
    const finalImageEl        = document.getElementById('finalImage');
    const instructionsEl      = document.getElementById('instructions');
    const aolResultEl         = document.getElementById('aolResult');
    const fatResultEl         = document.getElementById('fatResult');
    const calibrationResultEl = document.getElementById('calibrationResult');
    const modeRadios          = document.querySelectorAll('input[name="analysisMode"]');
    const batchControls       = document.getElementById('batch-controls');
    const startBatchButton    = document.getElementById('startBatchButton');
    const batchCodeInput      = document.getElementById('batchCode');
    const fileUploadArea      = document.getElementById('file-upload-area');
    const toastContainer      = document.getElementById('toast-container');
    const downloadExcelButton = document.getElementById('downloadExcelButton');
    const downloadAnnotatedButton = document.getElementById('downloadAnnotatedButton');
    const animalIdInput = document.getElementById('animalId');
    const sessionIdInput = document.getElementById('sessionId');
    const scaleLengthInput = document.getElementById('scaleLengthCm');
    const speciesInput = document.getElementById('animalSpecies');
    const bodyConditionInput = document.getElementById('bodyCondition');
    const measurementContext = document.getElementById('measurementContext');
    const reviewButton = document.getElementById('reviewMeasurementsButton');
    const reviewToolbar = document.getElementById('reviewToolbar');
    const reviewSave = document.getElementById('reviewSave');
    const reviewCancel = document.getElementById('reviewCancel');
    const fatCountInput = document.getElementById('fatMeasurementCount');
    const reviewFatSelect = document.getElementById('reviewFatSelect');
    const reviewEditDepth = document.getElementById('reviewEditDepth');
    const egsStepInfo = document.getElementById('egsStepInfo');
    const skipDepthButton = document.getElementById('skipDepthButton');
    const perimeterResultEl = document.getElementById('perimeterResult');
    const depthResultEl = document.getElementById('depthResult');
    const fatSummaryResultEl = document.getElementById('fatSummaryResult');
    const fatRepetitionsResultEl = document.getElementById('fatRepetitionsResult');
    const aolToolPanel = document.getElementById('aolToolPanel');
    const aolToolHelp = document.getElementById('aolToolHelp');
    const aolUndoButton = document.getElementById('aolUndo');
    const aolRedoButton = document.getElementById('aolRedo');
    const aolClearButton = document.getElementById('aolClear');

    // Modal
    const modal               = document.getElementById('modal');
    const modalCanvas         = document.getElementById('modalCanvas');
    const modalCtx            = modalCanvas.getContext('2d');
    const modalTitleEl        = document.getElementById('modalTitle');
    const modalInstructionsEl = document.getElementById('modalInstructions');
    const closeModalButton    = document.getElementById('close-modal');
    const confirmStepButton   = document.getElementById('confirm-step-button');
    const zoomInButton        = document.getElementById('zoom-in');
    const zoomOutButton       = document.getElementById('zoom-out');
    const zoomLevelEl         = document.getElementById('zoom-level');

    // -----------------------------------------------------------------------
    // Application state
    // -----------------------------------------------------------------------
    let state = {};

    function initializeState() {
        state = {
            analysisMode     : 'individual',
            batchCode        : '',
            batchCounter     : 1,
            batchRows        : [],        // accumulates {imageCode, aol, egs} per image
            currentStep      : 'IDLE',
            image            : null,
            token            : null,      // server-side image token
            scalePoints      : [],
            aolPoints        : [],
            fatPoints        : [], // reference to currently selected fat line
            fatLines         : [[]],
            fatTarget        : 3,
            activeFatIndex   : 0,
            depthPoints      : [],
            aolTool          : 'freehand',
            aolStrokeActive  : false,
            aolUndo          : [],
            aolRedo          : [],
            isDragging       : false,
            draggedPointIndex: -1,
            hoverPointIndex  : -1,
            mousePos         : { x: 0, y: 0 },
            reviewMode       : false,
            reviewSnapshot   : null,
            lastBatchIndex   : null,
            calculating     : false,
            zoomLevel        : 1.0,
            canvasW          : 0,
            canvasH          : 0,
        };
    }

    // -----------------------------------------------------------------------
    // Toast notifications
    // -----------------------------------------------------------------------
    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.classList.add('toast', type);
        toast.textContent = message;
        toastContainer.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('show'));
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 500);
        }, 4000);
    }

    // -----------------------------------------------------------------------
    // Application flow
    // -----------------------------------------------------------------------
    function resetApplication() {
        // Discard current image from server memory
        if (state.token) {
            fetch(`/discard/${state.token}`, { method: 'POST' }).catch(() => {});
        }
        initializeState();
        document.querySelector('input[name="analysisMode"][value="individual"]').checked = true;
        batchControls.classList.add('hidden');
        fileUploadArea.classList.remove('hidden');
        if (downloadExcelButton) downloadExcelButton.classList.add('hidden');
        downloadAnnotatedButton.classList.add('hidden');
        reviewButton.classList.add('hidden');
        reviewToolbar.classList.add('hidden');
        measurementContext.classList.add('hidden');
        measurementContext.textContent = '';
        imageLoader.value = '';
        finalImageEl.style.display = 'none';
        finalImageEl.src = '';
        aolResultEl.textContent          = '-- cm²';
        fatResultEl.textContent          = '-- cm';
        calibrationResultEl.textContent  = '-- px/cm';
        perimeterResultEl.textContent = '-- cm';
        depthResultEl.textContent = '-- cm';
        fatSummaryResultEl.textContent = '--';
        fatRepetitionsResultEl.textContent = '';
        updateMainInstructions();
        closeModal();
    }

    function handleImageUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        state.sourceFilename = file.name;
        const formData = new FormData();
        formData.append('file', file);

        fetch('/upload', { method: 'POST', body: formData })
            .then(r => r.json())
            .then(data => {
                if (data.error) throw new Error(data.error);
                state.token = data.token;
                state.image = new Image();
                state.image.src = data.url;
                state.image.onload = () => {
                    // A new image always begins with a fresh set of annotations.
                    state.scalePoints = [];
                    state.aolPoints = [];
                    state.fatTarget = Number(fatCountInput.value) || 3;
                    state.fatLines = Array.from({length: state.fatTarget}, () => []);
                    state.activeFatIndex = 0;
                    state.fatPoints = state.fatLines[0];
                    state.depthPoints = [];
                    state.aolTool = 'freehand';
                    state.aolStrokeActive = false;
                    state.aolUndo = [];
                    state.aolRedo = [];
                    state.reviewMode = false;
                    state.reviewSnapshot = null;
                    state.lastBatchIndex = null;
                    reviewButton.classList.add('hidden');
                    measurementContext.classList.add('hidden');
                    downloadAnnotatedButton.classList.add('hidden');
                    openModal();
                    setStep('CALIBRATING');
                };
            })
            .catch(err => showToast(`Upload error: ${err.message}`, 'error'));
    }

    function calculateResults() {
        if (state.calculating) return;
        const scaleLengthCm = Number(scaleLengthInput.value);
        if (!Number.isFinite(scaleLengthCm) || scaleLengthCm <= 0) {
            showToast('Enter a valid positive calibration distance in cm.', 'error');
            return;
        }
        if (state.scalePoints.length !== 2 || state.aolPoints.length < 3 ||
            state.fatLines.length !== state.fatTarget ||
            !state.fatLines.every(line => line.length === 2)) {
            showToast('Complete scale, AOL and EGS markings before saving.', 'error');
            return;
        }
        if (EchoROI.selfIntersects(state.aolPoints)) {
            showToast('AOL contour self-intersects. Correct the crossing with Edit points.', 'error');
            return;
        }
        const wasReview = Boolean(state.reviewMode);
        state.calculating = true;
        reviewSave.disabled = true;
        modalInstructionsEl.textContent = 'Calculating…';
        const highResAol = sampleAolContour(state.aolPoints);
        fetch('/calculate', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                token: state.token,
                scalePoints: state.scalePoints,
                scaleLengthCm,
                aolPoints: highResAol,
                fatPoints: state.fatLines[0],
                fatMeasurements: state.fatLines,
                depthPoints: state.depthPoints.length === 2 ? state.depthPoints : null,
            }),
        })
        .then(async response => {
            const result = await response.json();
            if (!response.ok || result.error) throw new Error(result.error || 'Unable to calculate.');
            return result;
        })
        .then(results => {
            aolResultEl.textContent = `${results.aol_cm2} cm²`;
            fatResultEl.textContent = `${results.fat_thickness_cm} cm`;
            calibrationResultEl.textContent = `${results.pixels_per_cm} px/cm`;
            perimeterResultEl.textContent = `${results.aol_perimeter_cm} cm`;
            depthResultEl.textContent = results.muscle_depth_cm === null ? 'Not measured' : `${results.muscle_depth_cm} cm`;
            fatSummaryResultEl.textContent = `${results.fat_samples_n} marks · Sample SD ${results.fat_sd_cm} cm`;
            fatRepetitionsResultEl.textContent = results.fat_measurements_cm
                .map((v, i) => `EGS ${i+1}: ${v} cm (${(v*10).toFixed(2)} mm)`).join('  ·  ');

            if (state.analysisMode === 'batch_running') {
                if (wasReview && Number.isInteger(state.lastBatchIndex) && state.batchRows[state.lastBatchIndex]) {
                    const row = state.batchRows[state.lastBatchIndex];
                    row.aol = results.aol_cm2;
                    row.egs = results.fat_thickness_cm;
                    row.perimeterCm = results.aol_perimeter_cm;
                    row.muscleDepthCm = results.muscle_depth_cm;
                    row.fatSamplesCm = results.fat_measurements_cm;
                    row.fatSdCm = results.fat_sd_cm;
                    row.fatSamplesN = results.fat_samples_n;
                    row.pixelsPerCm = results.pixels_per_cm;
                    row.scaleLengthCm = results.scale_length_cm;
                    row.animalId = animalIdInput.value.trim();
                    row.sessionId = sessionIdInput.value.trim();
                    row.species = speciesInput.value;
                    row.bodyCondition = bodyConditionInput.value.trim();
                    setStep('DONE');
                    drawFinalImage();
                    discardCurrentImage();
                    state.reviewMode = false;
                    state.reviewSnapshot = null;
                    reviewToolbar.classList.add('hidden');
                    closeModal();
                    updateMainInstructions();
                    showToast('Batch row updated — no duplicate added.', 'success');
                } else {
                    saveBatchRow(results);
                }
            } else {
                setStep('DONE');
                drawFinalImage();
                discardCurrentImage();
                state.reviewMode = false;
                state.reviewSnapshot = null;
                reviewToolbar.classList.add('hidden');
                closeModal();
                updateMainInstructions();
            }
            reviewButton.classList.remove('hidden');
            updateMeasurementContext();
        })
        .catch(err => {
            showToast(`Calculation error: ${err.message}`, 'error');
            if (wasReview) setStep('REVIEW');
            else setStep('DRAWING_FAT');
        })
        .finally(() => {
            state.calculating = false;
            reviewSave.disabled = false;
        });
    }

    function saveBatchRow(results) {
        const imageCode = `${state.batchCode}${String(state.batchCounter).padStart(2, '0')}`;
        const aol = results.aol_cm2, egs = results.fat_thickness_cm;
        state.batchRows.push({
            imageCode, aol, egs,
            perimeterCm: results.aol_perimeter_cm,
            muscleDepthCm: results.muscle_depth_cm,
            fatSamplesCm: results.fat_measurements_cm,
            fatSdCm: results.fat_sd_cm,
            fatSamplesN: results.fat_samples_n,
            species: speciesInput.value,
            bodyCondition: bodyConditionInput.value.trim(),
            originalFilename: state.sourceFilename || '',
            animalId: animalIdInput.value.trim(),
            sessionId: sessionIdInput.value.trim(),
            pixelsPerCm: results.pixels_per_cm,
            scaleLengthCm: results.scale_length_cm,
        });
        state.lastBatchIndex = state.batchRows.length - 1;
        state.batchCounter++;

        showToast(`${imageCode} saved (${state.batchRows.length} image${state.batchRows.length > 1 ? 's' : ''} in batch)`, 'success');

        // Show download button as soon as we have at least one row
        if (downloadExcelButton) downloadExcelButton.classList.remove('hidden');

        setStep('DONE');
        drawFinalImage(); // Copy annotated canvas while points are available.
        discardCurrentImage();
        closeModal();
        updateMainInstructions();
    }

    function discardCurrentImage() {
        if (state.token) {
            fetch(`/discard/${state.token}`, { method: 'POST' }).catch(() => {});
            state.token = null;
        }
    }

    function downloadExcel() {
        if (!state.batchRows.length) {
            showToast('No data to export yet.', 'error');
            return;
        }

        fetch('/download_excel', {
            method : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body   : JSON.stringify({
                batchCode: state.batchCode,
                rows     : state.batchRows,
            }),
        })
        .then(response => {
            if (!response.ok) return response.json().then(d => { throw new Error(d.error); });
            return response.blob();
        })
        .then(blob => {
            // Trigger browser file download
            const url  = URL.createObjectURL(blob);
            const a    = document.createElement('a');
            a.href     = url;
            a.download = `${state.batchCode}_results.xlsx`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
            showToast('Excel downloaded successfully!', 'success');
        })
        .catch(err => showToast(`Download error: ${err.message}`, 'error'));
    }

    function confirmStep() {
        if (state.currentStep === 'DRAWING_DEPTH' && !state.reviewMode) {
            if (state.depthPoints.length === 2) calculateResults();
            else skipMuscleDepth();
            return;
        }
        if (state.currentStep === 'DRAWING_FAT' && !state.reviewMode && state.fatPoints.length === 2) {
            finishFatLine();
            return;
        }
        if (state.currentStep === 'DRAWING_AOL') {
            if (state.aolPoints.length > 2) {
                setStep(state.reviewMode ? 'REVIEW' : 'DRAWING_FAT');
            } else {
                showToast('Draw at least 3 points to define the AOL area.', 'error');
            }
        }
    }

    function undoLastPoint() {
        if (state.currentStep === 'DRAWING_AOL' && state.aolUndo.length > 0) {
            undoAol();
        } else if (state.currentStep === 'CALIBRATING' && state.scalePoints.length > 0) {
            state.scalePoints.pop();
            draw();
        } else if (state.currentStep === 'DRAWING_FAT' && state.fatPoints.length > 0) {
            state.fatPoints.pop();
            draw();
        } else if (state.currentStep === 'DRAWING_DEPTH' && state.depthPoints.length > 0) {
            state.depthPoints.pop();
            draw();
        }
    }

    function startBatch() {
        const code = batchCodeInput.value.trim().toUpperCase();
        if (code) {
            state.batchCode    = code;
            state.batchCounter = 1;
            state.batchRows    = [];
            state.analysisMode = 'batch_running';
            batchControls.classList.add('hidden');
            fileUploadArea.classList.remove('hidden');
            if (downloadExcelButton) downloadExcelButton.classList.add('hidden');
            updateMainInstructions();
        } else {
            showToast('Please enter a batch code before starting.', 'error');
        }
    }

    // -----------------------------------------------------------------------
    // UI helpers
    // -----------------------------------------------------------------------
    function setStep(newStep) {
        state.currentStep = newStep;
        updateEgsProgress();
        updateModalInstructions();
        updateAolToolbar();
        draw();
    }

    function drawFinalImage() {
        draw();
        finalImageEl.src = modalCanvas.toDataURL('image/png');
        finalImageEl.style.display = 'block';
        downloadAnnotatedButton.classList.remove('hidden');
    }

    function downloadAnnotatedImage() {
        if (!finalImageEl.src || !finalImageEl.src.startsWith('data:image/png')) {
            showToast('No annotated image available.', 'error');
            return;
        }
        const a = document.createElement('a');
        const code = state.analysisMode === 'batch_running'
            ? `${state.batchCode}${String(state.batchCounter - 1).padStart(2, '0')}`
            : (animalIdInput.value.trim() || 'lambdamorph');
        a.href = finalImageEl.src;
        a.download = `${code}_annotated.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
    }

    function handleModeChange(event) {
        state.analysisMode = event.target.value;
        if (state.analysisMode === 'batch') {
            state.analysisMode = 'batch_setup';
            batchControls.classList.remove('hidden');
            fileUploadArea.classList.add('hidden');
        } else {
            batchControls.classList.add('hidden');
            fileUploadArea.classList.remove('hidden');
        }
        updateMainInstructions();
    }

    function updateMainInstructions() {
        let title, text;
        switch (state.analysisMode) {
            case 'individual':
                title = 'Individual Mode';
                text  = state.currentStep === 'DONE'
                    ? 'Analysis complete! Load another image to continue.'
                    : 'Load an image to start the analysis.';
                break;
            case 'batch_setup':
                title = 'Batch Mode — Setup';
                text  = 'Enter a batch code (e.g. LOTE01) and click <strong>Start Batch</strong>. Results accumulate in memory and you can download the Excel at any time.';
                break;
            case 'batch_running': {
                const nextCode = `${state.batchCode}${String(state.batchCounter).padStart(2, '0')}`;
                const saved    = state.batchRows.length;
                title = `Batch Mode — ${state.batchCode}`;
                text  = `<strong>${saved}</strong> image${saved !== 1 ? 's' : ''} saved. `
                      + (state.currentStep === 'DONE'
                            ? `Load the file for <strong>${nextCode}</strong>.`
                            : `Ready for <strong>${nextCode}</strong>.`);
                break;
            }
        }
        instructionsEl.innerHTML = `<h3><i class="fa-solid fa-info-circle"></i> ${title}</h3><p>${text}</p>`;
    }

    function updateModalInstructions() {
        let title, text;
        confirmStepButton.style.display = 'none';
        skipDepthButton.classList.add('hidden');
        confirmStepButton.textContent = 'Confirm Shape';
        switch (state.currentStep) {
            case 'CALIBRATING':
                title = 'Step 1 — Calibrate';
                text  = 'Use the scale length entered before loading the image, then click <strong>two points</strong> spanning that distance.';
                break;
            case 'DRAWING_AOL':
                title = 'Step 2 — Draw AOL';
                text = 'Choose <strong>Freehand</strong>, <strong>Polygon</strong>, or <strong>Edit points</strong> below. Confirm when the green border matches the muscle boundary.';
                confirmStepButton.style.display = 'block';
                break;
            case 'DRAWING_FAT':
                title = `Step 3 — EGS ${state.activeFatIndex + 1}/${state.fatTarget}`;
                text  = `Mark two anatomical interfaces for independent EGS measurement <strong>${state.activeFatIndex + 1}</strong> of <strong>${state.fatTarget}</strong>.`;
                if (!state.reviewMode && state.fatPoints.length === 2) {
                    confirmStepButton.textContent = 'Next EGS';
                    confirmStepButton.style.display = 'block';
                }
                break;
            case 'DRAWING_DEPTH':
                title = 'Step 4 — Muscle depth (optional)';
                text = 'Mark two points defining muscle depth according to your protocol, or choose <strong>Skip muscle depth</strong>. Avoid interpreting image height automatically as anatomical depth.';
                skipDepthButton.classList.remove('hidden');
                if (state.depthPoints.length === 2 && !state.reviewMode) {
                    confirmStepButton.style.display = 'block';
                    confirmStepButton.textContent = 'Calculate results';
                }
                break;
            case 'REVIEW':
                title = 'Review measurements';
                text = 'Select a tool above. Drag points to adjust; clear a tool to redraw it. Then choose <strong>Recalculate &amp; save</strong> or <strong>Cancel changes</strong>.';
                break;
            case 'DONE':
                title = 'Complete!';
                text  = 'Calculation finished.';
                break;
        }
        modalTitleEl.textContent      = title;
        modalInstructionsEl.innerHTML = text;
    }

    // -----------------------------------------------------------------------
    // Modal
    // -----------------------------------------------------------------------
    function openModal() {
        modal.style.display = 'flex';
        state.zoomLevel = 1.0;
        resizeCanvas();
        updateZoom();
    }

    function closeModal() {
        if (state.reviewMode) {
            cancelReview(); // Escape/X means discard edits, not previous validated measurements.
            return;
        }
        modal.style.display = 'none';
    }

    function updateZoom(newZoom) {
        if (newZoom !== undefined) {
            state.zoomLevel = Math.max(0.2, Math.min(5, newZoom));
        }
        zoomLevelEl.textContent = `${Math.round(state.zoomLevel * 100)}%`;
        resizeCanvas();
        draw();
    }

    function resizeCanvas() {
        if (!state.image) return;
        const newW = Math.round(state.image.width  * state.zoomLevel);
        const newH = Math.round(state.image.height * state.zoomLevel);
        if (newW !== state.canvasW || newH !== state.canvasH) {
            modalCanvas.width  = newW;
            modalCanvas.height = newH;
            state.canvasW = newW;
            state.canvasH = newH;
        }
    }

    // -----------------------------------------------------------------------
    // Drawing
    // -----------------------------------------------------------------------
    function draw() {
        if (!state.image) return;
        modalCtx.save();
        modalCtx.setTransform(1, 0, 0, 1, 0, 0);
        modalCtx.clearRect(0, 0, modalCanvas.width, modalCanvas.height);
        modalCtx.scale(state.zoomLevel, state.zoomLevel);
        modalCtx.drawImage(state.image, 0, 0);

        drawPoints(state.scalePoints, 'yellow', 5);
        drawSmoothPolygon(state.aolPoints, '#00ff00');
        state.fatLines.forEach((line, index) => {
            if (line.length === 2) {
                const color = index === state.activeFatIndex ? '#eb35b8' : '#e772ba';
                drawLine(line[0], line[1], color, 2.5);
                drawLabel(`EGS ${index+1}`, line[0], color);
            }
            if (line.length && state.currentStep === 'DRAWING_FAT' && index === state.activeFatIndex) {
                drawPoints(line, '#eb35b8', 5);
                if (line.length === 1) drawLine(line[0], state.mousePos, 'rgba(235,53,184,.6)', 2);
            }
        });
        if (state.depthPoints.length === 2) {
            drawLine(state.depthPoints[0], state.depthPoints[1], '#2fd6de', 2.5);
            drawLabel('Depth', state.depthPoints[0], '#2fd6de');
        }
        if (state.currentStep === 'DRAWING_DEPTH') {
            drawPoints(state.depthPoints, '#2fd6de', 5);
            if (state.depthPoints.length === 1) drawLine(state.depthPoints[0], state.mousePos, '#2fd6de', 2);
        }
        modalCtx.restore();
    }

    function drawPoints(points, color, radius) {
        const r = radius / state.zoomLevel;
        points.forEach((p, i) => {
            modalCtx.beginPath();
            modalCtx.arc(p.x, p.y, r, 0, 2 * Math.PI);
            modalCtx.fillStyle = (i === state.hoverPointIndex && !state.isDragging) ? 'red' : color;
            modalCtx.fill();
        });
    }

    function drawLabel(text, position, color) {
        modalCtx.font = `${12 / state.zoomLevel}px sans-serif`;
        modalCtx.lineWidth = 3 / state.zoomLevel;
        modalCtx.strokeStyle = 'rgba(0,0,0,.8)';
        modalCtx.strokeText(text, position.x + 7 / state.zoomLevel, position.y - 7 / state.zoomLevel);
        modalCtx.fillStyle = color;
        modalCtx.fillText(text, position.x + 7 / state.zoomLevel, position.y - 7 / state.zoomLevel);
    }

    function drawLine(p1, p2, color, width) {
        modalCtx.beginPath();
        modalCtx.moveTo(p1.x, p1.y);
        modalCtx.lineTo(p2.x, p2.y);
        modalCtx.strokeStyle = color;
        modalCtx.lineWidth   = width / state.zoomLevel;
        modalCtx.stroke();
    }

    // Unsmoothed ROI vertices: display and server area use the same coordinates.
    function sampleAolContour(points) {
        return EchoROI.copy(points);
    }

    function drawSmoothPolygon(points, color) {
        if (!points.length) return;
        const isEditingAol = state.currentStep === 'DRAWING_AOL';
        const freehandTracing = isEditingAol && state.aolStrokeActive;
        modalCtx.beginPath();
        modalCtx.moveTo(points[0].x, points[0].y);
        points.slice(1).forEach(point => modalCtx.lineTo(point.x, point.y));
        if (!freehandTracing && points.length >= 3) {
            modalCtx.closePath();
            modalCtx.fillStyle = 'rgba(40, 205, 127, 0.055)';
            modalCtx.fill();
        }
        modalCtx.strokeStyle = color;
        modalCtx.lineWidth = 2 / state.zoomLevel;
        modalCtx.stroke();
        if (isEditingAol && state.aolTool !== 'freehand' && !freehandTracing) {
            drawPoints(points, '#fff', 4);
        }
        if (isEditingAol && state.aolTool === 'polygon' && points.length > 0) {
            drawLine(points[points.length - 1], state.mousePos, 'rgba(0,255,0,0.38)', 2);
        }
    }

    // ---------------------------------------------------------------
    // Mouse handling
    // ---------------------------------------------------------------

    function getMousePos(event) {
        const rect = modalCanvas.getBoundingClientRect();
        return {
            x: (event.clientX - rect.left)  / state.zoomLevel,
            y: (event.clientY - rect.top) / state.zoomLevel,
        };
    }

    function findPointAt(pos, points, threshold = 10) {
        const t = threshold / state.zoomLevel;
        for (let i = 0; i < points.length; i++) {
            const dx = pos.x - points[i].x, dy = pos.y - points[i].y;
            if (Math.sqrt(dx * dx + dy * dy) < t) return i;
        }
        return -1;
    }

    function getCurrentPoints() {
        switch (state.currentStep) {
            case 'CALIBRATING': return state.scalePoints;
            case 'DRAWING_AOL': return state.aolPoints;
            case 'DRAWING_FAT': return state.fatPoints;
            case 'DRAWING_DEPTH': return state.depthPoints;
            default: return null;
        }
    }

    function onMouseDown(event) {
        if (event.button !== 0) return;
        state.mousePos = aolPoint(getMousePos(event));
        const points = getCurrentPoints();
        if (!points) return;
        if (state.currentStep === 'DRAWING_AOL') {
            const idx = findPointAt(state.mousePos, state.aolPoints);
            if (state.aolTool === 'freehand') {
                captureAolChange();
                state.aolPoints = [{...state.mousePos}];
                state.aolStrokeActive = true;
                draw();
                return;
            }
            if (state.aolTool === 'edit') {
                if (event.altKey && idx >= 0 && state.aolPoints.length > 3) {
                    captureAolChange();
                    state.aolPoints.splice(idx, 1);
                    updateAolToolbar();
                    draw();
                    return;
                }
                if (event.shiftKey) {
                    const hit = EchoROI.nearestSegment(state.mousePos, state.aolPoints);
                    if (hit && hit.distance <= 12 / state.zoomLevel) {
                        captureAolChange();
                        const newIndex = hit.index + 1;
                        state.aolPoints.splice(newIndex, 0, hit.projection);
                        state.isDragging = true;
                        state.draggedPointIndex = newIndex;
                        draw();
                    }
                    return;
                }
            }
            if (idx >= 0) {
                captureAolChange();
                state.isDragging = true;
                state.draggedPointIndex = idx;
            }
            return;
        }
        const idx = findPointAt(state.mousePos, points);
        if (idx !== -1) { state.isDragging = true; state.draggedPointIndex = idx; }
    }

    function onMouseMove(event) {
        state.mousePos = aolPoint(getMousePos(event));
        const points = getCurrentPoints();
        if (!points) return;
        if (state.currentStep === 'DRAWING_AOL' && state.aolStrokeActive) {
            const last = state.aolPoints[state.aolPoints.length - 1];
            if (state.aolPoints.length < 6000 &&
                Math.hypot(last.x - state.mousePos.x, last.y - state.mousePos.y) >= 2 / state.zoomLevel) {
                state.aolPoints.push({...state.mousePos});
            }
        } else if (state.isDragging) {
            points[state.draggedPointIndex] = {...state.mousePos};
        } else {
            state.hoverPointIndex = findPointAt(state.mousePos, points);
        }
        draw();
    }

    function onMouseUp(event) {
        if (event.button !== 0) return;
        state.mousePos = aolPoint(getMousePos(event));
        if (state.currentStep === 'DRAWING_AOL' && state.aolStrokeActive) {
            const last = state.aolPoints[state.aolPoints.length - 1];
            if (Math.hypot(last.x - state.mousePos.x, last.y - state.mousePos.y) > 0.5) {
                state.aolPoints.push({...state.mousePos});
            }
            finishFreehandStroke();
            return;
        }
        if (state.isDragging) {
            state.isDragging = false;
            state.draggedPointIndex = -1;
            updateAolToolbar();
            draw();
            return;
        }
        const points = getCurrentPoints();
        if (!points) return;
        if (state.currentStep === 'DRAWING_AOL') {
            if (state.aolTool !== 'polygon') return;
            if (findPointAt(state.mousePos, points) !== -1) return;
            if (points.length >= 2000) {
                showToast('Too many vertices. Use Edit to refine the existing polygon.', 'error');
                return;
            }
            captureAolChange();
            points.push({...state.mousePos});
            updateAolToolbar();
            draw();
            return;
        }
        if (findPointAt(state.mousePos, points) !== -1) return;
        if ((state.currentStep === 'CALIBRATING' || state.currentStep === 'DRAWING_FAT' || state.currentStep === 'DRAWING_DEPTH') && points.length >= 2) return;
        points.push({...state.mousePos});
        if (state.currentStep === 'CALIBRATING' && points.length === 2) {
            setStep(state.reviewMode ? 'REVIEW' : 'DRAWING_AOL');
        } else if (state.currentStep === 'DRAWING_FAT' && points.length === 2) {
            if (state.reviewMode) setStep('REVIEW');
            else finishFatLine();
        } else if (state.currentStep === 'DRAWING_DEPTH' && points.length === 2) {
            if (state.reviewMode) setStep('REVIEW');
            else calculateResults();
        }
        draw();
    }

    function onContextMenu(event) {
        event.preventDefault();
        undoLastPoint();
    }

    // -------- LambdaMorph 2.2: editable freehand/polygon ROI controller --------
    function aolPoint(pos) {
        return {
            x: Math.max(0, Math.min(state.image.width - 1, pos.x)),
            y: Math.max(0, Math.min(state.image.height - 1, pos.y)),
        };
    }

    function captureAolChange() {
        state.aolUndo.push(EchoROI.copy(state.aolPoints));
        if (state.aolUndo.length > 40) state.aolUndo.shift();
        state.aolRedo = [];
    }

    function undoAol() {
        if (state.aolUndo.length === 0) return;
        state.aolRedo.push(EchoROI.copy(state.aolPoints));
        state.aolPoints = state.aolUndo.pop();
        updateAolToolbar();
        draw();
    }

    function redoAol() {
        if (state.aolRedo.length === 0) return;
        state.aolUndo.push(EchoROI.copy(state.aolPoints));
        state.aolPoints = state.aolRedo.pop();
        updateAolToolbar();
        draw();
    }

    function setAolTool(tool) {
        if (!['freehand', 'polygon', 'edit'].includes(tool)) return;
        if (state.aolStrokeActive) finishFreehandStroke();
        state.aolTool = tool;
        updateAolToolbar();
        draw();
    }

    function updateAolToolbar() {
        const isAolStep = state.currentStep === 'DRAWING_AOL';
        aolToolPanel.classList.toggle('hidden', !isAolStep);
        aolToolPanel.querySelectorAll('[data-aol-tool]').forEach(button => {
            const active = button.dataset.aolTool === state.aolTool;
            button.classList.toggle('is-active', active);
            button.setAttribute('aria-pressed', String(active));
        });
        aolUndoButton.disabled = state.aolUndo.length === 0;
        aolRedoButton.disabled = state.aolRedo.length === 0;
        aolClearButton.disabled = state.aolPoints.length === 0;
        const guidance = {
            freehand: 'Freehand: hold the left mouse button and trace the muscle border. Release to close. A new stroke replaces the previous contour; Undo restores it.',
            polygon: 'Polygon: click to add vertices. Drag existing vertices to adjust. Confirm shape when finished.',
            edit: 'Edit: drag a vertex to move it. Shift+click near an edge to add a vertex; Alt+click a vertex to remove it.',
        };
        aolToolHelp.textContent = guidance[state.aolTool];
    }

    function finishFreehandStroke() {
        if (!state.aolStrokeActive) return;
        state.aolStrokeActive = false;
        const reduced = EchoROI.simplifyFreehand(state.aolPoints, Math.max(0.5, 1.2 / state.zoomLevel));
        if (reduced.length < 3 || EchoROI.area(reduced) < 1) {
            state.aolPoints = state.aolUndo.pop() || [];
            showToast('Trace a closed contour with sufficient area; try again.', 'error');
        } else {
            state.aolPoints = reduced;
            if (EchoROI.selfIntersects(reduced)) {
                showToast('The contour crosses itself. Choose Edit to correct it before confirming.', 'error');
            } else {
                showToast('Contour captured. You can choose Edit to refine its vertices.', 'success');
            }
        }
        updateAolToolbar();
        draw();
    }

    function clearAolContour() {
        if (state.currentStep !== 'DRAWING_AOL' || state.aolPoints.length === 0) return;
        captureAolChange();
        state.aolPoints = [];
        updateAolToolbar();
        draw();
    }


    // ---------- Annotation review (retains the last completed image) ----------

    function updateMeasurementContext() {
        const parts = [];
        const speciesLabel = speciesInput.options[speciesInput.selectedIndex]?.text;
        if (speciesInput.value) parts.push(`Species: ${speciesLabel}`);
        if (animalIdInput.value.trim()) parts.push(`Animal: ${animalIdInput.value.trim()}`);
        if (sessionIdInput.value.trim()) parts.push(`Session: ${sessionIdInput.value.trim()}`);
        if (bodyConditionInput.value.trim()) parts.push(`BCS: ${bodyConditionInput.value.trim()}`);
        measurementContext.textContent = parts.join(' · ');
        measurementContext.classList.toggle('hidden', !parts.length);
    }

    function clonePoints(points) {
        return points.map(p => ({x: p.x, y: p.y}));
    }

    function startReview() {
        if (!state.image || state.scalePoints.length !== 2 || state.aolPoints.length < 3 || state.fatPoints.length !== 2) {
            showToast('Complete a measurement before reviewing.', 'error');
            return;
        }
        state.reviewSnapshot = {
            fatLines: state.fatLines.map(clonePoints),
            activeFatIndex: state.activeFatIndex,
            depthPoints: clonePoints(state.depthPoints),
            scalePoints: clonePoints(state.scalePoints),
            aolPoints: clonePoints(state.aolPoints),
            fatPoints: clonePoints(state.fatPoints),
            scaleLength: scaleLengthInput.value,
        };
        state.reviewMode = true;
        reviewToolbar.classList.remove('hidden');
        reviewFatSelect.replaceChildren(...state.fatLines.map((_, i) => {
            const o = document.createElement('option');
            o.value = String(i); o.textContent = `EGS ${i+1}`; return o;
        }));
        selectFatLine(0);
        openModal();
        setStep('REVIEW');
    }

    function cancelReview() {
        if (state.reviewSnapshot) {
            state.scalePoints = clonePoints(state.reviewSnapshot.scalePoints);
            state.aolPoints = clonePoints(state.reviewSnapshot.aolPoints);
            state.fatLines = state.reviewSnapshot.fatLines.map(clonePoints);
            state.activeFatIndex = state.reviewSnapshot.activeFatIndex;
            state.fatPoints = state.fatLines[state.activeFatIndex];
            state.depthPoints = clonePoints(state.reviewSnapshot.depthPoints);
            scaleLengthInput.value = state.reviewSnapshot.scaleLength;
        }
        state.reviewMode = false;
        state.reviewSnapshot = null;
        reviewToolbar.classList.add('hidden');
        modal.style.display = 'none';
        setStep('DONE');
    }

    function selectReviewTool(step, buttonId) {
        if (!state.reviewMode) return;
        if (step === 'DRAWING_AOL') state.aolTool = 'edit';
        setStep(step);
        reviewToolbar.querySelectorAll('.review-edit-tools button').forEach(btn => {
            btn.classList.toggle('is-active', btn.id === buttonId);
        });
    }

    function clearReviewPoints() {
        if (!state.reviewMode) return;
        if (state.currentStep === 'CALIBRATING') state.scalePoints = [];
        else if (state.currentStep === 'DRAWING_AOL') state.aolPoints = [];
        else if (state.currentStep === 'DRAWING_FAT') {
            state.fatLines[state.activeFatIndex] = [];
            state.fatPoints = state.fatLines[state.activeFatIndex];
        }
        else if (state.currentStep === 'DRAWING_DEPTH') state.depthPoints = [];
        else showToast('Select scale, AOL or EGS before clearing points.', 'info');
        draw();
    }

    // ---------- LambdaMorph 2.3 morphometric measurement controls ----------
    function selectFatLine(index) {
        const i = Number(index);
        if (!Number.isInteger(i) || i < 0 || i >= state.fatLines.length) return;
        state.activeFatIndex = i;
        state.fatPoints = state.fatLines[i];
        reviewFatSelect.value = String(i);
        updateEgsProgress();
        draw();
    }

    function updateEgsProgress() {
        const visible = ['DRAWING_FAT', 'DRAWING_DEPTH'].includes(state.currentStep) || state.reviewMode;
        egsStepInfo.classList.toggle('hidden', !visible);
        if (visible) egsStepInfo.textContent = `EGS ${state.activeFatIndex + 1}/${state.fatTarget} · ${state.fatLines.filter(l => l.length === 2).length} complete`; 
    }

    function finishFatLine() {
        if (state.fatPoints.length !== 2) return;
        if (state.reviewMode) { setStep('REVIEW'); return; }
        if (state.activeFatIndex + 1 < state.fatTarget) {
            selectFatLine(state.activeFatIndex + 1);
            setStep('DRAWING_FAT');
        } else {
            setStep('DRAWING_DEPTH');
        }
    }

    function skipMuscleDepth() {
        if (state.reviewMode) return;
        state.depthPoints = [];
        calculateResults();
    }

    // -----------------------------------------------------------------------
    // Keyboard shortcuts
    // -----------------------------------------------------------------------
    function onKeyDown(event) {
        if (modal.style.display !== 'flex') return;
        if ((event.ctrlKey || event.metaKey) && state.currentStep === 'DRAWING_AOL') {
            if (event.key.toLowerCase() === 'z') {
                event.preventDefault();
                if (event.shiftKey) redoAol(); else undoAol();
                return;
            }
            if (event.key.toLowerCase() === 'y') {
                event.preventDefault();
                redoAol();
                return;
            }
        }
        switch (event.key) {
            case 'Escape': closeModal(); break;
            case 'Backspace':
            case 'Delete': event.preventDefault(); undoLastPoint(); break;
            case 'Enter': event.preventDefault(); confirmStep(); break;
        }
    }

    // -----------------------------------------------------------------------
    // Event listeners
    // -----------------------------------------------------------------------
    imageLoader.addEventListener('change', handleImageUpload);
    resetButton.addEventListener('click', resetApplication);
    closeModalButton.addEventListener('click', () => {
        closeModal();
        if (state.analysisMode === 'batch_running') updateMainInstructions();
    });
    confirmStepButton.addEventListener('click', confirmStep);
    zoomInButton.addEventListener('click',  () => updateZoom(state.zoomLevel + 0.2));
    zoomOutButton.addEventListener('click', () => updateZoom(state.zoomLevel - 0.2));
    modalCanvas.addEventListener('mousedown', onMouseDown);
    modalCanvas.addEventListener('mousemove', onMouseMove);
    modalCanvas.addEventListener('mouseup', onMouseUp);
    modalCanvas.addEventListener('mouseleave', () => {
        if (state.aolStrokeActive) finishFreehandStroke();
        if (state.isDragging) { state.isDragging = false; state.draggedPointIndex = -1; }
    });
    modalCanvas.addEventListener('contextmenu', onContextMenu);
    modeRadios.forEach(r => r.addEventListener('change', handleModeChange));
    startBatchButton.addEventListener('click', startBatch);
    document.addEventListener('keydown', onKeyDown);
    if (downloadExcelButton) downloadExcelButton.addEventListener('click', downloadExcel);
    downloadAnnotatedButton.addEventListener('click', downloadAnnotatedImage);
    reviewButton.addEventListener('click', startReview);
    reviewSave.addEventListener('click', calculateResults);
    reviewCancel.addEventListener('click', cancelReview);
    document.getElementById('reviewEditScale').addEventListener('click', () => selectReviewTool('CALIBRATING', 'reviewEditScale'));
    document.getElementById('reviewEditAol').addEventListener('click', () => selectReviewTool('DRAWING_AOL', 'reviewEditAol'));
    document.getElementById('reviewEditFat').addEventListener('click', () => selectReviewTool('DRAWING_FAT', 'reviewEditFat'));
    reviewEditDepth.addEventListener('click', () => selectReviewTool('DRAWING_DEPTH', 'reviewEditDepth'));
    reviewFatSelect.addEventListener('change', () => {
        selectFatLine(Number(reviewFatSelect.value));
        if (state.reviewMode) selectReviewTool('DRAWING_FAT', 'reviewEditFat');
    });
    skipDepthButton.addEventListener('click', skipMuscleDepth);
    document.getElementById('reviewClearPoints').addEventListener('click', clearReviewPoints);
    aolToolPanel.querySelectorAll('[data-aol-tool]').forEach(button => {
        button.addEventListener('click', () => setAolTool(button.dataset.aolTool));
    });
    aolUndoButton.addEventListener('click', undoAol);
    aolRedoButton.addEventListener('click', redoAol);
    aolClearButton.addEventListener('click', clearAolContour);

    // -----------------------------------------------------------------------
    // Init
    // -----------------------------------------------------------------------
    initializeState();
    updateMainInstructions();
});
