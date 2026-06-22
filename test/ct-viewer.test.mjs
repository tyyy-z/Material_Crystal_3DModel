import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const root = new URL("..", import.meta.url);

test("ct-viewer-server check loads mp-804 through Crystal Toolkit viewer", () => {
  const output = execFileSync(
    "python",
    ["scripts/ct-viewer-server.py", "--check", "mp-804"],
    { cwd: root, encoding: "utf8" },
  );
  const payload = JSON.parse(output);

  assert.equal(payload.material_id, "mp-804");
  assert.equal(payload.formula, "GaN");
  assert.equal(payload.viewer, "Crystal Toolkit");
  assert.equal(payload.component, "StructureMoleculeComponent");
  assert.equal(payload.structure_sites, 4);
});

test("ct-viewer-server preserves material id across Dash layout requests", () => {
  const output = execFileSync(
    "python",
    [
      "scripts/ct-viewer-server.py",
      "--check-route",
      "--path",
      "/_dash-layout",
      "--referrer",
      "http://127.0.0.1:8050/viewer/mp-804?material_id=mp-804",
    ],
    { cwd: root, encoding: "utf8" },
  );
  const payload = JSON.parse(output);

  assert.equal(payload.material_id, "mp-804");
});

test("ct-viewer-server uses the studio black skin instead of a white Dash app shell", () => {
  const source = readFileSync(new URL("../scripts/ct-viewer-server.py", import.meta.url), "utf8");

  assert.match(source, /CT_INDEX_STRING/);
  assert.match(source, /transparentBackground/);
  assert.match(source, /background.*#07000f/);
  assert.match(source, /body,\s*\n\s*html,\s*\n\s*\.body/);
  assert.match(source, /background:\s*transparent !important/);
  assert.match(source, /\.mpc-scene-square-wrapper/);
  assert.match(source, /aspect-ratio:\s*1\s*\/\s*1/);
  assert.match(source, /width:\s*min\(100vw,\s*100vh\) !important/);
  assert.match(source, /height:\s*min\(100vw,\s*100vh\) !important/);
  assert.match(source, /\.mpc-button-bar/);
  assert.match(source, /\.mpc-button-bar \.button/);
  assert.match(source, /\.mpc-scene-bottom-panel/);
  assert.match(source, /#07000f/);
  assert.doesNotMatch(source, /#f6f8fc/);
});

test("React stage embeds the Crystal Toolkit viewer iframe", () => {
  const appSource = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");

  assert.match(appSource, /ct-viewer-frame/);
  assert.match(appSource, /\/ct-viewer\//);
  assert.doesNotMatch(appSource, /<CrystalScene/);
});
