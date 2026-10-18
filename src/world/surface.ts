import { Color3, DynamicTexture, Scene, StandardMaterial } from "@babylonjs/core";

type Seg = readonly [number, number, number, number];
type RGB = [number, number, number];

/** Dirt tracks linking the valley's sites. */
const DIRT: readonly Seg[] = [
  [-60, 60, -20, 18],
  [-20, 18, 0, -25],
  [0, -25, 40, -8],
  [40, -8, 70, 0],
  [70, 0, 60, 42],
  [0, -60, 36, -70],
  [36, -70, 52, -70],
  [0, -25, 8, 28],
  [8, 28, 10, 50],
  [8, 28, 28, 32],
  [60, 60, 28, 42],
  [-60, 60, -88, 86],
];

/** Brick streets at the camp, the cemetery gate, and the scriptorium door. */
const BRICK: readonly Seg[] = [
  [0, -52, 0, -30],
  [42, -70, 52, -70],
  [60, 34, 60, 47],
];

const HILLS: readonly (readonly [number, number, number, number])[] = [
  [-124, -36, 26, 8],
  [124, 55, 24, 6.5],
  [-36, 132, 22, 5.5],
  [24, -132, 20, 4.8],
];

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function distSeg(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax;
  const dz = bz - az;
  const len2 = dx * dx + dz * dz || 1;
  const t = Math.min(1, Math.max(0, ((px - ax) * dx + (pz - az) * dz) / len2));
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}

export function hillHeight(x: number, z: number): number {
  let h = 0;
  for (const [cx, cz, r, amp] of HILLS) {
    const d = Math.hypot(x - cx, z - cz);
    if (d < r) h += amp * (1 - smooth(0, r, d));
  }
  return h;
}

/** True when a point sits on a road, including its verges. */
export function onRoad(x: number, z: number, margin = 0): boolean {
  if (Math.hypot(x, z + 60) < 9 + margin) return true;
  for (const [ax, az, bx, bz] of DIRT) if (distSeg(x, z, ax, az, bx, bz) < 4.2 + margin) return true;
  for (const [ax, az, bx, bz] of BRICK) if (distSeg(x, z, ax, az, bx, bz) < 3.2 + margin) return true;
  return false;
}

function mix(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function groundColor(x: number, z: number, h: number, hill: number): RGB {
  const n1 = Math.sin(x * 0.05 + 1.7) * Math.cos(z * 0.046 - 0.4);
  const n2 = Math.sin(x * 0.11 - z * 0.08 + 0.6);
  const n3 = Math.sin(x * 0.018 + z * 0.016);
  let c: RGB = [198, 170, 124];
  if (n3 > 0.35) c = mix(c, [230, 210, 168], smooth(0.35, 0.9, n3));
  if (n2 < -0.2) c = mix(c, [96, 68, 46], smooth(-0.2, -0.75, n2));
  if (n1 > 0.15) c = mix(c, [86, 122, 52], smooth(0.15, 0.75, n1));
  if (n1 > 0.55) c = mix(c, [58, 92, 40], smooth(0.55, 0.95, n1));
  if (h > 2.3) c = mix(c, [132, 124, 112], smooth(2.3, 4.2, h));
  if (hill > 0.4) c = mix(c, [112, 106, 98], smooth(0.4, 3, hill));
  if (h > 6) c = mix(c, [98, 94, 90], smooth(6, 12, h));

  const wet = Math.hypot(x + 60, z - 60);
  if (wet < 22 && wet > 13) c = mix(c, [62, 74, 52], 1 - smooth(13, 22, wet));

  for (const [cx, cz, r] of [
    [-42, -18, 16],
    [96, -36, 14],
  ] as const) {
    const d = Math.hypot(x - cx, z - cz);
    if (d < r) c = mix(c, [48, 40, 34], 1 - smooth(r * 0.3, r, d));
  }
  for (const [cx, cz, r] of [
    [-18, -96, 18],
    [46, 18, 12],
  ] as const) {
    const d = Math.hypot(x - cx, z - cz);
    if (d < r) c = mix(c, [226, 206, 160], 1 - smooth(r * 0.2, r, d));
  }

  let dirt = 99;
  for (const [ax, az, bx, bz] of DIRT) dirt = Math.min(dirt, distSeg(x, z, ax, az, bx, bz));
  if (dirt < 3.6) {
    const edge = smooth(1.3, 3.6, dirt);
    c = mix([150, 112, 70], [118, 84, 52], edge);
  }

  const plaza = Math.hypot(x, z + 60);
  let brick = plaza < 8 ? plaza : 99;
  for (const [ax, az, bx, bz] of BRICK) brick = Math.min(brick, distSeg(x, z, ax, az, bx, bz));
  if (brick < 2.3 || plaza < 8) {
    const row = Math.floor(z * 2.15);
    const fx = x * 1.05 + (row & 1 ? 0.5 : 0);
    const fz = z * 2.15 - row;
    const mortar = fx - Math.floor(fx) < 0.08 || fz < 0.14;
    const alt = (row + Math.floor(fx)) & 1;
    c = mortar ? [92, 62, 52] : alt ? [168, 74, 48] : [146, 58, 42];
    if (brick > 1.5 && plaza > 6.5) c = mix(c, [150, 112, 70], smooth(1.5, 2.3, Math.min(brick, plaza > 8 ? brick : 0)));
  }
  return c;
}

/** Paints grass, sand, rock, and roads onto one ground texture. */
export function paintGround(scene: Scene, heightAt: (x: number, z: number) => number): StandardMaterial {
  const size = 1024;
  const span = 360;
  const tex = new DynamicTexture("ground-tex", { width: size, height: size }, scene, false);
  const ctx = tex.getContext() as unknown as CanvasRenderingContext2D;
  const img = ctx.createImageData(size, size);
  const data = img.data;
  for (let y = 0; y < size; y++) {
    const z = (y / (size - 1) - 0.5) * span;
    for (let x = 0; x < size; x++) {
      const wx = (x / (size - 1) - 0.5) * span;
      const hill = hillHeight(wx, z);
      const h = heightAt(wx, z);
      const c = groundColor(wx, z, h, hill);
      const i = (y * size + x) * 4;
      const n = ((x * 13 + y * 7) & 15) - 7;
      data[i] = Math.min(255, Math.max(0, c[0] + n));
      data[i + 1] = Math.min(255, Math.max(0, c[1] + n));
      data[i + 2] = Math.min(255, Math.max(0, c[2] + n));
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  tex.update(false);
  const m = new StandardMaterial("ground-mat", scene);
  m.diffuseTexture = tex;
  m.specularColor = new Color3(0.04, 0.04, 0.03);
  return m;
}
