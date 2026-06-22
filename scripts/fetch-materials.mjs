import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  MATERIALS_PROJECT_API_BASE,
  buildMaterialsSummaryUrl,
  extractMaterialsProjectData,
  resolveMaterialsProjectApiKey,
} from "../src/mp-api-client.js";
import { MATERIALS_PROJECT_FIELDS } from "../src/materials-data.js";
import { standardizeMaterialsWithPymatgen } from "./standardize-materials.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");
const outputPath = join(projectRoot, "public", "data", "materials-summary.json");
const materialIds = ["mp-149", "mp-804", "mp-19017", "mp-5229"];

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

async function main() {
  const envFiles = await readEnvFiles();
  const apiKey = resolveMaterialsProjectApiKey({
    processEnv: process.env,
    envFiles,
  });

  if (!apiKey) {
    throw new Error("Missing MP_API_KEY. Add it to MP_API.env, .env, or your system environment.");
  }

  const url = buildMaterialsSummaryUrl({
    materialIds,
    fields: MATERIALS_PROJECT_FIELDS,
    baseUrl: MATERIALS_PROJECT_API_BASE,
  });

  const response = await fetch(url, {
    headers: {
      "X-API-KEY": apiKey,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Materials Project request failed: ${response.status} ${response.statusText}\n${body}`);
  }

  const payload = await response.json();
  const materials = standardizeMaterialsWithPymatgen(extractMaterialsProjectData(payload));
  if (!materials.length) {
    throw new Error("Materials Project response did not contain any material documents.");
  }

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(
    outputPath,
    `${JSON.stringify(
      {
        source: "Materials Project /materials/summary",
        structure_standardizer: "pymatgen.SpacegroupAnalyzer.get_conventional_standard_structure",
        fetched_at: new Date().toISOString(),
        material_ids: materialIds,
        fields: MATERIALS_PROJECT_FIELDS,
        materials,
      },
      null,
      2,
    )}\n`,
  );

  console.log(`Fetched ${materials.length} Materials Project records.`);
  console.log(`Wrote ${outputPath}.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
