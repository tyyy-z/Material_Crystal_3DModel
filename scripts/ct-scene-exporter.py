from __future__ import annotations

import argparse
import json
import sys

from ct_scene_exporter import export_material, export_material_by_id, material_to_structure


def write_json(payload) -> None:
    print(json.dumps(payload, separators=(",", ":")))


def run_check(material_id: str) -> None:
    material = export_material_by_id(material_id)
    structure = material_to_structure(material)
    scene = material["display_scene"]
    write_json(
        {
            "material_id": material_id,
            "formula": material.get("formula_pretty"),
            "scene_source": scene.get("source"),
            "structure_sites": len(structure.sites),
            "scene_atoms": len(scene.get("atoms", [])),
            "scene_bonds": len(scene.get("bonds", [])),
            "scene_cell_edges": len(scene.get("cellEdges", [])),
        }
    )


def run_export(material_id: str) -> None:
    write_json(export_material_by_id(material_id))


def run_stdin() -> None:
    payload = json.load(sys.stdin)
    if isinstance(payload, list):
        write_json([export_material(material) for material in payload])
        return
    if isinstance(payload, dict) and isinstance(payload.get("materials"), list):
        result = dict(payload)
        result["materials"] = [export_material(material) for material in payload["materials"]]
        write_json(result)
        return
    write_json(export_material(payload))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Export Crystal Toolkit scene geometry for local Three.js rendering.")
    parser.add_argument("--check", metavar="MATERIAL_ID")
    parser.add_argument("--export", metavar="MATERIAL_ID")
    parser.add_argument("--stdin", action="store_true")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.check:
        run_check(args.check)
        return
    if args.export:
        run_export(args.export)
        return
    if args.stdin:
        run_stdin()
        return
    raise SystemExit("Use --check MATERIAL_ID, --export MATERIAL_ID, or --stdin.")


if __name__ == "__main__":
    main()
