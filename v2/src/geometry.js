// Pure geometry: periodic expansion, boundary atoms, bonds by pair cutoffs, polyhedra neighbour sets.
export const EPS = 1e-3;
export function fracToCart(M, f) {
  return [f[0]*M[0][0]+f[1]*M[1][0]+f[2]*M[2][0], f[0]*M[0][1]+f[1]*M[1][1]+f[2]*M[2][1], f[0]*M[0][2]+f[1]*M[1][2]+f[2]*M[2][2]];
}
function cutoffTable(rules) {
  const t = new Map(), nd = new Set(); let max = 0;
  for (const r of rules) { t.set(r.a + "|" + r.b, r.max); t.set(r.b + "|" + r.a, r.max); if (r.draw === false) { nd.add(r.a + "|" + r.b); nd.add(r.b + "|" + r.a); } max = Math.max(max, r.max); }
  return { get: (a, b) => t.get(a + "|" + b), draw: (a, b) => !nd.has(a + "|" + b), max };
}
// Build the displayed scene graph for a cell (conventional or primitive) repeated n×n×n.
export function buildScene(cell, rules, polyEls, n = 1) {
  const M = cell.matrix, cut = cutoffTable(rules);
  const cand = []; // candidate atoms in [-1, n+1)
  for (let i = -1; i <= n; i++) for (let j = -1; j <= n; j++) for (let k = -1; k <= n; k++)
    cell.sites.forEach((s, si) => {
      const f = [s.frac[0] + i, s.frac[1] + j, s.frac[2] + k];
      cand.push({ el: s.el, f, p: fracToCart(M, f), site: si });
    });
  const inside = (f) => f.every((x) => x > -EPS && x < n + EPS);
  // spatial hash over candidates
  const h = cut.max, grid = new Map(), key = (p) => p.map((x) => Math.floor(x / h)).join(",");
  cand.forEach((a, idx) => { const kk = key(a.p); (grid.get(kk) || grid.set(kk, []).get(kk)).push(idx); });
  const neigh = (idx) => {
    const a = cand[idx], c = a.p.map((x) => Math.floor(x / h)), out = [];
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
      const l = grid.get([c[0]+dx, c[1]+dy, c[2]+dz].join(",")); if (!l) continue;
      for (const j of l) { if (j === idx) continue; const b = cand[j], m = cut.get(a.el, b.el); if (!m) continue;
        const d = Math.hypot(a.p[0]-b.p[0], a.p[1]-b.p[1], a.p[2]-b.p[2]); if (d <= m) out.push({ j, d }); }
    }
    return out;
  };
  const shown = new Set(); cand.forEach((a, i) => { if (inside(a.f)) shown.add(i); });
  const core = [...shown];
  // complete polyhedra: neighbours of in-cell polyhedron centres become visible
  const polyhedra = [];
  for (const i of core) {
    if (!polyEls.includes(cand[i].el)) continue;
    const nb = neigh(i); if (nb.length < 4) continue;
    nb.forEach((x) => shown.add(x.j)); polyhedra.push({ center: i, verts: nb.map((x) => x.j) });
  }
  const atoms = [...shown].sort((a, b) => a - b), pos = new Map(atoms.map((a, i) => [a, i]));
  const bonds = [], seen = new Set();
  for (const i of atoms) for (const { j, d } of neigh(i)) {
    if (!shown.has(j) || !cut.draw(cand[i].el, cand[j].el)) continue; const k = i < j ? i + "-" + j : j + "-" + i; if (seen.has(k)) continue; seen.add(k);
    bonds.push({ a: pos.get(i), b: pos.get(j), d });
  }
  return {
    atoms: atoms.map((i) => ({ ...cand[i], core: inside(cand[i].f) })),
    bonds, polyhedra: polyhedra.map((p) => ({ el: cand[p.center].el, center: cand[p.center].p, verts: p.verts.map((v) => cand[v].p) })),
    cellEdges: cellEdges(M, n),
  };
}
export function cellEdges(M, n) {
  const e = []; const c = (a, b, d) => fracToCart(M, [a, b, d]);
  for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) {
    e.push([c(0, i, j), c(n, i, j)], [c(i, 0, j), c(i, n, j)], [c(i, j, 0), c(i, j, n)]);
  }
  return n === 1 ? e : e.filter(([a, b]) => true);
}
