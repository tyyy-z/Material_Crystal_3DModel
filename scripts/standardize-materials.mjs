import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const standardizerPath = join(__dirname, "standardize-structures.py");

export function standardizeMaterialsWithPymatgen(materials) {
  if (!Array.isArray(materials) || materials.length === 0) {
    return materials;
  }

  const result = spawnSync("python", [standardizerPath], {
    input: JSON.stringify(materials),
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 64,
  });

  if (result.status !== 0) {
    const message = result.stderr?.trim() || "Unknown pymatgen standardization failure.";
    throw new Error(`pymatgen structure standardization failed: ${message}`);
  }

  return JSON.parse(result.stdout);
}
