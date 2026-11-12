/** LambdaMorph 2.0 visual enhancements. No changes to measurement logic. */
document.addEventListener('DOMContentLoaded', () => {
  'use strict';
  const imageInput = document.getElementById('imageLoader');
  const dropzone = document.getElementById('uploadDropzone');
  const fileName = document.getElementById('fileSelectedName');
  const stage = document.getElementById('analysisFlow');
  const modalTitle = document.getElementById('modalTitle');
  const finalImage = document.getElementById('finalImage');
  const canvasContainer = document.querySelector('.canvas-container');
  const resetButton = document.getElementById('resetButton');
  if (!imageInput || !dropzone || !stage || !modalTitle || !finalImage) return;

  const stepOrder = ['upload', 'calibrate', 'outline', 'fat', 'results'];
  function updateFlow(name) {
    const currentIndex = stepOrder.indexOf(name);
    if (currentIndex < 0) return;
    stage.querySelectorAll('[data-flow-step]').forEach(el => {
      const index = stepOrder.indexOf(el.dataset.flowStep);
      el.classList.toggle('is-current', index === currentIndex);
      el.classList.toggle('is-complete', index < currentIndex);
      if (index === currentIndex) el.setAttribute('aria-current', 'step');
      else el.removeAttribute('aria-current');
    });
  }
  function syncModalStep() {
    const title = modalTitle.textContent.toLowerCase();
    if (title.includes('calibrat')) updateFlow('calibrate');
    else if (title.includes('draw aol')) updateFlow('outline');
    else if (title.includes('measure egs') || title.includes('measure fat')) updateFlow('fat');
    else if (title.includes('complete')) updateFlow('results');
  }
  const stepObserver = new MutationObserver(syncModalStep);
  stepObserver.observe(modalTitle, {childList: true, characterData: true, subtree: true});

  function syncCanvas() {
    const visible = finalImage.style.display !== 'none' &&
      getComputedStyle(finalImage).display !== 'none' &&
      finalImage.src && finalImage.src !== location.href;
    canvasContainer.classList.toggle('has-image', Boolean(visible));
  }
  const imageObserver = new MutationObserver(syncCanvas);
  imageObserver.observe(finalImage, {attributes: true, attributeFilter: ['src', 'style']});

  imageInput.addEventListener('change', () => {
    const file = imageInput.files && imageInput.files[0];
    if (file) {
      fileName.textContent = file.name;
      fileName.title = file.name;
    }
  });
  ['dragenter', 'dragover'].forEach(name => {
    dropzone.addEventListener(name, event => {
      event.preventDefault();
      event.stopPropagation();
      dropzone.classList.add('is-dragging');
    });
  });
  ['dragleave', 'dragend', 'drop'].forEach(name => {
    dropzone.addEventListener(name, event => {
      event.preventDefault();
      event.stopPropagation();
      dropzone.classList.remove('is-dragging');
    });
  });
  dropzone.addEventListener('drop', event => {
    const files = event.dataTransfer && event.dataTransfer.files;
    if (!files || files.length === 0) return;
    const f = files[0];
    const extension = (f.name.split('.').pop() || '').toLowerCase();
    if (!['png', 'jpg', 'jpeg', 'bmp', 'gif'].includes(extension)) {
      fileName.textContent = 'Unsupported format. Use PNG, JPG, BMP or GIF.';
      return;
    }
    try {
      const dt = new DataTransfer();
      dt.items.add(f);
      imageInput.files = dt.files;
      imageInput.dispatchEvent(new Event('change', {bubbles: true}));
    } catch (error) {
      fileName.textContent = 'Drag-and-drop unavailable. Click here to select the image.';
    }
  });
  resetButton?.addEventListener('click', () => {
    updateFlow('upload');
    if (fileName) fileName.textContent = 'PNG, JPG, BMP or GIF · max. 20 MB';
    canvasContainer.classList.remove('has-image');
  });
  updateFlow('upload');
  syncCanvas();
});
