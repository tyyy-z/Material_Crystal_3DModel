import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { ConvexGeometry } from "three/examples/jsm/geometries/ConvexGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { buildScene } from "./geometry.js";

const $ = (s) => document.querySelector(s), view = $("#view");
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;
view.appendChild(renderer.domElement);
const scene = new THREE.Scene(), pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.add(new THREE.HemisphereLight(0xffffff, 0xb8c4d6, 0.6)); const key = new THREE.DirectionalLight(0xffffff, 1.4); key.position.set(5, 8, 6); scene.add(key);
const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 500), controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
let root = null, data = null, state = { id: "si", cell: "conventional", n: 1, poly: true }, tween = null;
const RADIUS_SCALE = 0.42, BOND_R = 0.11;
const q = new URLSearchParams(location.search);
if (q.get("m")) state.id = q.get("m"); if (q.get("cell")) state.cell = q.get("cell"); if (q.get("n")) state.n = +q.get("n"); if (q.get("poly") === "0") state.poly = false;

function resize() { const r = view.getBoundingClientRect(); renderer.setSize(r.width, r.height, false); renderer.domElement.style.width = r.width + "px"; renderer.domElement.style.height = r.height + "px"; camera.aspect = r.width / r.height; camera.updateProjectionMatrix(); }
addEventListener("resize", resize);

const sphereGeo = (detail) => new THREE.IcosahedronGeometry(1, detail);
const cylGeo = new THREE.CylinderGeometry(1, 1, 1, 12, 1, true);
const mats = new Map();
function mat(color, opts = {}) { const k = color + JSON.stringify(opts); if (!mats.has(k)) mats.set(k, new THREE.MeshPhysicalMaterial({ color, roughness: 0.35, metalness: 0.0, clearcoat: 0.4, clearcoatRoughness: 0.3, ...opts })); return mats.get(k); }

function build() {
  const cell = data[state.cell], s = buildScene(cell, data.bond_rules, state.poly ? data.polyhedra_elements : [], state.n);
  const g = new THREE.Group(), els = data.elements, total = s.atoms.length;
  const detail = total > 1500 ? 1 : total > 400 ? 2 : 3;
  // atoms: one InstancedMesh per element
  const byEl = {}; s.atoms.forEach((a, i) => (byEl[a.el] ||= []).push(i));
  const m4 = new THREE.Matrix4(), v = new THREE.Vector3(), qq = new THREE.Quaternion(), sc = new THREE.Vector3();
  const rOf = (el) => Math.min(0.62, 0.12 + els[el].atomic_radius * 0.26); // ball-and-stick scaling of atomic radii
  for (const [el, ids] of Object.entries(byEl)) {
    const im = new THREE.InstancedMesh(sphereGeo(detail), mat(els[el].vesta), ids.length);
    ids.forEach((i, k) => { const r = rOf(el); m4.compose(v.fromArray(s.atoms[i].p), qq.identity(), sc.set(r, r, r)); im.setMatrixAt(k, m4); });
    im.userData.kind = "atoms"; g.add(im);
  }
  // bonds: two half-cylinders per bond, coloured by endpoint element (single InstancedMesh, instanceColor)
  if (s.bonds.length) {
    const im = new THREE.InstancedMesh(cylGeo, mat(0xffffff), s.bonds.length * 2), up = new THREE.Vector3(0, 1, 0), col = new THREE.Color();
    let k = 0;
    for (const b of s.bonds) {
      const A = new THREE.Vector3().fromArray(s.atoms[b.a].p), B = new THREE.Vector3().fromArray(s.atoms[b.b].p), M = A.clone().lerp(B, 0.5);
      for (const [P, el] of [[A, s.atoms[b.a].el], [B, s.atoms[b.b].el]]) {
        const dir = M.clone().sub(P), len = dir.length(); qq.setFromUnitVectors(up, dir.normalize());
        m4.compose(P.clone().lerp(M, 0.5), qq, sc.set(BOND_R, len, BOND_R)); im.setMatrixAt(k, m4); im.setColorAt(k++, col.set(els[el].vesta));
      }
    }
    im.userData.kind = "bonds"; g.add(im);
  }
  // polyhedra: merged convex hulls per element, translucent + edges
  const pByEl = {}; s.polyhedra.forEach((p) => (pByEl[p.el] ||= []).push(new ConvexGeometry(p.verts.map((x) => new THREE.Vector3().fromArray(x)))));
  for (const [el, geos] of Object.entries(pByEl)) {
    const geo = mergeGeometries(geos.map((x) => { x.deleteAttribute("uv"); return x; }));
    const mesh = new THREE.Mesh(geo, mat(els[el].vesta, { transparent: true, opacity: 0.38, roughness: 0.2, depthWrite: false, side: THREE.DoubleSide }));
    mesh.renderOrder = 2; g.add(mesh);
    g.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 10), new THREE.LineBasicMaterial({ color: new THREE.Color(els[el].vesta).multiplyScalar(0.6), transparent: true, opacity: 0.6 })));
  }
  // unit cell outline
  const pts = s.cellEdges.flat().flatMap((p) => p);
  const lg = new THREE.BufferGeometry(); lg.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  g.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x3a4658 })));
  // centre
  const box = new THREE.Box3().setFromObject(g), c = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3()).length();
  g.position.sub(c); g.userData.size = size; g.userData.stats = { atoms: s.atoms.length, bonds: s.bonds.length, polyhedra: s.polyhedra.length };
  return g;
}

function show() {
  const next = build(), old = root; root = next; scene.add(next);
  const dist = (next.userData.size * 0.5) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / Math.min(1, camera.aspect) * 1.02, dir = camera.position.clone().normalize();
  if (!old) { camera.position.set(1, 0.75, 1.2).normalize().multiplyScalar(dist); next.scale.setScalar(1); }
  tween = { t0: performance.now(), dur: 450, old, from: camera.position.length(), to: dist, dir: old ? dir : camera.position.clone().normalize() };
  next.scale.setScalar(old ? 0.85 : 1); next.traverse((o) => o.material && (o.material.userData.o ??= o.material.opacity));
  window.__state = { ...state, ...next.userData.stats };
}
function step(now) {
  if (!tween) return; const t = Math.min(1, (now - tween.t0) / tween.dur), e = 1 - Math.pow(1 - t, 3);
  camera.position.copy(tween.dir).multiplyScalar(tween.from + (tween.to - tween.from) * e);
  root.scale.setScalar(0.85 + 0.15 * e);
  if (tween.old) tween.old.scale.setScalar(1 - 0.15 * e), tween.old.visible = t < 0.5;
  if (t >= 1) { if (tween.old) { scene.remove(tween.old); tween.old.traverse((o) => o.geometry?.dispose()); } tween = null; }
}

// perf instrumentation (mechanism-explainer §10.6)
const ft = []; let last = performance.now();
window.__perf = () => {
  const s = [...ft].sort((a, b) => a - b), avg = s.reduce((a, b) => a + b, 0) / (s.length || 1), info = renderer.info;
  let instances = 0; scene.traverse((o) => o.isInstancedMesh && (instances += o.count));
  return { avgMs: +avg.toFixed(2), p95Ms: +(s[Math.floor(s.length * 0.95)] || 0).toFixed(2), drawCalls: info.render.calls, triangles: info.render.triangles,
    textures: info.memory.textures, geometries: info.memory.geometries, instances, budget: { drawCalls: 150, triangles: 1.5e6, textureMB: 64 }, ...window.__state };
};
function loop(now) { ft.push(now - last); if (ft.length > 240) ft.shift(); last = now; step(now); controls.update(); renderer.render(scene, camera); requestAnimationFrame(loop); }

function fmt(x) { return x == null ? "—" : (+x).toFixed(4).replace(/0+$/, "").replace(/\.$/, ""); }
function info() {
  const d = data, s = d.source, mc = s.measured_cell, g = d.band_gap, c = d[state.cell];
  const gap = (x, cls, lab) => x ? `<div class="gap"><b>${x.value} eV</b><span class="tag ${cls}">${lab}</span> <span class="sub">${x.method || x.kind || ""}</span> · <a href="${x.src}" target="_blank" rel="noopener">source</a></div>` : `<div class="gap sub">${lab}: n/a</div>`;
  $("#info").innerHTML = `<h2>${d.name.en}</h2><p class="sub">${d.formula} · ${d.prototype} · <b>${d.spacegroup.symbol}</b> (#${d.spacegroup.number}), ${d.spacegroup.crystal_system}</p>
  <h3>Shown cell</h3><p>${state.cell} ${state.n}×${state.n}×${state.n} · ${c.sites.length} atoms/cell · a=${fmt(c.a)} b=${fmt(c.b)} c=${fmt(c.c)} Å · α=${fmt(c.alpha)} β=${fmt(c.beta)} γ=${fmt(c.gamma)}°</p>
  <h3>Measured cell (experiment)</h3><p>a=${mc.length_a} b=${mc.length_b} c=${mc.length_c} Å — COD <a href="${s.url}" target="_blank" rel="noopener">${s.cod_id}</a>${s.doi ? `, <a href="https://doi.org/${s.doi}" target="_blank" rel="noopener">${s.journal} ${s.year}</a>` : `, ${s.journal} ${s.year}`}</p>
  <h3>Band gap</h3>${gap(g.measured, "", "Measured")}${gap(g.computed, "calc", "Computed (DFT)")}
  <h3>Wyckoff sites</h3><table><tr><th>Site</th><th>Wyckoff</th><th>x y z</th><th>CN</th></tr>${d.wyckoff.map((w) => `<tr><td><span class="dot" style="background:${d.elements[w.el].vesta}"></span>${w.el}</td><td>${w.mult}${w.wyckoff.replace(/^\d+/, "")}</td><td>${w.frac.map((x) => fmt(x)).join(" ")}</td><td>${Object.entries(w.cn).map(([k, n]) => `${n} ${k}`).join(", ")}</td></tr>`).join("")}</table>
  <h3>Bond rules</h3><p class="sub">${d.bond_rules.map((b) => `${b.a}–${b.b} ≤ ${b.max} Å${b.draw === false ? " (counted for CN, not drawn)" : ""}`).join(" · ")}</p>`;
}
async function load() {
  data = await (await fetch(`./structures/${state.id}.json`)).json(); info(); show();
  history.replaceState(null, "", `?m=${state.id}&cell=${state.cell}&n=${state.n}${state.poly ? "" : "&poly=0"}`);
}
const segs = (sel, keyName, cast) => $(sel).addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return;
  $(sel).querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b)); state[keyName] = cast(b.dataset.v); info(); show(); history.replaceState(null, "", `?m=${state.id}&cell=${state.cell}&n=${state.n}`); });
segs("#cell", "cell", String); segs("#sup", "n", Number);
$("#poly").addEventListener("change", (e) => { state.poly = e.target.checked; show(); });
$("#mat").addEventListener("change", (e) => { state.id = e.target.value; load(); });
const idx = await (await fetch("./structures/index.json")).json();
$("#mat").innerHTML = idx.map((m) => `<option value="${m.id}">${m.name.en} — ${m.formula} (${m.spacegroup.symbol})</option>`).join("");
$("#mat").value = state.id; $("#poly").checked = state.poly;
document.querySelectorAll("#cell button").forEach((b) => b.classList.toggle("on", b.dataset.v === state.cell));
document.querySelectorAll("#sup button").forEach((b) => b.classList.toggle("on", +b.dataset.v === state.n));
resize(); await load(); requestAnimationFrame(loop);
