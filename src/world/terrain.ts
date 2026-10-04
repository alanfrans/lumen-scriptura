import { Mesh, MeshBuilder, Scene, StandardMaterial, VertexBuffer, VertexData } from "@babylonjs/core";
import { PLACEMENTS } from "../data/layout";

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

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function heightAt(x: number, z: number): number {
  const raw =
    3.2 * Math.sin(x * 0.045 + 1.3) * Math.cos(z * 0.04 - 0.7) +
    1.8 * Math.sin(x * 0.11 + z * 0.07) +
    1.1 * Math.cos(x * 0.16 - z * 0.13 + 2);
  let h = Math.max(0, raw + 1.2) + smooth(115, 170, Math.hypot(x, z)) * 18;
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

export function createTerrain(scene: Scene, mat: StandardMaterial): Mesh {
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
