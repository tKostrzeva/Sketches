/* 8bit_tex — recursive brightness-driven quadtree rasterizer.
   Each base grid cell recursively splits into 2x2 while it stays
   darker than the threshold, down to a max of 8x8. Leaf cells are
   painted with the closest-brightness image from the uploaded
   texture array (or a flat average color if no array is loaded). */

(function () {
  const MAX_DEPTH = 3;        // 2^3 = 8 → darkest cell caps at an 8x8 split
  const SRC_MAX_DIM = 480;    // working resolution for still images
  const CAM_MAX_DIM = 360;    // working resolution for live camera frames
  const TEX_SAMPLE = 24;      // size used to measure a texture's brightness

  const canvas = document.getElementById('output');
  const ctx = canvas.getContext('2d');
  const wrap = document.getElementById('canvas-wrap');
  const video = document.getElementById('camera-video');
  const dropHint = document.getElementById('drop-hint');

  const cfg = { threshold: 128, resolution: 16 };

  // ── Source image state (a summed-area table over grayscale luminance + RGB) ──
  const src = {
    ready: false,
    w: 0, h: 0,
    lumSAT: null, rSAT: null, gSAT: null, bSAT: null
  };

  let camStream = null;
  let camLoopId = null;

  const textures = []; // { img, brightness }

  // ── Summed-area table helpers ────────────────────────────────────────────
  function buildSAT(imageData, w, h) {
    const data = imageData.data;
    src.w = w; src.h = h;
    src.lumSAT = new Float64Array((w + 1) * (h + 1));
    src.rSAT = new Float64Array((w + 1) * (h + 1));
    src.gSAT = new Float64Array((w + 1) * (h + 1));
    src.bSAT = new Float64Array((w + 1) * (h + 1));
    const stride = w + 1;

    for (let y = 0; y < h; y++) {
      let rowLum = 0, rowR = 0, rowG = 0, rowB = 0;
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const r = data[i], g = data[i + 1], b = data[i + 2];
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        rowLum += lum; rowR += r; rowG += g; rowB += b;
        const idx = (y + 1) * stride + (x + 1);
        const above = y * stride + (x + 1);
        src.lumSAT[idx] = src.lumSAT[above] + rowLum;
        src.rSAT[idx] = src.rSAT[above] + rowR;
        src.gSAT[idx] = src.gSAT[above] + rowG;
        src.bSAT[idx] = src.bSAT[above] + rowB;
      }
    }
  }

  function rectSum(sat, w, x0, y0, x1, y1) {
    const stride = w + 1;
    return sat[y1 * stride + x1] - sat[y0 * stride + x1] - sat[y1 * stride + x0] + sat[y0 * stride + x0];
  }

  function sampleRect(x0, y0, x1, y1) {
    x0 = Math.max(0, Math.min(src.w, Math.round(x0)));
    x1 = Math.max(0, Math.min(src.w, Math.round(x1)));
    y0 = Math.max(0, Math.min(src.h, Math.round(y0)));
    y1 = Math.max(0, Math.min(src.h, Math.round(y1)));
    if (x1 <= x0) x1 = x0 + 1;
    if (y1 <= y0) y1 = y0 + 1;
    const area = (x1 - x0) * (y1 - y0);
    return {
      lum: rectSum(src.lumSAT, src.w, x0, y0, x1, y1) / area,
      r: rectSum(src.rSAT, src.w, x0, y0, x1, y1) / area,
      g: rectSum(src.gSAT, src.w, x0, y0, x1, y1) / area,
      b: rectSum(src.bSAT, src.w, x0, y0, x1, y1) / area
    };
  }

  // ── Loading a still image into the working source buffer ────────────────
  const workCanvas = document.createElement('canvas');
  const workCtx = workCanvas.getContext('2d', { willReadFrequently: true });

  function loadSourceFromImage(imgEl) {
    stopCamera();
    ingestDrawable(imgEl, imgEl.naturalWidth, imgEl.naturalHeight, SRC_MAX_DIM);
  }

  function ingestDrawable(drawable, naturalW, naturalH, maxDim) {
    const scale = Math.min(1, maxDim / Math.max(naturalW, naturalH));
    const w = Math.max(1, Math.round(naturalW * scale));
    const h = Math.max(1, Math.round(naturalH * scale));
    workCanvas.width = w;
    workCanvas.height = h;
    workCtx.drawImage(drawable, 0, 0, w, h);
    const data = workCtx.getImageData(0, 0, w, h);
    buildSAT(data, w, h);
    src.ready = true;
    dropHint.classList.add('hidden');
    render();
  }

  // ── Texture array ─────────────────────────────────────────────────────
  const texThumbCanvas = document.createElement('canvas');
  const texThumbCtx = texThumbCanvas.getContext('2d', { willReadFrequently: true });

  function addTexture(imgEl) {
    texThumbCanvas.width = TEX_SAMPLE;
    texThumbCanvas.height = TEX_SAMPLE;
    texThumbCtx.drawImage(imgEl, 0, 0, TEX_SAMPLE, TEX_SAMPLE);
    const data = texThumbCtx.getImageData(0, 0, TEX_SAMPLE, TEX_SAMPLE).data;
    let sum = 0;
    for (let i = 0; i < data.length; i += 4) {
      sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }
    const brightness = sum / (data.length / 4);
    textures.push({ img: imgEl, brightness });
    textures.sort((a, b) => a.brightness - b.brightness);
    refreshTexStrip();
    render();
  }

  function refreshTexStrip() {
    const strip = document.getElementById('tex-strip');
    const count = document.getElementById('tex-count');
    count.textContent = textures.length + (textures.length === 1 ? ' img' : ' imgs');
    strip.innerHTML = '';
    for (const t of textures) {
      const el = t.img.cloneNode();
      el.className = 'tex-thumb';
      el.title = 'brightness ' + Math.round(t.brightness);
      strip.appendChild(el);
    }
  }

  function pickTexture(brightness) {
    if (textures.length === 0) return null;
    let best = textures[0], bestDiff = Math.abs(textures[0].brightness - brightness);
    for (let i = 1; i < textures.length; i++) {
      const diff = Math.abs(textures[i].brightness - brightness);
      if (diff < bestDiff) { bestDiff = diff; best = textures[i]; }
    }
    return best.img;
  }

  // ── Camera ────────────────────────────────────────────────────────────
  async function startCamera() {
    try {
      camStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false
      });
    } catch (err) {
      alert('Could not access camera: ' + err.message);
      return;
    }
    video.srcObject = camStream;
    await video.play();
    document.getElementById('cam-btn').textContent = 'Stop Camera';
    document.getElementById('freeze-btn').classList.remove('hidden');
    dropHint.classList.add('hidden');
    camLoop();
  }

  function camLoop() {
    if (!camStream) return;
    if (video.videoWidth > 0) {
      ingestDrawable(video, video.videoWidth, video.videoHeight, CAM_MAX_DIM);
    }
    camLoopId = requestAnimationFrame(camLoop);
  }

  function stopCamera() {
    if (camLoopId) cancelAnimationFrame(camLoopId);
    camLoopId = null;
    if (camStream) {
      camStream.getTracks().forEach(t => t.stop());
      camStream = null;
    }
    video.srcObject = null;
    document.getElementById('cam-btn').textContent = 'Camera';
    document.getElementById('freeze-btn').classList.add('hidden');
  }

  function freezeFrame() {
    stopCamera(); // last ingested frame stays in the SAT buffers as a still
  }

  // ── Layout ────────────────────────────────────────────────────────────
  function resizeCanvas() {
    canvas.width = wrap.clientWidth;
    canvas.height = wrap.clientHeight;
    render();
  }

  function fitRect() {
    const cw = canvas.width, ch = canvas.height;
    if (!src.ready) return { dx: 0, dy: 0, dw: cw, dh: ch };
    const srcAspect = src.w / src.h;
    const boxAspect = cw / ch;
    let dw, dh;
    if (srcAspect > boxAspect) { dw = cw; dh = cw / srcAspect; }
    else { dh = ch; dw = ch * srcAspect; }
    return { dx: (cw - dw) / 2, dy: (ch - dh) / 2, dw, dh };
  }

  // ── Recursive rasterization ──────────────────────────────────────────
  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!src.ready) return;

    const { dx, dy, dw, dh } = fitRect();
    const sx = src.w / dw, sy = src.h / dh;

    const cols = cfg.resolution;
    const cellSize = dw / cols;
    const rows = Math.ceil(dh / cellSize);

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const lx = col * cellSize;
        const ly = row * cellSize;
        const size = Math.min(cellSize, dw - lx, dh - ly);
        if (size <= 0) continue;
        drawNode(lx, ly, size, 0, dx, dy, sx, sy);
      }
    }
  }

  function drawNode(lx, ly, size, depth, dx, dy, sx, sy) {
    const sample = sampleRect(lx * sx, ly * sy, (lx + size) * sx, (ly + size) * sy);

    if (depth < MAX_DEPTH && sample.lum < cfg.threshold) {
      const half = size / 2;
      drawNode(lx, ly, half, depth + 1, dx, dy, sx, sy);
      drawNode(lx + half, ly, half, depth + 1, dx, dy, sx, sy);
      drawNode(lx, ly + half, half, depth + 1, dx, dy, sx, sy);
      drawNode(lx + half, ly + half, half, depth + 1, dx, dy, sx, sy);
      return;
    }

    const cx = lx + dx, cy = ly + dy;
    const tex = pickTexture(sample.lum);
    if (tex) {
      ctx.drawImage(tex, cx, cy, size, size);
    } else {
      ctx.fillStyle = `rgb(${sample.r | 0}, ${sample.g | 0}, ${sample.b | 0})`;
      ctx.fillRect(cx, cy, size, size);
    }
  }

  // ── Export ───────────────────────────────────────────────────────────
  function doExport() {
    const a = document.createElement('a');
    a.download = '8bit_tex.png';
    a.href = canvas.toDataURL('image/png');
    a.click();
  }

  // ── UI wiring ────────────────────────────────────────────────────────
  function bindUI() {
    document.getElementById('img-input').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const img = new Image();
      img.onload = () => loadSourceFromImage(img);
      img.src = URL.createObjectURL(file);
    });

    document.getElementById('tex-input').addEventListener('change', (e) => {
      for (const file of e.target.files) {
        const img = new Image();
        img.onload = () => addTexture(img);
        img.src = URL.createObjectURL(file);
      }
      e.target.value = '';
    });

    document.getElementById('cam-btn').addEventListener('click', () => {
      if (camStream) stopCamera(); else startCamera();
    });
    document.getElementById('freeze-btn').addEventListener('click', freezeFrame);

    function bindSlider(id, key, fmt) {
      const el = document.getElementById(id);
      const vl = document.getElementById(id + '-v');
      el.addEventListener('input', () => {
        cfg[key] = parseFloat(el.value);
        if (vl) vl.textContent = fmt(cfg[key]);
        if (!camStream) render();
      });
    }
    bindSlider('threshold', 'threshold', v => Math.round(v));
    bindSlider('resolution', 'resolution', v => Math.round(v));

    document.getElementById('export-btn').addEventListener('click', doExport);

    const panel = document.getElementById('panel');
    const toggleBtn = document.getElementById('toggle-btn');
    const closeBtn = document.getElementById('close-btn');
    toggleBtn.addEventListener('click', () => { panel.classList.add('open'); toggleBtn.classList.add('hidden'); });
    closeBtn.addEventListener('click', () => { panel.classList.remove('open'); toggleBtn.classList.remove('hidden'); });

    window.addEventListener('resize', resizeCanvas);
  }

  bindUI();
  resizeCanvas();
})();
