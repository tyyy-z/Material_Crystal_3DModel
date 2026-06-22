import test from "node:test";
import assert from "node:assert/strict";
import { buildCrystalRenderModel, elementVisuals } from "../src/crystal-geometry.js";
import { getInitialMaterials, toUiMaterial } from "../src/materials-data.js";

test("buildCrystalRenderModel expands small primitive structures into a research-view supercell", () => {
  const silicon = toUiMaterial(getInitialMaterials()[0]);
  const model = buildCrystalRenderModel(silicon);

  assert.equal(model.atoms.length, silicon.atoms.length * 8);
  assert.equal(model.cellEdges.length, 12);
  assert.equal(model.bounds.radius > 0, true);
});

test("buildCrystalRenderModel creates bonds using element-aware covalent radii", () => {
  const silicon = toUiMaterial(getInitialMaterials()[0]);
  const model = buildCrystalRenderModel(silicon);

  assert.equal(model.bonds.length > 0, true);
  assert.equal(model.bonds.every((bond) => bond.start.length === 3 && bond.end.length === 3), true);
});

test("buildCrystalRenderModel displays periodic boundary images for cubic perovskite unit cells", () => {
  const srTiO3 = toUiMaterial(getInitialMaterials()[3]);
  const model = buildCrystalRenderModel(srTiO3);
  const elementCounts = model.atoms.reduce((counts, atom) => {
    counts[atom.element] = (counts[atom.element] ?? 0) + 1;
    return counts;
  }, {});
  const ti = model.atoms.find((atom) => atom.element === "Ti");
  const tiOBonds = model.bonds.filter((bond) => {
    const start = model.atoms.find((atom) => atom.id === bond.atomIds[0]);
    const end = model.atoms.find((atom) => atom.id === bond.atomIds[1]);
    return [start?.element, end?.element].sort().join("-") === "O-Ti";
  });
  const expectedTiODistance = srTiO3.lattice.a / 2;

  assert.equal(model.bounds.repetitions, 1);
  assert.equal(elementCounts.Sr, 8);
  assert.equal(elementCounts.Ti, 1);
  assert.equal(elementCounts.O, 6);
  assert.equal(tiOBonds.length, 6);
  assert.equal(tiOBonds.every((bond) => Math.abs(bond.length - expectedTiODistance) < 0.001), true);
  assert.ok(ti);
  assert.deepEqual(
    ti.position.map((value) => Math.abs(value) < 1e-9),
    [true, true, true],
  );
});

test("buildCrystalRenderModel uses pymatgen display_scene geometry when available", () => {
  const material = {
    formula: "AB",
    atoms: [],
    lattice: {
      matrix: [
        [2, 0, 0],
        [0, 3, 0],
        [0, 0, 4],
      ],
      displayKind: "pymatgen-standard",
    },
    displayScene: {
      atoms: [
        { id: "a", element: "Be", label: "Be", abc: [0, 0, 0], cartesian: [0, 0, 0] },
        { id: "b", element: "Au", label: "Au", abc: [0.5, 0.5, 0.5], cartesian: [1, 1.5, 2] },
      ],
      cellEdges: [
        { start: [0, 0, 0], end: [2, 0, 0] },
        { start: [0, 0, 0], end: [0, 3, 0] },
      ],
      bonds: [{ id: "a-b", atomIds: ["a", "b"], length: Math.sqrt(7.25) }],
      center: [1, 1.5, 2],
    },
  };

  const model = buildCrystalRenderModel(material);

  assert.equal(model.atoms.length, 2);
  assert.equal(model.cellEdges.length, 2);
  assert.equal(model.bonds.length, 1);
  assert.deepEqual(model.bounds.center, [1, 1.5, 2]);
  assert.deepEqual(model.atoms.find((atom) => atom.id === "b").position, [0, 0, 0]);
});

test("buildCrystalRenderModel renders Crystal Toolkit direct bond segments", () => {
  const material = {
    formula: "AB",
    atoms: [],
    lattice: { matrix: [[2, 0, 0], [0, 2, 0], [0, 0, 2]], displayKind: "api-structure" },
    displayScene: {
      source: "crystal-toolkit",
      atoms: [
        { id: "a", element: "Be", label: "Be", abc: [0, 0, 0], cartesian: [0, 0, 0], color: "#111111", radius: 0.5 },
        { id: "b", element: "Au", label: "Au", abc: [0.5, 0, 0], cartesian: [1, 0, 0], color: "#222222", radius: 0.5 },
      ],
      cellEdges: [{ start: [0, 0, 0], end: [2, 0, 0] }],
      bonds: [{ id: "ct-bond-0", start: [0, 0, 0], end: [0.5, 0, 0], length: 0.5, color: "#777777" }],
      center: [1, 0, 0],
    },
  };

  const model = buildCrystalRenderModel(material);

  assert.equal(model.bonds.length, 1);
  assert.deepEqual(model.bonds[0].atomIds, []);
  assert.deepEqual(model.bonds[0].start, [-3.1, 0, 0]);
  assert.deepEqual(model.bonds[0].end, [-1.55, 0, 0]);
  assert.equal(model.atoms[0].color, "#111111");
});

test("element visuals include Be and Au instead of falling back to default cyan atoms", () => {
  assert.equal(elementVisuals.Be.color, "#c8ff3d");
  assert.equal(elementVisuals.Au.color, "#ffd447");
  assert.equal(elementVisuals.Be.covalentRadius > 0, true);
  assert.equal(elementVisuals.Au.covalentRadius > 0, true);
});

test("buildCrystalRenderModel keeps labels as atom metadata, not HTML box state", () => {
  const silicon = toUiMaterial(getInitialMaterials()[0]);
  const model = buildCrystalRenderModel(silicon);

  assert.deepEqual(
    [...new Set(model.atoms.map((atom) => atom.label))],
    ["Si"],
  );
});

test("buildCrystalRenderModel exposes a [001] surface default view", () => {
  const silicon = toUiMaterial(getInitialMaterials()[0]);
  const model = buildCrystalRenderModel(silicon);

  assert.deepEqual(model.defaultView.direction, [0, 0, 1]);
  assert.equal(model.defaultView.projection, "orthographic");
});

test("buildCrystalRenderModel keeps conventional cubic displays to one unit cell by default", () => {
  const silicon = toUiMaterial({
    material_id: "mp-149",
    formula_pretty: "Si",
    crystal_system: "Cubic",
    symmetry: { symbol: "Fd-3m", crystal_system: "Cubic" },
    structure: {
      lattice: {
        matrix: [
          [3.333573, 0, 1.924639],
          [1.111191, 3.142924, 1.924639],
          [0, 0, 3.849278],
        ],
      },
      sites: [
        { species: [{ element: "Si", occu: 1 }], abc: [0.875, 0.875, 0.875] },
        { species: [{ element: "Si", occu: 1 }], abc: [0.125, 0.125, 0.125] },
      ],
    },
  });

  const model = buildCrystalRenderModel(silicon);

  assert.equal(silicon.atoms.length, 8);
  assert.equal(model.bounds.repetitions, 1);
  assert.equal(model.atoms.length < silicon.atoms.length * 8, true);
});
