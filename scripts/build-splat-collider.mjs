/**
 * Build the hidden tree collider with PlayCanvas splat-transform.
 *
 * The documented command is a voxel file plus a collision mesh:
 *
 *   splat-transform public/splats/tree.ply public/splats/tree.voxel.json \
 *     --collision-mesh smooth --voxel-size 0.3
 *
 * Voxelization uses the GPU. This script retries on lavapipe (Mesa's software
 * Vulkan) when the machine has no hardware adapter, which is how the committed
 * mesh was produced. Regenerate the tree first with `npm run splats:tiles`.
 *
 *   npm run splats:collider
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cli = resolve(root, "node_modules/@playcanvas/splat-transform/bin/cli.mjs");
const input = resolve(root, "public/splats/tree.ply");
const output = resolve(root, "public/splats/tree.voxel.json");
const LAVAPIPE = "/usr/share/vulkan/icd.d/lvp_icd.json";

if (!existsSync(input)) {
  console.error("Missing public/splats/tree.ply. Run npm run splats:tiles first.");
  process.exit(1);
}

function run(env, extra) {
  return spawnSync(
    process.execPath,
    [cli, input, output, "--collision-mesh", "smooth", "--voxel-size", "0.3", "--overwrite", ...extra],
    { cwd: root, stdio: "inherit", env: { ...process.env, ...env } },
  );
}

let result = run({}, []);
if (result.status !== 0 && existsSync(LAVAPIPE)) {
  console.log("No hardware WebGPU adapter. Retrying splat-transform on lavapipe.");
  result = run(
    { VK_ICD_FILENAMES: LAVAPIPE, VK_DRIVER_FILES: LAVAPIPE },
    ["--gpu-backend", "vulkan", "-g", "0"],
  );
}
process.exit(result.status ?? 1);
