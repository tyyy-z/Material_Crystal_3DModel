import { MATERIALS_PROJECT_FIELDS } from "./materials-data.js";

export const MATERIALS_PROJECT_API_BASE = "https://api.materialsproject.org";

export function parseEnvFile(text) {
  const result = {};

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const equalsIndex = line.indexOf("=");
    if (equalsIndex === -1) {
      continue;
    }

    const key = line.slice(0, equalsIndex).trim();
    let value = line.slice(equalsIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }

  return result;
}

export function resolveMaterialsProjectApiKey({ processEnv = {}, envFiles = [] } = {}) {
  const orderedNames = ["MP_API.env", ".env"];
  for (const fileName of orderedNames) {
    const envFile = envFiles.find((file) => file.name === fileName);
    if (!envFile) {
      continue;
    }
    const parsed = parseEnvFile(envFile.text);
    if (parsed.MP_API_KEY) {
      return parsed.MP_API_KEY;
    }
  }

  return processEnv.MP_API_KEY ?? "";
}

export function buildMaterialsSummaryUrl({
  materialIds,
  fields = MATERIALS_PROJECT_FIELDS,
  baseUrl = MATERIALS_PROJECT_API_BASE,
}) {
  const url = new URL("/materials/summary/", baseUrl);
  url.searchParams.set("material_ids", materialIds.join(","));
  url.searchParams.set("_fields", fields.join(","));
  url.searchParams.set("id_format", "legacy");
  return url;
}

export function buildMaterialsSummarySearchUrl({
  elements,
  fields = MATERIALS_PROJECT_FIELDS,
  limit = 24,
  baseUrl = MATERIALS_PROJECT_API_BASE,
}) {
  const url = new URL("/materials/summary/", baseUrl);
  const chemsys = [...new Set(elements)].sort().join("-");
  url.searchParams.set("chemsys", chemsys);
  url.searchParams.set("_fields", fields.join(","));
  url.searchParams.set("_limit", String(limit));
  url.searchParams.set("id_format", "legacy");
  return url;
}

export function extractMaterialsProjectData(payload) {
  if (Array.isArray(payload?.data)) {
    return payload.data;
  }
  if (Array.isArray(payload?.response?.data)) {
    return payload.response.data;
  }
  if (Array.isArray(payload)) {
    return payload;
  }
  return [];
}
