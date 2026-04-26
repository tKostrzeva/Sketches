/* global p5 */

new p5(function(p) {
  const cfg = {
    mirrors:     1,
    mMode:       2,
    nMode:       3,
    spread:      0.30,    // acceptance band around f=0; higher = thicker/denser lines
    sampleCount: 150000,  // Monte Carlo attempts per render
    pointSize:   1.5,     // dot diameter in px
    turbulence:  0.30,    // noise warp amplitude on evaluation position
    nscale:      0.003,
    seed:        42,
    offX:        0,
    offY:        0,
    particleColor: '#ffffff',
    bgColor:       '#000000',
  };

  let pts      = []; // accepted [x, y] sample positions
  let renderPG;      // p5.Graphics with all dots drawn (mirrored via compositeOn)
  let timer    = null;

  // Chladni standing-wave field. Nodal lines are where f(x,y) = 0.
  // Uses square normalization so pattern is aspect-ratio independent.
  function chladniField(x, y) {
    const S  = Math.min(p.width, p.height) / 2;
    const nx = (x / S) * Math.PI;
    const ny = (y / S) * Math.PI;
    const m  = cfg.mMode;
    const n  = cfg.nMode;
    if (m === n) {
      // Standard formula collapses to 0 when m=n; use single-axis product instead
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

  // Monte Carlo: sample uniformly, accept with prob = exp(-|f| / spread).
  // Noise warps the evaluation position so the natural Chladni lines get
  // organic texture without changing the overall topology.
  function resample() {
    p.randomSeed(cfg.seed);
    p.noiseSeed(cfg.seed);
    pts = [];

    const hw = p.width  / 2;
    const hh = p.height / 2;
    const S  = Math.min(hw, hh);

    for (let i = 0; i < cfg.sampleCount; i++) {
      const x = p.random(-hw, hw);
      const y = p.random(-hh, hh);

      // Evaluate field at noise-displaced position for organic variation.
      // Drawing position stays at (x,y) so spatial distribution stays uniform.
      let ex = x, ey = y;
      if (cfg.turbulence > 0.001) {
        const dnx = p.noise(x * cfg.nscale + cfg.offX,       y * cfg.nscale + cfg.offY)       - 0.5;
        const dny = p.noise(x * cfg.nscale + cfg.offX + 100, y * cfg.nscale + cfg.offY + 100) - 0.5;
        ex += dnx * cfg.turbulence * S * 0.25;
        ey += dny * cfg.turbulence * S * 0.25;
      }

      const f = chladniField(ex, ey);
      if (p.random() < Math.exp(-Math.abs(f) / cfg.spread)) {
        pts.push([x, y]);
      }
    }
  }

  // Render accepted points to an offscreen buffer using raw canvas API for speed.
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

  function regenerate() {
    resample();
    renderToBuffer();
    p.redraw();
  }

  function scheduleRegen(fn) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { fn(); timer = null; }, 80);
  }

  // Composite renderPG onto target N times with rotational symmetry.
  function compositeOn(target, w, h) {
    const step = p.TWO_PI / cfg.mirrors;
    target.push();
    target.translate(w / 2, h / 2);
    for (let m = 0; m < cfg.mirrors; m++) {
      target.push();
      target.rotate(step * m);
      target.image(renderPG, -w / 2, -h / 2);
      target.pop();
    }
    target.pop();
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
    if (renderPG) compositeOn(p, p.width, p.height);
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
    compositeOn(pg, p.width, p.height);
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

    sl('mirrors',     'mirrors',     v => Math.round(v),                  'draw');
    sl('mMode',       'mMode',       v => Math.round(v),                  'regen');
    sl('nMode',       'nMode',       v => Math.round(v),                  'regen');
    sl('spread',      'spread',      v => v.toFixed(2),                   'regen');
    sl('sampleCount', 'sampleCount', v => (v / 1000).toFixed(0) + 'k',   'regen');
    sl('pointSize',   'pointSize',   v => v.toFixed(1),                   'render');
    sl('turbulence',  'turbulence',  v => v.toFixed(2),                   'regen');
    sl('nscale',      'nscale',      v => v.toFixed(4),                   'regen');
    sl('seed',        'seed',        v => Math.round(v),                  'regen');
    sl('offx',        'offX',        v => v.toFixed(2),                   'regen');
    sl('offy',        'offY',        v => v.toFixed(2),                   'regen');

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
