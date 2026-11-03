// Perf regression gate (mechanism-explainer §10.6). Serves dist, renders heavy views in headless Chrome
// (SwiftShader, so numbers are relative), compares to baseline; fails on >1.5x regression or a budget breach.
// usage: node v2/perf/perf-check.mjs [--update]
import http from "http"; import fs from "fs"; import path from "path"; import puppeteer from "puppeteer-core";
const ROOT = path.resolve("dist"), BASE = path.resolve("v2/perf/baseline.swiftshader.json"), K = 1.5;
const CASES = ["si:conventional:1", "lifepo4:conventional:4", "quartz:conventional:4", "srtio3:conventional:4", "graphite:conventional:4", "gan:conventional:3", "licoo2:primitive:4"];
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml" };
const srv = http.createServer((q, r) => { const f = path.join(ROOT, decodeURIComponent(q.url.split("?")[0]).replace(/\/$/, "/index.html"));
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(r); });
await new Promise((ok) => srv.listen(0, "127.0.0.1", ok)); const port = srv.address().port;
const b = await puppeteer.launch({ executablePath: process.env.CHROME || "/usr/bin/google-chrome", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"] });
const res = {};
const RUNS = 3, med = (a) => [...a].sort((x, y) => x - y)[a.length >> 1]; // SwiftShader is noisy: median of 3 fresh loads
for (const c of CASES) {
  const [m, cell, n] = c.split(":"), runs = [];
  for (let i = 0; i < RUNS; i++) {
    const p = await b.newPage(); await p.setViewport({ width: 1440, height: 900 });
    // rot=0 + wait past the build animation so every run measures the same static frame
    await p.goto(`http://127.0.0.1:${port}/?m=${m}&cell=${cell}&n=${n}&rot=0`, { waitUntil: "networkidle0" }); await new Promise((r) => setTimeout(r, 4000));
    const x = await p.evaluate(() => window.__perf()); runs.push({ frameMs: x.p95Ms > 0 ? +((x.avgMs + x.p95Ms) / 2).toFixed(1) : x.avgMs, drawCalls: x.drawCalls, triangles: x.triangles, textures: x.textures }); await p.close();
  }
  res[c] = { frameMs: med(runs.map((r) => r.frameMs)), drawCalls: med(runs.map((r) => r.drawCalls)), triangles: med(runs.map((r) => r.triangles)), textures: runs[0].textures, runs: runs.map((r) => r.frameMs) };
}
await b.close(); srv.close();
if (process.argv.includes("--update") || !fs.existsSync(BASE)) { fs.writeFileSync(BASE, JSON.stringify({ renderer: "swiftshader 1440x900", factor: K, runs: RUNS, stat: "median", cases: res }, null, 1) + "\n"); console.log("baseline written", BASE); }
const base = JSON.parse(fs.readFileSync(BASE, "utf8")).cases; let bad = 0;
for (const [c, r] of Object.entries(res)) { const o = base[c] || r, fails = [];
  for (const k of ["frameMs", "drawCalls", "triangles"]) if (r[k] > o[k] * K) fails.push(`${k} ${o[k]}→${r[k]}`);
  if (r.drawCalls > 150) fails.push(`drawCalls>150`); if (r.triangles > 1.5e6) fails.push(`triangles>1.5M`);
  console.log(`${fails.length ? "FAIL" : "ok  "} ${c.padEnd(24)} ${String(r.frameMs).padStart(7)} ms  ${String(r.drawCalls).padStart(4)} calls  ${String(r.triangles).padStart(8)} tris  ${fails.join("; ")}`); bad += fails.length > 0; }
process.exit(bad ? 1 : 0);
