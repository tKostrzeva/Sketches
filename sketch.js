/* global p5 */

// ── Math helpers ───────────────────────────────────────────────────────────────
function norm3(v) {
  const l = Math.sqrt(v[0]*v[0] + v[1]*v[1] + v[2]*v[2]);
  return l < 1e-10 ? [0,0,0] : [v[0]/l, v[1]/l, v[2]/l];
}
function dot3(a, b)  { return a[0]*b[0] + a[1]*b[1] + a[2]*b[2]; }
function sub3(a, b)  { return [a[0]-b[0], a[1]-b[1], a[2]-b[2]]; }
function cross3(a, b){ return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]; }

function hexToRGB(h) {
  return [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)];
}
function lerpRGB(a, b, t) {
  return [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t];
}

// ── 3D Convex Hull (incremental) ───────────────────────────────────────────────
function convexHull3D(pts) {
  const n = pts.length;
  if (n < 4) return [];

  function above(fi, p) {
    const [a, b, c] = faces[fi];
    const nrm = cross3(sub3(pts[b], pts[a]), sub3(pts[c], pts[a]));
    return dot3(nrm, sub3(p, pts[a]));
  }

  let iMinX = 0, iMaxX = 0, iMinY = 0, iMaxY = 0;
  for (let i = 1; i < n; i++) {
    if (pts[i][0] < pts[iMinX][0]) iMinX = i;
    if (pts[i][0] > pts[iMaxX][0]) iMaxX = i;
    if (pts[i][1] < pts[iMinY][1]) iMinY = i;
    if (pts[i][1] > pts[iMaxY][1]) iMaxY = i;
  }

  const [p0, p1, p2] = [...new Set([iMinX, iMaxX, iMinY, iMaxY, 0, 1, 2])].slice(0, 3);
  const nrm012 = cross3(sub3(pts[p1], pts[p0]), sub3(pts[p2], pts[p0]));
  let p3 = -1, maxD = 0;
  for (let i = 0; i < n; i++) {
    if (i === p0 || i === p1 || i === p2) continue;
    const d = Math.abs(dot3(nrm012, sub3(pts[i], pts[p0])));
    if (d > maxD) { maxD = d; p3 = i; }
  }
  if (p3 < 0) return [];

  let faces = [
    [p0,p1,p2], [p0,p3,p1], [p0,p2,p3], [p1,p3,p2]
  ];

  const cx = (pts[p0][0]+pts[p1][0]+pts[p2][0]+pts[p3][0])/4;
  const cy = (pts[p0][1]+pts[p1][1]+pts[p2][1]+pts[p3][1])/4;
  const cz = (pts[p0][2]+pts[p1][2]+pts[p2][2]+pts[p3][2])/4;
  const centroid = [cx, cy, cz];
  faces = faces.map(([a,b,c]) => {
    const nrm = cross3(sub3(pts[b], pts[a]), sub3(pts[c], pts[a]));
    return dot3(nrm, sub3(centroid, pts[a])) > 0 ? [a,c,b] : [a,b,c];
  });

  for (let i = 0; i < n; i++) {
    if (i === p0 || i === p1 || i === p2 || i === p3) continue;

    const visible = new Set();
    for (let fi = 0; fi < faces.length; fi++) {
      if (above(fi, pts[i]) > 1e-10) visible.add(fi);
    }
    if (visible.size === 0) continue;

    const visEdges = new Set();
    for (const fi of visible) {
      const [a,b,c] = faces[fi];
      visEdges.add(a+'_'+b); visEdges.add(b+'_'+c); visEdges.add(c+'_'+a);
    }
    const horizon = [];
    for (const fi of visible) {
      for (const [ea,eb] of [[faces[fi][0],faces[fi][1]],[faces[fi][1],faces[fi][2]],[faces[fi][2],faces[fi][0]]]) {
        if (!visEdges.has(eb+'_'+ea)) horizon.push([ea,eb]);
      }
    }

    faces = faces.filter((_,fi) => !visible.has(fi));
    for (const [ea,eb] of horizon) faces.push([i,ea,eb]);
  }

  return faces;
}

// ── p5 sketch ──────────────────────────────────────────────────────────────────
new p5(function(p) {
  const RADIUS = 150;
  const DISP   = 200;

  const cfg = {
    seed: 42, nscale: 0.80, offX: 0, offY: 0,
    complexity: 2, spike: 1.8, opacity: 255,
    colorA: '#1a3aff', colorB: '#ff1a6e'
  };

  let pts, hullFaces, faceCache;
  let camTheta = 0.4, camPhi = 0.70, camR = 480;
  let dragging = false, px = 0, py = 0;

  function buildCrystal() {
    p.noiseSeed(cfg.seed);
    p.randomSeed(cfg.seed);

    const counts = [12, 24, 48, 96, 200, 400];
    const N = counts[cfg.complexity - 1];

    const unitPts = [];
    for (let i = 0; i < N; i++) {
      const phi   = Math.acos(1 - 2*(i+0.5)/N);
      const theta = Math.PI * (1+Math.sqrt(5)) * i;
      const jt = 0.55;
      unitPts.push(norm3([
        Math.sin(phi)*Math.cos(theta) + p.random(-jt,jt),
        Math.cos(phi)                 + p.random(-jt,jt),
        Math.sin(phi)*Math.sin(theta) + p.random(-jt,jt)
      ]));
    }

    pts = unitPts.map(v => {
      const nx = v[0]*cfg.nscale + cfg.offX;
      const ny = v[1]*cfg.nscale + cfg.offY;
      const nz = v[2]*cfg.nscale;
      const raw = p.noise(nx, ny, nz) * 0.65
                + p.noise(nx*2.8+17.3, ny*2.8+5.1, nz*2.8) * 0.35;
      const n = Math.pow(raw, cfg.spike);
      const r = RADIUS + n * DISP;
      return [v[0]*r, v[1]*r, v[2]*r];
    });

    hullFaces = convexHull3D(pts);

    const cA = hexToRGB(cfg.colorA);
    const cB = hexToRGB(cfg.colorB);

    faceCache = hullFaces.map(([ai,bi,ci]) => {
      const a=pts[ai], b=pts[bi], c=pts[ci];
      const normal = norm3(cross3(sub3(b,a), sub3(c,a)));
      const ctr = [(a[0]+b[0]+c[0])/3,(a[1]+b[1]+c[1])/3,(a[2]+b[2]+c[2])/3];
      const t = p.noise(
        ctr[0]/RADIUS*cfg.nscale+cfg.offX,
        ctr[1]/RADIUS*cfg.nscale+cfg.offY,
        ctr[2]/RADIUS*cfg.nscale
      );
      return { a, b, c, normal, color: lerpRGB(cA,cB,t) };
    });
  }

  function camEye() {
    return [
      camR*Math.sin(camPhi)*Math.sin(camTheta),
      camR*Math.cos(camPhi),
      camR*Math.sin(camPhi)*Math.cos(camTheta)
    ];
  }

  function render() {
    const eye = camEye();
    p.camera(eye[0],eye[1],eye[2], 0,0,0, 0,1,0);
    p.perspective(Math.PI/4, p.width/p.height, 1, 8000);
    if (!faceCache) return;

    for (const f of faceCache) {
      if (dot3(f.normal, eye) <= 0) continue;
      p.fill(f.color[0], f.color[1], f.color[2], cfg.opacity);
      p.beginShape();
      p.vertex(f.a[0],f.a[1],f.a[2]);
      p.vertex(f.b[0],f.b[1],f.b[2]);
      p.vertex(f.c[0],f.c[1],f.c[2]);
      p.endShape(p.CLOSE);
    }
  }

  p.setup = function() {
    const wrap = document.getElementById('canvas-wrap');
    const cnv = p.createCanvas(wrap.clientWidth, wrap.clientHeight, p.WEBGL);
    cnv.parent('canvas-wrap');
    p.noStroke();
    buildCrystal();
    bindUI();

    const el = cnv.elt;
    el.addEventListener('mousedown', e => { dragging=true; px=e.clientX; py=e.clientY; });
    window.addEventListener('mouseup', () => { dragging=false; });
    window.addEventListener('mousemove', e => {
      if (!dragging) return;
      camTheta -= (e.clientX-px)*0.007;
      camPhi = Math.max(0.05, Math.min(Math.PI-0.05, camPhi-(e.clientY-py)*0.007));
      px=e.clientX; py=e.clientY;
    });
    el.addEventListener('wheel', e => {
      camR = Math.max(200, Math.min(1400, camR+e.deltaY*0.5));
      e.preventDefault();
    }, { passive: false });

    let lastTouchX=0, lastTouchY=0, lastPinchDist=0;
    el.addEventListener('touchstart', e => {
      e.preventDefault();
      if (e.touches.length===1) { lastTouchX=e.touches[0].clientX; lastTouchY=e.touches[0].clientY; }
      else if (e.touches.length===2) lastPinchDist=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);
    }, { passive: false });
    el.addEventListener('touchmove', e => {
      e.preventDefault();
      if (e.touches.length===1) {
        camTheta -= (e.touches[0].clientX-lastTouchX)*0.007;
        camPhi = Math.max(0.05, Math.min(Math.PI-0.05, camPhi-(e.touches[0].clientY-lastTouchY)*0.007));
        lastTouchX=e.touches[0].clientX; lastTouchY=e.touches[0].clientY;
      } else if (e.touches.length===2) {
        const dist=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);
        camR=Math.max(200, Math.min(1400, camR-(dist-lastPinchDist)*1.5));
        lastPinchDist=dist;
      }
    }, { passive: false });
  };

  p.draw = function() { p.background(8,8,15); render(); };

  p.windowResized = function() {
    const wrap = document.getElementById('canvas-wrap');
    p.resizeCanvas(wrap.clientWidth, wrap.clientHeight);
  };

  function doExport() { p.clear(); render(); p.saveCanvas('crystal','png'); }

  function bindUI() {
    function bindSlider(id, key, fmt) {
      const el = document.getElementById(id);
      const vl = document.getElementById(id+'-v');
      el.addEventListener('input', () => {
        cfg[key] = parseFloat(el.value);
        if (vl) vl.textContent = fmt(cfg[key]);
        buildCrystal();
      });
    }
    const ptCounts = [12, 24, 48, 96, 200, 400];
    bindSlider('seed',       'seed',       v => Math.round(v));
    bindSlider('nscale',     'nscale',     v => v.toFixed(2));
    bindSlider('offx',       'offX',       v => v.toFixed(2));
    bindSlider('offy',       'offY',       v => v.toFixed(2));
    bindSlider('complexity', 'complexity', v => { const n=Math.round(v); return n+'  ('+ptCounts[n-1]+' pts)'; });
    bindSlider('spike',      'spike',      v => v.toFixed(2));

    const opacityEl = document.getElementById('opacity');
    const opacityVl = document.getElementById('opacity-v');
    opacityEl.addEventListener('input', () => {
      cfg.opacity = parseFloat(opacityEl.value);
      if (opacityVl) opacityVl.textContent = Math.round(cfg.opacity);
    });

    document.getElementById('colorA').addEventListener('input', e => { cfg.colorA=e.target.value; buildCrystal(); });
    document.getElementById('colorB').addEventListener('input', e => { cfg.colorB=e.target.value; buildCrystal(); });
    document.getElementById('export-btn').addEventListener('click', doExport);
    const panel=document.getElementById('panel'), toggleBtn=document.getElementById('toggle-btn'), closeBtn=document.getElementById('close-btn');
    toggleBtn.addEventListener('click', () => { panel.classList.add('open'); toggleBtn.classList.add('hidden'); });
    closeBtn.addEventListener('click',  () => { panel.classList.remove('open'); toggleBtn.classList.remove('hidden'); });
  }
});
