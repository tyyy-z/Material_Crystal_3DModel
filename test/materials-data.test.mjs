import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  MATERIALS_PROJECT_FIELDS,
  getInitialMaterials,
  toUiMaterial,
} from "../src/materials-data.js";

test("initial dataset exposes Materials Project summary fields used by the UI", () => {
  assert.deepEqual(MATERIALS_PROJECT_FIELDS, [
    "material_id",
    "formula_pretty",
    "structure",
    "band_gap",
    "energy_above_hull",
    "density",
    "symmetry",
  ]);
});

test("initial dataset contains real Materials Project IDs and crystal structures", () => {
  const materials = getInitialMaterials();

  assert.equal(materials.length >= 4, true);
  assert.equal(materials[0].material_id, "mp-149");
  assert.equal(materials[0].structure.lattice.matrix.length, 3);
  assert.equal(materials[0].structure.sites.length >= 2, true);
});

test("toUiMaterial maps a Materials Project-style document into preview data", () => {
  const [silicon] = getInitialMaterials();
  const uiMaterial = toUiMaterial(silicon);

  assert.equal(uiMaterial.id, "mp-149");
  assert.equal(uiMaterial.title, "Silicon");
  assert.equal(uiMaterial.formula, "Si");
  assert.equal(uiMaterial.spaceGroup, "Fd-3m");
  assert.equal(uiMaterial.atoms.length, silicon.structure.sites.length);
  assert.match(uiMaterial.researchNote, /semiconductor/i);
});

test("toUiMaterial converts cubic primitive display lattice to conventional cubic length", () => {
  const primitiveSi = {
    material_id: "mp-149",
    formula_pretty: "Si",
    crystal_system: "Cubic",
    band_gap: 0.61,
    energy_above_hull: 0,
    density: 2.31,
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
        { species: [{ element: "Si", occu: 1 }], abc: [0.875, 0.875, 0.875], xyz: [3.8891685, 2.7500585, 6.7362365] },
        { species: [{ element: "Si", occu: 1 }], abc: [0.125, 0.125, 0.125], xyz: [0.5555955, 0.3928655, 0.9623195] },
      ],
    },
  };

  const uiMaterial = toUiMaterial(primitiveSi);

  assert.equal(uiMaterial.lattice.displayKind, "conventional-cubic");
  assert.equal(uiMaterial.lattice.centering, "fcc");
  assert.equal(Math.abs(uiMaterial.lattice.a - 5.443) < 0.01, true);
  assert.equal(uiMaterial.lattice.a, uiMaterial.lattice.b);
  assert.equal(uiMaterial.lattice.b, uiMaterial.lattice.c);
});

test("toUiMaterial expands fcc primitive cubic sites into a conventional display cell", () => {
  const primitiveSi = {
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
  };

  const uiMaterial = toUiMaterial(primitiveSi);

  assert.equal(uiMaterial.atoms.length, 8);
  assert.equal(uiMaterial.atomCount, 8);
  assert.equal(uiMaterial.atoms.every((atom) => atom.abc.every((value) => value >= 0 && value < 1)), true);
});

test("cached mp-5229 SrTiO3 keeps the Materials Project cubic perovskite sites", () => {
  const payload = JSON.parse(readFileSync(new URL("../public/data/materials-summary.json", import.meta.url), "utf8"));
  const srTiO3 = payload.materials.find((material) => material.material_id === "mp-5229");
  const uiMaterial = toUiMaterial(srTiO3);
  const sites = uiMaterial.atoms.map((atom) => `${atom.element}:${atom.abc.map((value) => value.toFixed(3)).join(",")}`).sort();

  assert.equal(uiMaterial.formula, "SrTiO3");
  assert.equal(uiMaterial.spaceGroup, "Pm-3m");
  assert.equal(Math.abs(uiMaterial.lattice.a - 3.91270131) < 0.001, true);
  assert.equal(uiMaterial.lattice.a, uiMaterial.lattice.b);
  assert.equal(uiMaterial.lattice.b, uiMaterial.lattice.c);
  assert.deepEqual(sites, [
    "O:0.000,0.500,0.500",
    "O:0.500,0.000,0.500",
    "O:0.500,0.500,0.000",
    "Sr:0.000,0.000,0.000",
    "Ti:0.500,0.500,0.500",
  ]);
});
