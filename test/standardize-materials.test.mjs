import test from "node:test";
import assert from "node:assert/strict";
import { standardizeMaterialsWithPymatgen } from "../scripts/standardize-materials.mjs";
import { toUiMaterial } from "../src/materials-data.js";

const rawGaN = {
  material_id: "mp-804",
  formula_pretty: "GaN",
  symmetry: {
    crystal_system: "Hexagonal",
    symbol: "P6_3mc",
    symprec: 0.1,
    angle_tolerance: 5,
  },
  structure: {
    "@module": "pymatgen.core.structure",
    "@class": "Structure",
    charge: 0,
    lattice: {
      matrix: [
        [3.18892989, 0, 0],
        [-1.59446545, 2.76169519, 0],
        [0, 0, 5.19235725],
      ],
      pbc: [true, true, true],
    },
    sites: [
      { species: [{ element: "Ga", occu: 1 }], abc: [0.666667, 0.333333, 0.49908371] },
      { species: [{ element: "Ga", occu: 1 }], abc: [0.333333, 0.666667, 0.99908371] },
      { species: [{ element: "N", occu: 1 }], abc: [0.666667, 0.333333, 0.87591629] },
      { species: [{ element: "N", occu: 1 }], abc: [0.333333, 0.666667, 0.37591629] },
    ],
  },
};

test("Crystal Toolkit display scene includes image atoms and direct bond segments for wurtzite GaN", () => {
  const [standardized] = standardizeMaterialsWithPymatgen([rawGaN]);
  const scene = standardized.display_scene;

  assert.equal(standardized.structure.sites.length, 4);
  assert.equal(standardized.display_structure.source, "mp-api-structure");
  assert.equal(scene.source, "crystal-toolkit");
  assert.equal(scene.atoms.length > 4, true);
  assert.equal(scene.cellEdges.length, 12);
  assert.equal(scene.bonds.length >= 8, true);
  assert.equal(scene.bonds.every((bond) => Array.isArray(bond.start) && Array.isArray(bond.end)), true);
  assert.equal(scene.bonds.every((bond) => bond.length > 0.4 && bond.length < 1.1), true);
});

test("pymatgen metadata keeps BeAu2 conventional lattice while CT exports the render scene", () => {
  const [standardized] = standardizeMaterialsWithPymatgen([
    {
      material_id: "mp-12761",
      formula_pretty: "BeAu2",
      symmetry: {
        crystal_system: "Tetragonal",
        symbol: "I4/mmm",
        symprec: 0.1,
        angle_tolerance: 5,
      },
      structure: {
        "@module": "pymatgen.core.structure",
        "@class": "Structure",
        charge: 0,
        lattice: {
          matrix: [
            [2.80535652, 0, -0.805484],
            [-0.23127314, 2.79580827, -0.80548401],
            [0.04787294, 0.05199518, 5.45475509],
          ],
          pbc: [true, true, true],
        },
        sites: [
          { species: [{ element: "Be", occu: 1 }], abc: [0, 0, 0] },
          { species: [{ element: "Au", occu: 1 }], abc: [0.35823055, 0.35823055, 0.7164631] },
          { species: [{ element: "Au", occu: 1 }], abc: [0.64176945, 0.64176945, 0.2835369] },
        ],
      },
    },
  ]);

  const uiMaterial = toUiMaterial(standardized);

  assert.ok(standardized.display_scene);
  assert.ok(standardized.conventional_structure);
  assert.equal(standardized.structure.sites.length, 3);
  assert.equal(standardized.display_structure.source, "pymatgen-conventional-standard");
  assert.equal(standardized.display_scene.source, "crystal-toolkit");
  assert.equal(standardized.display_scene.cellEdges.length, 12);
  assert.equal(standardized.display_scene.atoms.length >= standardized.structure.sites.length, true);
  assert.equal(uiMaterial.lattice.displayKind, "pymatgen-standard");
  assert.equal(uiMaterial.atoms.length, 3);
  assert.equal(uiMaterial.displayScene.atoms.length >= 3, true);
  assert.equal(Math.abs(uiMaterial.lattice.a - uiMaterial.lattice.b) < 0.001, true);
  assert.equal(Math.abs(uiMaterial.lattice.a - uiMaterial.lattice.c) > 1, true);
});
