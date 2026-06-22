export const elementVisuals = {
  H: { color: "#f7fbff", radius: 0.22, covalentRadius: 0.31 },
  Be: { color: "#c8ff3d", radius: 0.3, covalentRadius: 0.96 },
  Li: { color: "#7cffb1", radius: 0.34, covalentRadius: 1.28 },
  C: { color: "#b7c0c7", radius: 0.28, covalentRadius: 0.76 },
  N: { color: "#5aa7ff", radius: 0.27, covalentRadius: 0.71 },
  O: { color: "#ff4e6a", radius: 0.26, covalentRadius: 0.66 },
  F: { color: "#80ff9f", radius: 0.25, covalentRadius: 0.57 },
  Na: { color: "#ab7cff", radius: 0.38, covalentRadius: 1.66 },
  Mg: { color: "#7cffd4", radius: 0.36, covalentRadius: 1.41 },
  Al: { color: "#b6c8d7", radius: 0.34, covalentRadius: 1.21 },
  Si: { color: "#00ffff", radius: 0.32, covalentRadius: 1.11 },
  P: { color: "#ff9a2e", radius: 0.3, covalentRadius: 1.07 },
  S: { color: "#ffd24a", radius: 0.3, covalentRadius: 1.05 },
  Ti: { color: "#8fb7ff", radius: 0.36, covalentRadius: 1.6 },
  Fe: { color: "#ff3864", radius: 0.36, covalentRadius: 1.52 },
  Ga: { color: "#ff8f3d", radius: 0.36, covalentRadius: 1.22 },
  Sr: { color: "#ff00ff", radius: 0.42, covalentRadius: 1.95 },
  Au: { color: "#ffd447", radius: 0.42, covalentRadius: 1.36 },
};

const defaultVisual = { color: "#00ffff", radius: 0.32, covalentRadius: 1.2 };

function add(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function sub(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function scale(v, factor) {
  return [v[0] * factor, v[1] * factor, v[2] * factor];
}

function length(v) {
  return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
}

function matrixVector(matrix, fractional) {
  const [a, b, c] = fractional;
  return [
    matrix[0][0] * a + matrix[1][0] * b + matrix[2][0] * c,
    matrix[0][1] * a + matrix[1][1] * b + matrix[2][1] * c,
    matrix[0][2] * a + matrix[1][2] * b + matrix[2][2] * c,
  ];
}

function formatKey(position) {
  return position.map((value) => value.toFixed(4)).join(":");
}

function getVisual(element) {
  return elementVisuals[element] ?? defaultVisual;
}

function buildOffsets(repetitions) {
  const offsets = [];
  for (let i = 0; i < repetitions; i += 1) {
    for (let j = 0; j < repetitions; j += 1) {
      for (let k = 0; k < repetitions; k += 1) {
        offsets.push([i, j, k]);
      }
    }
  }
  return offsets;
}

function isLowerBoundary(value) {
  return Math.abs(value) < 0.0001;
}

function isUpperBoundary(value) {
  return Math.abs(value - 1) < 0.0001;
}

function axisDisplayCoordinates(fractionalValue, repetitions, includeBoundaryImages) {
  const normalized = ((fractionalValue % 1) + 1) % 1;
  const coordinates = [];
  for (let i = 0; i < repetitions; i += 1) {
    coordinates.push(normalized + i);
  }

  if (includeBoundaryImages && isLowerBoundary(normalized)) {
    coordinates.push(repetitions);
  }
  if (includeBoundaryImages && isUpperBoundary(normalized)) {
    coordinates.push(0);
  }

  return [...new Set(coordinates.map((value) => Math.round(value * 1000000) / 1000000))];
}

function buildDisplayFractionalPositions(abc, repetitions, includeBoundaryImages) {
  const axes = abc.map((value) => axisDisplayCoordinates(value, repetitions, includeBoundaryImages));
  const positions = [];
  for (const a of axes[0]) {
    for (const b of axes[1]) {
      for (const c of axes[2]) {
        positions.push([a, b, c]);
      }
    }
  }
  return positions;
}

function buildCellEdges(matrix, repetitions, center, displayScale) {
  const a = scale(matrix[0], repetitions);
  const b = scale(matrix[1], repetitions);
  const c = scale(matrix[2], repetitions);
  const vertices = [
    [0, 0, 0],
    a,
    b,
    c,
    add(a, b),
    add(a, c),
    add(b, c),
    add(add(a, b), c),
  ];
  const edgePairs = [
    [0, 1],
    [0, 2],
    [0, 3],
    [1, 4],
    [1, 5],
    [2, 4],
    [2, 6],
    [3, 5],
    [3, 6],
    [4, 7],
    [5, 7],
    [6, 7],
  ];

  return edgePairs.map(([start, end]) => ({
    start: scale(sub(vertices[start], center), displayScale),
    end: scale(sub(vertices[end], center), displayScale),
  }));
}

function buildModelFromDisplayScene(material, options) {
  const scene = material.displayScene;
  const center = scene.center ?? [0, 0, 0];
  const rawAtoms = scene.atoms ?? [];
  const maxRadius = Math.max(...rawAtoms.map((atom) => length(sub(atom.cartesian, center))), 1);
  const displayScale = 3.1 / maxRadius;
  const atoms = rawAtoms.map((atom) => {
    const visual = getVisual(atom.element);
    return {
      id: atom.id,
      element: atom.element,
      label: atom.label ?? atom.element,
      abc: atom.abc,
      cartesian: atom.cartesian,
      color: atom.color ?? visual.color,
      radius: atom.radius ?? visual.radius,
      covalentRadius: visual.covalentRadius,
      position: scale(sub(atom.cartesian, center), displayScale),
      displayRadius: atom.radius ?? visual.radius,
      isBoundaryImage: atom.isBoundaryImage ?? false,
    };
  });
  const atomById = new Map(atoms.map((atom) => [atom.id, atom]));
  const bonds = (scene.bonds ?? [])
    .map((bond) => {
      if (Array.isArray(bond.start) && Array.isArray(bond.end)) {
        return {
          id: bond.id,
          atomIds: bond.atomIds ?? [],
          start: scale(sub(bond.start, center), displayScale),
          end: scale(sub(bond.end, center), displayScale),
          length: bond.length,
          color: bond.color,
        };
      }
      const start = atomById.get(bond.atomIds?.[0]);
      const end = atomById.get(bond.atomIds?.[1]);
      if (!start || !end) {
        return null;
      }
      return {
        id: bond.id,
        atomIds: bond.atomIds,
        start: start.position,
        end: end.position,
        length: bond.length,
      };
    })
    .filter(Boolean)
    .slice(0, options.maxBonds ?? 160);

  return {
    atoms,
    bonds,
    cellEdges: (scene.cellEdges ?? []).map((edge) => ({
      start: scale(sub(edge.start, center), displayScale),
      end: scale(sub(edge.end, center), displayScale),
    })),
    bounds: {
      center,
      radius: maxRadius,
      displayScale,
      repetitions: 1,
      source: scene.source,
    },
    defaultView: {
      direction: [0, 0, 1],
      up: [0, 1, 0],
      projection: "orthographic",
    },
  };
}

export function buildCrystalRenderModel(material, options = {}) {
  if (material.displayScene?.atoms?.length && material.displayScene?.cellEdges?.length) {
    return buildModelFromDisplayScene(material, options);
  }

  const baseAtoms = material.atoms ?? [];
  const matrix = material.lattice?.matrix ?? [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];
  const repetitions =
    options.repetitions ?? (material.lattice?.displayKind === "conventional-cubic" ? 1 : baseAtoms.length <= 4 ? 2 : 1);
  const includeBoundaryImages = options.includeBoundaryImages ?? repetitions === 1;
  const dedupe = new Set();

  const rawAtoms = [];
  for (const atom of baseAtoms) {
    const abc = atom.abc ?? [0, 0, 0];
    const fractionalPositions = includeBoundaryImages
      ? buildDisplayFractionalPositions(abc, repetitions, includeBoundaryImages)
      : buildOffsets(repetitions).map((offset) => add(abc, offset));

    for (const fractional of fractionalPositions) {
      const cartesian = matrixVector(matrix, fractional);
      const key = `${atom.element}:${formatKey(cartesian)}`;
      if (dedupe.has(key)) {
        continue;
      }
      dedupe.add(key);
      const visual = getVisual(atom.element);
      rawAtoms.push({
        id: `${atom.id}:${fractional.map((value) => value.toFixed(4)).join(",")}`,
        element: atom.element,
        label: atom.label ?? atom.element,
        abc: fractional,
        cartesian,
        color: visual.color,
        radius: visual.radius,
        covalentRadius: visual.covalentRadius,
      });
    }
  }

  const center = matrixVector(matrix, [repetitions / 2, repetitions / 2, repetitions / 2]);
  const maxRadius = Math.max(...rawAtoms.map((atom) => length(sub(atom.cartesian, center))), 1);
  const displayScale = 3.1 / maxRadius;
  const atoms = rawAtoms.map((atom) => ({
    ...atom,
    position: scale(sub(atom.cartesian, center), displayScale),
    displayRadius: atom.radius,
  }));

  const bonds = [];
  for (let i = 0; i < atoms.length; i += 1) {
    for (let j = i + 1; j < atoms.length; j += 1) {
      const rawDistance = length(sub(rawAtoms[i].cartesian, rawAtoms[j].cartesian));
      const threshold = (rawAtoms[i].covalentRadius + rawAtoms[j].covalentRadius) * 1.18;
      if (rawDistance > 0.25 && rawDistance <= threshold) {
        bonds.push({
          id: `${atoms[i].id}-${atoms[j].id}`,
          atomIds: [atoms[i].id, atoms[j].id],
          start: atoms[i].position,
          end: atoms[j].position,
          length: rawDistance,
        });
      }
    }
  }

  return {
    atoms,
    bonds: bonds.slice(0, options.maxBonds ?? 160),
    cellEdges: buildCellEdges(matrix, repetitions, center, displayScale),
    bounds: {
      center,
      radius: maxRadius,
      displayScale,
      repetitions,
    },
    defaultView: {
      direction: [0, 0, 1],
      up: [0, 1, 0],
      projection: "orthographic",
    },
  };
}
