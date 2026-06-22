export const MATERIALS_PROJECT_FIELDS = [
  "material_id",
  "formula_pretty",
  "structure",
  "band_gap",
  "energy_above_hull",
  "density",
  "symmetry",
];

const seedMaterials = [
  {
    material_id: "mp-149",
    formula_pretty: "Si",
    name: "Silicon",
    crystal_system: "Cubic",
    band_gap: 0.61,
    energy_above_hull: 0,
    density: 2.33,
    symmetry: { symbol: "Fd-3m", number: 227 },
    structure: {
      lattice: {
        matrix: [
          [5.431, 0, 0],
          [0, 5.431, 0],
          [0, 0, 5.431],
        ],
      },
      sites: [
        { species: [{ element: "Si", occu: 1 }], abc: [0, 0, 0] },
        { species: [{ element: "Si", occu: 1 }], abc: [0.25, 0.25, 0.25] },
      ],
    },
    research_note:
      "Silicon is the baseline semiconductor reference. Use it as the default calibration material before exploring defect-sensitive compounds.",
    theme: ["#00ffff", "#ff00ff"],
  },
  {
    material_id: "mp-804",
    formula_pretty: "GaN",
    name: "Gallium Nitride",
    crystal_system: "Hexagonal",
    band_gap: 1.75,
    energy_above_hull: 0,
    density: 6.1,
    symmetry: { symbol: "P6_3mc", number: 186 },
    structure: {
      lattice: {
        matrix: [
          [3.189, 0, 0],
          [-1.5945, 2.761, 0],
          [0, 0, 5.185],
        ],
      },
      sites: [
        { species: [{ element: "Ga", occu: 1 }], abc: [0, 0, 0] },
        { species: [{ element: "Ga", occu: 1 }], abc: [0.6667, 0.3333, 0.5] },
        { species: [{ element: "N", occu: 1 }], abc: [0, 0, 0.375] },
        { species: [{ element: "N", occu: 1 }], abc: [0.6667, 0.3333, 0.875] },
      ],
    },
    research_note:
      "GaN is a strong candidate for high-power electronics and optoelectronics. Prioritize polarity, surface termination, and dislocation-related defect workflows.",
    theme: ["#00ffff", "#ff9900"],
  },
  {
    material_id: "mp-19017",
    formula_pretty: "LiFePO4",
    name: "Lithium Iron Phosphate",
    crystal_system: "Orthorhombic",
    band_gap: 3.7,
    energy_above_hull: 0.012,
    density: 3.47,
    symmetry: { symbol: "Pnma", number: 62 },
    structure: {
      lattice: {
        matrix: [
          [10.33, 0, 0],
          [0, 6.01, 0],
          [0, 0, 4.69],
        ],
      },
      sites: [
        { species: [{ element: "Li", occu: 1 }], abc: [0, 0, 0] },
        { species: [{ element: "Fe", occu: 1 }], abc: [0.282, 0.25, 0.974] },
        { species: [{ element: "P", occu: 1 }], abc: [0.095, 0.25, 0.418] },
        { species: [{ element: "O", occu: 1 }], abc: [0.097, 0.25, 0.744] },
        { species: [{ element: "O", occu: 1 }], abc: [0.457, 0.25, 0.206] },
        { species: [{ element: "O", occu: 1 }], abc: [0.165, 0.047, 0.284] },
      ],
    },
    research_note:
      "LiFePO4 is useful for structure-property teaching around ion channels, redox centers, and stability screening in AI4Science battery discovery.",
    theme: ["#5dff9b", "#ff00ff"],
  },
  {
    material_id: "mp-5229",
    formula_pretty: "SrTiO3",
    name: "Strontium Titanate",
    crystal_system: "Cubic",
    band_gap: 1.8,
    energy_above_hull: 0,
    density: 5.12,
    symmetry: { symbol: "Pm-3m", number: 221 },
    structure: {
      lattice: {
        matrix: [
          [3.905, 0, 0],
          [0, 3.905, 0],
          [0, 0, 3.905],
        ],
      },
      sites: [
        { species: [{ element: "Sr", occu: 1 }], abc: [0, 0, 0] },
        { species: [{ element: "Ti", occu: 1 }], abc: [0.5, 0.5, 0.5] },
        { species: [{ element: "O", occu: 1 }], abc: [0.5, 0.5, 0] },
        { species: [{ element: "O", occu: 1 }], abc: [0.5, 0, 0.5] },
        { species: [{ element: "O", occu: 1 }], abc: [0, 0.5, 0.5] },
      ],
    },
    research_note:
      "SrTiO3 can anchor oxide interface and defect-state experiments. It is a good preview material for vacancy, dopant, and symmetry visualization modes.",
    theme: ["#ffffff", "#00ffff"],
  },
];

export function getInitialMaterials() {
  return seedMaterials.map((material) => structuredClone(material));
}

export function toUiMaterial(material) {
  const structure = material.structure ?? { sites: [] };
  const symmetry = material.symmetry ?? {};
  const formula = material.formula_pretty ?? material.formula ?? material.material_id;
  const title = material.name ?? formula;
  const crystalSystem = material.crystal_system ?? symmetry.crystal_system ?? "Crystal";
  const bandGap = Number(material.band_gap ?? 0);
  const hull = Number(material.energy_above_hull ?? 0);
  const density = Number(material.density ?? 0);
  const spaceGroup = symmetry.symbol ?? symmetry.number?.toString() ?? "Unknown";

  const sourceAtoms = structure.sites.map((site, index) => {
    const element = site.species[0]?.element ?? "X";
    const [a, b, c] = site.abc;
    const [x, y, z] = site.xyz ?? [a, b, c];
    return {
      id: `${material.material_id}-${index}`,
      element,
      label: site.label ?? element,
      abc: [a, b, c],
      xyz: [x, y, z],
      x: Math.round((12 + a * 72 + c * 10) * 10) / 10,
      y: Math.round((16 + b * 64 - c * 16) * 10) / 10,
      z: c,
    };
  });

  const latticeMatrix = structure.lattice?.matrix ?? [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];
  const displayLattice = buildDisplayLattice(latticeMatrix, crystalSystem);
  const sceneLatticeMatrix = material.display_scene?.latticeMatrix;
  const uiLatticeMatrix = sceneLatticeMatrix ?? displayLattice.matrix;
  const atoms = buildDisplayAtoms(sourceAtoms, displayLattice);
  const elements = [...new Set(atoms.map((atom) => atom.element))].sort();
  const displayKind = material.display_structure ? "pymatgen-standard" : displayLattice.kind;

  return {
    id: material.material_id,
    title,
    formula,
    meta: `${formula} / ${material.material_id} / ${crystalSystem.toLowerCase()} / ${spaceGroup}`,
    bandGap: `${bandGap.toFixed(2)} eV`,
    hull: `${hull.toFixed(3)} eV`,
    density: `${density.toFixed(2)} g/cm3`,
    spaceGroup,
    crystalSystem,
    materialId: material.material_id,
    elements,
    atomCount: atoms.length,
    lattice: {
      rawMatrix: latticeMatrix,
      matrix: uiLatticeMatrix,
      displayKind,
      centering: displayLattice.centering,
      a: vectorLength(uiLatticeMatrix[0]),
      b: vectorLength(uiLatticeMatrix[1]),
      c: vectorLength(uiLatticeMatrix[2]),
    },
    atoms,
    displayScene: material.display_scene
      ? {
          atoms: material.display_scene.atoms ?? [],
          cellEdges: material.display_scene.cellEdges ?? [],
          bonds: material.display_scene.bonds ?? [],
          center: material.display_scene.center,
          latticeMatrix: material.display_scene.latticeMatrix,
          source: material.display_scene.source,
        }
      : null,
    researchNote:
      material.research_note ??
      `${formula} was loaded from Materials Project summary data. Inspect its structure, stability, and electronic properties before selecting a defect or AI4Science workflow.`,
    theme: material.theme ?? ["#00ffff", "#ff00ff"],
  };
}

function vectorLength(vector) {
  const [x, y, z] = vector;
  return Math.sqrt(x * x + y * y + z * z);
}

function vectorDot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function angleDegrees(a, b) {
  const denominator = vectorLength(a) * vectorLength(b);
  if (!denominator) {
    return 90;
  }
  const cosine = Math.max(-1, Math.min(1, vectorDot(a, b) / denominator));
  return (Math.acos(cosine) * 180) / Math.PI;
}

function normalizeFraction(value) {
  const normalized = ((value % 1) + 1) % 1;
  return Math.round(normalized * 1000000) / 1000000;
}

function normalizeFractionalTuple(tuple) {
  return tuple.map(normalizeFraction);
}

function primitiveToConventionalFraction(abc, centering) {
  const [a, b, c] = abc;
  if (centering === "fcc") {
    return normalizeFractionalTuple([(b + c) / 2, (a + c) / 2, (a + b) / 2]);
  }
  if (centering === "bcc") {
    return normalizeFractionalTuple([(a + b - c) / 2, (a - b + c) / 2, (-a + b + c) / 2]);
  }
  return normalizeFractionalTuple(abc);
}

function subtractFractionalOffset(tuple, offset) {
  return normalizeFractionalTuple([
    tuple[0] - offset[0],
    tuple[1] - offset[1],
    tuple[2] - offset[2],
  ]);
}

function addFractionalOffset(tuple, offset) {
  return normalizeFractionalTuple([
    tuple[0] + offset[0],
    tuple[1] + offset[1],
    tuple[2] + offset[2],
  ]);
}

function fractionalSortKey(tuple) {
  return tuple.map((value) => value.toFixed(6)).join(":");
}

function buildDisplayAtoms(sourceAtoms, displayLattice) {
  if (displayLattice.kind !== "conventional-cubic" || displayLattice.centering === "primitive") {
    return sourceAtoms;
  }

  const centeringOffsets =
    displayLattice.centering === "fcc"
      ? [
          [0, 0, 0],
          [0, 0.5, 0.5],
          [0.5, 0, 0.5],
          [0.5, 0.5, 0],
        ]
      : [
          [0, 0, 0],
          [0.5, 0.5, 0.5],
        ];

  const conventionalBasis = sourceAtoms.map((atom) => ({
    atom,
    abc: primitiveToConventionalFraction(atom.abc, displayLattice.centering),
  }));
  const origin = conventionalBasis
    .map((entry) => entry.abc)
    .sort((a, b) => fractionalSortKey(a).localeCompare(fractionalSortKey(b)))[0] ?? [0, 0, 0];

  const dedupe = new Set();
  const atoms = [];
  for (const { atom, abc } of conventionalBasis) {
    const basis = subtractFractionalOffset(abc, origin);
    for (const offset of centeringOffsets) {
      const displayAbc = addFractionalOffset(basis, offset);
      const key = `${atom.element}:${fractionalSortKey(displayAbc)}`;
      if (dedupe.has(key)) {
        continue;
      }
      dedupe.add(key);
      atoms.push({
        ...atom,
        id: `${atom.id}:conv-${atoms.length}`,
        abc: displayAbc,
        x: Math.round((12 + displayAbc[0] * 72 + displayAbc[2] * 10) * 10) / 10,
        y: Math.round((16 + displayAbc[1] * 64 - displayAbc[2] * 16) * 10) / 10,
        z: displayAbc[2],
      });
    }
  }

  return atoms;
}

function buildDisplayLattice(matrix, crystalSystem) {
  const lengths = matrix.map(vectorLength);
  const angles = [
    angleDegrees(matrix[1], matrix[2]),
    angleDegrees(matrix[0], matrix[2]),
    angleDegrees(matrix[0], matrix[1]),
  ];
  const isCubic = crystalSystem.toLowerCase() === "cubic";
  const equalLengths = Math.max(...lengths) - Math.min(...lengths) < 0.03;
  const nonOrthogonal = angles.some((angle) => Math.abs(angle - 90) > 3);

  if (isCubic && equalLengths && nonOrthogonal) {
    const primitiveLength = lengths.reduce((sum, value) => sum + value, 0) / lengths.length;
    const averageAngle = angles.reduce((sum, value) => sum + value, 0) / angles.length;
    const centering = Math.abs(averageAngle - 60) < 8 ? "fcc" : Math.abs(averageAngle - 109.47) < 8 ? "bcc" : "primitive";
    const conventionalLength =
      centering === "fcc"
        ? primitiveLength * Math.sqrt(2)
        : centering === "bcc"
          ? (primitiveLength * 2) / Math.sqrt(3)
          : primitiveLength;

    const rounded = Math.round(conventionalLength * 1000) / 1000;
    return {
      kind: "conventional-cubic",
      centering,
      matrix: [
        [rounded, 0, 0],
        [0, rounded, 0],
        [0, 0, rounded],
      ],
    };
  }

  return {
    kind: "api-structure",
    centering: "primitive",
    matrix,
  };
}
