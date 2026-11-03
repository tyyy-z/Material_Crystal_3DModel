import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { ConvexGeometry } from "three/examples/jsm/geometries/ConvexGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { CSS2DRenderer, CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { buildScene, EPS } from "./geometry.js";
import { STR, PROTO_ZH, EL_ZH, GROUPS } from "./i18n.js";
import { TOURS, GENERIC } from "./tours.js";

const $ = (s) => document.querySelector(s), view = $("#view");
const q = new URLSearchParams(location.search);
const state = { id: q.get("m") || "si", cell: q.get("cell") || "conventional", n: +(q.get("n") || 1), poly: q.get("poly") !== "0",
  labels: q.get("labels") === "1", lang: q.get("lang") || localStorage.getItem("cs-lang") || "en", pick: null };
const t = (k) => STR[state.lang][k] ?? STR.en[k];
const nm = (o) => (state.lang === "zh" ? o.zh : o.en);
const isPhone = () => innerWidth <= 820;

// renderer
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;
view.appendChild(renderer.domElement);
const css2d = new CSS2DRenderer(); css2d.domElement.style.cssText = "position:absolute;inset:0;pointer-events:none"; view.appendChild(css2d.domElement);
const scene = new THREE.Scene(), pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.add(new THREE.HemisphereLight(0xffffff, 0xb8c4d6, 0.55)); const key = new THREE.DirectionalLight(0xffffff, 1.3); key.position.set(5, 8, 6); scene.add(key);
const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 500), controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.minDistance = 3; controls.maxDistance = 220;
const HOME = new THREE.Vector3(1, 0.72, 1.25).normalize();
let root = null, data = null, index = [], scn = null, freeAspect = 1;

// the free area of the screen (not under glass) is where the structure is centred
function freeRect() {
  const W = innerWidth, H = innerHeight;
  if (isPhone()) { const top = $("#tools").getBoundingClientRect().bottom + 8, bottom = H - 150; return { x: 0, y: top, w: W, h: Math.max(200, bottom - top) }; }
  const L = 284 + 32, R = W - 368 - 32; return { x: L, y: 0, w: R - L, h: H - 70 };
}
function resize() {
  const W = innerWidth, H = innerHeight; renderer.setSize(W, H); css2d.setSize(W, H);
  const f = freeRect(); camera.aspect = W / H; freeAspect = Math.min(f.h / H, (W / H) * (f.w / W));
  camera.setViewOffset(W, H, W / 2 - (f.x + f.w / 2), H / 2 - (f.y + f.h / 2), W, H); camera.updateProjectionMatrix();
}
addEventListener("resize", () => { resize(); if (root) fit(false); });

const mats = new Map();
const mat = (color, o = {}) => { const k = color + JSON.stringify(o); if (!mats.has(k)) mats.set(k, new THREE.MeshPhysicalMaterial({ color, roughness: 0.34, metalness: 0, clearcoat: 0.45, clearcoatRoughness: 0.28, ...o })); return mats.get(k); };
const cylGeo = new THREE.CylinderGeometry(1, 1, 1, 12, 1, true);
const BOND_R = 0.11, rOf = (el) => Math.min(0.62, 0.12 + data.elements[el].atomic_radius * 0.26);
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches || q.get("motion") === "0";
const keyOf = (p) => Math.round(p[0] * 40) + "," + Math.round(p[1] * 40) + "," + Math.round(p[2] * 40);

// Everything lives in g.userData.inner so the symmetry spin can transform it while ghosts stay put.
function build() {
  const cell = data[state.cell], s = buildScene(cell, data.bond_rules, state.poly ? data.polyhedra_elements : [], state.n);
  const g = new THREE.Group(), inner = new THREE.Group(), els = data.elements, detail = s.atoms.length > 1500 ? 1 : s.atoms.length > 400 ? 2 : 3;
  inner.matrixAutoUpdate = false; g.add(inner); const U = (g.userData = { inner, atomMeshes: [], fades: [], own: [] });
  const byEl = {}; s.atoms.forEach((a, i) => (byEl[a.el] ||= []).push(i));
  const m4 = new THREE.Matrix4(), v = new THREE.Vector3(), qq = new THREE.Quaternion(), sc = new THREE.Vector3();
  for (const [el, ids] of Object.entries(byEl)) {
    const im = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, detail), mat(els[el].vesta), ids.length), r = rOf(el);
    ids.forEach((i, k) => { m4.compose(v.fromArray(s.atoms[i].p), qq.identity(), sc.set(r, r, r)); im.setMatrixAt(k, m4); });
    im.computeBoundingSphere(); im.userData = { ids, r, delay: new Float32Array(ids.length).fill(-1) }; inner.add(im); U.atomMeshes.push(im);
  }
  if (s.bonds.length) {
    const im = new THREE.InstancedMesh(cylGeo, mat(0xffffff), s.bonds.length * 2), up = new THREE.Vector3(0, 1, 0), col = new THREE.Color(); let k = 0;
    const N = s.bonds.length * 2, P = new Float32Array(N * 3), H = new Float32Array(N * 3), ends = new Int32Array(N);
    for (const b of s.bonds) {
      const A = new THREE.Vector3().fromArray(s.atoms[b.a].p), B = new THREE.Vector3().fromArray(s.atoms[b.b].p), M = A.clone().lerp(B, 0.5);
      for (const [Q, el, ai] of [[A, s.atoms[b.a].el, b.a], [B, s.atoms[b.b].el, b.b]]) {
        const dir = M.clone().sub(Q), len = dir.length(); qq.setFromUnitVectors(up, dir.clone().normalize());
        m4.compose(Q.clone().lerp(M, 0.5), qq, sc.set(BOND_R, len, BOND_R)); im.setMatrixAt(k, m4); im.setColorAt(k, col.set(els[el].vesta));
        Q.toArray(P, k * 3); dir.multiplyScalar(0.5).toArray(H, k * 3); ends[k] = ai; k++;
      }
    }
    im.computeBoundingSphere(); im.userData = { P, H, ends, base: im.instanceMatrix.array.slice(), delay: new Float32Array(N).fill(-1) }; inner.add(im); U.bonds = im;
  }
  const fade = (m, to) => { U.fades.push({ m, to }); U.own.push(m); return m; };
  const pByEl = {}; s.polyhedra.forEach((p) => (pByEl[p.el] ||= []).push(new ConvexGeometry(p.verts.map((x) => new THREE.Vector3().fromArray(x)))));
  for (const [el, geos] of Object.entries(pByEl)) {
    const geo = mergeGeometries(geos.map((x) => { x.deleteAttribute("uv"); return x; }));
    const mesh = new THREE.Mesh(geo, fade(mat(els[el].vesta, { transparent: true, opacity: 0.36, roughness: 0.2, depthWrite: false, side: THREE.DoubleSide }).clone(), 0.36)); mesh.renderOrder = 2; inner.add(mesh);
    inner.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 10), fade(new THREE.LineBasicMaterial({ color: new THREE.Color(els[el].vesta).multiplyScalar(0.55), transparent: true, opacity: 0.55 }), 0.55)));
  }
  const lp = new Float32Array(s.cellEdges.flat().flat()), lg = new THREE.BufferGeometry(); lg.setAttribute("position", new THREE.BufferAttribute(lp.slice(), 3));
  U.lineMat = new THREE.LineBasicMaterial({ color: 0x334155, transparent: true, opacity: 0.7 }); U.own.push(U.lineMat);
  U.lines = new THREE.LineSegments(lg, U.lineMat); U.lineFinal = lp; inner.add(U.lines);
  U.labels = []; if (state.labels) addLabels(g, s, cell);
  const box = new THREE.Box3().setFromObject(g), c = box.getCenter(new THREE.Vector3());
  g.position.sub(c); U.home = g.position.clone(); U.radius = box.getBoundingSphere(new THREE.Sphere()).radius;
  U.stats = { atoms: s.atoms.length, bonds: s.bonds.length, polyhedra: s.polyhedra.length }; U.scene = s; U.cellKind = state.cell; U.n = state.n;
  return g;
}
// labels: one per site of the base cell; overlap culling runs in the frame loop
function addLabels(g, s, cell) {
  s.atoms.forEach((a) => {
    if (!a.f.every((x) => x > -EPS && x < 1 - EPS)) return;
    const w = data.wyckoff[cell.sites[a.site].w], d = document.createElement("div"); d.className = "lbl";
    d.innerHTML = `${a.el}<small>${w.wyckoff.replace(/^\d+/, "")}</small>`; const o = new CSS2DObject(d); o.position.fromArray(a.p); g.userData.inner.add(o); g.userData.labels.push(o);
  });
}
const _v = new THREE.Vector3(); let cullTick = 0;
function cullLabels() {
  if (!root || !root.userData.labels.length || (cullTick++ % 4)) return;
  const W = innerWidth, H = innerHeight, L = root.userData.labels, pts = [];
  for (const o of L) { o.getWorldPosition(_v); const z = _v.distanceTo(camera.position); _v.project(camera); pts.push([o, (_v.x + 1) * W / 2, (1 - _v.y) * H / 2, z]); }
  pts.sort((a, b) => a[3] - b[3]); const kept = [];
  for (const [o, x, y] of pts) { const ok = kept.length < 48 && kept.every(([u, w]) => Math.abs(u - x) > 46 || Math.abs(w - y) > 22); o.element.style.opacity = ok ? "" : "0"; if (ok) kept.push([x, y]); }
}

// radius must fit inside the free (unglazed) part of the frustum; bounding sphere is conservative, hence 0.86
const fitDist = (r) => (r * 0.86) / (Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * freeAspect);
function fit(home) { cam = { t0: performance.now(), dur: 650, from: camera.position.length(), to: fitDist(root.userData.radius), dir: home ? HOME.clone() : camera.position.clone().normalize(), dir0: camera.position.clone().normalize() }; controls.target.set(0, 0, 0); }

// ---- transitions ----------------------------------------------------------------------------------------------
// mode "build": atoms appear orbit by orbit (Wyckoff order), then bonds grow from the atoms, then polyhedra fade in.
// mode "morph": atoms at the same absolute position persist; new ones pop in outward from the origin, removed ones
// shrink; cell edges interpolate (prim<->conv) or scale (supercell grow); group re-centres smoothly.
const ease = { out: (k) => 1 - (1 - k) ** 3, inOut: (k) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2), back: (k) => { const c = 1.5; return 1 + (c + 1) * (k - 1) ** 3 + c * (k - 1) ** 2; } };
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const ATOM_D = 460, BOND_D = 340, FADE_D = 420;
let anim = null, cam = null;
function show(mode = "morph") {
  if (anim) finish(anim);
  const next = build(), old = root; root = next; scn = next.userData.scene; scene.add(next); clearPick(false);
  const U = next.userData, now = performance.now();
  if (!old) { camera.position.copy(HOME).multiplyScalar(fitDist(U.radius)); mode = "build"; }
  cam = { t0: now, dur: 700, from: camera.position.length(), to: fitDist(U.radius), dir: camera.position.clone().normalize(), dir0: camera.position.clone().normalize() };
  window.__state = { ...state, ...U.stats };
  const a = { t0: now, next, old, mode, end: 0, caption: null };
  const oldKeys = new Map();
  if (old && mode === "morph") old.userData.atomMeshes.forEach((im) => im.userData.ids.forEach((id, k) => oldKeys.set(keyOf(old.userData.scene.atoms[id].p), [im, k])));
  const atomDelay = new Float32Array(scn.atoms.length).fill(-1);
  if (mode === "build") {
    const orbits = [...new Set(scn.atoms.map((x) => data[state.cell].sites[x.site].w))].sort((x, y) => x - y), slot = Math.min(420, 1500 / orbits.length);
    let maxR = 0; const ctr = new THREE.Box3().setFromArray(scn.atoms.flatMap((x) => x.p)).getCenter(new THREE.Vector3());
    scn.atoms.forEach((x) => (maxR = Math.max(maxR, ctr.distanceTo(_v.fromArray(x.p)))));
    scn.atoms.forEach((x, i) => { const o = orbits.indexOf(data[state.cell].sites[x.site].w); atomDelay[i] = (old ? 220 : 120) + o * slot + 200 * (ctr.distanceTo(_v.fromArray(x.p)) / (maxR || 1)); });
    a.caption = orbits.map((w, i) => [w, (old ? 220 : 120) + i * slot]);
    U.lineMat.opacity = 0; a.lineFade = [old ? 120 : 0, 420];
  } else {
    let maxP = 0; scn.atoms.forEach((x) => (maxP = Math.max(maxP, Math.hypot(...x.p))));
    scn.atoms.forEach((x, i) => { const hit = oldKeys.get(keyOf(x.p)); if (hit) { hit[0].userData.keep ||= new Set(); hit[0].userData.keep.add(hit[1]); } else atomDelay[i] = 140 + 560 * (Math.hypot(...x.p) / (maxP || 1)); });
    // cell edges: interpolate index-wise (same count), scale (supercell of the same cell) or fade
    const oF = old.userData.lineFinal, nF = U.lineFinal, pos = U.lines.geometry.attributes.position.array;
    if (oF.length === nF.length) a.lineFrom = oF.slice();
    else if (old.userData.cellKind === state.cell) { const f = old.userData.n / state.n; a.lineFrom = nF.map((x) => x * f); }
    else { U.lineMat.opacity = 0; a.lineFade = [200, 420]; }
    if (a.lineFrom) pos.set(a.lineFrom);
    a.pos0 = old.position.clone(); next.position.copy(old.position);
  }
  U.atomMeshes.forEach((im) => im.userData.ids.forEach((id, k) => (im.userData.delay[k] = atomDelay[id])));
  if (U.bonds) { const d = U.bonds.userData; for (let k = 0; k < d.ends.length; k++) { const b = scn.bonds[k >> 1], t = Math.max(atomDelay[b.a], atomDelay[b.b]); d.delay[k] = t < 0 ? -1 : t + ATOM_D * 0.55; } }
  let last = 0; atomDelay.forEach((x) => (last = Math.max(last, x)));
  a.polyAt = mode === "build" ? last + ATOM_D * 0.7 : Math.max(120, last * 0.45); U.fades.forEach((f) => (f.m.opacity = 0));
  a.end = Math.max(last + ATOM_D + BOND_D, a.polyAt + FADE_D, 700) + 60;
  if (old) { old.userData.fades.push({ m: old.userData.lineMat, to: old.userData.lineMat.opacity }); if (old.userData.bonds && mode === "morph") old.userData.bonds.visible = false; old.userData.labels.forEach((o) => (o.element.style.opacity = "0")); }
  if (a.caption) capShow(a.caption);
  anim = a; tick(a, REDUCED ? Infinity : 0);
}
const M16 = new Float32Array(16);
function atomFrame(im, t) {
  const d = im.userData, arr = im.instanceMatrix.array, r = d.r; let dirty = false;
  for (let k = 0; k < d.delay.length; k++) { const t0 = d.delay[k]; if (t0 < 0) continue; const s = r * Math.max(0, ease.back(clamp01((t - t0) / ATOM_D))); const o = k * 16; if (arr[o] !== s) { arr[o] = arr[o + 5] = arr[o + 10] = s; dirty = true; } }
  if (dirty) im.instanceMatrix.needsUpdate = true;
}
function bondFrame(im, t) {
  const d = im.userData, arr = im.instanceMatrix.array, B = d.base;
  for (let k = 0; k < d.delay.length; k++) {
    const t0 = d.delay[k]; if (t0 < 0) continue; const l = ease.out(clamp01((t - t0) / BOND_D)), o = k * 16;
    for (let j = 0; j < 4; j++) arr[o + 4 + j] = B[o + 4 + j] * l;
    arr[o + 12] = d.P[k * 3] + d.H[k * 3] * l; arr[o + 13] = d.P[k * 3 + 1] + d.H[k * 3 + 1] * l; arr[o + 14] = d.P[k * 3 + 2] + d.H[k * 3 + 2] * l;
  }
  im.instanceMatrix.needsUpdate = true;
}
function tick(a, t) {
  const U = a.next.userData, k = clamp01(t / 700);
  U.atomMeshes.forEach((im) => atomFrame(im, t)); if (U.bonds) bondFrame(U.bonds, t);
  const pf = ease.out(clamp01((t - a.polyAt) / FADE_D)); U.fades.forEach((f) => (f.m.opacity = f.to * pf));
  if (a.lineFrom) { const pos = U.lines.geometry.attributes.position, e = ease.inOut(k); for (let i = 0; i < pos.array.length; i++) pos.array[i] = a.lineFrom[i] + (U.lineFinal[i] - a.lineFrom[i]) * e; pos.needsUpdate = true; }
  if (a.lineFade) U.lineMat.opacity = 0.7 * ease.out(clamp01((t - a.lineFade[0]) / a.lineFade[1]));
  if (a.pos0) { a.next.position.lerpVectors(a.pos0, U.home, ease.inOut(k)); if (a.old) a.old.position.copy(a.next.position); }
  if (a.old) {
    const O = a.old.userData, ko = clamp01(t / 260), s = 1 - ease.out(ko);
    // morph: old polyhedra cross-fade against the new ones instead of vanishing first
    const kf = a.mode === "morph" ? clamp01((t - a.polyAt) / FADE_D) : ko, sf = 1 - ease.out(kf);
    O.fades.forEach((f) => (f.m.opacity = f.to * (f.m === O.lineMat ? s : sf)));
    if (a.mode === "build") a.old.scale.setScalar(1 - 0.12 * ease.out(ko));
    O.atomMeshes.forEach((im) => { const arr = im.instanceMatrix.array, keep = im.userData.keep;
      for (let j = 0; j < im.count; j++) { const v = keep?.has(j) ? 0 : im.userData.r * s; arr[j * 16] = arr[j * 16 + 5] = arr[j * 16 + 10] = v; } im.instanceMatrix.needsUpdate = true; });
    if (ko >= 1 && kf >= 1) { disposeGroup(a.old); a.old = null; }
  }
  if (a.caption) capStep(a.caption, t);
  if (t >= a.end) finish(a);
}
function finish(a) {
  if (anim !== a) return; anim = null; tick2(a);
}
function tick2(a) { // snap to the final state
  const U = a.next.userData;
  U.atomMeshes.forEach((im) => { im.userData.delay.fill(-1); const r = im.userData.r, arr = im.instanceMatrix.array; for (let j = 0; j < im.count; j++) arr[j * 16] = arr[j * 16 + 5] = arr[j * 16 + 10] = r; im.instanceMatrix.needsUpdate = true; });
  if (U.bonds) { U.bonds.instanceMatrix.array.set(U.bonds.userData.base); U.bonds.userData.delay.fill(-1); U.bonds.instanceMatrix.needsUpdate = true; }
  U.fades.forEach((f) => (f.m.opacity = f.to)); U.lineMat.opacity = 0.7; U.lines.geometry.attributes.position.array.set(U.lineFinal); U.lines.geometry.attributes.position.needsUpdate = true;
  a.next.position.copy(U.home); if (a.old) disposeGroup(a.old); a.old = null;
  if (a.caption) setTimeout(() => $("#cap").classList.remove("on"), 1200);
}
function capShow(c) {
  const el = $("#cap"); el.innerHTML = `<span class="k">${t("buildCap")}</span>` + c.map(([w]) => { const x = data.wyckoff[w]; return `<span class="o" style="--c:${data.elements[x.el].vesta}"><i></i>${x.el} ${x.wyckoff}</span>`; }).join("<b>→</b>");
  el.classList.add("on");
}
function capStep(c, t) { const os = $("#cap").querySelectorAll(".o"); c.forEach(([, t0], i) => os[i]?.classList.toggle("lit", t >= t0)); }
function disposeGroup(g) { scene.remove(g); g.traverse((o) => { o.geometry?.dispose(); if (o.isCSS2DObject) o.element.remove(); }); g.userData.own?.forEach((m) => m.dispose()); }

// ---- symmetry-axis spin --------------------------------------------------------------------------------------
let spin = null;
function startSpin() {
  const ax = data.sym_axis; if (!ax || !root || spin) return; stopRot(); if (anim) finish(anim);
  const U = root.userData, ghosts = new THREE.Group(), u = new THREE.Vector3().fromArray(ax.dir), P = new THREE.Vector3().fromArray(ax.point);
  const gm = []; U.atomMeshes.forEach((im) => { const m = new THREE.MeshBasicMaterial({ color: im.material.color, transparent: true, opacity: 0, depthWrite: false }); gm.push(m);
    const g = new THREE.InstancedMesh(im.geometry, m, im.count); g.instanceMatrix = im.instanceMatrix; g.boundingSphere = im.boundingSphere; g.renderOrder = 3; ghosts.add(g); });
  const len = U.radius * 2.3, axis = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, len, 10), new THREE.MeshBasicMaterial({ color: 0x2563eb, transparent: true, opacity: 0 }));
  axis.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), u); axis.position.copy(P); ghosts.add(axis); gm.push(axis.material);
  const tag = document.createElement("div"); tag.className = "axl"; tag.textContent = ax.label; const to = new CSS2DObject(tag); to.position.copy(P).addScaledVector(u, len / 2); ghosts.add(to);
  root.add(ghosts); spin = { t0: performance.now(), ghosts, gm, u, P, ang: THREE.MathUtils.degToRad(ax.angle), screw: ax.screw, tag };
  if (REDUCED) spin.t0 -= 1e9;
}
const SP = { in: 350, rot: 1700, hold: 700, back: 900, out: 350 }, _m1 = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _m3 = new THREE.Matrix4();
function spinFrame(now) {
  if (!spin) return; const t = now - spin.t0, inner = root.userData.inner;
  const a1 = SP.in, a2 = a1 + SP.rot, a3 = a2 + SP.hold, a4 = a3 + SP.back, a5 = a4 + SP.out;
  const vis = t < a1 ? ease.out(t / a1) : t < a4 ? 1 : 1 - ease.out(clamp01((t - a4) / SP.out));
  spin.gm.forEach((m, i) => (m.opacity = (i === spin.gm.length - 1 ? 0.9 : 0.16) * vis)); spin.tag.style.opacity = vis;
  const e = t < a1 ? 0 : t < a2 ? ease.inOut((t - a1) / SP.rot) : t < a3 ? 1 : t < a4 ? 1 - ease.inOut((t - a3) / SP.back) : 0;
  _m1.makeTranslation(spin.P.x + spin.u.x * spin.screw * e, spin.P.y + spin.u.y * spin.screw * e, spin.P.z + spin.u.z * spin.screw * e);
  _m2.makeRotationAxis(spin.u, spin.ang * e); _m3.makeTranslation(-spin.P.x, -spin.P.y, -spin.P.z);
  inner.matrix.copy(_m1).multiply(_m2).multiply(_m3); inner.matrixWorldNeedsUpdate = true;
  if (t >= a5) endSpin();
}
function endSpin() { if (!spin) return; const g = spin.ghosts; g.parent?.remove(g); g.traverse((o) => { if (o.isCSS2DObject) o.element.remove(); if (o.isMesh && !o.isInstancedMesh) o.geometry.dispose(); }); spin.gm.forEach((m) => m.dispose()); root.userData.inner.matrix.identity(); spin = null; }

// ---- auto-rotate: gentle, off on first interaction --------------------------------------------------------------
controls.autoRotateSpeed = 0.5; controls.autoRotate = !REDUCED && q.get("rot") !== "0";
function stopRot() { controls.autoRotate = false; $("#rot")?.setAttribute("aria-pressed", "false"); }
controls.addEventListener("start", stopRot);

// hover + pick
const ray = new THREE.Raycaster(), ptr = new THREE.Vector2(); let hoverAt = null, halo = null, downAt = null;
function hit(ev) {
  if (!root) return null; const r = renderer.domElement.getBoundingClientRect();
  ptr.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ptr, camera);
  const h = ray.intersectObjects(root.userData.atomMeshes, false)[0]; if (!h) return null;
  return h.object.userData.ids[h.instanceId];
}
function siteInfo(i) { const a = scn.atoms[i], site = data[state.cell].sites[a.site], w = data.wyckoff[site.w]; return { a, w, wi: site.w }; }
function cnText(w) { return Object.entries(w.cn).map(([e, n]) => `${n} ${e}`).join(" + "); }
view.addEventListener("pointermove", (ev) => { hoverAt = ev; });
view.addEventListener("pointerleave", () => { hoverAt = null; $("#tip").hidden = true; });
view.addEventListener("pointerdown", (ev) => { downAt = [ev.clientX, ev.clientY]; });
view.addEventListener("pointerup", (ev) => {
  if (!downAt || Math.hypot(ev.clientX - downAt[0], ev.clientY - downAt[1]) > 5) return;
  const i = hit(ev); if (i == null) clearPick(); else setPick(i);
});
function hoverStep() {
  if (!hoverAt || isPhone()) return; const i = hit(hoverAt), tip = $("#tip");
  if (i == null) { tip.hidden = true; view.style.cursor = ""; return; }
  const { a, w } = siteInfo(i); view.style.cursor = "pointer";
  tip.innerHTML = `<b>${a.el}</b> <span class="mono">${w.wyckoff}</span><div>${t("cn")} ${w.cn_total} · ${cnText(w)}</div><div class="mono">${a.f.map((x) => x.toFixed(3)).join("  ")}</div>`;
  tip.style.left = hoverAt.clientX + "px"; tip.style.top = hoverAt.clientY + "px"; tip.hidden = false; hoverAt = null;
}
function setPick(i) {
  clearPick(false); const { a, w, wi } = siteInfo(i); state.pick = { i, wi, f: a.f, el: a.el };
  halo = new THREE.Group(); const hm = new THREE.MeshBasicMaterial({ color: 0x2563eb, transparent: true, opacity: 0.32, depthWrite: false });
  const add = (p, r) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), hm); m.position.fromArray(p); halo.add(m); };
  add(a.p, rOf(a.el) * 1.55);
  scn.bonds.forEach((b) => { if (b.a === i) add(scn.atoms[b.b].p, rOf(scn.atoms[b.b].el) * 1.35); if (b.b === i) add(scn.atoms[b.a].p, rOf(scn.atoms[b.a].el) * 1.35); });
  root.userData.inner.add(halo); stopRot(); info();
}
function clearPick(render = true) { if (halo) { halo.parent?.remove(halo); halo.traverse((o) => o.geometry?.dispose()); halo = null; } state.pick = null; if (render && data) info(); }

// perf instrumentation (mechanism-explainer §10.6)
const ft = []; let last = performance.now();
window.__perf = () => {
  const s = [...ft].sort((a, b) => a - b), avg = s.reduce((a, b) => a + b, 0) / (s.length || 1), inf = renderer.info; let instances = 0;
  scene.traverse((o) => o.isInstancedMesh && (instances += o.count));
  return { avgMs: +avg.toFixed(2), p95Ms: +(s[Math.floor(s.length * 0.95)] || 0).toFixed(2), drawCalls: inf.render.calls, triangles: inf.render.triangles,
    textures: inf.memory.textures, geometries: inf.memory.geometries, instances, budget: { drawCalls: 150, triangles: 1.5e6, textureMB: 64 }, ...window.__state };
};
function camStep(now) {
  if (!cam) return; const k = REDUCED ? 1 : clamp01((now - cam.t0) / cam.dur), e = ease.out(k);
  _v.copy(cam.dir0).lerp(cam.dir, e).normalize(); camera.position.copy(_v).multiplyScalar(cam.from + (cam.to - cam.from) * e); if (k >= 1) cam = null;
}
function loop(now) {
  const dt = now - last; ft.push(dt); if (ft.length > 240) ft.shift(); last = now;
  if (anim) tick(anim, REDUCED ? Infinity : now - anim.t0); camStep(now); spinFrame(now); hoverStep();
  controls.update(Math.min(dt, 50) / 1000); renderer.render(scene, camera); css2d.render(scene, camera); cullLabels(); requestAnimationFrame(loop);
}

// ---- guided tour ------------------------------------------------------------------------------------------------
let tour = null;
function tokens(txt) {
  const d = data, W = d.wyckoff, f2 = (x) => fmt(x, 2), ax = d.sym_axis;
  const orbits = W.map((w) => `${w.el} ${w.wyckoff}`).join(state.lang === "zh" ? "、" : ", ");
  return txt.replace(/\{(\w+)(?::(\d+))?\}/g, (_, k, i) => {
    const w = W[+i];
    switch (k) {
      case "w": return `<b>${w.el} ${w.wyckoff}</b>`; case "cn": return w.cn_total;
      case "d": return f2(Math.min(...w.bond_lengths)); case "D": return f2(Math.max(...w.bond_lengths));
      case "c2": return f2(d.conventional.c / 2); case "orbits": return orbits; case "N": return d.conventional.sites.length; case "k": return W.length;
      case "axis": return `<b>${ax.label}</b>`; case "ang": return Math.abs(ax.angle);
      case "scr": return Math.abs(ax.screw) > 1e-3 ? tokens(state.lang === "zh" ? GENERIC.scrZh : GENERIC.scrEn) : "";
      case "s": return f2(Math.abs(ax.screw)); default: return _;
    }
  });
}
const tourSteps = () => [{ build: true, ...GENERIC.build }, ...(TOURS[state.id] || []), ...(data.sym_axis ? [{ spin: true, ...GENERIC.spin }] : [])];
function tourGo(i) {
  const st = tourSteps(); i = Math.max(0, Math.min(st.length - 1, i)); tour = { i }; const s = st[i];
  stopRot(); endSpin();
  // every step states its full view so stepping backwards is consistent
  const want = { cell: s.cell || "conventional", n: s.n || 1, poly: s.poly ?? true, labels: false };
  const changed = Object.keys(want).some((k) => state[k] !== want[k]); Object.assign(state, want);
  if (s.build || changed) { show(s.build ? "build" : "morph"); info(); syncControls(); } else clearPick();
  if (s.pick != null) setTimeout(() => { if (tour?.i !== i) return; const k = scn.atoms.findIndex((a) => a.core && data[state.cell].sites[a.site].w === s.pick && a.f.every((x) => x > -EPS && x < 1 - EPS)); if (k >= 0) setPick(k); }, changed ? 700 : 0);
  if (s.spin) setTimeout(() => tour?.i === i && startSpin(), 150);
  const el = $("#tour"); el.hidden = false; el.style.bottom = isPhone() ? "" : innerHeight - $("#tools").getBoundingClientRect().top + 10 + "px";
  el.innerHTML = `<div class="th"><span class="k">${t("tour")} · ${nm(data.name)}</span><span class="dots">${st.map((_, j) => `<i class="${j === i ? "on" : ""}"></i>`).join("")}</span><button class="x" id="tx" aria-label="${t("close")}">×</button></div>
    <p>${tokens(s[state.lang] || s.en)}</p><div class="tb"><button id="tp" ${i === 0 ? "disabled" : ""}>${t("prev")}</button>${s.spin ? `<button id="tr">${t("replay")}</button>` : s.build ? `<button id="tr">${t("replay")}</button>` : ""}<button id="tn" class="pri">${i === st.length - 1 ? t("done") : t("next")}</button></div>`;
  $("#tp").onclick = () => tourGo(i - 1); $("#tx").onclick = tourEnd;
  $("#tn").onclick = () => (i === st.length - 1 ? tourEnd() : tourGo(i + 1));
  if ($("#tr")) $("#tr").onclick = () => (s.spin ? (endSpin(), startSpin()) : show("build"));
  $("#tourb").setAttribute("aria-pressed", "true"); syncUrl();
}
function tourEnd() { tour = null; $("#tour").hidden = true; $("#tourb").setAttribute("aria-pressed", "false"); syncUrl(); }

// UI
const fx = (f) => f.replace(/(\d+)/g, "<sub>$1</sub>");
const sgx = (g) => g.replace(/-(\d)/g, '<span class="ob">$1</span>').replace(/_(\d)/g, "<sub>$1</sub>");
const fmt = (x, d = 4) => (x == null ? "—" : (+x).toFixed(d).replace(/\.?0+$/, ""));
function i18nStatic() {
  document.documentElement.lang = state.lang === "zh" ? "zh-CN" : "en";
  document.querySelectorAll("[data-i]").forEach((e) => (e.textContent = t(e.dataset.i)));
  document.querySelectorAll("[data-t]").forEach((e) => (e.title = t(e.dataset.t)));
  document.querySelectorAll("#lang button").forEach((b) => b.classList.toggle("on", b.dataset.l === state.lang));
  document.title = state.lang === "zh" ? "晶体结构 · 实测数据 3D 可视化" : "Crystal Structures · measured, in 3D";
}
function rail() {
  const byId = Object.fromEntries(index.map((m) => [m.id, m]));
  $("#cases").innerHTML = GROUPS.map(([g, ids]) => `<div class="grp">${t("groups")[g]}</div>` + ids.map((id) => { const m = byId[id];
    return `<button class="ci${id === state.id ? " on" : ""}" data-id="${id}"><span class="f">${fx(m.formula)}</span><span class="sg">${sgx(m.spacegroup.symbol)}</span><span class="n">${nm(m.name)}</span></button>`; }).join("")).join("");
  const on = $("#cases .ci.on"), box = $("#cases"); if (on) isPhone() ? box.scrollTo({ left: on.offsetLeft - box.clientWidth / 2 + on.clientWidth / 2 }) : on.scrollIntoView({ block: "nearest" });
}
function info() {
  const d = data, s = d.source, mc = s.measured_cell, g = d.band_gap, c = d[state.cell], zh = state.lang === "zh";
  const sys = t("system")[d.spacegroup.crystal_system] || d.spacegroup.crystal_system, proto = zh ? PROTO_ZH[d.prototype] || d.prototype : d.prototype;
  const elName = (e) => (zh ? EL_ZH[e] || d.elements[e].name : d.elements[e].name);
  const legend = Object.keys(d.elements).map((e) => {
    const orbs = d.wyckoff.map((w, k) => [w, k]).filter(([w]) => w.el === e);
    return orbs.map(([w, k]) => `<button class="lr${state.pick?.wi === k ? " on" : ""}" data-w="${k}"><span class="dot" style="background:${d.elements[e].vesta}"></span>
      <span class="el">${e}<small>${elName(e)}</small></span><span class="w">${w.wyckoff}</span>
      <span class="cnl">${t("cn")} ${w.cn_total} · ${cnText(w)}${w.bond_lengths.length ? ` · ${fmt(Math.min(...w.bond_lengths), 3)}–${fmt(Math.max(...w.bond_lengths), 3)} Å` : ""}</span></button>`).join("");
  }).join("");
  let sel = "";
  if (state.pick) { const w = d.wyckoff[state.pick.wi];
    sel = `<div class="sel"><div class="top"><b>${t("selected")}: ${w.el} ${w.wyckoff}</b><button id="clr">${t("clear")}</button></div>
      <div class="row"><span>${t("frac")}</span><span class="mono">${state.pick.f.map((x) => x.toFixed(4)).join(" ")}</span></div>
      <div class="row"><span>${t("cn")}</span><span>${w.cn_total} · ${cnText(w)}</span></div>
      <div class="row"><span>${t("bonds")}</span><span class="mono">${[...new Set(w.bond_lengths)].map((x) => fmt(x, 3)).join(", ")} Å</span></div></div>`; }
  const gapRow = (x, lab) => x ? `<div class="gap${x.tier === "secondary" ? " sec2" : ""}"><span class="t">${lab}</span><span class="v">${x.value == null ? t("noGap") : `${x.value} eV`}</span><span class="m">${x.method || x.kind || ""} · <a href="${x.src}" target="_blank" rel="noopener" ${x.quote ? `title="${x.quote.replace(/"/g, "&quot;")}"` : ""}>${x.tier === "secondary" ? t("secondary") : x.tier === "primary" ? t("primary") : t("source")}</a></span></div>`
    : `<div class="gap na"><span class="t">${lab}</span><span class="v">${t("na")}</span></div>`;
  const L = (k) => fmt(c[k]), M = (k) => fmt(mc[`length_${k}`]);
  $("#info").innerHTML = `<div class="hd"><div class="kick"><span>${proto}</span></div><h2>${nm(d.name)}</h2><div class="formula">${fx(d.formula)}</div>
    <div class="chips"><span class="chip sg">${sgx(d.spacegroup.symbol)} · #${d.spacegroup.number}</span><span class="chip">${sys}</span><span class="chip">${c.sites.length} ${t("atomsCell")}</span><span class="chip">${fmt(d.density, 3)} g/cm³</span></div></div>
    <div class="sec"><h3>${t("elements")}</h3><div class="leg">${legend}</div>${sel}</div>
    <div class="sec"><h3>${t("lattice")} (Å, °)</h3><div class="kv"><span></span><span class="h">${t("shown")} · ${t(state.cell)}</span><span class="h">${t("measured")} · COD</span>
      ${["a", "b", "c"].map((k) => `<span>${k}</span><span class="mono">${L(k)}</span><span class="mono">${state.cell === "conventional" ? M(k) : "—"}</span>`).join("")}
      ${["alpha", "beta", "gamma"].map((k, i) => `<span>${"αβγ"[i]}</span><span class="mono">${fmt(c[k], 2)}</span><span class="mono">${state.cell === "conventional" ? fmt(mc[`angle_${k}`], 2) : "—"}</span>`).join("")}</div></div>
    <div class="sec"><h3>${t("bandgap")}</h3>${gapRow(g.measured, t("measured"))}${gapRow(g.computed, t("computed"))}</div>
    <div class="sec"><h3>${t("source")}</h3><div class="meta">COD <a href="${s.url}" target="_blank" rel="noopener">${s.cod_id}</a> · <a href="${s.cif_url}" target="_blank" rel="noopener">CIF</a>${s.doi ? ` · <a href="https://doi.org/${s.doi}" target="_blank" rel="noopener">DOI</a>` : ""}<span class="j">${s.journal || ""}${s.year ? `, ${s.year}` : ""}</span></div></div>
    <div class="sec"><h3>${t("bondRules")}</h3><div class="rules">${d.bond_rules.map((b) => `${b.a}–${b.b} ≤ ${b.max} Å${b.draw === false ? ` <em>(${t("notDrawn")})</em>` : ""}`).join("<br>")}</div></div>`;
  $("#clr")?.addEventListener("click", () => clearPick());
  document.querySelectorAll(".lr").forEach((b) => b.addEventListener("click", () => {
    const k = +b.dataset.w, i = scn.atoms.findIndex((a) => a.core && data[state.cell].sites[a.site].w === k && a.f.every((x) => x > -EPS && x < 1 - EPS));
    if (state.pick?.wi === k) clearPick(); else if (i >= 0) setPick(i);
  }));
  // a faint tint of the structure's own element colours on the ground
  const cols = Object.values(d.elements).map((e) => e.vesta);
  $("#ground").style.background = `radial-gradient(900px 640px at 52% 42%,#fff 0%,transparent 70%),radial-gradient(700px 500px at 20% 90%,${cols[0]}22,transparent 70%),radial-gradient(700px 520px at 85% 8%,${cols[cols.length - 1]}1f,transparent 70%),var(--ground)`;
}
function syncControls() {
  document.querySelectorAll("#cell button").forEach((b) => b.classList.toggle("on", b.dataset.v === state.cell));
  document.querySelectorAll("#sup button").forEach((b) => b.classList.toggle("on", +b.dataset.v === state.n));
  $("#poly").setAttribute("aria-pressed", state.poly); $("#lab").setAttribute("aria-pressed", state.labels);
  $("#symb").disabled = !data?.sym_axis; $("#symb .ax").textContent = data?.sym_axis?.label || ""; syncUrl();
}
function syncUrl() {
  const p = new URLSearchParams({ m: state.id, cell: state.cell, n: state.n }); if (!state.poly) p.set("poly", 0); if (state.labels) p.set("labels", 1); if (state.lang !== "en") p.set("lang", state.lang);
  if (tour) p.set("tour", tour.i + 1); for (const k of ["rot", "motion"]) if (q.get(k)) p.set(k, q.get(k));
  history.replaceState(null, "", "?" + p);
}
async function load() { endSpin(); data = await (await fetch(`./structures/${state.id}.json`)).json(); rail(); info(); show("build"); syncControls(); if (tour) tourGo(0); }
const seg = (sel, k, cast) => $(sel).addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; state[k] = cast(b.dataset.v); info(); show(); syncControls(); });
seg("#cell", "cell", String); seg("#sup", "n", Number);
$("#poly").addEventListener("click", () => { state.poly = !state.poly; show(); syncControls(); });
$("#lab").addEventListener("click", () => { state.labels = !state.labels; show(); syncControls(); });
$("#reset").addEventListener("click", () => fit(true));
$("#rot").addEventListener("click", () => { controls.autoRotate = !controls.autoRotate; $("#rot").setAttribute("aria-pressed", controls.autoRotate); });
$("#symb").addEventListener("click", () => { endSpin(); startSpin(); });
$("#tourb").addEventListener("click", () => (tour ? tourEnd() : tourGo(0)));
$("#cases").addEventListener("click", (e) => { const b = e.target.closest(".ci"); if (!b || b.dataset.id === state.id) return; state.id = b.dataset.id; load(); });
$("#lang").addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; state.lang = b.dataset.l; localStorage.setItem("cs-lang", state.lang); i18nStatic(); rail(); info(); syncControls(); resize(); if (root) fit(false); if (tour) tourGo(tour.i); });
$("#grab").addEventListener("click", () => $("#panel").classList.toggle("open"));
{ let y0 = null; const p = $("#panel");
  p.addEventListener("touchstart", (e) => { if (e.target.closest(".grab") || p.querySelector(".pscroll").scrollTop === 0) y0 = e.touches[0].clientY; }, { passive: true });
  p.addEventListener("touchend", (e) => { if (y0 == null) return; const dy = e.changedTouches[0].clientY - y0; if (dy < -30) p.classList.add("open"); if (dy > 30) p.classList.remove("open"); y0 = null; }); }
addEventListener("keydown", (e) => { if (e.key === "Escape") { if (tour) tourEnd(); else clearPick(); } if (tour && e.key === "ArrowRight") $("#tn").click(); if (tour && e.key === "ArrowLeft" && tour.i > 0) tourGo(tour.i - 1); });

index = await (await fetch("./structures/index.json")).json();
if (!index.some((x) => x.id === state.id)) state.id = (index.find((x) => x.id.includes(state.id)) || index[0]).id; // ?m=rutile -> tio2-rutile
if (!["conventional", "primitive"].includes(state.cell)) state.cell = "conventional"; state.n = Math.min(4, Math.max(1, state.n | 0 || 1));
if (q.get("sheet") === "open") $("#panel").classList.add("open");
$("#rot").setAttribute("aria-pressed", controls.autoRotate);
i18nStatic(); resize(); await load(); requestAnimationFrame(loop);
if (q.get("tour")) tourGo(+q.get("tour") - 1);
window.__spin = startSpin; window.__show = show;
