from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[1]
MPL_CACHE = PROJECT_ROOT / ".cache" / "matplotlib"
MPL_CACHE.mkdir(parents=True, exist_ok=True)
os.environ.setdefault("MPLCONFIGDIR", str(MPL_CACHE))

from crystal_toolkit.components.structure import StructureMoleculeComponent
from pymatgen.core import Structure


CACHE_PATHS = [
    PROJECT_ROOT / "public" / "data" / "runtime-materials-summary.json",
    PROJECT_ROOT / "public" / "data" / "materials-summary.json",
]
ELEMENT_RE = re.compile(r"^([A-Z][a-z]?)\b")
INDEX_RE = re.compile(r"index:(\d+)")


def read_materials() -> list[dict[str, Any]]:
    materials: list[dict[str, Any]] = []
    seen: set[str] = set()
    for path in CACHE_PATHS:
        if not path.exists():
            continue
        payload = json.loads(path.read_text(encoding="utf-8-sig"))
        for material in payload.get("materials", []):
            material_id = material.get("material_id")
            if not material_id or material_id in seen:
                continue
            seen.add(material_id)
            materials.append(material)
    return materials


def find_material(material_id: str) -> dict[str, Any]:
    for material in read_materials():
        if material.get("material_id") == material_id:
            return material
    raise ValueError(f"{material_id} was not found in local Materials Project cache.")


def material_to_structure(material: dict[str, Any]) -> Structure:
    structure_data = material.get("structure")
    if not structure_data:
        material_id = material.get("material_id", "unknown")
        raise ValueError(f"{material_id} is missing raw MP structure data.")
    return Structure.from_dict(structure_data)


def round_tuple(values: list[float] | tuple[float, ...]) -> list[float]:
    return [round(float(value), 8) for value in values]


def walk_scene_nodes(node: dict[str, Any]):
    yield node
    for child in node.get("contents", []) or []:
        if isinstance(child, dict):
            yield from walk_scene_nodes(child)


def scene_group(scene: dict[str, Any], name: str) -> dict[str, Any] | None:
    for node in walk_scene_nodes(scene):
        if node.get("name") == name:
            return node
    return None


def parse_atom_tooltip(tooltip: str, fallback_index: int) -> tuple[str, int]:
    element_match = ELEMENT_RE.search(tooltip or "")
    index_match = INDEX_RE.search(tooltip or "")
    element = element_match.group(1) if element_match else "X"
    site_index = int(index_match.group(1)) if index_match else fallback_index
    return element, site_index


def extract_atoms(scene: dict[str, Any], structure: Structure) -> list[dict[str, Any]]:
    group = scene_group(scene, "atoms")
    atoms: list[dict[str, Any]] = []
    if not group:
        return atoms

    seen: set[tuple[str, tuple[float, float, float]]] = set()
    for primitive in group.get("contents", []) or []:
        if primitive.get("type") != "spheres":
            continue
        tooltip = primitive.get("tooltip", "")
        for position in primitive.get("positions", []) or []:
            element, site_index = parse_atom_tooltip(tooltip, len(atoms))
            cartesian = round_tuple(position)
            key = (element, tuple(cartesian))
            if key in seen:
                continue
            seen.add(key)
            frac = structure.lattice.get_fractional_coords(cartesian)
            atoms.append(
                {
                    "id": f"ct-site-{site_index}:image-{len(atoms)}",
                    "element": element,
                    "label": element,
                    "siteIndex": site_index,
                    "abc": round_tuple(frac),
                    "cartesian": cartesian,
                    "color": primitive.get("color"),
                    "radius": primitive.get("radius"),
                    "isBoundaryImage": site_index >= len(structure.sites),
                }
            )
    return atoms


def extract_bonds(scene: dict[str, Any]) -> list[dict[str, Any]]:
    group = scene_group(scene, "bonds")
    bonds: list[dict[str, Any]] = []
    if not group:
        return bonds

    for primitive in group.get("contents", []) or []:
        if primitive.get("type") != "cylinders":
            continue
        for pair in primitive.get("positionPairs", []) or []:
            if len(pair) != 2:
                continue
            start = round_tuple(pair[0])
            end = round_tuple(pair[1])
            bonds.append(
                {
                    "id": f"ct-bond-{len(bonds)}",
                    "start": start,
                    "end": end,
                    "length": round(
                        sum((start[axis] - end[axis]) ** 2 for axis in range(3)) ** 0.5,
                        8,
                    ),
                    "color": primitive.get("color"),
                    "radius": primitive.get("radius"),
                }
            )
    return bonds


def extract_cell_edges(scene: dict[str, Any]) -> list[dict[str, Any]]:
    group = scene_group(scene, "unit_cell")
    edges: list[dict[str, Any]] = []
    if not group:
        return edges

    for primitive in walk_scene_nodes(group):
        if primitive.get("type") != "lines":
            continue
        positions = primitive.get("positions", []) or []
        for index in range(0, len(positions), 2):
            if index + 1 >= len(positions):
                continue
            edges.append(
                {
                    "start": round_tuple(positions[index]),
                    "end": round_tuple(positions[index + 1]),
                }
            )
    return edges


def build_display_scene_with_crystal_toolkit(structure: Structure) -> dict[str, Any]:
    component = StructureMoleculeComponent(
        structure,
        id="ct-scene-export",
        bonding_strategy="CrystalNN",
        color_scheme="VESTA",
        radius_strategy="uniform",
        unit_cell_choice="input",
        draw_image_atoms=True,
        bonded_sites_outside_unit_cell=False,
        hide_incomplete_bonds=True,
        show_compass=True,
    )
    graph = component._preprocess_input_to_graph(structure, bonding_strategy="CrystalNN")
    scene, legend = component.get_scene_and_legend(
        graph,
        color_scheme="VESTA",
        radius_strategy="uniform",
        draw_image_atoms=True,
        bonded_sites_outside_unit_cell=False,
        hide_incomplete_bonds=True,
        show_compass=True,
    )
    return {
        "source": "crystal-toolkit",
        "component": "StructureMoleculeComponent.get_scene_and_legend",
        "bonding_strategy": "CrystalNN",
        "color_scheme": "VESTA",
        "unit_cell_choice": "input",
        "center": round_tuple(structure.lattice.get_cartesian_coords([0.5, 0.5, 0.5])),
        "latticeMatrix": [round_tuple(vector) for vector in structure.lattice.matrix],
        "atoms": extract_atoms(scene, structure),
        "bonds": extract_bonds(scene),
        "cellEdges": extract_cell_edges(scene),
        "legend": legend,
    }


def export_material(material: dict[str, Any]) -> dict[str, Any]:
    structure = material_to_structure(material)
    result = dict(material)
    result["structure"] = structure.as_dict()
    result["display_scene"] = build_display_scene_with_crystal_toolkit(structure)
    return result


def export_material_by_id(material_id: str) -> dict[str, Any]:
    return export_material(find_material(material_id))
