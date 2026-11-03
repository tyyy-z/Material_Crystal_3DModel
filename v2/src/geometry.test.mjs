import { test } from "node:test"; import assert from "node:assert/strict"; import fs from "node:fs";
import { buildScene } from "./geometry.js";
const load = (id) => JSON.parse(fs.readFileSync(new URL(`../../public/structures/${id}.json`, import.meta.url)));
const avgCN = (s, el) => { const c = new Map(); s.bonds.forEach((b) => { [b.a, b.b].forEach((x) => c.set(x, (c.get(x) || 0) + 1)); });
  const core = s.atoms.map((a, i) => [a, i]).filter(([a]) => a.el === el && a.core && a.f.every((x) => x > 0.01 && x < 0.99)); return core.map(([, i]) => c.get(i)); };
test("Si conventional: 18 boundary-inclusive atoms, interior Si 4-coordinated", () => {
  const d = load("si"), s = buildScene(d.conventional, d.bond_rules, d.polyhedra_elements, 1);
  assert.equal(s.atoms.filter((a) => a.core).length, 18); // 8 corners + 6 faces + 4 interior
  avgCN(s, "Si").forEach((n) => assert.equal(n, 4));
});
for (const [id, el, n] of [["srtio3", "Ti", 6], ["lifepo4", "Fe", 6], ["lifepo4", "P", 4], ["gan", "Ga", 4], ["quartz", "Si", 4], ["caf2", "F", 4], ["licoo2", "Co", 6]])
  test(`${id}: every ${el} polyhedron complete (${n} vertices) in 1..3 supercells`, () => {
    const d = load(id);
    for (const k of [1, 2, 3]) for (const cell of ["conventional", "primitive"]) {
      const s = buildScene(d[cell], d.bond_rules, d.polyhedra_elements, k);
      const ps = s.polyhedra.filter((p) => p.el === el); assert.ok(ps.length > 0); ps.forEach((p) => assert.equal(p.verts.length, n));
    }
  });
