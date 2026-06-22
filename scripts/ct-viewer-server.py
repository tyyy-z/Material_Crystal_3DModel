from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlparse


PROJECT_ROOT = Path(__file__).resolve().parents[1]
MPL_CACHE = PROJECT_ROOT / ".cache" / "matplotlib"
MPL_CACHE.mkdir(parents=True, exist_ok=True)
os.environ.setdefault("MPLCONFIGDIR", str(MPL_CACHE))

import dash
from dash import html
from flask import request
from pymatgen.core import Structure

import crystal_toolkit.components as ctc
from crystal_toolkit.settings import SETTINGS


CACHE_PATHS = [
    PROJECT_ROOT / "public" / "data" / "runtime-materials-summary.json",
    PROJECT_ROOT / "public" / "data" / "materials-summary.json",
]
DEFAULT_MATERIAL_ID = "mp-149"
COMPONENT_ID = "ct-structure"
CT_INDEX_STRING = """
<!DOCTYPE html>
<html>
  <head>
    {%metas%}
    <title>{%title%}</title>
    {%favicon%}
    {%css%}
    <style>
      :root {
        color-scheme: dark;
        --void: #07000f;
        --panel-strong: rgba(10, 4, 26, 0.92);
        --ink: #f2f4ff;
        --muted: #9ea2c4;
        --cyan: #00ffff;
        --magenta: #ff00ff;
      }

      html,
      body {
        min-height: 100%;
        margin: 0;
        background: transparent !important;
        color: var(--ink);
        font-family: "Share Tech Mono", "Cascadia Code", monospace;
        overflow: hidden;
      }

      body,
      html,
      .body {
        background: transparent !important;
      }

      #react-entry-point,
      #_dash-app-content {
        min-height: 100vh;
        background: transparent !important;
      }

      .ct-shell {
        min-height: 100vh;
        padding: 0;
        background: transparent !important;
      }

      .ct-frame {
        position: relative;
        height: 100vh;
        overflow: hidden;
        border: 0;
        background: transparent;
      }

      .ct-header {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip: rect(0 0 0 0);
        white-space: nowrap;
      }

      .ct-stage {
        position: absolute;
        inset: 0;
        height: 100vh;
        padding: 0;
        background: transparent;
      }

      .ct-stage > div,
      .ct-stage .box {
        width: 100% !important;
        height: 100% !important;
        max-width: none !important;
        max-height: none !important;
        position: relative !important;
        border: 0 !important;
        padding: 0 !important;
        background: transparent !important;
        box-shadow: none !important;
      }

      .ct-stage > div > div,
      .ct-stage .mpc-expandable.box {
        position: absolute !important;
        inset: 0 !important;
        width: 100% !important;
        height: 100% !important;
        min-height: 100% !important;
        padding: 0 !important;
        margin: 0 !important;
        background: transparent !important;
      }

      .ct-stage canvas,
      .ct-stage [class*="scene"],
      .ct-stage [class*="Scene"],
      .ct-stage [class*="viewer"],
      .ct-stage [class*="Viewer"] {
        background: transparent !important;
      }

      .mpc-scene {
        width: 100% !important;
        height: 100% !important;
        max-width: none !important;
        max-height: none !important;
      }

      .mpc-scene {
        position: absolute !important;
        inset: 0 !important;
        overflow: hidden !important;
      }

      .mpc-scene-square-wrapper,
      .mpc-scene-square {
        position: absolute !important;
        top: 50% !important;
        left: 50% !important;
        width: min(100vw, 100vh) !important;
        height: min(100vw, 100vh) !important;
        max-width: 100% !important;
        max-height: 100% !important;
        aspect-ratio: 1 / 1 !important;
        transform: translate(-50%, -50%) !important;
      }

      .mpc-scene canvas {
        width: 100% !important;
        height: 100% !important;
      }

      .mpc-button-bar {
        position: absolute !important;
        top: 14px !important;
        right: 14px !important;
        z-index: 8 !important;
        display: flex !important;
        flex-direction: column !important;
        width: 44px !important;
        height: 220px !important;
      }

      .mpc-button-bar > *,
      .mpc-button-bar > div,
      .mpc-button-bar .dropdown,
      .mpc-button-bar .dropdown-trigger {
        width: 44px !important;
        height: 44px !important;
        flex: 0 0 44px !important;
        margin: 0 !important;
      }

      .mpc-button-bar .button,
      .mpc-scene button.button {
        position: static !important;
        right: auto !important;
        left: auto !important;
        z-index: 8 !important;
        width: 44px !important;
        height: 44px !important;
        min-width: 44px !important;
        border: 1px solid rgba(0, 255, 255, 0.42) !important;
        background: rgba(7, 0, 15, 0.82) !important;
        color: var(--cyan) !important;
        box-shadow: 0 0 18px rgba(0, 255, 255, 0.16) !important;
      }

      .mpc-button-bar svg,
      .mpc-button-bar .icon {
        color: var(--cyan) !important;
        fill: currentColor !important;
      }

      .mpc-scene-bottom-panel {
        position: absolute !important;
        right: 14px !important;
        bottom: 14px !important;
        left: auto !important;
        z-index: 8 !important;
      }

      .mpc-scene-bottom-panel .button,
      .mpc-scene-bottom-panel .is-static {
        border: 1px solid rgba(0, 255, 255, 0.42) !important;
        background: rgba(7, 0, 15, 0.82) !important;
        color: var(--cyan) !important;
        box-shadow: 0 0 18px rgba(0, 255, 255, 0.16) !important;
      }

      .mpc-scene-bottom-panel *,
      .mpc-scene-bottom-panel .button *,
      .mpc-scene-bottom-panel .is-static * {
        color: var(--cyan) !important;
        text-shadow: 0 0 10px rgba(0, 255, 255, 0.38) !important;
      }

      .ct-error {
        height: 100%;
        display: grid;
        place-items: center;
        padding: 28px;
        border: 1px solid rgba(255, 153, 0, 0.38);
        background: rgba(0, 0, 0, 0.42);
        color: #ffd89a;
      }
    </style>
  </head>
  <body>
    {%app_entry%}
    <footer>
      {%config%}
      {%scripts%}
      {%renderer%}
    </footer>
  </body>
</html>
"""


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


def build_structure_component(material: dict[str, Any]) -> ctc.StructureMoleculeComponent:
    structure = material_to_structure(material)
    return ctc.StructureMoleculeComponent(
        structure,
        id=COMPONENT_ID,
        bonding_strategy="CrystalNN",
        color_scheme="VESTA",
        radius_strategy="uniform",
        unit_cell_choice="input",
        draw_image_atoms=True,
        hide_incomplete_bonds=True,
        show_compass=True,
        scene_settings={
            "transparentBackground": True,
            "background": "#07000f",
            "extractAxis": True,
            "renderer": "webgl",
            "secondaryObjectView": False,
        },
        show_legend=True,
        show_settings=True,
        show_controls=True,
    )


def resolve_material_id(
    path: str = "/",
    query_string: str = "",
    referrer: str | None = None,
    cookie_material_id: str | None = None,
) -> str:
    query = parse_qs(query_string.lstrip("?"))
    material_id = query.get("material_id", [None])[0]
    if material_id:
        return material_id

    path = path.strip("/")
    if path.startswith("viewer/"):
        return path.split("/", 1)[1] or DEFAULT_MATERIAL_ID

    if referrer:
        parsed = urlparse(referrer)
        referrer_id = resolve_material_id(parsed.path, parsed.query, None, None)
        if referrer_id != DEFAULT_MATERIAL_ID:
            return referrer_id

    if cookie_material_id:
        return cookie_material_id

    return DEFAULT_MATERIAL_ID


def resolve_request_material_id() -> str:
    query_string = request.query_string.decode("utf8", errors="ignore")
    return resolve_material_id(
        path=request.path,
        query_string=query_string,
        referrer=request.referrer,
        cookie_material_id=request.cookies.get("ct_material_id"),
    )


def make_layout() -> html.Div:
    material_id = DEFAULT_MATERIAL_ID
    try:
        if request:
            material_id = resolve_request_material_id()
    except RuntimeError:
        pass

    try:
        material = find_material(material_id)
        component = build_structure_component(material)
        formula = material.get("formula_pretty", material_id)
        structure = material_to_structure(material)
        viewer = component.layout(size="100vh")
        status = f"{formula} / {material_id} / raw MP Structure / {len(structure.sites)} sites"
    except Exception as exc:
        viewer = html.Div(
            [
                html.H2("Crystal Toolkit viewer unavailable"),
                html.P(str(exc)),
                html.P("Run the MP search again so the raw structure is written to the runtime cache."),
            ],
            className="ct-error",
        )
        status = f"{material_id} / load error"

    return html.Div(
        [
            html.Div(
                [
                    html.Div(
                        [
                            html.Strong("MP / Crystal Toolkit viewer"),
                            html.Span(status),
                        ],
                        className="ct-header",
                    ),
                    html.Div(viewer, className="ct-stage"),
                ],
                className="ct-frame",
            ),
        ],
        className="ct-shell",
    )


def run_check(material_id: str) -> None:
    material = find_material(material_id)
    structure = material_to_structure(material)
    component = build_structure_component(material)
    payload = {
        "material_id": material_id,
        "formula": material.get("formula_pretty"),
        "viewer": "Crystal Toolkit",
        "component": component.__class__.__name__,
        "structure_sites": len(structure.sites),
        "source": "Materials Project raw structure",
    }
    print(json.dumps(payload, separators=(",", ":")))


def run_check_route(path: str, query_string: str, referrer: str | None, cookie_material_id: str | None) -> None:
    payload = {
        "material_id": resolve_material_id(path, query_string, referrer, cookie_material_id),
        "path": path,
        "query_string": query_string,
        "referrer": referrer,
        "cookie_material_id": cookie_material_id,
    }
    print(json.dumps(payload, separators=(",", ":")))


def create_app() -> dash.Dash:
    app = dash.Dash(
        __name__,
        assets_folder=SETTINGS.ASSETS_PATH,
        suppress_callback_exceptions=True,
        title="Material Crystal Studio CT Viewer",
    )
    app.index_string = CT_INDEX_STRING
    app.layout = make_layout
    ctc.register_crystal_toolkit(app=app, layout=make_layout())
    app.layout = make_layout

    @app.server.after_request
    def remember_material_id(response):
        try:
            material_id = resolve_request_material_id()
            if material_id != DEFAULT_MATERIAL_ID or request.path.strip("/").startswith("viewer/"):
                response.set_cookie("ct_material_id", material_id, samesite="Lax")
        except Exception:
            pass
        return response

    return app


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Local Crystal Toolkit viewer for MP raw structures.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=int(os.environ.get("CT_VIEWER_PORT", "8050")))
    parser.add_argument("--check", metavar="MATERIAL_ID")
    parser.add_argument("--check-route", action="store_true")
    parser.add_argument("--path", default="/")
    parser.add_argument("--query-string", default="")
    parser.add_argument("--referrer")
    parser.add_argument("--cookie-material-id")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.check:
        run_check(args.check)
        return
    if args.check_route:
        run_check_route(args.path, args.query_string, args.referrer, args.cookie_material_id)
        return

    app = create_app()
    app.run(host=args.host, port=args.port, debug=False)


if __name__ == "__main__":
    main()
