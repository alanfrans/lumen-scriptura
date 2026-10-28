import { Mesh, MeshBuilder, Scene, VertexBuffer, VertexData } from "@babylonjs/core";
import { PLACEMENTS } from "../data/layout";
import { hillHeight, paintGround } from "./surface";

/** [x, z, radius] areas kept perfectly flat at height 0 so sites and verses sit on level ground. */
const FLAT_ZONES: ReadonlyArray<readonly [number, number, number]> = [
  [0, -60, 14],
  [0, -28, 20],
  [-60, 60, 24],
  [60, 60, 20],
  [60, -70, 30],
  [70, 0, 15],
  [10, 77, 36],
  [30, 32, 11],
  [-92, 92, 6],
  ...PLACEMENTS.map((p) => [p.x, p.z, 5] as const),
];

const OASIS = { x: -60, z: 60 };
/** Matches the ground mesh: 360 m across, one vertex every 2 m. */
const GROUND_STEPS = 180;
const GROUND_STEP = 360 / GROUND_STEPS;
const GROUND_ORIGIN = -180;

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function rawHeight(x: number, z: number): number {
  const raw =
    3.2 * Math.sin(x * 0.045 + 1.3) * Math.cos(z * 0.04 - 0.7) +
    1.8 * Math.sin(x * 0.11 + z * 0.07) +
    1.1 * Math.cos(x * 0.16 - z * 0.13 + 2) +
    0.32 * Math.sin(x * 0.31 + 0.6) * Math.cos(z * 0.28 - 1.2) +
    0.15 * Math.sin((x + z) * 0.57 + 2.1);
  let h = Math.max(0, raw + 1.2) + smooth(115, 170, Math.hypot(x, z)) * 18 + hillHeight(x, z);
  let mask = 0;
  for (const [zx, zz, r] of FLAT_ZONES) {
    const d = Math.hypot(x - zx, z - zz);
    if (d < r + 10) mask = Math.max(mask, 1 - smooth(r, r + 10, d));
    if (mask >= 1) break;
  }
  h *= 1 - mask;
  const od = Math.hypot(x - OASIS.x, z - OASIS.z);
  if (od < 18) h = Math.min(h, -0.7 * (1 - smooth(12, 18, od)));
  return h;
}

/** Height of the drawn ground. The mesh is flat between vertices, so standing on the raw curve sinks into those faces. */
export function heightAt(x: number, z: number): number {
  const gx = (x - GROUND_ORIGIN) / GROUND_STEP;
  const gz = (z - GROUND_ORIGIN) / GROUND_STEP;
  const x0 = Math.max(0, Math.min(GROUND_STEPS - 1, Math.floor(gx)));
  const z0 = Math.max(0, Math.min(GROUND_STEPS - 1, Math.floor(gz)));
  const x1 = Math.min(GROUND_STEPS, x0 + 1);
  const z1 = Math.min(GROUND_STEPS, z0 + 1);
  const tx = Math.min(1, Math.max(0, gx - x0));
  const tz = Math.min(1, Math.max(0, gz - z0));
  const at = (ix: number, iz: number) => rawHeight(GROUND_ORIGIN + ix * GROUND_STEP, GROUND_ORIGIN + iz * GROUND_STEP);
  const h00 = at(x0, z0);
  const h10 = at(x1, z0);
  const h01 = at(x0, z1);
  const h11 = at(x1, z1);
  return (h00 * (1 - tx) + h10 * tx) * (1 - tz) + (h01 * (1 - tx) + h11 * tx) * tz;
}

export function createTerrain(scene: Scene): Mesh {
  const mat = paintGround(scene, heightAt);
  const ground = MeshBuilder.CreateGround(
    "ground",
    { width: 360, height: 360, subdivisions: 180, updatable: true },
    scene,
  );
  const pos = ground.getVerticesData(VertexBuffer.PositionKind);
  const indices = ground.getIndices();
  if (pos && indices) {
    for (let i = 0; i < pos.length; i += 3) pos[i + 1] = heightAt(pos[i], pos[i + 2]);
    const normals: number[] = [];
    VertexData.ComputeNormals(pos, indices, normals);
    ground.updateVerticesData(VertexBuffer.PositionKind, pos);
    ground.updateVerticesData(VertexBuffer.NormalKind, normals);
    ground.refreshBoundingInfo();
  }
  ground.material = mat;
  ground.freezeWorldMatrix();
  return ground;
}
