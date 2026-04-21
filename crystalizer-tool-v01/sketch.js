/* global p5 */

// ── Icosahedron base geometry ──────────────────────────────────────────────────
const PHI = (1 + Math.sqrt(5)) / 2;

const BASE_V = [
  [-1, PHI, 0], [1, PHI, 0], [-1, -PHI, 0], [1, -PHI, 0],
  [0, -1, PHI], [0, 1, PHI], [0, -1, -PHI], [0, 1, -PHI],
  [PHI, 0, -1], [PHI, 0, 1], [-PHI, 0, -1], [-PHI, 0, 1]
].map(v => norm3(v));

const BASE_F = [
  [0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],
  [1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],
  [3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],
  [4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1]
];

// ── Math helpers ───────────────────────────────────────────────────────────────
function norm3(v) {
  const l = Math.sqrt(v[0]*v[0] + v[1]*v[1] + v[2]*v[2]);
  return [v[0]/l, v[1]/l, v[2]/l];
}

function dot3(a, b) {
  return a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
}

function crossNorm(a, b, c) {
  const ux = b[0]-a[0], uy = b[1]-a[1], uz = b[2]-a[2];
  const vx = c[0]-a[0], vy = c[1]-a[1], vz = c[2]-a[2];
  return norm3([uy*vz - uz*vy, uz*vx - ux*vz, ux*vy - uy*vx]);
}

function hexToRGB(h) {
  return [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)];
}

function lerpRGB(a, b, t) {
  return [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t];
}

// ── Icosphere subdivision ─────────────────────────────────────────────────────
function subdivide(verts, faces, levels) {
  for (let l = 0; l < levels; l++) {
    const edgeMap = new Map();
    const newFaces = [];

    function midIdx(i, j) {
      const key = Math.min(i,j) + '_' + Math.max(i,j);
      if (!edgeMap.has(key)) {
        edgeMap.set(key, verts.length);
        verts.push(norm3([
          (verts[i][0]+verts[j][0])/2,
          (verts[i][1]+verts[j][1])/2,
          (verts[i][2]+verts[j][2])/2
        ]));
      }
      return edgeMap.get(key);
    }

    for (const [a, b, c] of faces) {
      const ab = midIdx(a,b), bc = midIdx(b,c), ca = midIdx(c,a);
      newFaces.push([a,ab,ca], [b,bc,ab], [c,ca,bc], [ab,bc,ca]);
    }
    faces = newFaces;
  }
  return { vertices: verts, faces };
}

// ── p5 sketch ──────────────────────────────────────────────────────────────────
new p5(function(p) {
  const RADIUS = 150;
  const DISP   = 70;
  const LIGHT  = norm3([0.8, 1.4, 1.0]);

  const cfg = {
    seed: 42, nscale: 0.30, offX: 0, offY: 0,
    complexity: 2, colorA: '#1a3aff', colorB: '#ff1a6e'
  };

  let geo, displaced, faceCache;
  let camTheta = 0.4, camPhi = 0.70, camR = 480;
  let dragging = false, px = 0, py = 0;

  // ── Build crystal geometry ────────────────────────────────────────────────────
  function buildCrystal() {
    p.noiseSeed(cfg.seed);

    const verts = BASE_V.map(v => [...v]);
    const faces = BASE_F.map(f => [...f]);
    geo = subdivide(verts, faces, cfg.complexity - 1);

    displaced = geo.vertices.map(v => {
      const nx = v[0] * cfg.nscale + cfg.offX;
      const ny = v[1] * cfg.nscale + cfg.offY;
      const nz = v[2] * cfg.nscale;
      const r = RADIUS + p.noise(nx, ny, nz) * DISP;
      return [v[0]*r, v[1]*r, v[2]*r];
    });

    const cA = hexToRGB(cfg.colorA);
    const cB = hexToRGB(cfg.colorB);

    faceCache = geo.faces.map(([ai, bi, ci]) => {
      const a = displaced[ai], b = displaced[bi], c = displaced[ci];
      const ctr = [
        (a[0]+b[0]+c[0]) / 3,
        (a[1]+b[1]+c[1]) / 3,
        (a[2]+b[2]+c[2]) / 3
      ];
      const normal = crossNorm(a, b, c);
      const t = p.noise(
        ctr[0] / RADIUS * cfg.nscale + cfg.offX,
        ctr[1] / RADIUS * cfg.nscale + cfg.offY,
        ctr[2] / RADIUS * cfg.nscale
      );
      return { ai, bi, ci, normal, color: lerpRGB(cA, cB, t) };
    });
  }

  // ── Camera position from spherical coords ─────────────────────────────────────
  function camEye() {
    return [
      camR * Math.sin(camPhi) * Math.sin(camTheta),
      camR * Math.cos(camPhi),
      camR * Math.sin(camPhi) * Math.cos(camTheta)
    ];
  }

  // ── Render crystal faces ──────────────────────────────────────────────────────
  function render() {
    const eye = camEye();
    p.camera(eye[0], eye[1], eye[2], 0, 0, 0, 0, 1, 0);
    p.perspective(Math.PI / 4, p.width / p.height, 1, 8000);

    if (!faceCache) return;

    const eyeN = norm3(eye);
    const halfDir = norm3([
      eyeN[0] + LIGHT[0],
      eyeN[1] + LIGHT[1],
      eyeN[2] + LIGHT[2]
    ]);

    for (const f of faceCache) {
      if (dot3(f.normal, eye) <= 0) continue;

      const diff = Math.max(0, dot3(f.normal, LIGHT)) * 0.45 + 0.45;
      const spec = Math.pow(Math.max(0, dot3(f.normal, halfDir)), 28) * 85;

      p.fill(
        Math.min(255, f.color[0] * diff + spec),
        Math.min(255, f.color[1] * diff + spec),
        Math.min(255, f.color[2] * diff + spec)
      );
      p.beginShape();
      const a = displaced[f.ai], b = displaced[f.bi], c = displaced[f.ci];
      p.vertex(a[0], a[1], a[2]);
      p.vertex(b[0], b[1], b[2]);
      p.vertex(c[0], c[1], c[2]);
      p.endShape(p.CLOSE);
    }
  }

  // ── p5 lifecycle ──────────────────────────────────────────────────────────────
  p.setup = function() {
    const wrap = document.getElementById('canvas-wrap');
    const cnv = p.createCanvas(wrap.clientWidth, wrap.clientHeight, p.WEBGL);
    cnv.parent('canvas-wrap');
    p.noStroke();
    buildCrystal();
    bindUI();

    const el = cnv.elt;

    el.addEventListener('mousedown', e => {
      dragging = true; px = e.clientX; py = e.clientY;
    });
    window.addEventListener('mouseup', () => { dragging = false; });
    window.addEventListener('mousemove', e => {
      if (!dragging) return;
      camTheta -= (e.clientX - px) * 0.007;
      camPhi = Math.max(0.05, Math.min(Math.PI - 0.05, camPhi - (e.clientY - py) * 0.007));
      px = e.clientX; py = e.clientY;
    });

    el.addEventListener('wheel', e => {
      camR = Math.max(200, Math.min(1400, camR + e.deltaY * 0.5));
      e.preventDefault();
    }, { passive: false });

    // Touch support for mobile orbit
    let lastTouchX = 0, lastTouchY = 0, lastPinchDist = 0;
    el.addEventListener('touchstart', e => {
      e.preventDefault();
      if (e.touches.length === 1) {
        lastTouchX = e.touches[0].clientX;
        lastTouchY = e.touches[0].clientY;
      } else if (e.touches.length === 2) {
        lastPinchDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      }
    }, { passive: false });
    el.addEventListener('touchmove', e => {
      e.preventDefault();
      if (e.touches.length === 1) {
        camTheta -= (e.touches[0].clientX - lastTouchX) * 0.007;
        camPhi = Math.max(0.05, Math.min(Math.PI - 0.05, camPhi - (e.touches[0].clientY - lastTouchY) * 0.007));
        lastTouchX = e.touches[0].clientX;
        lastTouchY = e.touches[0].clientY;
      } else if (e.touches.length === 2) {
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        camR = Math.max(200, Math.min(1400, camR - (dist - lastPinchDist) * 1.5));
        lastPinchDist = dist;
      }
    }, { passive: false });
  };

  p.draw = function() {
    p.background(8, 8, 15);
    render();
  };

  p.windowResized = function() {
    const wrap = document.getElementById('canvas-wrap');
    p.resizeCanvas(wrap.clientWidth, wrap.clientHeight);
  };

  // ── PNG export (transparent background) ───────────────────────────────────────
  function doExport() {
    p.clear();
    render();
    p.saveCanvas('crystal', 'png');
  }

  // ── UI bindings ───────────────────────────────────────────────────────────────
  function bindUI() {
    function bindSlider(id, key, fmt) {
      const el = document.getElementById(id);
      const vl = document.getElementById(id + '-v');
      el.addEventListener('input', () => {
        cfg[key] = parseFloat(el.value);
        if (vl) vl.textContent = fmt(cfg[key]);
        buildCrystal();
      });
    }

    const faceCounts = [20, 80, 320, 1280];

    bindSlider('seed',       'seed',       v => Math.round(v));
    bindSlider('nscale',     'nscale',     v => v.toFixed(2));
    bindSlider('offx',       'offX',       v => v.toFixed(2));
    bindSlider('offy',       'offY',       v => v.toFixed(2));
    bindSlider('complexity', 'complexity', v => {
      const n = Math.round(v);
      return n + '  (' + faceCounts[n-1] + ' faces)';
    });

    document.getElementById('colorA').addEventListener('input', e => {
      cfg.colorA = e.target.value;
      buildCrystal();
    });
    document.getElementById('colorB').addEventListener('input', e => {
      cfg.colorB = e.target.value;
      buildCrystal();
    });

    document.getElementById('export-btn').addEventListener('click', doExport);
  }
});
