import test from "node:test";
import assert from "node:assert/strict";
import {
  buildMaterialsSummaryUrl,
  buildMaterialsSummarySearchUrl,
  parseEnvFile,
  resolveMaterialsProjectApiKey,
} from "../src/mp-api-client.js";

test("parseEnvFile reads MP_API_KEY without leaking unrelated lines", () => {
  const env = parseEnvFile(`
    # local Materials Project key
    MP_API_KEY="abc123"
    OTHER=value
  `);

  assert.equal(env.MP_API_KEY, "abc123");
  assert.equal(env.OTHER, "value");
});

test("resolveMaterialsProjectApiKey prefers MP_API.env over .env and process env", () => {
  const key = resolveMaterialsProjectApiKey({
    processEnv: { MP_API_KEY: "from-process" },
    envFiles: [
      { name: ".env", text: "MP_API_KEY=from-dot-env" },
      { name: "MP_API.env", text: "MP_API_KEY=from-mp-env" },
    ],
  });

  assert.equal(key, "from-mp-env");
});

test("buildMaterialsSummaryUrl requests summary fields for selected material IDs", () => {
  const url = buildMaterialsSummaryUrl({
    materialIds: ["mp-149", "mp-804"],
    fields: ["material_id", "formula_pretty", "structure"],
  });

  assert.equal(url.origin, "https://api.materialsproject.org");
  assert.equal(url.pathname, "/materials/summary/");
  assert.equal(url.searchParams.get("material_ids"), "mp-149,mp-804");
  assert.equal(url.searchParams.get("_fields"), "material_id,formula_pretty,structure");
  assert.equal(url.searchParams.get("id_format"), "legacy");
});

test("buildMaterialsSummarySearchUrl requests a multi-element chemical system", () => {
  const url = buildMaterialsSummarySearchUrl({
    elements: ["Si", "O"],
    fields: ["material_id", "formula_pretty", "structure"],
    limit: 24,
  });

  assert.equal(url.pathname, "/materials/summary/");
  assert.equal(url.searchParams.get("chemsys"), "O-Si");
  assert.equal(url.searchParams.get("_fields"), "material_id,formula_pretty,structure");
  assert.equal(url.searchParams.get("_limit"), "24");
  assert.equal(url.searchParams.get("id_format"), "legacy");
});

test("buildMaterialsSummarySearchUrl supports a single selected element", () => {
  const url = buildMaterialsSummarySearchUrl({
    elements: ["Si"],
    fields: ["material_id", "formula_pretty", "structure"],
    limit: 24,
  });

  assert.equal(url.pathname, "/materials/summary/");
  assert.equal(url.searchParams.get("chemsys"), "Si");
  assert.equal(url.searchParams.get("_fields"), "material_id,formula_pretty,structure");
  assert.equal(url.searchParams.get("_limit"), "24");
});
