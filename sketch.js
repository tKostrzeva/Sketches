/* global p5 */

new p5(function(p) {
  // Fixed params (not exposed in UI)
  const SAMPLE_COUNT = 250000;
  const TURBULENCE   = 0.30;
  const NSCALE       = 0.003;

  const cfg = {
    mMode:   2,
    nMode:   3,
    spread:  0.30,
    pointSize: 1.5,
    seed:    42,
    particleColor: '#ffffff',
    bgColor:       '#000000',
  };

  let pts      = [];
  let renderPG;
  let timer    = null;

  function chladniField(x, y) {
    const S  = Math.min(p.width, p.height) / 2;
    const nx = (x / S) * Math.PI;
    const ny = (y / S) * Math.PI;
    const m  = cfg.mMode;
    const n  = cfg.nMode;
    if (m === n) {
      return Math.cos(m * nx) * Math.sin(n * ny);
    }
    return Math.cos(m * nx) * Math.cos(n * ny)
         - Math.cos(n * nx) * Math.cos(m * ny);
  }

  function hexToRGB(hex) {
    return {
      r: parseInt(hex.slice(1, 3), 16),
      g: parseInt(hex.slice(3, 5), 16),
      b: parseInt(hex.slice(5, 7), 16),
    };
  }

  function resample() {
    p.randomSeed(cfg.seed);
    p.noiseSeed(cfg.seed);
    pts = [];

    const hw = p.width  / 2;
    const hh = p.height / 2;
    const S  = Math.min(hw, hh);

    for (let i = 0; i < SAMPLE_COUNT; i++) {
      const x = p.random(-hw, hw);
      const y = p.random(-hh, hh);

      let ex = x, ey = y;
      const dnx = p.noise(x * NSCALE, y * NSCALE)       - 0.5;
      const dny = p.noise(x * NSCALE + 100, y * NSCALE) - 0.5;
      ex += dnx * TURBULENCE * S * 0.25;
      ey += dny * TURBULENCE * S * 0.25;

      const f = chladniField(ex, ey);
      if (p.random() < Math.exp(-Math.abs(f) / cfg.spread)) {
        pts.push([x, y]);
      }
    }
  }

  function renderToBuffer() {
    if (renderPG) renderPG.remove();
    renderPG = p.createGraphics(p.width, p.height);
    renderPG.clear();

    const col = hexToRGB(cfg.particleColor);
    const ctx = renderPG.drawingContext;
    const r   = cfg.pointSize / 2;
    const ox  = p.width  / 2;
    const oy  = p.height / 2;

    ctx.fillStyle = `rgb(${col.r},${col.g},${col.b})`;
    for (const [x, y] of pts) {
      ctx.beginPath();
      ctx.arc(ox + x, oy + y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function regenerate() { resample(); renderToBuffer(); p.redraw(); }

  function scheduleRegen(fn) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { fn(); timer = null; }, 80);
  }

  p.setup = function() {
    const wrap = document.getElementById('canvas-wrap');
    const cnv  = p.createCanvas(wrap.clientWidth, wrap.clientHeight);
    cnv.parent('canvas-wrap');
    p.noLoop();
    regenerate();
    bindUI();
  };

  p.draw = function() {
    const bg = hexToRGB(cfg.bgColor);
    p.background(bg.r, bg.g, bg.b);
    if (renderPG) {
      p.push();
      p.translate(p.width / 2, p.height / 2);
      p.image(renderPG, -p.width / 2, -p.height / 2);
      p.pop();
    }
  };

  p.windowResized = function() {
    const wrap = document.getElementById('canvas-wrap');
    p.resizeCanvas(wrap.clientWidth, wrap.clientHeight);
    regenerate();
  };

  function triggerDownload(canvas, filename, mimeType, quality) {
    const link    = document.createElement('a');
    link.download = filename;
    link.href     = canvas.toDataURL(mimeType, quality);
    link.click();
  }

  function exportJpg() {
    p.redraw();
    triggerDownload(document.querySelector('#canvas-wrap canvas'), 'chladni.jpg', 'image/jpeg', 0.95);
  }

  function exportPng() {
    const pg = p.createGraphics(p.width, p.height);
    pg.clear();
    pg.image(renderPG, 0, 0);
    triggerDownload(pg.elt, 'chladni.png', 'image/png', 1.0);
    pg.remove();
  }

  function bindUI() {
    function renderAndRedraw() { renderToBuffer(); p.redraw(); }

    function sl(id, key, fmt, action) {
      const el = document.getElementById(id);
      const vl = document.getElementById(id + '-v');
      el.addEventListener('input', () => {
        cfg[key] = parseFloat(el.value);
        if (vl) vl.textContent = fmt(cfg[key]);
        if      (action === 'regen')  scheduleRegen(regenerate);
        else if (action === 'render') scheduleRegen(renderAndRedraw);
        else if (action === 'draw')   p.redraw();
      });
    }

    sl('pointSize', 'pointSize', v => v.toFixed(1), 'render');
    sl('spread',    'spread',    v => v.toFixed(2), 'regen');
    sl('seed',      'seed',      v => Math.round(v), 'regen');
    sl('nMode',     'nMode',     v => Math.round(v), 'regen');
    sl('mMode',     'mMode',     v => Math.round(v), 'regen');

    document.getElementById('particleColor').addEventListener('input', e => {
      cfg.particleColor = e.target.value;
      scheduleRegen(renderAndRedraw);
    });
    document.getElementById('bgColor').addEventListener('input', e => {
      cfg.bgColor = e.target.value;
      p.redraw();
    });

    document.getElementById('export-jpg-btn').addEventListener('click', exportJpg);
    document.getElementById('export-png-btn').addEventListener('click', exportPng);

    const panel     = document.getElementById('panel');
    const toggleBtn = document.getElementById('toggle-btn');
    const closeBtn  = document.getElementById('close-btn');
    toggleBtn.addEventListener('click', () => {
      panel.classList.add('open');
      toggleBtn.classList.add('hidden');
    });
    closeBtn.addEventListener('click', () => {
      panel.classList.remove('open');
      toggleBtn.classList.remove('hidden');
    });
  }
});
