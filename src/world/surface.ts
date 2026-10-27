import { Color3, DynamicTexture, Scene, StandardMaterial, Texture } from "@babylonjs/core";
import { createGroundDetail } from "../art/textures";

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

function hash(ix: number, iz: number): number {
  let n = Math.imul(ix, 374761393) + Math.imul(iz, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function vnoise(x: number, z: number): number {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const fx = x - x0;
  const fz = z - z0;
  const sx = fx * fx * (3 - 2 * fx);
  const sz = fz * fz * (3 - 2 * fz);
  const a = hash(x0, z0);
  const b = hash(x0 + 1, z0);
  const c = hash(x0, z0 + 1);
  const d = hash(x0 + 1, z0 + 1);
  return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
}

function fbm(x: number, z: number): number {
  return vnoise(x, z) * 0.56 + vnoise(x * 2.07 + 5.2, z * 2.07 - 3.1) * 0.28 + vnoise(x * 4.13 - 1.7, z * 4.13 + 2.4) * 0.16;
}

type Surface = "sand" | "grass" | "rock" | "soil" | "dirt" | "brick" | "wet";

interface GroundSample {
  c: RGB;
  /** Micro height for the normal map. Negative values are grooves. */
  height: number;
  shine: number;
}

function groundSample(x: number, z: number, h: number, hill: number): GroundSample {
  const n1 = Math.sin(x * 0.05 + 1.7) * Math.cos(z * 0.046 - 0.4);
  const n2 = Math.sin(x * 0.11 - z * 0.08 + 0.6);
  const n3 = Math.sin(x * 0.018 + z * 0.016);
  let c: RGB = [198, 170, 124];
  let surface: Surface = "sand";
  if (n3 > 0.35) c = mix(c, [230, 210, 168], smooth(0.35, 0.9, n3));
  if (n2 < -0.2) {
    c = mix(c, [96, 68, 46], smooth(-0.2, -0.75, n2));
    surface = "soil";
  }
  if (n1 > 0.15) {
    c = mix(c, [86, 122, 52], smooth(0.15, 0.75, n1));
    surface = "grass";
  }
  if (n1 > 0.55) c = mix(c, [58, 92, 40], smooth(0.55, 0.95, n1));
  if (h > 2.3) {
    c = mix(c, [132, 124, 112], smooth(2.3, 4.2, h));
    surface = "rock";
  }
  if (hill > 0.4) {
    c = mix(c, [112, 106, 98], smooth(0.4, 3, hill));
    surface = "rock";
  }
  if (h > 6) {
    c = mix(c, [98, 94, 90], smooth(6, 12, h));
    surface = "rock";
  }

  const wet = Math.hypot(x + 60, z - 60);
  if (wet < 22 && wet > 13) {
    c = mix(c, [62, 74, 52], 1 - smooth(13, 22, wet));
    surface = "wet";
  }

  for (const [cx, cz, r] of [
    [-42, -18, 16],
    [96, -36, 14],
  ] as const) {
    const d = Math.hypot(x - cx, z - cz);
    if (d < r) {
      c = mix(c, [48, 40, 34], 1 - smooth(r * 0.3, r, d));
      surface = "soil";
    }
  }
  for (const [cx, cz, r] of [
    [-18, -96, 18],
    [46, 18, 12],
  ] as const) {
    const d = Math.hypot(x - cx, z - cz);
    if (d < r) {
      c = mix(c, [226, 206, 160], 1 - smooth(r * 0.2, r, d));
      surface = "sand";
    }
  }

  let dirt = 99;
  for (const [ax, az, bx, bz] of DIRT) dirt = Math.min(dirt, distSeg(x, z, ax, az, bx, bz));
  if (dirt < 3.6) {
    const edge = smooth(1.3, 3.6, dirt);
    c = mix([150, 112, 70], [118, 84, 52], edge);
    surface = "dirt";
  }

  const plaza = Math.hypot(x, z + 60);
  let brick = plaza < 8 ? plaza : 99;
  for (const [ax, az, bx, bz] of BRICK) brick = Math.min(brick, distSeg(x, z, ax, az, bx, bz));
  let height = 0;
  let shine = 0.05;
  if (brick < 2.3 || plaza < 8) {
    const row = Math.floor(z * 2.15);
    const fx = x * 1.05 + (row & 1 ? 0.5 : 0);
    const fz = z * 2.15 - row;
    const fu = fx - Math.floor(fx);
    const mortar = fu < 0.08 || fz < 0.14;
    const alt = (row + Math.floor(fx)) & 1;
    const tone = hash(Math.floor(fx) * 3 + row, row * 5);
    c = mortar ? [108, 92, 78] : alt ? [164, 98, 70] : [148, 88, 62];
    if (!mortar) c = mix(c, [c[0] + (tone - 0.5) * 18, c[1] + (tone - 0.5) * 12, c[2] + (tone - 0.5) * 8], 0.65);
    if (brick > 1.5 && plaza > 6.5) c = mix(c, [150, 112, 70], smooth(1.5, 2.3, Math.min(brick, plaza > 8 ? brick : 0)));
    surface = "brick";
    // Mortar is only a pixel or two at this map size, so keep the groove shallow or it turns into black noise.
    height = mortar ? -0.16 : 0.04 + (tone - 0.5) * 0.06;
    shine = mortar ? 0.02 : 0.08;
  }

  const grain = fbm(x * 1.35, z * 1.35);
  if (surface === "grass") {
    const tuft = hash(Math.floor(x * 3.2), Math.floor(z * 3.2));
    if (tuft > 0.64) {
      c = mix(c, tuft > 0.86 ? [176, 162, 84] : [54, 88, 38], 0.55);
      height += 0.38;
    }
    shine = 0.03;
  } else if (surface === "rock") {
    const crack = Math.abs(Math.sin(x * 2.6 + grain * 5) * Math.sin(z * 2.2 - grain * 4));
    if (crack < 0.08) {
      c = mix(c, [42, 40, 38], 0.6);
      height -= 0.75;
    }
    shine = 0.09;
  } else if (surface === "dirt") {
    const rut = Math.exp(-(((dirt - 0.85) * 2.4) ** 2)) + Math.exp(-(((dirt - 1.75) * 2.4) ** 2));
    c = mix(c, [88, 60, 34], Math.min(1, rut) * 0.5);
    height -= rut * 0.32;
    shine = 0.045;
  } else if (surface === "wet") {
    c = mix(c, [40, 52, 40], 0.28);
    shine = 0.62;
  } else if (surface === "sand" || surface === "soil") {
    const cx = Math.floor(x * 0.9);
    const cz = Math.floor(z * 0.9);
    const p = hash(cx + 11, cz - 4);
    if (p > 0.91) {
      const lx = x * 0.9 - cx - 0.5;
      const lz = z * 0.9 - cz - 0.5;
      const rad = 0.1 + (p - 0.91) * 1.4;
      const d = Math.hypot(lx, lz);
      if (d < rad) {
        const k = 1 - d / rad;
        c = mix(c, [146, 136, 116], k * 0.75);
        height += k * 0.35;
      }
    }
    shine = surface === "soil" ? 0.04 : 0.055;
  }
  if (surface !== "brick") height += (grain - 0.5) * (surface === "rock" ? 0.65 : 0.38);
  if (height < 0) {
    const ao = 1 + height * 0.2;
    c = [c[0] * ao, c[1] * ao, c[2] * ao];
  }
  const speckle = (hash(Math.floor(x * 47), Math.floor(z * 43)) - 0.5) * 9;
  return { c: [c[0] + speckle, c[1] + speckle, c[2] + speckle], height, shine };
}

const byte = (v: number) => Math.max(0, Math.min(255, Math.round(v)));

/** Paints grass, sand, rock, and roads onto one ground texture, with a matching normal and shine. */
export function paintGround(scene: Scene, heightAt: (x: number, z: number) => number): StandardMaterial {
  const size = 1024;
  const span = 360;
  const tex = new DynamicTexture("ground-tex", { width: size, height: size }, scene, false);
  const bump = new DynamicTexture("ground-bump", { width: size, height: size }, scene, false);
  const spec = new DynamicTexture("ground-spec", { width: size, height: size }, scene, false);
  const ctx = tex.getContext() as unknown as CanvasRenderingContext2D;
  const bctx = bump.getContext() as unknown as CanvasRenderingContext2D;
  const sctx = spec.getContext() as unknown as CanvasRenderingContext2D;
  const img = ctx.createImageData(size, size);
  const bimg = bctx.createImageData(size, size);
  const simg = sctx.createImageData(size, size);
  const heights = new Float32Array(size * size);
  const data = img.data;
  for (let y = 0; y < size; y++) {
    const z = (y / (size - 1) - 0.5) * span;
    for (let x = 0; x < size; x++) {
      const wx = (x / (size - 1) - 0.5) * span;
      const hill = hillHeight(wx, z);
      const h = heightAt(wx, z);
      const sample = groundSample(wx, z, h, hill);
      const i = (y * size + x) * 4;
      heights[y * size + x] = sample.height;
      data[i] = byte(sample.c[0]);
      data[i + 1] = byte(sample.c[1]);
      data[i + 2] = byte(sample.c[2]);
      data[i + 3] = 255;
      const shine = byte(sample.shine * 255);
      simg.data[i] = simg.data[i + 1] = simg.data[i + 2] = shine;
      simg.data[i + 3] = 255;
    }
  }
  const strength = 1.25;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const x0 = Math.max(0, x - 1);
      const x1 = Math.min(size - 1, x + 1);
      const y0 = Math.max(0, y - 1);
      const y1 = Math.min(size - 1, y + 1);
      const dx = (heights[y * size + x1] - heights[y * size + x0]) * strength;
      const dy = (heights[y1 * size + x] - heights[y0 * size + x]) * strength;
      let nx = -dx;
      let ny = -dy;
      let nz = 1;
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len;
      ny /= len;
      nz /= len;
      const i = (y * size + x) * 4;
      bimg.data[i] = byte(nx * 127.5 + 127.5);
      bimg.data[i + 1] = byte(ny * 127.5 + 127.5);
      bimg.data[i + 2] = byte(nz * 127.5 + 127.5);
      bimg.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  bctx.putImageData(bimg, 0, 0);
  sctx.putImageData(simg, 0, 0);
  tex.update(false);
  bump.update(false);
  spec.update(false);
  tex.anisotropicFilteringLevel = 16;
  bump.anisotropicFilteringLevel = 8;
  tex.updateSamplingMode(Texture.TRILINEAR_SAMPLINGMODE);
  bump.updateSamplingMode(Texture.TRILINEAR_SAMPLINGMODE);
  spec.updateSamplingMode(Texture.TRILINEAR_SAMPLINGMODE);
  const detail = createGroundDetail(scene);
  detail.uScale = detail.vScale = 70;
  const m = new StandardMaterial("ground-mat", scene);
  m.diffuseTexture = tex;
  m.bumpTexture = bump;
  m.specularTexture = spec;
  m.specularColor = new Color3(0.28, 0.28, 0.26);
  m.specularPower = 32;
  m.detailMap.isEnabled = true;
  m.detailMap.texture = detail;
  m.detailMap.diffuseBlendLevel = 0.12;
  m.detailMap.bumpLevel = 0.2;
  return m;
}

