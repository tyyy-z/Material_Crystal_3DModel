import json
import sys

from pymatgen.core import Structure
from pymatgen.analysis.local_env import CrystalNN
from pymatgen.symmetry.analyzer import SpacegroupAnalyzer
from ct_scene_exporter import build_display_scene_with_crystal_toolkit


def rounded_tuple(values, digits=8):
    return [round(float(value), digits) for value in values]


def normalize_fraction(value):
    normalized = float(value) % 1
    if abs(normalized - 1) < 1e-8:
        return 0.0
    return normalized


def axis_display_values(value):
    normalized = normalize_fraction(value)
    values = [normalized]
    if abs(normalized) < 1e-6:
        values.append(1.0)
    return values


def display_fractional_positions(frac_coords):
    axes = [axis_display_values(value) for value in frac_coords]
    positions = []
    for a in axes[0]:
        for b in axes[1]:
            for c in axes[2]:
                positions.append([a, b, c])
    return positions


def build_cell_edges(lattice):
    matrix = lattice.matrix
    vertices = [
        [0, 0, 0],
        matrix[0],
        matrix[1],
        matrix[2],
        matrix[0] + matrix[1],
        matrix[0] + matrix[2],
        matrix[1] + matrix[2],
        matrix[0] + matrix[1] + matrix[2],
    ]
    pairs = [
        (0, 1),
        (0, 2),
        (0, 3),
        (1, 4),
        (1, 5),
        (2, 4),
        (2, 6),
        (3, 5),
        (3, 6),
        (4, 7),
        (5, 7),
        (6, 7),
    ]
    return [
        {
            "start": rounded_tuple(vertices[start]),
            "end": rounded_tuple(vertices[end]),
        }
        for start, end in pairs
    ]


def build_display_atoms(structure):
    atoms = []
    seen = set()
    for site_index, site in enumerate(structure):
        element = site.specie.symbol
        for image_index, frac in enumerate(display_fractional_positions(site.frac_coords)):
            cartesian = structure.lattice.get_cartesian_coords(frac)
            image = [round(float(frac[axis] - site.frac_coords[axis]), 8) for axis in range(3)]
            key = (site_index, tuple(round(value, 6) for value in image))
            if key in seen:
                continue
            seen.add(key)
            atoms.append(
                {
                    "id": f"{site_index}:{','.join(str(int(value)) if float(value).is_integer() else str(value) for value in image)}",
                    "siteIndex": site_index,
                    "element": element,
                    "label": site.label or element,
                    "abc": rounded_tuple(frac),
                    "image": rounded_tuple(image),
                    "cartesian": rounded_tuple(cartesian),
                    "isBoundaryImage": image_index > 0,
                    "isPeriodicNeighborImage": False,
                }
            )
    return atoms


def distance(a, b):
    return sum((a[index] - b[index]) ** 2 for index in range(3)) ** 0.5


def atom_id(site_index, image):
    return f"{site_index}:{','.join(str(int(value)) if float(value).is_integer() else str(value) for value in image)}"


def get_or_create_atom(structure, atoms, atom_lookup, site_index, image, is_neighbor_image=False):
    normalized_image = tuple(int(round(float(value))) for value in image)
    key = (site_index, normalized_image)
    if key in atom_lookup:
        atom = atom_lookup[key]
        if is_neighbor_image and any(value != 0 for value in normalized_image):
            atom["isPeriodicNeighborImage"] = True
        return atom

    site = structure[site_index]
    frac = [float(site.frac_coords[axis]) + normalized_image[axis] for axis in range(3)]
    cartesian = structure.lattice.get_cartesian_coords(frac)
    atom = {
        "id": atom_id(site_index, normalized_image),
        "siteIndex": site_index,
        "element": site.specie.symbol,
        "label": site.label or site.specie.symbol,
        "abc": rounded_tuple(frac),
        "image": rounded_tuple(normalized_image),
        "cartesian": rounded_tuple(cartesian),
        "isBoundaryImage": any(value != 0 for value in normalized_image),
        "isPeriodicNeighborImage": is_neighbor_image and any(value != 0 for value in normalized_image),
    }
    atom_lookup[key] = atom
    atoms.append(atom)
    return atom


def build_display_bonds(structure, atoms):
    atom_lookup = {
        (atom["siteIndex"], tuple(int(round(float(value))) for value in atom.get("image", [0, 0, 0]))): atom
        for atom in atoms
    }

    pairs = set()
    try:
        cnn = CrystalNN(distance_cutoffs=(0.5, 1.0), x_diff_weight=0)
        for site_index in range(len(structure)):
            start = get_or_create_atom(structure, atoms, atom_lookup, site_index, [0, 0, 0])
            for neighbor in cnn.get_nn_info(structure, site_index):
                other_index = int(neighbor["site_index"])
                if site_index == other_index:
                    continue
                end = get_or_create_atom(
                    structure,
                    atoms,
                    atom_lookup,
                    other_index,
                    neighbor.get("image", [0, 0, 0]),
                    is_neighbor_image=True,
                )
                bond_length = distance(start["cartesian"], end["cartesian"])
                if 0.25 < bond_length < 4.2:
                    pair_key = tuple(sorted([start["id"], end["id"]]))
                    pairs.add((pair_key[0], pair_key[1], round(bond_length, 6)))
    except Exception:
        return []

    bonds = []
    for index, (start_id, end_id, bond_length) in enumerate(sorted(pairs)):
        bonds.append(
            {
                "id": f"bond:{index}",
                "atomIds": [start_id, end_id],
                "length": bond_length,
            }
        )
    return bonds[:240]


def build_display_scene(structure):
    atoms = build_display_atoms(structure)
    center = structure.lattice.get_cartesian_coords([0.5, 0.5, 0.5])
    return {
        "source": "pymatgen conventional standard structure",
        "latticeMatrix": [rounded_tuple(vector) for vector in structure.lattice.matrix],
        "center": rounded_tuple(center),
        "atoms": atoms,
        "cellEdges": build_cell_edges(structure.lattice),
        "bonds": build_display_bonds(structure, atoms),
    }


def raw_structure_matches_conventional_shape(structure, crystal_system):
    lattice = structure.lattice
    angles = [float(lattice.alpha), float(lattice.beta), float(lattice.gamma)]
    lengths = [float(lattice.a), float(lattice.b), float(lattice.c)]
    system = (crystal_system or "").lower()

    def close(value, target, tolerance=1e-2):
        return abs(value - target) <= tolerance

    if system == "hexagonal":
        return close(angles[0], 90) and close(angles[1], 90) and close(angles[2], 120)
    if system in {"orthorhombic", "tetragonal", "cubic"}:
        if not all(close(angle, 90) for angle in angles):
            return False
        if system == "cubic":
            return max(lengths) - min(lengths) < 1e-2
        if system == "tetragonal":
            return abs(lengths[0] - lengths[1]) < 1e-2
        return True
    return True


def standardize_material(material):
    structure_data = material.get("structure")
    if not structure_data:
        return material

    structure = Structure.from_dict(structure_data)
    symmetry = material.get("symmetry") or {}
    symprec = symmetry.get("symprec", 0.1)
    angle_tolerance = symmetry.get("angle_tolerance", 5)
    analyzer = SpacegroupAnalyzer(
        structure,
        symprec=symprec,
        angle_tolerance=angle_tolerance,
    )
    conventional = analyzer.get_conventional_standard_structure()
    crystal_system = symmetry.get("crystal_system", "")
    if raw_structure_matches_conventional_shape(structure, crystal_system):
        display_structure = structure
        display_basis = "mp-api-structure"
    else:
        display_structure = conventional
        display_basis = "pymatgen-conventional-standard"

    result = dict(material)
    result["structure"] = structure.as_dict()
    result["conventional_structure"] = conventional.as_dict()
    result["display_structure"] = {
        "source": display_basis,
        "standardizer": "pymatgen.SpacegroupAnalyzer.get_conventional_standard_structure",
        "symprec": symprec,
        "angle_tolerance": angle_tolerance,
    }
    result["display_scene"] = build_display_scene_with_crystal_toolkit(structure)
    return result


def main():
    payload = json.load(sys.stdin)
    if isinstance(payload, list):
        json.dump([standardize_material(material) for material in payload], sys.stdout)
        return

    materials = payload.get("materials")
    if isinstance(materials, list):
        payload = dict(payload)
        payload["materials"] = [standardize_material(material) for material in materials]
        json.dump(payload, sys.stdout)
        return

    json.dump(standardize_material(payload), sys.stdout)


if __name__ == "__main__":
    main()
