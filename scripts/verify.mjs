import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const root = process.cwd();
const requiredFiles = [
  "index.html",
  "src/App.tsx",
  "src/components/CrystalScene.tsx",
  "src/data/elements.ts",
  "src/materials-data.js",
  "src/mp-api-client.js",
  "scripts/ct-viewer-server.py",
  "scripts/ct-scene-exporter.py",
  "scripts/ct_scene_exporter.py",
  "public/data/materials-summary.json",
];

for (const file of requiredFiles) {
  const path = join(root, file);
  if (!existsSync(path)) {
    throw new Error(`Missing required file: ${file}`);
  }
}

const payload = JSON.parse(await readFile(join(root, "public/data/materials-summary.json"), "utf8"));
const ids = payload.materials?.map((material) => material.material_id) ?? [];
for (const id of ["mp-149", "mp-804", "mp-19017", "mp-5229"]) {
  if (!ids.includes(id)) {
    throw new Error(`Cached Materials Project dataset is missing ${id}`);
  }
}

const srTiO3 = payload.materials.find((material) => material.material_id === "mp-5229");
const gan = payload.materials.find((material) => material.material_id === "mp-804");
const lattice = srTiO3?.structure?.lattice;
const sites = srTiO3?.structure?.sites ?? [];
if (!lattice || Math.abs(lattice.a - lattice.b) > 0.0001 || Math.abs(lattice.b - lattice.c) > 0.0001) {
  throw new Error("mp-5229 verification failed: expected cubic lattice with equal a/b/c.");
}
if ([lattice.alpha, lattice.beta, lattice.gamma].some((angle) => Math.abs(angle - 90) > 0.0001)) {
  throw new Error("mp-5229 verification failed: expected 90 degree cubic lattice angles.");
}

const siteKeys = sites
  .map((site) => `${site.species?.[0]?.element}:${site.abc?.map((value) => Number(value).toFixed(3)).join(",")}`)
  .sort();
const expectedSrTiO3Sites = [
  "O:0.000,0.500,0.500",
  "O:0.500,0.000,0.500",
  "O:0.500,0.500,0.000",
  "Sr:0.000,0.000,0.000",
  "Ti:0.500,0.500,0.500",
];
if (JSON.stringify(siteKeys) !== JSON.stringify(expectedSrTiO3Sites)) {
  throw new Error("mp-5229 verification failed: expected SrTiO3 cubic perovskite fractional sites.");
}

if (!gan?.structure?.lattice || gan.structure.sites?.length !== 4) {
  throw new Error("mp-804 verification failed: expected raw GaN MP structure with 4 sites.");
}

const ctCheck = JSON.parse(execFileSync("python", ["scripts/ct-viewer-server.py", "--check", "mp-804"], {
  cwd: root,
  encoding: "utf8",
}));

if (ctCheck.viewer !== "Crystal Toolkit" || ctCheck.component !== "StructureMoleculeComponent") {
  throw new Error("Crystal Toolkit verification failed: viewer component did not initialize.");
}

console.log("Static verification passed.");
console.log(`Cached materials: ${ids.join(", ")}`);
console.log(`CT viewer check: ${ctCheck.material_id} / ${ctCheck.formula} / ${ctCheck.structure_sites} sites`);
