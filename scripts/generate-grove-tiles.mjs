/**
 * Turn the CC0 toy-tree splat into a y-up canonical tree and spatial grove tiles.
 *
 * Each tile is one tree in its own file, centered on the tile origin, with a
 * unique yaw baked in. The viewer streams those files by camera distance.
 * `public/splats/tree.ply` is the unrotated tree the collider is built from.
 *
 *   npm run splats:tiles
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = resolve(root, "assets/splats/gsplat-toy-tree.splat");
const SH_C0 = 0.28209479177387814;
const TARGET_HEIGHT = 4.8;

/** 12 m cells. Two rows, four columns, west of the garden and clear of the lake. */
const COLS = [-102, -90, -78, -66];
const ROWS = [4, 16];
const TILE_SIZE = 12;
const LOAD_RADIUS = 18;
const UNLOAD_RADIUS = 27;

/** Genesis 2 verse anchors. A tile must not cover one. */
const VERSES = [
  [0, -52], [-10, -44], [10, -44], [0, -34], [-30, -28], [-46, -16], [-34, -4],
  [-6, 2], [4, 14], [12, 30], [36, 36], [58, 40], [46, 14], [26, 46], [14, 4],
  [-16, 16], [14, 20], [-2, 32], [-22, 30], [-38, 42], [-8, 48], [8, 56],
  [-4, 64], [12, 70], [0, 78],
];

function mulQuat(a, b) {
  return [
    a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3],
    a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2],
    a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1],
    a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0],
  ];
}

function normalizeQuat(q) {
  const len = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
  return q.map((v) => v / len);
}

/** Antimatter15 .splat, 32 bytes, y-down. Returns y-up splats in linear units. */
function readSplat(path) {
  const buf = readFileSync(path);
  if (buf.length % 32 !== 0) throw new Error(`${path} is not a 32-byte splat record file`);
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const out = [];
  for (let i = 0; i < buf.length / 32; i++) {
    const o = i * 32;
    const px = dv.getFloat32(o, true);
    const py = dv.getFloat32(o + 4, true);
    const pz = dv.getFloat32(o + 8, true);
    const sx = dv.getFloat32(o + 12, true);
    const sy = dv.getFloat32(o + 16, true);
    const sz = dv.getFloat32(o + 20, true);
    const r = buf[o + 24];
    const g = buf[o + 25];
    const b = buf[o + 26];
    const a = buf[o + 27] / 255;
    // rot bytes are w, x, y, z mapped from 0..255 into [-1, 1].
    const rw = (buf[o + 28] / 255) * 2 - 1;
    const rx = (buf[o + 29] / 255) * 2 - 1;
    const ry = (buf[o + 30] / 255) * 2 - 1;
    const rz = (buf[o + 31] / 255) * 2 - 1;
    // 180° about X takes 3DGS y-down into y-up: (x, y, z) -> (x, -y, -z).
    const flipped = normalizeQuat(mulQuat([0, 1, 0, 0], [rw, rx, ry, rz]));
    if (![px, py, pz, sx, sy, sz, a, ...flipped].every(Number.isFinite)) continue;
    if (sx <= 1e-8 || sy <= 1e-8 || sz <= 1e-8 || a <= 0.02) continue;
    out.push({
      x: px,
      y: -py,
      z: -pz,
      sx,
      sy,
      sz,
      q: flipped,
      r,
      g,
      b,
      a,
    });
  }
  return out;
}

function percentile(sorted, t) {
  const i = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * t)));
  return sorted[i];
}

function scaleTree(splats) {
  const ys = splats.map((s) => s.y).sort((a, b) => a - b);
  const lo = percentile(ys, 0.01);
  const hi = percentile(ys, 0.99);
  const height = hi - lo;
  if (height < 0.2) throw new Error(`Tree height ${height} is not usable`);
  const scale = TARGET_HEIGHT / height;
  let sx = 0;
  let sz = 0;
  for (const s of splats) {
    sx += s.x;
    sz += s.z;
  }
  sx /= splats.length;
  sz /= splats.length;
  return splats.map((s) => ({
    ...s,
    x: (s.x - sx) * scale,
    y: (s.y - lo) * scale,
    z: (s.z - sz) * scale,
    sx: s.sx * scale,
    sy: s.sy * scale,
    sz: s.sz * scale,
  }));
}

function yawTree(splats, yaw) {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const qyaw = [Math.cos(yaw / 2), 0, Math.sin(yaw / 2), 0];
  return splats.map((sp) => ({
    ...sp,
    x: sp.x * c + sp.z * s,
    z: -sp.x * s + sp.z * c,
    q: normalizeQuat(mulQuat(qyaw, sp.q)),
  }));
}

function writePly(path, splats) {
  const header =
    "ply\n" +
    "format binary_little_endian 1.0\n" +
    "comment Derived from the Innerscene CC0 toy tree. See assets/splats/LICENSE.md\n" +
    `element vertex ${splats.length}\n` +
    "property float x\nproperty float y\nproperty float z\n" +
    "property float scale_0\nproperty float scale_1\nproperty float scale_2\n" +
    "property float rot_0\nproperty float rot_1\nproperty float rot_2\nproperty float rot_3\n" +
    "property float f_dc_0\nproperty float f_dc_1\nproperty float f_dc_2\n" +
    "property float opacity\n" +
    "end_header\n";
  const body = Buffer.alloc(splats.length * 14 * 4);
  const dv = new DataView(body.buffer, body.byteOffset, body.byteLength);
  splats.forEach((s, i) => {
    const o = i * 56;
    const logit = Math.log(Math.min(1 - 1e-4, Math.max(1e-4, s.a)) / (1 - Math.min(1 - 1e-4, Math.max(1e-4, s.a))));
    const values = [
      s.x, s.y, s.z,
      Math.log(s.sx), Math.log(s.sy), Math.log(s.sz),
      s.q[0], s.q[1], s.q[2], s.q[3],
      (s.r / 255 - 0.5) / SH_C0,
      (s.g / 255 - 0.5) / SH_C0,
      (s.b / 255 - 0.5) / SH_C0,
      logit,
    ];
    for (let k = 0; k < 14; k++) dv.setFloat32(o + k * 4, values[k], true);
  });
  writeFileSync(path, Buffer.concat([Buffer.from(header), body]));
}

function radiusOf(splats) {
  let r = 0;
  for (const s of splats) r = Math.max(r, Math.hypot(s.x, s.z) + Math.max(s.sx, s.sz));
  return r;
}

function main() {
  const raw = readSplat(sourcePath);
  const tree = scaleTree(raw);
  const radius = radiusOf(tree);
  mkdirSync(resolve(root, "public/splats/tiles"), { recursive: true });
  writePly(resolve(root, "public/splats/tree.ply"), tree);

  const tiles = [];
  let yawN = 0;
  for (let row = 0; row < ROWS.length; row++) {
    for (let col = 0; col < COLS.length; col++) {
      const x = COLS[col];
      const z = ROWS[row];
      for (const [vx, vz] of VERSES) {
        const gap = Math.hypot(vx - x, vz - z) - radius;
        if (gap < 2) {
          throw new Error(`Tile at ${x},${z} comes within ${gap.toFixed(2)} m of a verse at ${vx},${vz}`);
        }
      }
      const yaw = yawN * 0.85;
      yawN += 1;
      const id = `c${col}r${row}`;
      writePly(resolve(root, `public/splats/tiles/${id}.ply`), yawTree(tree, yaw));
      tiles.push({ id, url: `/splats/tiles/${id}.ply`, x, z, yaw, splatCount: tree.length });
    }
  }

  const spawn = { x: (COLS[0] + COLS[1]) / 2, z: (ROWS[0] + ROWS[1]) / 2 };
  const manifest = `/** Generated by scripts/generate-grove-tiles.mjs. Do not edit by hand. */\n` +
    `export interface GroveTile {\n` +
    `  id: string;\n  url: string;\n  x: number;\n  z: number;\n  yaw: number;\n  splatCount: number;\n}\n\n` +
    `export const GROVE = {\n` +
    `  tileSize: ${TILE_SIZE},\n` +
    `  loadRadius: ${LOAD_RADIUS},\n` +
    `  unloadRadius: ${UNLOAD_RADIUS},\n` +
    `  treeHeight: ${TARGET_HEIGHT},\n` +
    `  treeRadius: ${Number(radius.toFixed(3))},\n` +
    `  sourceSplats: ${raw.length},\n` +
    `  paged: false,\n` +
    `  spawn: { x: ${spawn.x}, z: ${spawn.z} },\n` +
    `  tiles: ${JSON.stringify(tiles, null, 2)} as GroveTile[],\n` +
    `};\n`;
  writeFileSync(resolve(root, "src/splats/grove-manifest.ts"), manifest);
  console.log(
    `tree ${tree.length} splats, height ${TARGET_HEIGHT} m, radius ${radius.toFixed(2)} m, ${tiles.length} tiles of ${TILE_SIZE} m`,
  );
}

main();
