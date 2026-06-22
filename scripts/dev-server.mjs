import http from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createServer as createViteServer } from "vite";
import {
  buildMaterialsSummarySearchUrl,
  extractMaterialsProjectData,
  resolveMaterialsProjectApiKey,
} from "../src/mp-api-client.js";
import { MATERIALS_PROJECT_FIELDS } from "../src/materials-data.js";
import { standardizeMaterialsWithPymatgen } from "./standardize-materials.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");
const host = "127.0.0.1";
const port = Number(process.env.PORT ?? 5173);
const ctPort = Number(process.env.CT_VIEWER_PORT ?? 8050);
const runtimeMaterialsPath = join(projectRoot, "public", "data", "runtime-materials-summary.json");

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

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

async function writeRuntimeMaterials(payload) {
  await mkdir(dirname(runtimeMaterialsPath), { recursive: true });
  await writeFile(runtimeMaterialsPath, JSON.stringify(payload, null, 2), "utf8");
}

function startCrystalToolkitViewer() {
  const matplotlibCache = join(projectRoot, ".cache", "matplotlib");
  const child = spawn(
    "python",
    [join(projectRoot, "scripts", "ct-viewer-server.py"), "--host", host, "--port", String(ctPort)],
    {
      cwd: projectRoot,
      env: {
        ...process.env,
        CT_VIEWER_PORT: String(ctPort),
        MPLCONFIGDIR: matplotlibCache,
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  child.stdout.on("data", (chunk) => process.stdout.write(`[ct-viewer] ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[ct-viewer] ${chunk}`));
  child.on("exit", (code) => {
    if (code !== 0 && code !== null) {
      console.error(`[ct-viewer] exited with code ${code}`);
    }
  });

  const stop = () => {
    if (!child.killed) {
      child.kill();
    }
  };
  process.on("exit", stop);
  process.on("SIGINT", () => {
    stop();
    process.exit(130);
  });
  process.on("SIGTERM", () => {
    stop();
    process.exit(143);
  });
}

startCrystalToolkitViewer();

const vite = await createViteServer({
  root: projectRoot,
  server: { middlewareMode: true, host, port },
  appType: "spa",
});

const server = http.createServer(async (req, res) => {
  if (req.url?.startsWith("/ct-viewer/")) {
    const materialId = decodeURIComponent(req.url.slice("/ct-viewer/".length).split(/[?#]/)[0] || "mp-149");
    const target = `http://${host}:${ctPort}/viewer/${encodeURIComponent(materialId)}?material_id=${encodeURIComponent(materialId)}`;
    res.writeHead(302, { Location: target });
    res.end();
    return;
  }

  if (req.url?.startsWith("/api/materials/summary")) {
    try {
      const url = new URL(req.url, `http://${host}:${port}`);
      const elements = (url.searchParams.get("elements") ?? "")
        .split(",")
        .map((element) => element.trim())
        .filter(Boolean);

      if (elements.length < 2) {
        sendJson(res, 400, { error: "Select at least two elements." });
        return;
      }

      const apiKey = resolveMaterialsProjectApiKey({
        processEnv: process.env,
        envFiles: await readEnvFiles(),
      });
      if (!apiKey) {
        sendJson(res, 500, { error: "Missing MP_API_KEY in MP_API.env, .env, or process env." });
        return;
      }

      const apiUrl = buildMaterialsSummarySearchUrl({
        elements,
        fields: MATERIALS_PROJECT_FIELDS,
        limit: Number(url.searchParams.get("limit") ?? 24),
      });
      const response = await fetch(apiUrl, {
        headers: { "X-API-KEY": apiKey, Accept: "application/json" },
      });

      if (!response.ok) {
        sendJson(res, response.status, {
          error: `Materials Project request failed: ${response.status} ${response.statusText}`,
        });
        return;
      }

      const payload = await response.json();
      const materials = standardizeMaterialsWithPymatgen(extractMaterialsProjectData(payload));
      const responsePayload = {
        source: "Materials Project /materials/summary",
        structure_source: "Materials Project raw structure",
        viewer: "Crystal Toolkit StructureMoleculeComponent",
        query: { elements },
        materials,
      };
      await writeRuntimeMaterials({
        ...responsePayload,
        fetched_at: new Date().toISOString(),
      });
      sendJson(res, 200, {
        ...responsePayload,
      });
    } catch (error) {
      sendJson(res, 500, { error: error instanceof Error ? error.message : "Unknown server error." });
    }
    return;
  }

  vite.middlewares(req, res);
});

server.listen(port, host, () => {
  console.log(`Material Crystal Studio running at http://${host}:${port}/`);
});
