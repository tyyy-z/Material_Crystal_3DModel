import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");
const host = "127.0.0.1";
const port = Number(process.env.SMOKE_PORT ?? 5183);
const ctPort = Number(process.env.SMOKE_CT_PORT ?? 8053);
const baseUrl = `http://${host}:${port}`;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForFetch(url, options = {}) {
  const started = Date.now();
  let lastError;
  while (Date.now() - started < 90000) {
    try {
      const response = await fetch(url, options);
      if (response.ok || response.status === 302) {
        return response;
      }
      lastError = new Error(`${url} returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await delay(1000);
  }
  throw lastError ?? new Error(`${url} did not respond`);
}

const child = spawn(process.execPath, [join(projectRoot, "scripts", "dev-server.mjs")], {
  cwd: projectRoot,
  env: {
    ...process.env,
    PORT: String(port),
    CT_VIEWER_PORT: String(ctPort),
  },
  stdio: ["ignore", "pipe", "pipe"],
});

let logs = "";
child.stdout.on("data", (chunk) => {
  logs += chunk.toString();
});
child.stderr.on("data", (chunk) => {
  logs += chunk.toString();
});

try {
  const appResponse = await waitForFetch(baseUrl);
  const appHtml = await appResponse.text();
  if (!appHtml.includes("root")) {
    throw new Error("Vite app did not return the React root HTML.");
  }

  const redirect = await waitForFetch(`${baseUrl}/ct-viewer/mp-804`, { redirect: "manual" });
  const location = redirect.headers.get("location");
  if (!location?.includes(`:${ctPort}/viewer/mp-804`)) {
    throw new Error(`CT redirect location was unexpected: ${location}`);
  }

  const ctResponse = await waitForFetch(location);
  const ctHtml = await ctResponse.text();
  if (!ctHtml.includes("_dash") && !ctHtml.includes("Crystal Toolkit")) {
    throw new Error("Crystal Toolkit viewer did not return a Dash page.");
  }
  if (!ctHtml.includes("#07000f") || ctHtml.includes("#f6f8fc")) {
    throw new Error("Crystal Toolkit viewer did not use the studio black skin.");
  }

  const cookie = ctResponse.headers.get("set-cookie")?.split(";")[0];
  const layoutResponse = await waitForFetch(`http://${host}:${ctPort}/_dash-layout`, {
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      Referer: location,
    },
  });
  const layoutJson = await layoutResponse.text();
  if (!layoutJson.includes("mp-804") || !layoutJson.includes("GaN")) {
    throw new Error("Crystal Toolkit Dash layout did not preserve the selected mp-804 material.");
  }
  if (!layoutJson.includes("transparentBackground") || !layoutJson.includes("#07000f")) {
    throw new Error("Crystal Toolkit Dash layout did not pass the black scene background settings.");
  }

  console.log(`Smoke dev passed: ${baseUrl} -> ${location} with studio black skin.`);
} catch (error) {
  console.error(logs);
  throw error;
} finally {
  child.kill();
}
