import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildMaterialsSummarySearchUrl,
  extractMaterialsProjectData,
  resolveMaterialsProjectApiKey,
} from "../src/mp-api-client.js";
import { MATERIALS_PROJECT_FIELDS } from "../src/materials-data.js";
import { standardizeMaterialsWithPymatgen } from "./standardize-materials.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");
const elements = process.argv.slice(2);

async function readEnvFiles() {
  const envFiles = [];
  for (const name of ["MP_API.env", ".env"]) {
    const path = join(projectRoot, name);
    if (existsSync(path)) {
      envFiles.push({ name, text: await readFile(path, "utf8") });
    }
  }
  return envFiles;
}

if (elements.length < 2) {
  throw new Error("Usage: node scripts/inspect-chemsys.mjs Be Au");
}

const apiKey = resolveMaterialsProjectApiKey({
  processEnv: process.env,
  envFiles: await readEnvFiles(),
});
if (!apiKey) {
  throw new Error("Missing MP_API_KEY.");
}

const url = buildMaterialsSummarySearchUrl({
  elements,
  fields: MATERIALS_PROJECT_FIELDS,
  limit: 12,
});
const response = await fetch(url, {
  headers: { "X-API-KEY": apiKey, Accept: "application/json" },
});
if (!response.ok) {
  throw new Error(`Materials Project request failed: ${response.status} ${response.statusText}`);
}

const materials = standardizeMaterialsWithPymatgen(extractMaterialsProjectData(await response.json()));
for (const material of materials) {
  const lattice = material.structure?.lattice;
  console.log(JSON.stringify({
    material_id: material.material_id,
    formula: material.formula_pretty,
    space_group: material.symmetry?.symbol,
    crystal_system: material.symmetry?.crystal_system,
    lattice: lattice && {
      a: lattice.a,
      b: lattice.b,
      c: lattice.c,
      alpha: lattice.alpha,
      beta: lattice.beta,
      gamma: lattice.gamma,
    },
    site_count: material.structure?.sites?.length ?? 0,
    first_sites: material.structure?.sites?.slice(0, 8).map((site) => ({
      element: site.species?.[0]?.element,
      abc: site.abc,
    })),
  }, null, 2));
}
