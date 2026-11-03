import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { ConvexGeometry } from "three/examples/jsm/geometries/ConvexGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { CSS2DRenderer, CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { buildScene, EPS } from "./geometry.js";
import { STR, PROTO_ZH, EL_ZH, GROUPS } from "./i18n.js";

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
let root = null, data = null, index = [], tween = null, scn = null, freeAspect = 1;

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

function build() {
  const cell = data[state.cell], s = buildScene(cell, data.bond_rules, state.poly ? data.polyhedra_elements : [], state.n);
  const g = new THREE.Group(), els = data.elements, detail = s.atoms.length > 1500 ? 1 : s.atoms.length > 400 ? 2 : 3;
  const byEl = {}; s.atoms.forEach((a, i) => (byEl[a.el] ||= []).push(i));
  const m4 = new THREE.Matrix4(), v = new THREE.Vector3(), qq = new THREE.Quaternion(), sc = new THREE.Vector3();
  g.userData.atomMeshes = [];
  for (const [el, ids] of Object.entries(byEl)) {
    const im = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, detail), mat(els[el].vesta), ids.length);
    ids.forEach((i, k) => { const r = rOf(el); m4.compose(v.fromArray(s.atoms[i].p), qq.identity(), sc.set(r, r, r)); im.setMatrixAt(k, m4); });
    im.userData.ids = ids; g.add(im); g.userData.atomMeshes.push(im);
  }
  if (s.bonds.length) {
    const im = new THREE.InstancedMesh(cylGeo, mat(0xffffff), s.bonds.length * 2), up = new THREE.Vector3(0, 1, 0), col = new THREE.Color(); let k = 0;
    for (const b of s.bonds) {
      const A = new THREE.Vector3().fromArray(s.atoms[b.a].p), B = new THREE.Vector3().fromArray(s.atoms[b.b].p), M = A.clone().lerp(B, 0.5);
      for (const [P, el] of [[A, s.atoms[b.a].el], [B, s.atoms[b.b].el]]) {
        const dir = M.clone().sub(P), len = dir.length(); qq.setFromUnitVectors(up, dir.normalize());
        m4.compose(P.clone().lerp(M, 0.5), qq, sc.set(BOND_R, len, BOND_R)); im.setMatrixAt(k, m4); im.setColorAt(k++, col.set(els[el].vesta));
      }
    }
    g.add(im);
  }
  const pByEl = {}; s.polyhedra.forEach((p) => (pByEl[p.el] ||= []).push(new ConvexGeometry(p.verts.map((x) => new THREE.Vector3().fromArray(x)))));
  for (const [el, geos] of Object.entries(pByEl)) {
    const geo = mergeGeometries(geos.map((x) => { x.deleteAttribute("uv"); return x; }));
    const mesh = new THREE.Mesh(geo, mat(els[el].vesta, { transparent: true, opacity: 0.36, roughness: 0.2, depthWrite: false, side: THREE.DoubleSide })); mesh.renderOrder = 2; g.add(mesh);
    g.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 10), new THREE.LineBasicMaterial({ color: new THREE.Color(els[el].vesta).multiplyScalar(0.55), transparent: true, opacity: 0.55 })));
  }
  const lg = new THREE.BufferGeometry(); lg.setAttribute("position", new THREE.Float32BufferAttribute(s.cellEdges.flat().flat(), 3));
  g.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x334155, transparent: true, opacity: 0.7 })));
  // labels: one per site of the base cell (element + Wyckoff letter)
  if (state.labels) s.atoms.forEach((a) => {
    if (!a.f.every((x) => x > -EPS && x < 1 - EPS)) return;
    const w = data.wyckoff[cell.sites[a.site].w], d = document.createElement("div"); d.className = "lbl";
    d.innerHTML = `${a.el}<small>${w.wyckoff.replace(/^\d+/, "")}</small>`; const o = new CSS2DObject(d); o.position.fromArray(a.p); g.add(o);
  });
  const box = new THREE.Box3().setFromObject(g), c = box.getCenter(new THREE.Vector3());
  g.position.sub(c); g.userData.radius = box.getBoundingSphere(new THREE.Sphere()).radius;
  g.userData.stats = { atoms: s.atoms.length, bonds: s.bonds.length, polyhedra: s.polyhedra.length }; g.userData.scene = s;
  return g;
}
// radius must fit inside the free (unglazed) part of the frustum; bounding sphere is conservative, hence 0.86
const fitDist = (r) => (r * 0.86) / (Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * freeAspect);
function fit(home) { const d = fitDist(root.userData.radius); tween = { t0: performance.now(), dur: 450, from: camera.position.length(), to: d, dir: home ? HOME.clone() : camera.position.clone().normalize(), old: tween?.old }; controls.target.set(0, 0, 0); }
function show() {
  const next = build(), old = root; root = next; scn = next.userData.scene; scene.add(next); clearPick(false);
  if (!old) camera.position.copy(HOME).multiplyScalar(fitDist(next.userData.radius));
  const dir = camera.position.clone().normalize();
  tween = { t0: performance.now(), dur: 450, old, from: camera.position.length(), to: fitDist(next.userData.radius), dir };
  next.scale.setScalar(old ? 0.86 : 1);
  window.__state = { ...state, ...next.userData.stats };
}
function step(now) {
  if (!tween) return; const k = Math.min(1, (now - tween.t0) / tween.dur), e = 1 - Math.pow(1 - k, 3);
  camera.position.copy(tween.dir).multiplyScalar(tween.from + (tween.to - tween.from) * e);
  root.scale.setScalar(Math.min(1, root.scale.x + (1 - root.scale.x) * e));
  if (tween.old) { tween.old.scale.setScalar(1 - 0.14 * e); tween.old.visible = k < 0.5; }
  if (k >= 1) { if (tween.old) disposeGroup(tween.old); root.scale.setScalar(1); tween = null; }
}
function disposeGroup(g) { scene.remove(g); g.traverse((o) => { o.geometry?.dispose(); if (o.isCSS2DObject) o.element.remove(); }); }

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
  root.add(halo); info();
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
function loop(now) { ft.push(now - last); if (ft.length > 240) ft.shift(); last = now; step(now); hoverStep(); controls.update(); renderer.render(scene, camera); css2d.render(scene, camera); requestAnimationFrame(loop); }

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
  const gapRow = (x, lab) => x ? `<div class="gap"><span class="t">${lab}</span><span class="v">${x.value} eV</span><span class="m">${x.method || x.kind || ""} · <a href="${x.src}" target="_blank" rel="noopener">${t("source")}</a></span></div>`
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
  const p = new URLSearchParams({ m: state.id, cell: state.cell, n: state.n }); if (!state.poly) p.set("poly", 0); if (state.labels) p.set("labels", 1); if (state.lang !== "en") p.set("lang", state.lang);
  history.replaceState(null, "", "?" + p);
}
async function load() { data = await (await fetch(`./structures/${state.id}.json`)).json(); rail(); info(); show(); syncControls(); }
const seg = (sel, k, cast) => $(sel).addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; state[k] = cast(b.dataset.v); info(); show(); syncControls(); });
seg("#cell", "cell", String); seg("#sup", "n", Number);
$("#poly").addEventListener("click", () => { state.poly = !state.poly; show(); syncControls(); });
$("#lab").addEventListener("click", () => { state.labels = !state.labels; show(); syncControls(); });
$("#reset").addEventListener("click", () => fit(true));
$("#cases").addEventListener("click", (e) => { const b = e.target.closest(".ci"); if (!b || b.dataset.id === state.id) return; state.id = b.dataset.id; load(); });
$("#lang").addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; state.lang = b.dataset.l; localStorage.setItem("cs-lang", state.lang); i18nStatic(); rail(); info(); syncControls(); resize(); if (root) fit(false); });
$("#grab").addEventListener("click", () => $("#panel").classList.toggle("open"));
{ let y0 = null; const p = $("#panel");
  p.addEventListener("touchstart", (e) => { if (e.target.closest(".grab") || p.querySelector(".pscroll").scrollTop === 0) y0 = e.touches[0].clientY; }, { passive: true });
  p.addEventListener("touchend", (e) => { if (y0 == null) return; const dy = e.changedTouches[0].clientY - y0; if (dy < -30) p.classList.add("open"); if (dy > 30) p.classList.remove("open"); y0 = null; }); }
addEventListener("keydown", (e) => { if (e.key === "Escape") clearPick(); });

index = await (await fetch("./structures/index.json")).json();
if (q.get("sheet") === "open") $("#panel").classList.add("open");
i18nStatic(); resize(); await load(); requestAnimationFrame(loop);
