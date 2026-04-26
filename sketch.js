/* global p5 */

new p5(function(p) {
  // Physics constants
  const FORCE_K = 0.12;  // Chladni attraction toward nodal lines
  const DAMPING = 0.87;  // velocity damping per frame
  const FADE    = 0.018; // trail alpha reduction per frame (destination-out)
  const EPS     = 3;     // pixel step for numerical gradient

  const cfg = {
    mirrors:    1,
    mMode:      2,
    nMode:      3,
    turbulence: 1.0,
    seed:       42,
    nscale:     0.0030,
    offX:       0,
    offY:       0,
    swarmCount: 3000,
    particleColor: '#ffffff',
    bgColor:       '#000000',
  };

  let particles = [];
  let trailPG;
  let t = 0;

  // Chladni standing-wave field for a square plate.
  // Nodal lines (where sand accumulates) are where f(x,y) = 0.
  // Formula: cos(m*π*nx)*cos(n*π*ny) - cos(n*π*nx)*cos(m*π*ny)
  // Degenerate when m==n (always zero) — use single-axis mode instead.
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

  class Particle {
    constructor() { this.spawn(); }

    spawn() {
      const S = Math.min(p.width, p.height) / 2;
      this.x  = p.random(-S, S);
      this.y  = p.random(-S, S);
      this.vx = p.random(-0.5, 0.5);
      this.vy = p.random(-0.5, 0.5);
      this.px = null;
      this.py = null;
    }

    update() {
      this.px = this.x;
      this.py = this.y;

      // Chladni force: push particle toward nearest nodal line (f = 0)
      // Uses normalized gradient so force magnitude is independent of field steepness
      const f   = chladniField(this.x, this.y);
      const gx  = (chladniField(this.x + EPS, this.y) - chladniField(this.x - EPS, this.y)) / (2 * EPS);
      const gy  = (chladniField(this.x, this.y + EPS) - chladniField(this.x, this.y - EPS)) / (2 * EPS);
      const mag = Math.sqrt(gx * gx + gy * gy) + 1e-6;
      this.vx  -= f * (gx / mag) * FORCE_K;
      this.vy  -= f * (gy / mag) * FORCE_K;

      // Noise turbulence (simulates vibration randomness, keeps dust animated)
      if (cfg.turbulence > 0.001) {
        const nv  = p.noise(
          this.x * cfg.nscale + cfg.offX,
          this.y * cfg.nscale + cfg.offY,
          t
        );
        const ang = nv * p.TWO_PI * 4;
        this.vx  += Math.cos(ang) * cfg.turbulence * 0.04;
        this.vy  += Math.sin(ang) * cfg.turbulence * 0.04;
      }

      this.vx *= DAMPING;
      this.vy *= DAMPING;
      this.x  += this.vx;
      this.y  += this.vy;

      const hw = p.width / 2 + 10;
      const hh = p.height / 2 + 10;
      if (this.x < -hw || this.x > hw || this.y < -hh || this.y > hh) {
        this.spawn();
      }
    }
  }

  // Reduce alpha of every pixel in trailPG toward transparent (not toward bg color)
  function fadeTrail() {
    const ctx = trailPG.drawingContext;
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = `rgba(0,0,0,${FADE})`;
    ctx.fillRect(0, 0, trailPG.width, trailPG.height);
    ctx.globalCompositeOperation = 'source-over';
  }

  function paintParticles() {
    const col = hexToRGB(cfg.particleColor);
    trailPG.push();
    trailPG.translate(trailPG.width / 2, trailPG.height / 2);
    trailPG.stroke(col.r, col.g, col.b, 160);
    trailPG.strokeWeight(1.0);
    trailPG.noFill();
    for (const pt of particles) {
      if (pt.px !== null) trailPG.line(pt.px, pt.py, pt.x, pt.y);
    }
    trailPG.pop();
  }

  function stepSim() {
    t += 0.002;
    for (const pt of particles) pt.update();
    fadeTrail();
    paintParticles();
  }

  // Draw trailPG onto target N times with rotational symmetry
  function compositeOn(target, w, h) {
    const step = p.TWO_PI / cfg.mirrors;
    target.push();
    target.translate(w / 2, h / 2);
    for (let m = 0; m < cfg.mirrors; m++) {
      target.push();
      target.rotate(step * m);
      target.image(trailPG, -w / 2, -h / 2);
      target.pop();
    }
    target.pop();
  }

  function initTrailPG() {
    if (trailPG) trailPG.remove();
    trailPG = p.createGraphics(p.width, p.height);
    trailPG.clear();
  }

  function initParticles() {
    p.noiseSeed(cfg.seed);
    p.randomSeed(cfg.seed);
    t = 0;
    trailPG.clear();
    particles = [];
    for (let i = 0; i < cfg.swarmCount; i++) {
      particles.push(new Particle());
    }
  }

  p.setup = function() {
    const wrap = document.getElementById('canvas-wrap');
    const cnv  = p.createCanvas(wrap.clientWidth, wrap.clientHeight);
    cnv.parent('canvas-wrap');
    initTrailPG();
    initParticles();
    bindUI();
  };

  p.draw = function() {
    stepSim();
    const bg = hexToRGB(cfg.bgColor);
    p.background(bg.r, bg.g, bg.b);
    compositeOn(p, p.width, p.height);
  };

  p.windowResized = function() {
    const wrap = document.getElementById('canvas-wrap');
    p.resizeCanvas(wrap.clientWidth, wrap.clientHeight);
    initTrailPG();
    initParticles();
  };

  function triggerDownload(canvas, filename, mimeType, quality) {
    const link    = document.createElement('a');
    link.download = filename;
    link.href     = canvas.toDataURL(mimeType, quality);
    link.click();
  }

  function exportJpg() {
    const cnv = document.querySelector('#canvas-wrap canvas');
    triggerDownload(cnv, 'chladni.jpg', 'image/jpeg', 0.95);
  }

  function exportPng() {
    const pg = p.createGraphics(p.width, p.height);
    pg.clear();
    compositeOn(pg, p.width, p.height);
    triggerDownload(pg.elt, 'chladni.png', 'image/png', 1.0);
    pg.remove();
  }

  function bindUI() {
    function sl(id, key, fmt, onchange) {
      const el = document.getElementById(id);
      const vl = document.getElementById(id + '-v');
      el.addEventListener('input', () => {
        cfg[key] = parseFloat(el.value);
        if (vl) vl.textContent = fmt(cfg[key]);
        if (onchange) onchange(cfg[key]);
      });
    }

    sl('mirrors',    'mirrors',    v => Math.round(v), null);
    // m/n changes: no reinit — particles flow live to new pattern
    sl('mMode',      'mMode',      v => Math.round(v), null);
    sl('nMode',      'nMode',      v => Math.round(v), null);
    sl('turbulence', 'turbulence', v => v.toFixed(1),  null);
    sl('seed',       'seed',       v => Math.round(v), () => initParticles());
    sl('nscale',     'nscale',     v => v.toFixed(4),  null);
    sl('offx',       'offX',       v => v.toFixed(2),  null);
    sl('offy',       'offY',       v => v.toFixed(2),  null);
    sl('swarmCount', 'swarmCount', v => Math.round(v), v => {
      const n = Math.round(v);
      if (n > particles.length) {
        for (let i = particles.length; i < n; i++) particles.push(new Particle());
      } else {
        particles.length = n;
      }
    });

    document.getElementById('particleColor').addEventListener('input', e => {
      cfg.particleColor = e.target.value;
    });
    document.getElementById('bgColor').addEventListener('input', e => {
      cfg.bgColor = e.target.value;
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
