/* global p5 */

new p5(function(p) {
  const ZONE    = 110;   // px from each corner — drag zone radius
  const MAX_F   = 20;    // max frequency for corner handles
  const SAMPLES = 200000;

  const cfg = {
    zoom:       1.0,
    pointScale: 1.5,
    spread:     0.15,
    hueA:       200,
    hueB:       40,
    waveA:      1.0,
    waveB:      1.0,
  };

  // freq[0]=TL, freq[1]=TR, freq[2]=BL, freq[3]=BR
  // formula: cos(f0*u + pA)*cos(f3*v) - cos(f1*u)*cos(f2*v + pB)
  const freq    = [3, 2, 3, 2];
  let   t       = 0;
  let   playing = false;
  let   dragIdx = -1;

  // ── Chladni field ──────────────────────────────────────────────────────────
  function chladni(x, y) {
    const S  = Math.min(p.width, p.height) * 0.5;
    const u  = (x / S) * cfg.zoom;
    const v  = (y / S) * cfg.zoom;
    const pA = t * cfg.waveA * 0.025;
    const pB = t * cfg.waveB * 0.025;
    return Math.cos(freq[0] * u + pA) * Math.cos(freq[3] * v)
         - Math.cos(freq[1] * u)      * Math.cos(freq[2] * v + pB);
  }

  // ── Corner handle position — mapped along diagonal from corner ─────────────
  function handlePos(i) {
    const d    = ZONE * Math.sqrt((freq[i] - 1) / (MAX_F - 1));
    const diag = d * 0.707;
    switch (i) {
      case 0: return { x: diag,            y: diag            };
      case 1: return { x: p.width - diag,  y: diag            };
      case 2: return { x: diag,            y: p.height - diag };
      case 3: return { x: p.width - diag,  y: p.height - diag };
    }
  }

  function freqFromCorner(i, mx, my) {
    const corners = [
      [0, 0], [p.width, 0], [0, p.height], [p.width, p.height],
    ];
    const [cx, cy] = corners[i];
    const d = Math.min(ZONE, Math.hypot(mx - cx, my - cy));
    return Math.max(1, Math.round(1 + (d / ZONE) ** 2 * (MAX_F - 1)));
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
    drawHandles();
  }

  function drawHandles() {
    p.push();
    p.strokeWeight(1);
    p.textSize(9);
    p.textFont('Courier New');
    for (let i = 0; i < 4; i++) {
      const { x, y } = handlePos(i);
      p.stroke(255, 100);
      p.noFill();
      p.ellipse(x, y, 20, 20);
      p.line(x - 10, y, x + 10, y);
      p.line(x, y - 10, x, y + 10);
      p.noStroke();
      p.fill(255, 160);
      p.textAlign(i % 2 === 0 ? p.RIGHT : p.LEFT, i < 2 ? p.BOTTOM : p.TOP);
      p.text(freq[i], x + (i % 2 === 0 ? -14 : 14), y + (i < 2 ? -14 : 14));
    }
    p.pop();
  }

  // ── Hit test ───────────────────────────────────────────────────────────────
  function hitHandle(mx, my) {
    for (let i = 0; i < 4; i++) {
      const { x, y } = handlePos(i);
      if (Math.hypot(mx - x, my - y) < 22) return i;
    }
    return -1;
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

  // ── Mouse ──────────────────────────────────────────────────────────────────
  p.mousePressed = function() {
    dragIdx = hitHandle(p.mouseX, p.mouseY);
    if (dragIdx >= 0) return false;
  };

  p.mouseDragged = function() {
    if (dragIdx < 0) return;
    freq[dragIdx] = freqFromCorner(dragIdx, p.mouseX, p.mouseY);
    if (!playing) p.redraw();
    return false;
  };

  p.mouseReleased = function() { dragIdx = -1; };

  // ── Touch ──────────────────────────────────────────────────────────────────
  p.touchStarted = function() {
    if (p.touches.length === 1) {
      dragIdx = hitHandle(p.touches[0].x, p.touches[0].y);
      if (dragIdx >= 0) return false;
    }
  };

  p.touchMoved = function() {
    if (dragIdx < 0 || p.touches.length !== 1) return;
    freq[dragIdx] = freqFromCorner(dragIdx, p.touches[0].x, p.touches[0].y);
    if (!playing) p.redraw();
    return false;
  };

  p.touchEnded = function() { dragIdx = -1; };

  // ── Cursor ─────────────────────────────────────────────────────────────────
  function setupCursor() {
    const el = document.querySelector('#canvas-wrap canvas');
    if (!el) return;
    el.addEventListener('mousemove', e => {
      const r = el.getBoundingClientRect();
      el.style.cursor = dragIdx >= 0 ? 'grabbing'
        : hitHandle(e.clientX - r.left, e.clientY - r.top) >= 0 ? 'grab' : 'default';
    });
  }

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

    setupCursor();
  }
});
