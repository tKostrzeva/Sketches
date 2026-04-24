/* global p5 */

new p5(function(p) {
  const SPEED = 2.0;
  const FADE  = 0.04; // alpha reduction per frame via destination-out

  const cfg = {
    mirrors:    4,
    seed:       42,
    nscale:     0.0030,
    offX:       0,
    offY:       0,
    swarmCount: 600,
    particleColor: '#7040ff',
    bgColor:       '#08080f',
  };

  let particles = [];
  let trailPG;
  let t = 0;

  class Particle {
    constructor() { this.spawn(); }

    spawn() {
      this.x  = p.random(-p.width / 2, p.width / 2);
      this.y  = p.random(-p.height / 2, p.height / 2);
      this.px = null;
      this.py = null;
    }

    update() {
      this.px = this.x;
      this.py = this.y;
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

  // Fade trailPG toward transparent using canvas destination-out composite
  function fadeTrail() {
    const ctx = trailPG.drawingContext;
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = `rgba(0,0,0,${FADE})`;
    ctx.fillRect(0, 0, trailPG.width, trailPG.height);
    ctx.globalCompositeOperation = 'source-over';
  }

  // Paint new particle segments (one line per particle per frame)
  function paintParticles() {
    const col = hexToRGB(cfg.particleColor);
    trailPG.push();
    trailPG.translate(trailPG.width / 2, trailPG.height / 2);
    trailPG.stroke(col.r, col.g, col.b, 200);
    trailPG.strokeWeight(1.5);
    trailPG.noFill();
    for (const pt of particles) {
      if (pt.px !== null) trailPG.line(pt.px, pt.py, pt.x, pt.y);
    }
    trailPG.pop();
  }

  // One simulation + paint step
  function stepSim() {
    t += 0.003;
    for (const pt of particles) pt.update();
    fadeTrail();
    paintParticles();
  }

  // Composite trailPG onto target N times with rotational symmetry
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
    for (let i = 0; i < 40; i++) stepSim(); // pre-warm trails
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
    triggerDownload(cnv, 'swarm.jpg', 'image/jpeg', 0.95);
  }

  // PNG export: composite trailPG onto transparent buffer (no background)
  function exportPng() {
    const pg = p.createGraphics(p.width, p.height);
    pg.clear();
    compositeOn(pg, p.width, p.height);
    triggerDownload(pg.elt, 'swarm.png', 'image/png', 1.0);
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
