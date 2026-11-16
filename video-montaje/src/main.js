import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CONFIG } from './config.js';

const QS = new URLSearchParams(location.search);
const VERT = QS.get('formato') === 'vertical';
const W = VERT ? 1080 : 1920, H = VERT ? 1920 : 1080;
export const DURATION = 38.5;
const CAPTURE = QS.has('capture');
const CIERRE = QS.get('cierre') || CONFIG.cierre;

// ---------- utilidades ----------
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const lerp = (a, b, k) => a + (b - a) * k;
const prog = (t, t0, dur) => clamp01((t - t0) / dur);
const easeOut = (p) => 1 - Math.pow(1 - p, 3);
const easeInOut = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
const easeOutBack = (p) => { const c = 1.6; return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); };
const fmt = (n, dec = 2) => n.toLocaleString('es-AR', { minimumFractionDigits: dec, maximumFractionDigits: dec });

const C = { bg: 0x0a0f1e, plate: 0x17223c, teal: 0x2dd4bf, blue: 0x4f8cff, amber: 0xfbbf24, green: 0x34d399 };
const MONO = '"JetBrains Mono", "DejaVu Sans Mono", ui-monospace, Menlo, monospace';
const SANS = 'Inter, "Helvetica Neue", Arial, sans-serif';

// ---------- escena ----------
const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color(C.bg);
scene.fog = VERT ? new THREE.Fog(C.bg, 42, 100) : new THREE.Fog(C.bg, 26, 70);
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.45;

const camera = new THREE.PerspectiveCamera(VERT ? 40 : 28, W / H, 0.1, 300);

scene.add(new THREE.HemisphereLight(0x9db8ff, 0x0b1020, 0.55));
const key = new THREE.DirectionalLight(0xffffff, 2.4);
key.position.set(7, 14, 9);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 40 });
key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
scene.add(key);
const rim = new THREE.DirectionalLight(0x5b8cff, 1.1);
rim.position.set(-7, 5, -9);
scene.add(rim);

const floor = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), new THREE.MeshStandardMaterial({ color: 0x0b1122, roughness: 0.95, metalness: 0 }));
floor.rotation.x = -Math.PI / 2; floor.position.y = -0.03; floor.receiveShadow = true;
scene.add(floor);
const grid = new THREE.GridHelper(120, 120, 0x22335a, 0x141e38);
grid.position.y = -0.02;
scene.add(grid);

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.1, ...o });
const glow = (color, i = 1.2) => new THREE.MeshStandardMaterial({ color: 0x000000, emissive: color, emissiveIntensity: i, roughness: 0.4 });
const mesh = (geo, mat, shadow = true) => { const m = new THREE.Mesh(geo, mat); m.castShadow = shadow; m.receiveShadow = true; return m; };

// ---------- sistema de piezas ----------
const parts = [];
const updaters = [];
function addPart(obj, { t0, dur = 0.95, from = [0, 6, 0], spin = 0, ringR = 0, parent = scene }) {
  const mats = [];
  obj.traverse((o) => { if (o.material && !mats.includes(o.material)) mats.push(o.material); });
  let ring = null;
  if (ringR) {
    ring = new THREE.Mesh(new THREE.RingGeometry(ringR * 0.93, ringR, 64),
      new THREE.MeshBasicMaterial({ color: C.teal, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(obj.position.x, 0.425, obj.position.z);
    scene.add(ring);
  }
  parts.push({ obj, t0, dur, from: new THREE.Vector3(...from), final: obj.position.clone(), rotY: obj.rotation.y, spin, mats, ring });
  parent.add(obj);
}
function updateParts(t) {
  for (const p of parts) {
    const k = prog(t, p.t0, p.dur);
    p.obj.visible = k > 0;
    const e = easeOut(k);
    p.obj.position.copy(p.final).addScaledVector(p.from, 1 - e);
    p.obj.rotation.y = p.rotY + p.spin * (1 - e);
    const a = clamp01(k / 0.3);
    for (const m of p.mats) { m.transparent = a < 1; m.opacity = a; }
    if (p.ring) {
      const q = prog(t, p.t0 + p.dur * 0.8, 0.8);
      p.ring.visible = q > 0 && q < 1;
      p.ring.scale.setScalar(lerp(0.6, 1.9, easeOut(q)));
      p.ring.material.opacity = 0.75 * (1 - q);
    }
  }
}

function canvasTex(w, h) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return { cv, ctx: cv.getContext('2d'), tex, key: null };
}
function rrect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }

// ---------- tiempos ----------
const T = { base: 1.0, db: 3.2, recon: 6.6, match: 8.3, gears: 11.6, chart: 15.1, term: 19.2, dash: 23.2, flow: 27.2, tags: 28.8, end: 31.2, brand: 33.7 };

// ---------- 00 base ----------
{
  const g = new THREE.Group();
  const plate = mesh(new RoundedBoxGeometry(11.6, 0.4, 7.4, 6, 0.12), std(C.plate, { roughness: 0.5, metalness: 0.35 }));
  plate.position.y = 0.2;
  const trim = mesh(new RoundedBoxGeometry(11.72, 0.05, 7.52, 4, 0.025), glow(C.teal, 0.9), false);
  trim.position.y = 0.07;
  g.add(plate, trim);
  addPart(g, { t0: T.base, dur: 1.3, from: [0, -3.5, 0] });
}

// ---------- 01 fuentes de datos ----------
const DB = new THREE.Vector3(-3.9, 0.4, -2.0);
for (let i = 0; i < 3; i++) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.5, 56), std(0x2a3f70, { metalness: 0.6, roughness: 0.3 })));
  const band = mesh(new THREE.CylinderGeometry(0.962, 0.962, 0.07, 56, 1, true), glow(C.teal, 1.3), false);
  band.position.y = 0.1; g.add(band);
  const cap = mesh(new THREE.CylinderGeometry(0.78, 0.78, 0.03, 56), std(0x3a5391, { metalness: 0.5, roughness: 0.35 }));
  cap.position.y = 0.255; g.add(cap);
  g.position.set(DB.x, DB.y + 0.25 + i * 0.62, DB.z);
  addPart(g, { t0: T.db + i * 0.42, from: [0, 5 + i, 0], spin: 1.2, ringR: i === 0 ? 1.15 : 0 });
}

// ---------- 02 conciliación bancaria ----------
const ROWS = [
  ['03/11', 'Transferencia recibida', 1250000.0],
  ['05/11', 'Pago a proveedor', -384500.0],
  ['08/11', 'Comisión bancaria', -12350.0],
  ['12/11', 'Depósito', 640000.0],
  ['15/11', 'Débito automático', -98760.0],
  ['19/11', 'Cheque 004512', -215000.0],
];
const FLAG = 2; // partida que está en el banco y no en los libros
const SHEET = { w: 1.9, d: 2.6, cw: 608, ch: 832, zc: 1.9, xa: -4.3, xb: -1.7 };
const rowY = (i) => 240 + i * 92;
const rowZ = (i) => SHEET.zc + (rowY(i) / SHEET.ch - 0.5) * SHEET.d;
const matchState = (t, i) => prog(t, T.match + i * 0.42, 0.35);

function drawSheet(s, t, libro) {
  const st = ROWS.map((_, i) => matchState(t, i));
  const k = st.map((v) => v.toFixed(2)).join();
  if (s.key === k) return; s.key = k;
  const { ctx } = s, { cw, ch } = SHEET;
  ctx.fillStyle = '#f4f6fb'; ctx.fillRect(0, 0, cw, ch);
  ctx.fillStyle = libro ? '#0f766e' : '#1e3a8a'; ctx.fillRect(0, 0, cw, 122);
  ctx.fillStyle = '#fff'; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  ctx.font = `700 36px ${SANS}`; ctx.fillText(libro ? 'LIBRO MAYOR' : 'EXTRACTO BANCARIO', 32, 62);
  ctx.font = `500 21px ${SANS}`; ctx.globalAlpha = 0.85;
  ctx.fillText(libro ? 'Banco cta. cte. · Noviembre' : 'Cuenta corriente · Noviembre', 32, 98); ctx.globalAlpha = 1;
  ctx.fillStyle = '#64748b'; ctx.font = `600 17px ${SANS}`;
  ctx.fillText('FECHA', 36, 172); ctx.fillText('CONCEPTO', 128, 172);
  ctx.textAlign = 'right'; ctx.fillText('IMPORTE', 532, 172); ctx.textAlign = 'left';
  ctx.fillStyle = '#cbd5e1'; ctx.fillRect(24, 186, cw - 48, 2);
  let saldo = 0;
  ROWS.forEach(([fecha, concepto, imp], i) => {
    const y = rowY(i), flagged = i === FLAG, missing = flagged && libro;
    if (!missing) saldo += imp;
    if (st[i] > 0) {
      ctx.globalAlpha = st[i];
      ctx.fillStyle = flagged ? 'rgba(245,158,11,.26)' : 'rgba(16,185,129,.2)';
      rrect(ctx, 18, y - 38, cw - 36, 76, 12); ctx.fill();
      ctx.fillStyle = flagged ? '#d97706' : '#059669';
      ctx.beginPath(); ctx.arc(564, y, 15, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = `700 20px ${SANS}`; ctx.textAlign = 'center';
      ctx.fillText(flagged ? '!' : '✓', 564, y + 7); ctx.textAlign = 'left';
      ctx.globalAlpha = 1;
    }
    if (missing) {
      ctx.fillStyle = st[i] > 0.5 ? '#b45309' : '#94a3b8'; ctx.font = `italic 500 22px ${SANS}`;
      ctx.fillText('—  sin registrar  —', 128, y + 8);
      return;
    }
    ctx.fillStyle = '#475569'; ctx.font = `500 20px ${MONO}`; ctx.fillText(fecha, 36, y + 7);
    ctx.fillStyle = '#0f172a'; ctx.font = `500 22px ${SANS}`; ctx.fillText(concepto, 128, y + 8);
    ctx.fillStyle = imp < 0 ? '#b91c1c' : '#0f172a'; ctx.font = `700 20px ${MONO}`; ctx.textAlign = 'right';
    ctx.fillText(fmt(imp), 536, y + 7); ctx.textAlign = 'left';
  });
  ctx.fillStyle = '#cbd5e1'; ctx.fillRect(24, 752, cw - 48, 2);
  ctx.fillStyle = '#334155'; ctx.font = `700 21px ${SANS}`; ctx.fillText('SALDO', 36, 796);
  ctx.fillStyle = '#0f172a'; ctx.font = `700 23px ${MONO}`; ctx.textAlign = 'right'; ctx.fillText(fmt(saldo), 536, 796); ctx.textAlign = 'left';
  s.tex.needsUpdate = true;
}
function makeSheet(x, libro, t0, from) {
  const s = canvasTex(SHEET.cw, SHEET.ch);
  const g = new THREE.Group();
  g.add(mesh(new RoundedBoxGeometry(SHEET.w, 0.07, SHEET.d, 3, 0.03), std(0xe9edf6, { roughness: 0.85 })));
  const face = new THREE.Mesh(new THREE.PlaneGeometry(SHEET.w - 0.04, SHEET.d - 0.04), new THREE.MeshStandardMaterial({ map: s.tex, roughness: 0.9, metalness: 0 }));
  face.rotation.x = -Math.PI / 2; face.position.y = 0.037; face.receiveShadow = true;
  g.add(face);
  g.position.set(x, 0.44, SHEET.zc);
  addPart(g, { t0, from, spin: libro ? -0.7 : 0.7, ringR: 0 });
  updaters.push((t) => drawSheet(s, t, libro));
}
makeSheet(SHEET.xa, false, T.recon, [-6, 2.5, 1]);
makeSheet(SHEET.xb, true, T.recon + 0.5, [1, 5, 5]);
{
  const x0 = SHEET.xa + SHEET.w / 2, len = SHEET.xb - SHEET.xa - SHEET.w;
  ROWS.forEach((_, i) => {
    if (i === FLAG) {
      const m = mesh(new THREE.OctahedronGeometry(0.15), glow(C.amber, 1.6));
      scene.add(m);
      updaters.push((t) => {
        const s = matchState(t, i);
        m.visible = s > 0; m.scale.setScalar(Math.max(0.001, easeOutBack(s)));
        m.position.set(x0 + len / 2, 0.72 + 0.05 * Math.sin(t * 3), rowZ(i)); m.rotation.y = t * 1.5;
      });
      return;
    }
    const bar = mesh(new THREE.BoxGeometry(len, 0.05, 0.07), glow(C.green, 1.4), false);
    scene.add(bar);
    updaters.push((t) => {
      const s = easeOut(matchState(t, i));
      bar.visible = s > 0; bar.scale.x = Math.max(0.001, s);
      bar.position.set(x0 + (len * s) / 2, 0.5, rowZ(i));
    });
  });
}

// ---------- 03 automatización (engranajes) ----------
function gearShape(N, m) {
  const rp = (m * N) / 2, ro = rp + m, rr = rp - 1.25 * m, step = (Math.PI * 2) / N, s = new THREE.Shape();
  for (let i = 0; i < N; i++) {
    const a = i * step;
    [[rr, a - step * 0.28], [ro, a - step * 0.13], [ro, a + step * 0.13], [rr, a + step * 0.28]].forEach(([r, an], k) => {
      const x = r * Math.cos(an), y = r * Math.sin(an);
      if (i === 0 && k === 0) s.moveTo(x, y); else s.lineTo(x, y);
    });
  }
  s.closePath();
  const hole = new THREE.Path(); hole.absarc(0, 0, rp * 0.24, 0, Math.PI * 2, true); s.holes.push(hole);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.3, h = new THREE.Path();
    h.absarc(rp * 0.58 * Math.cos(a), rp * 0.58 * Math.sin(a), rp * 0.16, 0, Math.PI * 2, true); s.holes.push(h);
  }
  return s;
}
const HUB = new THREE.Vector3(0.2, 0.4, 0.0);
{
  const gg = new THREE.Group();
  gg.position.set(HUB.x, 0.47, HUB.z); gg.rotation.x = -Math.PI / 2; gg.scale.setScalar(0.8);
  scene.add(gg);
  const M = 0.125, deg = Math.PI / 180;
  const defs = [
    { N: 16, th: 0, dist: 0, color: 0x9fb4dc },
    { N: 10, th: 25 * deg, color: 0x2dd4bf },
    { N: 12, th: 160 * deg, color: 0x6f9bff },
  ];
  const gears = defs.map((d, i) => {
    const g = new THREE.Group();
    const body = mesh(new THREE.ExtrudeGeometry(gearShape(d.N, M), { depth: 0.26, bevelEnabled: true, bevelSize: 0.018, bevelThickness: 0.018, bevelSegments: 2, curveSegments: 20 }),
      std(d.color, { metalness: 0.85, roughness: 0.28 }));
    const rp = (M * d.N) / 2;
    const axle = mesh(new THREE.CylinderGeometry(rp * 0.2, rp * 0.2, 0.4, 24), glow(C.teal, 1.1), false);
    axle.rotation.x = Math.PI / 2; axle.position.z = 0.15;
    g.add(body, axle);
    if (i > 0) { const dist = (M * (defs[0].N + d.N)) / 2; g.position.set(dist * Math.cos(d.th), dist * Math.sin(d.th), 0); }
    addPart(g, { t0: T.gears + i * 0.4, from: [0, 0, 7], parent: gg });
    return { body, d };
  });
  const p0 = parts[parts.length - 3];
  p0.ring = null;
  updaters.push((t) => {
    const s = t - (T.gears + 1.5), tau = s < 0 ? 0 : s < 1 ? (s * s) / 2 : s - 0.5;
    const rotA = 0.9 * tau, Na = defs[0].N;
    gears.forEach(({ body, d }, i) => {
      body.rotation.z = i === 0 ? rotA : d.th + Math.PI - Math.PI / d.N - (Na / d.N) * (rotA - d.th);
    });
  });
}

// ---------- 04 estadística ----------
const CH = new THREE.Vector3(3.0, 0.4, -2.0);
{
  const slab = mesh(new RoundedBoxGeometry(3.7, 0.1, 1.0, 3, 0.04), std(0x22335c, { metalness: 0.4, roughness: 0.4 }));
  slab.position.set(CH.x, 0.45, CH.z);
  addPart(slab, { t0: T.chart, from: [0, 5, 0], ringR: 0 });
  const gauss = (u) => Math.exp(-0.5 * (u / 1.7) ** 2);
  const colA = new THREE.Color(C.blue), colB = new THREE.Color(C.teal);
  for (let i = 0; i < 9; i++) {
    const g = gauss(i - 4), h = 0.25 + 2.3 * g;
    const geo = new THREE.BoxGeometry(0.28, 1, 0.5); geo.translate(0, 0.5, 0);
    const bar = mesh(geo, std(colA.clone().lerp(colB, g * g), { metalness: 0.3, roughness: 0.35 }));
    bar.position.set(CH.x + (i - 4) * 0.36, 0.5, CH.z);
    scene.add(bar);
    updaters.push((t) => { const k = prog(t, T.chart + 0.6 + i * 0.12, 0.6); bar.visible = k > 0; bar.scale.y = Math.max(0.001, h * easeOutBack(k)); });
  }
  const pts = [];
  for (let j = 0; j <= 60; j++) { const x = -1.85 + (3.7 * j) / 60; pts.push(new THREE.Vector3(CH.x + x, 0.5 + 0.25 + 2.3 * gauss(x / 0.36) + 0.16, CH.z)); }
  const SEG = 160, RAD = 8;
  const tube = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), SEG, 0.04, RAD, false), glow(C.amber, 1.5), false);
  scene.add(tube);
  updaters.push((t) => { const k = easeInOut(prog(t, T.chart + 2.0, 1.3)); tube.visible = k > 0; tube.geometry.setDrawRange(0, Math.floor(SEG * k) * RAD * 6); });
}

// ---------- 05 programación (terminal) ----------
const TM = new THREE.Vector3(3.1, 0.4, 1.9);
const CODE = [
  'import pandas as pd',
  '',
  'banco = pd.read_excel("extracto.xlsx")',
  'libro = pd.read_sql(CONSULTA, conexion)',
  '',
  '# cruce partida por partida',
  'cruce = banco.merge(libro, on=["fecha", "importe"],',
  '                    how="outer", indicator=True)',
  '',
  'pendientes = cruce[cruce["_merge"] != "both"]',
  'print(f"Conciliado: {tasa:.1%}")',
];
const TOK = /(#.*$)|(f?"[^"]*")|\b(import|as|True|False)\b|\b(\d+(?:\.\d+)?)\b|([A-Za-z_]\w*(?=\())|(\s+|\w+|.)/g;
const TOKCOL = ['#6b7fa8', '#fbbf24', '#c084fc', '#f472b6', '#60a5fa', '#dbe4f5'];
{
  const s = canvasTex(1120, 680);
  const total = CODE.reduce((a, l) => a + l.length + 1, 0);
  const draw = (t) => {
    const n = Math.floor(total * prog(t, T.term + 1.0, 2.0)), done = t > T.term + 3.15;
    const blink = Math.floor(t * 2.5) % 2;
    const k = `${n}|${done}|${blink}`;
    if (s.key === k) return; s.key = k;
    const { ctx } = s;
    ctx.fillStyle = '#0b1020'; ctx.fillRect(0, 0, 1120, 680);
    ctx.fillStyle = '#131b33'; ctx.fillRect(0, 0, 1120, 52);
    ['#f87171', '#fbbf24', '#34d399'].forEach((c, i) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(30 + i * 26, 26, 8, 0, 7); ctx.fill(); });
    ctx.fillStyle = '#8fa2c6'; ctx.font = `500 20px ${MONO}`; ctx.textBaseline = 'middle'; ctx.fillText('conciliacion.py', 124, 27);
    ctx.font = `500 24px ${MONO}`;
    const cw = ctx.measureText('M').width, lh = 40, x0 = 82, y0 = 96;
    let left = n, cx = x0, cy = y0;
    CODE.forEach((line, li) => {
      const y = y0 + li * lh;
      if (left <= 0 && li > 0) return;
      ctx.fillStyle = '#3d4d74'; ctx.textAlign = 'right'; ctx.fillText(String(li + 1), 56, y); ctx.textAlign = 'left';
      let col = 0; TOK.lastIndex = 0; let m;
      while ((m = TOK.exec(line)) && left > 0) {
        const gi = m.slice(1).findIndex((v) => v !== undefined), txt = m[0].slice(0, left);
        ctx.fillStyle = TOKCOL[gi]; ctx.fillText(txt, x0 + col * cw, y);
        col += txt.length; left -= txt.length;
        if (m[0].length === 0) TOK.lastIndex++;
      }
      cx = x0 + col * cw; cy = y;
      left -= 1;
    });
    if (done) {
      const y = y0 + (CODE.length + 1) * lh;
      ctx.fillStyle = '#5eead4'; ctx.fillText('>>> Conciliado: 98.7%  ·  17 partidas pendientes', x0, y);
      cx = x0; cy = y + lh;
    }
    if (blink) { ctx.fillStyle = '#5eead4'; ctx.fillRect(cx + 2, cy - 14, cw, 28); }
    s.tex.needsUpdate = true;
  };
  const g = new THREE.Group();
  const body = mesh(new RoundedBoxGeometry(3.0, 1.9, 0.12, 4, 0.05), std(0x101830, { metalness: 0.6, roughness: 0.35 }));
  body.position.y = 0.98;
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 1.7), new THREE.MeshBasicMaterial({ map: s.tex, toneMapped: false }));
  scr.position.set(0, 0.98, 0.062);
  const tilt = new THREE.Group(); tilt.add(body, scr); tilt.rotation.x = -0.24;
  const foot = mesh(new RoundedBoxGeometry(3.0, 0.08, 0.7, 3, 0.03), std(0x22335c, { metalness: 0.5, roughness: 0.4 }));
  foot.position.set(0, 0.04, -0.15);
  g.add(tilt, foot);
  g.position.copy(TM);
  addPart(g, { t0: T.term, from: [8, 1.5, 0], ringR: 0 });
  updaters.push(draw);
}

// ---------- 06 tablero ----------
const DS = new THREE.Vector3(0, 4.5, -3.0);
{
  const mast = new THREE.Group();
  const pole = mesh(new THREE.CylinderGeometry(0.1, 0.1, 2.6, 24), std(0x8fa3c8, { metalness: 0.85, roughness: 0.3 })); pole.position.y = 1.3;
  const foot = mesh(new THREE.CylinderGeometry(0.55, 0.6, 0.1, 40), std(0x22335c, { metalness: 0.5, roughness: 0.4 })); foot.position.y = 0.05;
  mast.add(pole, foot); mast.position.set(DS.x, 0.4, DS.z);
  addPart(mast, { t0: T.dash, from: [0, 7, 0], ringR: 0.8 });

  const s = canvasTex(1280, 720);
  const serie = [22, 25, 24, 29, 31, 30, 35, 38, 36, 42, 45, 48.2];
  const prev = [23, 24, 26, 27, 29, 31, 33, 35, 37, 39, 41, 43];
  const donut = [[0.46, '#2dd4bf', 'Cobranzas'], [0.27, '#4f8cff', 'Transferencias'], [0.17, '#fbbf24', 'Cheques'], [0.1, '#f472b6', 'Otros']];
  const draw = (t) => {
    const td = t - (T.dash + 1.7);
    const a = easeOut(clamp01(td / 1.6)), line = easeInOut(clamp01((td - 0.3) / 1.8));
    const k = `${a.toFixed(3)}|${line.toFixed(3)}`;
    if (s.key === k) return; s.key = k;
    const { ctx } = s;
    ctx.fillStyle = '#0b1224'; ctx.fillRect(0, 0, 1280, 720);
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    ctx.fillStyle = '#e8eefb'; ctx.font = `700 34px ${SANS}`; ctx.fillText('Panel financiero', 40, 62); const tw = ctx.measureText('Panel financiero').width;
    ctx.fillStyle = '#7f92b8'; ctx.font = `500 22px ${SANS}`; ctx.fillText('Noviembre · acumulado anual', 40 + tw + 22, 61);
    ctx.fillStyle = '#2dd4bf'; ctx.beginPath(); ctx.arc(1064, 52, 7, 0, 7); ctx.fill();
    ctx.fillStyle = '#9fb0d0'; ctx.font = `500 20px ${SANS}`; ctx.fillText('Actualizado hoy', 1082, 59);
    const kpis = [
      ['Ingresos', `$ ${fmt(48.2 * a, 1)} M`, '▲ 12,4 % interanual', '#34d399'],
      ['Partidas conciliadas', `${fmt(98.7 * a, 1)} %`, '1.284 de 1.301', '#5eead4'],
      ['Diferencias abiertas', `${Math.round(17 * a)}`, '▼ 9 respecto a octubre', '#fbbf24'],
    ];
    kpis.forEach(([lab, val, sub, col], i) => {
      const x = 40 + i * 408;
      ctx.fillStyle = '#121c36'; rrect(ctx, x, 92, 384, 150, 16); ctx.fill();
      ctx.fillStyle = col; rrect(ctx, x, 92, 6, 150, 3); ctx.fill();
      ctx.fillStyle = '#8fa2c6'; ctx.font = `500 21px ${SANS}`; ctx.fillText(lab, x + 28, 130);
      ctx.fillStyle = '#f1f5ff'; ctx.font = `700 52px ${SANS}`; ctx.fillText(val, x + 28, 190);
      ctx.fillStyle = col; ctx.font = `500 19px ${SANS}`; ctx.globalAlpha = a; ctx.fillText(sub, x + 28, 224); ctx.globalAlpha = 1;
    });
    // evolución mensual
    ctx.fillStyle = '#121c36'; rrect(ctx, 40, 266, 792, 414, 16); ctx.fill();
    ctx.fillStyle = '#c9d5ee'; ctx.font = `600 22px ${SANS}`; ctx.fillText('Evolución mensual', 68, 308); const ew = ctx.measureText('Evolución mensual').width;
    ctx.fillStyle = '#7f92b8'; ctx.font = `500 18px ${SANS}`; ctx.fillText('real vs. previsto', 68 + ew + 16, 307);
    const gx = 76, gy = 340, gw = 724, gh = 290, X = (i) => gx + (gw * i) / 11, Y = (v) => gy + gh - ((v - 18) / 34) * gh;
    ctx.strokeStyle = '#1e2b4d'; ctx.lineWidth = 1;
    for (let j = 0; j <= 4; j++) { ctx.beginPath(); ctx.moveTo(gx, gy + (gh * j) / 4); ctx.lineTo(gx + gw, gy + (gh * j) / 4); ctx.stroke(); }
    ctx.fillStyle = '#5d6f96'; ctx.font = `500 15px ${SANS}`; ctx.textAlign = 'center';
    'EFMAMJJASOND'.split('').forEach((m, i) => ctx.fillText(m, X(i), gy + gh + 24)); ctx.textAlign = 'left';
    ctx.save(); ctx.beginPath(); ctx.rect(gx - 6, gy - 10, (gw + 12) * line, gh + 20); ctx.clip();
    ctx.setLineDash([8, 8]); ctx.strokeStyle = '#5d6f96'; ctx.lineWidth = 2.5; ctx.beginPath();
    prev.forEach((v, i) => (i ? ctx.lineTo(X(i), Y(v)) : ctx.moveTo(X(i), Y(v)))); ctx.stroke(); ctx.setLineDash([]);
    const grad = ctx.createLinearGradient(0, gy, 0, gy + gh); grad.addColorStop(0, 'rgba(45,212,191,.35)'); grad.addColorStop(1, 'rgba(45,212,191,0)');
    ctx.beginPath(); serie.forEach((v, i) => (i ? ctx.lineTo(X(i), Y(v)) : ctx.moveTo(X(i), Y(v))));
    ctx.lineTo(X(11), gy + gh); ctx.lineTo(X(0), gy + gh); ctx.closePath(); ctx.fillStyle = grad; ctx.fill();
    ctx.strokeStyle = '#2dd4bf'; ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.beginPath();
    serie.forEach((v, i) => (i ? ctx.lineTo(X(i), Y(v)) : ctx.moveTo(X(i), Y(v)))); ctx.stroke();
    ctx.fillStyle = '#0b1224'; serie.forEach((v, i) => { ctx.beginPath(); ctx.arc(X(i), Y(v), 5, 0, 7); ctx.fill(); ctx.stroke(); });
    ctx.restore();
    // composición
    ctx.fillStyle = '#121c36'; rrect(ctx, 856, 266, 384, 414, 16); ctx.fill();
    ctx.fillStyle = '#c9d5ee'; ctx.font = `600 22px ${SANS}`; ctx.fillText('Origen de fondos', 884, 308);
    let ang = -Math.PI / 2; ctx.lineWidth = 34;
    donut.forEach(([f, col]) => { const sw = f * Math.PI * 2 * a; ctx.strokeStyle = col; ctx.beginPath(); ctx.arc(1048, 436, 82, ang, ang + sw - 0.03 * a); ctx.stroke(); ang += sw; });
    ctx.fillStyle = '#f1f5ff'; ctx.font = `700 34px ${SANS}`; ctx.textAlign = 'center'; ctx.fillText(`${Math.round(100 * a)}%`, 1048, 448); ctx.textAlign = 'left';
    donut.forEach(([f, col, lab], i) => {
      const x = 884 + (i % 2) * 180, y = 590 + Math.floor(i / 2) * 38;
      ctx.fillStyle = col; rrect(ctx, x, y - 13, 14, 14, 4); ctx.fill();
      ctx.fillStyle = '#a9b8d6'; ctx.font = `500 18px ${SANS}`; ctx.fillText(`${lab} ${Math.round(f * 100)}%`, x + 24, y);
    });
    s.tex.needsUpdate = true;
  };
  const g = new THREE.Group();
  g.add(mesh(new RoundedBoxGeometry(5.6, 3.25, 0.16, 4, 0.07), std(0x101830, { metalness: 0.7, roughness: 0.3 })));
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(5.36, 3.015), new THREE.MeshBasicMaterial({ map: s.tex, toneMapped: false }));
  scr.position.z = 0.082; g.add(scr);
  g.position.copy(DS);
  addPart(g, { t0: T.dash + 0.7, dur: 1.2, from: [0, 5.5, 0] });
  updaters.push(draw);
}

// ---------- flujo de datos ----------
{
  const hub = new THREE.Vector2(HUB.x, HUB.z);
  const lines = [
    { p: [-3.0, -1.6], dir: 1 }, { p: [-0.75, 0.75], dir: 1 },
    { p: [2.0, -1.6], dir: -1 }, { p: [2.0, 1.45], dir: -1 }, { p: [0.03, -2.5], dir: -1 },
  ];
  lines.forEach(({ p, dir }, li) => {
    const end = new THREE.Vector2(...p), d = end.clone().sub(hub), len = d.length(), ang = Math.atan2(d.y, d.x);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(len, 0.02, 0.07), glow(C.teal, 0.7));
    bar.rotation.y = -ang; scene.add(bar);
    const dots = [0, 1].map(() => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.085, 16, 12), glow(0x99f6e4, 2.2)); scene.add(m); return m; });
    updaters.push((t) => {
      const k = easeOut(prog(t, T.flow + li * 0.08, 0.8));
      bar.visible = k > 0; bar.scale.x = Math.max(0.001, k);
      const mid = hub.clone().addScaledVector(d, k / 2); bar.position.set(mid.x, 0.412, mid.y);
      dots.forEach((m, j) => {
        let u = (((t - T.flow) * 0.55 + j / 2 + li * 0.17) % 1 + 1) % 1; if (dir > 0) u = 1 - u;
        const q = hub.clone().addScaledVector(d, u);
        m.visible = k >= 1; m.position.set(q.x, 0.47, q.y);
      });
    });
  });
}

// ---------- cámara ----------
// [t, tx, ty, tz, radio, azimut°, elevación°]
const CAM_H = [
  [0.0, 0, 0.6, 0, 20, 34, 30], [2.9, 0, 0.5, 0, 17.5, 30, 30],
  [4.1, -3.4, 1.3, -1.4, 10.5, 38, 25], [6.1, -3.4, 1.3, -1.4, 10.0, 42, 25],
  [7.5, -3.6, 0.4, 1.65, 8.9, 5, 60], [11.2, -3.6, 0.4, 1.65, 8.5, 9, 60],
  [12.5, 1.2, 0.6, -0.1, 8.6, 30, 42], [14.9, 1.2, 0.6, -0.1, 8.2, 36, 40],
  [16.2, 2.2, 1.7, -1.6, 10.0, -20, 20], [18.9, 2.2, 1.7, -1.6, 9.6, -15, 20],
  [20.2, 2.2, 1.25, 1.6, 8.4, -16, 18], [22.9, 2.2, 1.25, 1.6, 8.0, -11, 18],
  [24.6, 1.5, 3.7, -2.2, 12.6, 8, 9], [27.2, 1.5, 3.7, -2.2, 12.2, 4, 9],
  [29.2, 0, 2.5, -0.4, 19.5, 24, 19], [DURATION, 0, 2.5, -0.4, 18.6, 44, 19],
];
const CAM_V = [
  [0.0, 0, 1.2, 0, 36, 30, 28], [2.9, 0, 1.0, 0, 32, 26, 28],
  [4.1, -3.9, 1.9, -2.0, 13.5, 38, 22], [6.1, -3.9, 1.9, -2.0, 13.0, 42, 22],
  [7.5, -3.0, 0.4, 1.15, 13.9, 3, 62], [11.2, -3.0, 0.4, 1.15, 13.5, 7, 62],
  [12.5, 0.2, 1.5, -0.3, 11.0, 28, 45], [14.9, 0.2, 1.5, -0.3, 10.5, 34, 43],
  [16.2, 3.0, 2.7, -2.0, 12.5, -18, 18], [18.9, 3.0, 2.7, -2.0, 12.0, -13, 18],
  [20.2, 3.1, 2.5, 1.9, 10.8, -14, 16], [22.9, 3.1, 2.5, 1.9, 10.4, -9, 16],
  [24.6, 0, 4.7, -3.0, 16.0, 5, 8], [27.2, 0, 4.7, -3.0, 15.5, 1, 8],
  [29.2, 0, 3.2, -0.4, 34, 12, 22], [DURATION, 0, 3.2, -0.4, 33, 28, 22],
];
const CAM = VERT ? CAM_V : CAM_H;
function updateCamera(t) {
  let i = 0; while (i < CAM.length - 2 && t > CAM[i + 1][0]) i++;
  const a = CAM[i], b = CAM[i + 1];
  let k = clamp01((t - a[0]) / (b[0] - a[0]));
  if (i % 2 === 0 && i < CAM.length - 2 || i === 0) k = easeInOut(k); // tramos pares: traslados; impares: deriva lenta
  const v = a.map((x, j) => lerp(x, b[j], k));
  const az = (v[5] * Math.PI) / 180, el = (v[6] * Math.PI) / 180;
  camera.position.set(v[1] + v[4] * Math.sin(az) * Math.cos(el), v[2] + v[4] * Math.sin(el), v[3] + v[4] * Math.cos(az) * Math.cos(el));
  camera.lookAt(v[1], v[2], v[3]);
  camera.updateMatrixWorld();
}
const project = (p) => { const v = p.clone().project(camera); return [(v.x * 0.5 + 0.5) * W, (-v.y * 0.5 + 0.5) * H]; };

// ---------- rótulos ----------
const STEPS = [
  { t0: 4.2, t1: 6.2, start: T.db, title: 'Fuentes de datos', sub: 'SQL, Excel, extractos bancarios y sistemas contables, integrados en un solo lugar.',
    anchor: [-3.9, 1.7, -2.0], x: 1230, y: 330, w: 540, side: 'L', tag: [-3.9, 2.5, -2.0] },
  { t0: 7.7, t1: 11.3, start: T.recon, title: 'Conciliación bancaria', sub: 'Extracto contra libro mayor, partida por partida. Las diferencias aparecen solas.',
    anchor: [-3.0, 0.5, 0.62], x: 110, y: 64, w: 1150, side: 'L', tag: [-3.0, 0.6, 1.9], noLeader: true },
  { t0: 12.6, t1: 15.0, start: T.gears, title: 'Automatización', sub: 'Procesos en Python que corren solos: menos tareas manuales, menos errores.',
    anchor: [0.9, 0.75, -0.3], x: 1270, y: 300, w: 520, side: 'L', tag: [0.2, 0.9, 0] },
  { t0: 16.3, t1: 19.0, start: T.chart, title: 'Estadística', sub: 'Distribuciones, modelos e inferencia para respaldar cada conclusión.',
    anchor: [1.75, 2.0, -2.0], x: 120, y: 300, w: 520, side: 'R', tag: [3.0, 3.3, -2.0] },
  { t0: 20.3, t1: 23.0, start: T.term, title: 'Programación', sub: 'Código claro y reproducible en Python y SQL, hecho a medida.',
    anchor: [1.65, 1.5, 1.7], x: 120, y: 330, w: 500, side: 'R', tag: [3.1, 2.45, 1.7] },
  { t0: 24.8, t1: 27.3, start: T.dash, title: 'Tableros', sub: 'Indicadores claros para decidir con datos, en un tablero hecho a medida.',
    anchor: [2.75, 4.6, -2.9], x: 1380, y: 330, w: 430, side: 'L', tag: [0, 6.25, -3.0] },
];
const $ = (id) => document.getElementById(id);
const NS = 'http://www.w3.org/2000/svg';
if (VERT) {
  const tagsV = { 1: [-2.4, 0.5, 3.5], 4: [4.3, 0.5, 3.4] };
  STEPS.forEach((s, i) => Object.assign(s, { x: 80, y: 270, w: 900, noLeader: true, tag: tagsV[i] || s.tag }));
}
$('stage').classList.toggle('vertical', VERT);
for (const el of [$('stage'), canvas]) { el.style.width = `${W}px`; el.style.height = `${H}px`; }
$('leaders').setAttribute('width', W); $('leaders').setAttribute('height', H);
STEPS.forEach((s, i) => {
  const el = document.createElement('div'); el.className = 'callout';
  el.style.cssText = `left:${s.x}px;top:${s.y}px;width:${s.w}px`;
  el.innerHTML = `<div class="num">0${i + 1} / 06</div><div class="title">${s.title}</div><div class="sub">${s.sub}</div>`;
  $('labels').appendChild(el); s.el = el;
  s.path = document.createElementNS(NS, 'path'); s.path.setAttribute('pathLength', '1'); s.path.setAttribute('stroke-dasharray', '1');
  s.dot = document.createElementNS(NS, 'circle'); s.dot.setAttribute('r', '6');
  $('leaders').append(s.path, s.dot);
  const tag = document.createElement('div'); tag.className = 'tag'; tag.innerHTML = `<b>0${i + 1}</b>${s.title}`;
  $('labels').appendChild(tag); s.tagEl = tag;
  s.anchorV = new THREE.Vector3(...s.anchor); s.tagV = new THREE.Vector3(...s.tag);
});
$('intro').textContent = CONFIG.intro;
$('brand').textContent = CONFIG.marca.join(' · ');
$('pips').innerHTML = `<span class="lbl"></span>` + STEPS.map(() => '<span class="pip"><i></i></span>').join('');
$('end').className = CIERRE;
$('end').innerHTML = `<div class="blk a"><div class="lema">${CONFIG.lema}</div><div class="rule"></div>
  <div class="serv">${CONFIG.servicios.map((x) => `<em>${x}</em>`).join('<span>·</span>')}</div></div>
  <div class="blk b"><div class="marca">${CONFIG.marca.join('<span>·</span>')}</div>
  <div class="nombre">${CONFIG.nombre}</div><div class="rol">${CONFIG.rol}</div>
  <div class="web">${CONFIG.web}<i>→</i></div></div>`;
const pipEls = [...document.querySelectorAll('#pips .pip i')], pipLbl = document.querySelector('#pips .lbl');
const endA = document.querySelector('#end .a'), kidsA = [...endA.children], kidsB = [...document.querySelectorAll('#end .b > *')];

function updateOverlay(t) {
  $('intro').style.opacity = Math.min(prog(t, 0.3, 0.6), 1 - prog(t, 2.3, 0.6));
  $('intro').style.transform = `translateY(${(1 - easeOut(prog(t, 0.3, 0.8))) * 24}px)`;
  const hud = Math.min(prog(t, T.db, 0.6), 1 - prog(t, T.end - 0.4, 0.6));
  $('pips').style.opacity = hud; $('brand').style.opacity = hud * 0.9;
  let cur = 0;
  STEPS.forEach((s, i) => {
    const next = i < 5 ? STEPS[i + 1].start : T.flow;
    pipEls[i].style.width = `${prog(t, s.start, next - s.start) * 100}%`;
    if (t >= s.start) cur = i + 1;
    const a = Math.min(prog(t, s.t0, 0.5), 1 - prog(t, s.t1, 0.4));
    s.el.style.opacity = a;
    s.el.style.transform = `translateY(${(1 - easeOut(prog(t, s.t0, 0.6))) * 18}px)`;
    const show = a > 0 && !s.noLeader;
    s.path.style.display = s.dot.style.display = show ? '' : 'none';
    if (show) {
      const [ax, ay] = project(s.anchorV), ly = s.y + 62, lx = s.side === 'L' ? s.x - 16 : s.x + s.w + 16, ex = s.side === 'L' ? lx - 50 : lx + 50;
      s.path.setAttribute('d', `M${ax.toFixed(1)},${ay.toFixed(1)} L${ex},${ly} L${lx},${ly}`);
      s.path.style.strokeDashoffset = 1 - easeOut(prog(t, s.t0, 0.6));
      s.path.style.opacity = s.dot.style.opacity = a;
      s.dot.setAttribute('cx', ax); s.dot.setAttribute('cy', ay);
    }
    const ta = Math.min(prog(t, T.tags + i * 0.12, 0.4), 1 - prog(t, T.end - 0.5, 0.5));
    s.tagEl.style.opacity = ta;
    if (ta > 0) { const [x, y] = project(s.tagV); s.tagEl.style.left = `${x}px`; s.tagEl.style.top = `${y - 14 + (1 - easeOut(prog(t, T.tags + i * 0.12, 0.5))) * 14}px`; }
  });
  pipLbl.textContent = `0${Math.max(1, cur)} / 06`;
  $('end').style.opacity = prog(t, T.end, 1.0);
  const stagger = (els, t0) => els.forEach((el, i) => {
    const k = prog(t, t0 + i * 0.26, 0.8);
    el.style.opacity = k; el.style.transform = `translateY(${(1 - easeOut(k)) * 26}px)`;
  });
  stagger(kidsA, T.end + 0.4); stagger(kidsB, T.brand);
  endA.style.opacity = 1 - prog(t, T.brand - 0.5, 0.4);
}

// ---------- cuadro ----------
function renderFrame(t) {
  updateParts(t);
  for (const u of updaters) u(t);
  updateCamera(t);
  updateOverlay(t);
  renderer.render(scene, camera);
}
window.renderFrame = renderFrame;
window.DURATION = DURATION;

if (!CAPTURE) {
  const fit = () => { const s = Math.min(innerWidth / W, innerHeight / H); $('stage').style.transform = `translate(${(innerWidth - W * s) / 2}px, ${(innerHeight - H * s) / 2}px) scale(${s})`; };
  addEventListener('resize', fit); fit();
  const t0 = performance.now();
  const loop = (now) => { renderFrame(((now - t0) / 1000) % (DURATION + 1.5)); requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
}
const FONTS = ['400', '500', '600', '700'].map((w) => `${w} 20px Inter`).concat(['400', '700'].map((w) => `${w} 20px "JetBrains Mono"`));
Promise.all(FONTS.map((f) => document.fonts.load(f))).catch(() => {}).then(() => { renderFrame(0); window.READY = true; });
