/* global p5 */

new p5(function(p) {
  const NUM_PARTICLES = 600;
  const TRAIL_LEN     = 50;
  const SPEED         = 2.0;

  const cfg = {
    mirrors: 4,
    seed: 42,
    nscale: 0.0030,
    offX: 0,
    offY: 0,
    particleColor: '#7040ff',
    bgColor: '#08080f',
  };

  let particles = [];
  let t = 0;

  class Particle {
    constructor() { this.spawn(); }

    spawn() {
      this.x = p.random(-p.width / 2, p.width / 2);
      this.y = p.random(-p.height / 2, p.height / 2);
      this.history = [];
    }

    update() {
      this.history.push({ x: this.x, y: this.y });
      if (this.history.length > TRAIL_LEN) this.history.shift();

      const n = p.noise(
        this.x * cfg.nscale + cfg.offX,
        this.y * cfg.nscale + cfg.offY,
        t
      );
      const angle = n * p.TWO_PI * 4;
      this.x += Math.cos(angle) * SPEED;
      this.y += Math.sin(angle) * SPEED;

      const hw = p.width / 2 + 20;
      const hh = p.height / 2 + 20;
      if (this.x < -hw || this.x > hw || this.y < -hh || this.y > hh) {
        this.spawn();
      }
    }
  }

  function hexToRGB(hex) {
    return {
      r: parseInt(hex.slice(1, 3), 16),
      g: parseInt(hex.slice(3, 5), 16),
      b: parseInt(hex.slice(5, 7), 16),
    };
  }

  function initParticles() {
    p.noiseSeed(cfg.seed);
    p.randomSeed(cfg.seed);
    t = 0;
    particles = [];
    for (let i = 0; i < NUM_PARTICLES; i++) {
      const pt = new Particle();
      const warmup = Math.floor(p.random(0, TRAIL_LEN));
      for (let j = 0; j < warmup; j++) pt.update();
      particles.push(pt);
    }
  }

  // Draws all particle trails into graphics context g (centered at 0,0)
  function drawParticlesOn(g) {
    const col  = hexToRGB(cfg.particleColor);
    const M    = cfg.mirrors;
    const step = p.TWO_PI / M;

    g.noFill();

    for (let m = 0; m < M; m++) {
      g.push();
      g.rotate(step * m);

      for (const pt of particles) {
        const len = pt.history.length;
        if (len < 2) continue;
        for (let i = 1; i < len; i++) {
          const a = p.map(i, 0, len - 1, 0, 190);
          const w = p.map(i, 0, len - 1, 0.3, 1.5);
          g.stroke(col.r, col.g, col.b, a);
          g.strokeWeight(w);
          g.line(
            pt.history[i - 1].x, pt.history[i - 1].y,
            pt.history[i].x,     pt.history[i].y
          );
        }
      }

      g.pop();
    }
  }

  p.setup = function() {
    const wrap = document.getElementById('canvas-wrap');
    const cnv  = p.createCanvas(wrap.clientWidth, wrap.clientHeight);
    cnv.parent('canvas-wrap');
    initParticles();
    bindUI();
  };

  p.draw = function() {
    t += 0.003;
    for (const pt of particles) pt.update();

    const bg = hexToRGB(cfg.bgColor);
    p.background(bg.r, bg.g, bg.b);
    p.push();
    p.translate(p.width / 2, p.height / 2);
    drawParticlesOn(p);
    p.pop();
  };

  p.windowResized = function() {
    const wrap = document.getElementById('canvas-wrap');
    p.resizeCanvas(wrap.clientWidth, wrap.clientHeight);
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
    triggerDownload(cnv, 'swarm.jpg', 'image/jpeg', 0.95);
  }

  // PNG export: particles only, transparent background
  function exportPng() {
    const pg = p.createGraphics(p.width, p.height);
    pg.pixelDensity(p.pixelDensity());
    pg.clear();
    pg.push();
    pg.translate(pg.width / 2, pg.height / 2);
    drawParticlesOn(pg);
    pg.pop();
    triggerDownload(pg.elt, 'swarm.png', 'image/png', 1.0);
    pg.remove();
  }

  function bindUI() {
    function sl(id, key, fmt, reinit) {
      const el = document.getElementById(id);
      const vl = document.getElementById(id + '-v');
      el.addEventListener('input', () => {
        cfg[key] = parseFloat(el.value);
        if (vl) vl.textContent = fmt(cfg[key]);
        if (reinit) initParticles();
      });
    }

    sl('mirrors', 'mirrors', v => Math.round(v), false);
    sl('seed',    'seed',    v => Math.round(v), true);
    sl('nscale',  'nscale',  v => v.toFixed(4),  false);
    sl('offx',    'offX',    v => v.toFixed(2),  false);
    sl('offy',    'offY',    v => v.toFixed(2),  false);

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
