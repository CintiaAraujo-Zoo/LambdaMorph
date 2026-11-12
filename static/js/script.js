/* EchoMetrics 2.1 - annotation review */
/**
 * EchoMetrics — client-side analysis logic
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
            fatPoints        : [],
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
                    state.fatPoints = [];
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
        if (state.scalePoints.length !== 2 || state.aolPoints.length < 3 || state.fatPoints.length !== 2) {
            showToast('Complete scale, AOL and EGS markings before saving.', 'error');
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
                fatPoints: state.fatPoints,
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

            if (state.analysisMode === 'batch_running') {
                if (wasReview && Number.isInteger(state.lastBatchIndex) && state.batchRows[state.lastBatchIndex]) {
                    const row = state.batchRows[state.lastBatchIndex];
                    row.aol = results.aol_cm2;
                    row.egs = results.fat_thickness_cm;
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
        if (state.currentStep === 'DRAWING_FAT' && !state.reviewMode && state.fatPoints.length === 2) {
            calculateResults();
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
        if (state.currentStep === 'DRAWING_AOL' && state.aolPoints.length > 0) {
            state.aolPoints.pop();
            draw();
        } else if (state.currentStep === 'CALIBRATING' && state.scalePoints.length > 0) {
            state.scalePoints.pop();
            draw();
        } else if (state.currentStep === 'DRAWING_FAT' && state.fatPoints.length > 0) {
            state.fatPoints.pop();
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
        updateModalInstructions();
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
            : (animalIdInput.value.trim() || 'echometrics');
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
        confirmStepButton.textContent = 'Confirm Shape';
        switch (state.currentStep) {
            case 'CALIBRATING':
                title = 'Step 1 — Calibrate';
                text  = 'Use the scale length entered before loading the image, then click <strong>two points</strong> spanning that distance.';
                break;
            case 'DRAWING_AOL':
                title = 'Step 2 — Draw AOL';
                text  = 'Click to add points. Drag to adjust. <strong>Right-click</strong> or <kbd>Backspace</kbd> to undo. Press <kbd>Enter</kbd> or click <em>Confirm Shape</em> when done.';
                confirmStepButton.style.display = 'block';
                break;
            case 'DRAWING_FAT':
                title = 'Step 3 — Measure EGS';
                text  = 'Click <strong>two points</strong> to measure subcutaneous fat thickness.';
                if (!state.reviewMode && state.fatPoints.length === 2) {
                    confirmStepButton.textContent = 'Calculate';
                    confirmStepButton.style.display = 'block';
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
        drawPoints(state.fatPoints, 'magenta', 5);

        if (state.fatPoints.length === 1 && state.currentStep === 'DRAWING_FAT') {
            drawLine(state.fatPoints[0], state.mousePos, 'rgba(255,0,255,0.5)', 2);
        }
        if (state.fatPoints.length === 2) {
            drawLine(state.fatPoints[0], state.fatPoints[1], 'magenta', 2);
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

    function drawLine(p1, p2, color, width) {
        modalCtx.beginPath();
        modalCtx.moveTo(p1.x, p1.y);
        modalCtx.lineTo(p2.x, p2.y);
        modalCtx.strokeStyle = color;
        modalCtx.lineWidth   = width / state.zoomLevel;
        modalCtx.stroke();
    }

    // Closed Catmull-Rom curve. Exactly the SAME sample points are used for
    // drawing and for the server-side area measurement.
    function sampleAolContour(points, samplesPerSegment = 12) {
        if (points.length < 3) return points.slice();
        const output = [], n = points.length;
        for (let i = 0; i < n; i++) {
            const p0 = points[(i - 1 + n) % n];
            const p1 = points[i];
            const p2 = points[(i + 1) % n];
            const p3 = points[(i + 2) % n];
            for (let j = 0; j < samplesPerSegment; j++) {
                const t = j / samplesPerSegment, t2 = t * t, t3 = t2 * t;
                const coord = k => 0.5 * (
                    2 * p1[k] + (-p0[k] + p2[k]) * t +
                    (2*p0[k] - 5*p1[k] + 4*p2[k] - p3[k]) * t2 +
                    (-p0[k] + 3*p1[k] - 3*p2[k] + p3[k]) * t3);
                output.push({ x: coord('x'), y: coord('y') });
            }
        }
        return output;
    }

    function drawSmoothPolygon(points, color) {
        if (!points.length) return;
        modalCtx.strokeStyle = color;
        modalCtx.lineWidth = 2 / state.zoomLevel;
        drawPoints(points, 'white', 5);
        const sampled = sampleAolContour(points);
        if (sampled.length > 1) {
            modalCtx.beginPath();
            modalCtx.moveTo(sampled[0].x, sampled[0].y);
            sampled.slice(1).forEach(p => modalCtx.lineTo(p.x, p.y));
            if (points.length >= 3) modalCtx.closePath();
            modalCtx.stroke();
        }
        if (state.currentStep === 'DRAWING_AOL' && points.length > 0) {
            drawLine(points[points.length - 1], state.mousePos, 'rgba(0,255,0,0.4)', 2);
        }
    }

    // -----------------------------------------------------------------------
    // Mouse handling
    // -----------------------------------------------------------------------
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
            default: return null;
        }
    }

    function onMouseDown(event) {
        if (event.button !== 0) return;
        state.mousePos = getMousePos(event);
        const points = getCurrentPoints();
        if (!points) return;
        const idx = findPointAt(state.mousePos, points);
        if (idx !== -1) { state.isDragging = true; state.draggedPointIndex = idx; }
    }

    function onMouseMove(event) {
        state.mousePos = getMousePos(event);
        const points = getCurrentPoints();
        if (!points) return;
        if (state.isDragging) {
            points[state.draggedPointIndex] = { ...state.mousePos };
        } else {
            state.hoverPointIndex = findPointAt(state.mousePos, points);
        }
        draw();
    }

    function onMouseUp(event) {
        if (event.button !== 0) return;
        if (state.isDragging) {
            state.isDragging = false; state.draggedPointIndex = -1; draw(); return;
        }
        const points = getCurrentPoints();
        if (!points) return;
        if (findPointAt(state.mousePos, points) !== -1) return;
        if ((state.currentStep === 'CALIBRATING' || state.currentStep === 'DRAWING_FAT') && points.length >= 2) return;
        points.push({ ...state.mousePos });
        if (state.currentStep === 'CALIBRATING' && points.length === 2) {
            setStep(state.reviewMode ? 'REVIEW' : 'DRAWING_AOL');
        } else if (state.currentStep === 'DRAWING_FAT' && points.length === 2) {
            if (state.reviewMode) setStep('REVIEW');
            else calculateResults();
        }
        draw();
    }

    function onContextMenu(event) { event.preventDefault(); undoLastPoint(); }


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
            scalePoints: clonePoints(state.scalePoints),
            aolPoints: clonePoints(state.aolPoints),
            fatPoints: clonePoints(state.fatPoints),
            scaleLength: scaleLengthInput.value,
        };
        state.reviewMode = true;
        reviewToolbar.classList.remove('hidden');
        openModal();
        setStep('REVIEW');
    }

    function cancelReview() {
        if (state.reviewSnapshot) {
            state.scalePoints = clonePoints(state.reviewSnapshot.scalePoints);
            state.aolPoints = clonePoints(state.reviewSnapshot.aolPoints);
            state.fatPoints = clonePoints(state.reviewSnapshot.fatPoints);
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
        setStep(step);
        reviewToolbar.querySelectorAll('.review-edit-tools button').forEach(btn => {
            btn.classList.toggle('is-active', btn.id === buttonId);
        });
    }

    function clearReviewPoints() {
        if (!state.reviewMode) return;
        if (state.currentStep === 'CALIBRATING') state.scalePoints = [];
        else if (state.currentStep === 'DRAWING_AOL') state.aolPoints = [];
        else if (state.currentStep === 'DRAWING_FAT') state.fatPoints = [];
        else showToast('Select scale, AOL or EGS before clearing points.', 'info');
        draw();
    }

    // -----------------------------------------------------------------------
    // Keyboard shortcuts
    // -----------------------------------------------------------------------
    function onKeyDown(event) {
        if (modal.style.display !== 'flex') return;
        switch (event.key) {
            case 'Escape':    closeModal(); break;
            case 'Backspace':
            case 'Delete':    event.preventDefault(); undoLastPoint(); break;
            case 'Enter':     event.preventDefault(); confirmStep(); break;
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
    modalCanvas.addEventListener('mousedown',   onMouseDown);
    modalCanvas.addEventListener('mousemove',   onMouseMove);
    modalCanvas.addEventListener('mouseup',     onMouseUp);
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
    document.getElementById('reviewClearPoints').addEventListener('click', clearReviewPoints);

    // -----------------------------------------------------------------------
    // Init
    // -----------------------------------------------------------------------
    initializeState();
    updateMainInstructions();
});
