/* global p5 */

// Chladni nodal line formula for a square plate
// f(x,y) = cos(m*PI*x)*cos(n*PI*y) - cos(n*PI*x)*cos(m*PI*y)
// Particles drift toward f(x,y) = 0 (the nodal lines)

const MAX_PARTICLES = 6000;
const STEP = 0.05; // random walk step size

let particles = [];

function chladni(x, y, m, n) {
  return Math.cos(m * Math.PI * x) * Math.cos(n * Math.PI * y)
       - Math.cos(n * Math.PI * x) * Math.cos(m * Math.PI * y);
}

function randomParticle() {
  return { x: Math.random() * 2 - 1, y: Math.random() * 2 - 1 };
}

function resetParticles() {
  particles = [];
  for (let i = 0; i < MAX_PARTICLES; i++) particles.push(randomParticle());
}

resetParticles();

new p5(function(p) {

  p.setup = function() {
    const wrap = document.getElementById('canvas-wrap');
    p.createCanvas(wrap.clientWidth, wrap.clientHeight).parent('canvas-wrap');
    p.noStroke();
    p.fill(255, 60); // low alpha — clusters accumulate brightness via ADD blend
    bindUI();
  };

  p.draw = function() {
    p.blendMode(p.BLEND);
    p.background(8, 8, 15);
    p.blendMode(p.ADD);

    const m       = parseFloat(document.getElementById('m').value);
    const n       = parseFloat(document.getElementById('n').value);
    const count   = parseInt(document.getElementById('density').value);
    const pSize   = parseFloat(document.getElementById('size').value);
    const zoom    = parseFloat(document.getElementById('zoom').value);

    // Move each active particle one step toward the nearest nodal line
    for (let i = 0; i < count; i++) {
      const pt  = particles[i];
      const cur = Math.abs(chladni(pt.x, pt.y, m, n));

      const nx = p.constrain(pt.x + p.random(-STEP, STEP), -1, 1);
      const ny = p.constrain(pt.y + p.random(-STEP, STEP), -1, 1);

      // Accept move only if it brings particle closer to a nodal line
      if (Math.abs(chladni(nx, ny, m, n)) < cur) {
        pt.x = nx;
        pt.y = ny;
      }
    }

    // Draw — map particle coords [-1/zoom, 1/zoom] → screen
    for (let i = 0; i < count; i++) {
      const pt = particles[i];
      const sx = p.map(pt.x, -1 / zoom, 1 / zoom, 0, p.width);
      const sy = p.map(pt.y, -1 / zoom, 1 / zoom, 0, p.height);
      p.circle(sx, sy, pSize);
    }
  };

  p.windowResized = function() {
    const wrap = document.getElementById('canvas-wrap');
    p.resizeCanvas(wrap.clientWidth, wrap.clientHeight);
  };

  function bindUI() {
    // Slider → display value updates
    function wire(id, format) {
      const slider  = document.getElementById(id);
      const display = document.getElementById(id + '-v');
      slider.addEventListener('input', () => display.textContent = format(slider.value));
    }
    wire('m',       v => v);
    wire('n',       v => v);
    wire('density', v => v);
    wire('size',    v => parseFloat(v).toFixed(1));
    wire('zoom',    v => parseFloat(v).toFixed(2));

    // Panel toggle
    const panel     = document.getElementById('panel');
    const toggleBtn = document.getElementById('toggle-btn');
    const closeBtn  = document.getElementById('close-btn');
    toggleBtn.addEventListener('click', () => { panel.classList.add('open');    toggleBtn.classList.add('hidden'); });
    closeBtn.addEventListener('click',  () => { panel.classList.remove('open'); toggleBtn.classList.remove('hidden'); });

    document.getElementById('reset-btn').addEventListener('click', resetParticles);
  }
});
