/**
 * Pre-build Spark LoD trees for the grove tiles.
 *
 * Spark's documented tool is `build-lod` from the Spark repo (Rust). The npm
 * package only ships the renderer, so point SPARK_BUILD_LOD at the binary:
 *
 *   cargo build --release --manifest-path rust/build-lod/Cargo.toml
 *   SPARK_BUILD_LOD=rust/target/release/build-lod npm run splats:lod
 *
 * Each tile becomes a chunked .RAD (`--quick --rad-chunked`). The viewer then
 * loads it with SplatMesh `{ paged: true }`, which streams chunks by view.
 *
 *   npm run splats:lod
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tilesDir = resolve(root, "public/splats/tiles");
const manifestPath = resolve(root, "src/splats/grove-manifest.ts");
const candidates = [
  process.env.SPARK_BUILD_LOD,
  resolve(root, "spark/rust/target/release/build-lod"),
  "/tmp/spark/rust/target/release/build-lod",
].filter(Boolean);

const binary = candidates.find((path) => existsSync(path));
if (!binary) {
  console.error(
    "Spark build-lod was not found. Clone https://github.com/sparkjsdev/spark and run\n" +
      "  cargo build --release --manifest-path rust/build-lod/Cargo.toml\n" +
      "then set SPARK_BUILD_LOD to rust/target/release/build-lod.",
  );
  process.exit(1);
}

const inputs = readdirSync(tilesDir)
  .filter((name) => name.endsWith(".ply"))
  .map((name) => resolve(tilesDir, name));
if (!inputs.length) {
  console.error("No tile PLY files. Run npm run splats:tiles first.");
  process.exit(1);
}

const result = spawnSync(binary, ["--quick", "--rad-chunked", "--max-sh=0", ...inputs], {
  cwd: root,
  stdio: "inherit",
});
if (result.status !== 0) process.exit(result.status ?? 1);

let manifest = readFileSync(manifestPath, "utf8");
manifest = manifest.replaceAll('.ply"', '-lod.rad"').replace("paged: false", "paged: true");
writeFileSync(manifestPath, manifest);
console.log("Manifest now streams the chunked .RAD tiles (paged: true).");
