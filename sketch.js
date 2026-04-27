/* global p5 */

new p5(function(p) {
  const SAMPLES = 200000;

  const cfg = {
    waveA:      3.0,
    waveB:      2.0,
    zoom:       1.0,
    pointScale: 1.5,
    spread:     0.15,
    hueA:       200,
    hueB:       40,
  };

  let t       = 0;
  let playing = false;

  // ── Chladni field ──────────────────────────────────────────────────────────
  function chladni(x, y) {
    const S = Math.min(p.width, p.height) * 0.5;
    const u = (x / S) * cfg.zoom;
    const v = (y / S) * cfg.zoom;
    // play: frequencies oscillate at different rates (phase offsets avoid t=0 being degenerate)
    const m = playing ? cfg.waveA * Math.abs(Math.sin(t * 0.020 + 1.0)) : cfg.waveA;
    const n = playing ? cfg.waveB * Math.abs(Math.sin(t * 0.017 + 2.0)) : cfg.waveB;
    return Math.cos(m * u) * Math.cos(n * v)
         - Math.cos(n * u) * Math.cos(m * v);
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  function renderFrame() {
    p.background(0);
    p.colorMode(p.HSB, 360, 100, 100, 100);
    p.noStroke();

    const hw = p.width  / 2;
    const hh = p.height / 2;
    const r  = cfg.pointScale;

    for (let i = 0; i < SAMPLES; i++) {
      const x   = p.random(-hw, hw);
      const y   = p.random(-hh, hh);
      const f   = Math.abs(chladni(x, y));
      const acc = Math.exp(-f / cfg.spread);
      if (p.random() < acc) {
        const hue = p.lerp(cfg.hueA, cfg.hueB, 1 - acc);
        p.fill(hue, 75, 100, 85);
        p.ellipse(x + hw, y + hh, r * 2, r * 2);
      }
    }

    p.colorMode(p.RGB, 255);
  }

  // ── p5 lifecycle ───────────────────────────────────────────────────────────
  p.setup = function() {
    const wrap = document.getElementById('canvas-wrap');
    p.createCanvas(wrap.clientWidth, wrap.clientHeight).parent('canvas-wrap');
    p.noLoop();
    bindUI();
    p.redraw();
  };

  p.draw = function() {
    if (playing) t++;
    renderFrame();
  };

  p.windowResized = function() {
    const wrap = document.getElementById('canvas-wrap');
    p.resizeCanvas(wrap.clientWidth, wrap.clientHeight);
    if (!playing) p.redraw();
  };

  // ── Play / Pause ───────────────────────────────────────────────────────────
  function setPlaying(on) {
    playing = on;
    if (!on) t = 0;
    const btn = document.getElementById('play-btn');
    if (btn) {
      btn.textContent = on ? 'Pause' : 'Play';
      btn.classList.toggle('active', on);
    }
    if (on) { p.loop(); } else { p.noLoop(); p.redraw(); }
  }

  // ── Export ─────────────────────────────────────────────────────────────────
  function doExport(mime, filename, quality) {
    if (!playing) p.redraw();
    const link    = document.createElement('a');
    link.download = filename;
    link.href     = document.querySelector('#canvas-wrap canvas').toDataURL(mime, quality);
    link.click();
  }

  // ── UI bindings ────────────────────────────────────────────────────────────
  function bindUI() {
    function sl(id, key, fmt) {
      const el = document.getElementById(id);
      const vl = document.getElementById(id + '-v');
      if (!el) return;
      el.addEventListener('input', () => {
        cfg[key] = parseFloat(el.value);
        if (vl) {
          if (key === 'hueA' || key === 'hueB') {
            vl.style.color = `hsl(${cfg[key]}, 70%, 65%)`;
          } else {
            vl.textContent = fmt(cfg[key]);
          }
        }
        if (!playing) p.redraw();
      });
      if ((key === 'hueA' || key === 'hueB') && vl) {
        vl.style.color = `hsl(${cfg[key]}, 70%, 65%)`;
      }
    }

    sl('waveA',      'waveA',      v => v.toFixed(1));
    sl('waveB',      'waveB',      v => v.toFixed(1));
    sl('zoom',       'zoom',       v => v.toFixed(1));
    sl('pointScale', 'pointScale', v => v.toFixed(1));
    sl('spread',     'spread',     v => v.toFixed(2));
    sl('hueA',       'hueA',       v => v.toFixed(0));
    sl('hueB',       'hueB',       v => v.toFixed(0));

    document.getElementById('play-btn')?.addEventListener('click', () => setPlaying(!playing));
    document.getElementById('export-jpg-btn')?.addEventListener('click', () => doExport('image/jpeg', 'chladni.jpg', 0.95));
    document.getElementById('export-png-btn')?.addEventListener('click', () => doExport('image/png',  'chladni.png', 1.0));

    const panel     = document.getElementById('panel');
    const toggleBtn = document.getElementById('toggle-btn');
    const closeBtn  = document.getElementById('close-btn');
    toggleBtn?.addEventListener('click', () => { panel.classList.add('open'); toggleBtn.classList.add('hidden'); });
    closeBtn?.addEventListener('click',  () => { panel.classList.remove('open'); toggleBtn.classList.remove('hidden'); });
  }
});
