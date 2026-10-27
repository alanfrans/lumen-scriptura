import { DynamicTexture, Scene, Texture } from "@babylonjs/core";

/**
 * Tileable textures painted in code. Nothing here is a downloaded asset,
 * so there is no third-party license to track.
 * Albedo stays near mid-gray so a material's diffuse color can still tint it.
 * `h` is a height used only to build the matching normal map.
 */
export type TexKind =
  | "sand"
  | "grain"
  | "ashlar"
  | "wood"
  | "cloth"
  | "stripes"
  | "skin"
  | "fur"
  | "metal"
  | "ripple"
  | "leaf"
  | "rock";

export interface TexPair {
  diffuse: Texture;
  bump: Texture;
}

interface Sample {
  r: number;
  g: number;
  b: number;
  h: number;
}

const TAU = Math.PI * 2;

function seeded(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Smooth value noise on a wrapping grid, so the texture tiles seamlessly. */
function periodic(cells: number, rand: () => number): (u: number, v: number) => number {
  const g = Array.from({ length: cells * cells }, rand);
  const at = (i: number, j: number) => g[(((j % cells) + cells) % cells) * cells + (((i % cells) + cells) % cells)];
  return (u, v) => {
    const x = u * cells;
    const y = v * cells;
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * sx;
    const b = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * sx;
    return a + (b - a) * sy;
  };
}

const byte = (v: number) => Math.max(0, Math.min(255, Math.round(v)));

function paintPair(
  scene: Scene,
  name: string,
  size: number,
  shade: (u: number, v: number, rand: () => number) => Sample,
): TexPair {
  const diffuse = new DynamicTexture(`${name}-diff`, { width: size, height: size }, scene, true);
  const bump = new DynamicTexture(`${name}-bump`, { width: size, height: size }, scene, true);
  const ctx = diffuse.getContext() as unknown as CanvasRenderingContext2D;
  const bctx = bump.getContext() as unknown as CanvasRenderingContext2D;
  const img = ctx.createImageData(size, size);
  const bimg = bctx.createImageData(size, size);
  const heights = new Float32Array(size * size);
  const rand = seeded(size * 31 + name.length * 977);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const s = shade(x / size, y / size, rand);
      const i = (y * size + x) * 4;
      heights[y * size + x] = s.h;
      img.data[i] = byte(s.r);
      img.data[i + 1] = byte(s.g);
      img.data[i + 2] = byte(s.b);
      img.data[i + 3] = 255;
    }
  }
  const strength = 2.6;
  for (let y = 0; y < size; y++) {
    const y0 = y === 0 ? size - 1 : y - 1;
    const y1 = y === size - 1 ? 0 : y + 1;
    for (let x = 0; x < size; x++) {
      const x0 = x === 0 ? size - 1 : x - 1;
      const x1 = x === size - 1 ? 0 : x + 1;
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
  // Keep canvas Y aligned with the height field the normals were built from.
  diffuse.update(false);
  bump.update(false);
  for (const tex of [diffuse, bump]) {
    tex.wrapU = tex.wrapV = Texture.WRAP_ADDRESSMODE;
    tex.anisotropicFilteringLevel = 8;
    tex.updateSamplingMode(Texture.TRILINEAR_SAMPLINGMODE);
  }
  return { diffuse, bump };
}

function buildNoises(): {
  n4: (u: number, v: number) => number;
  n8: (u: number, v: number) => number;
  n32: (u: number, v: number) => number;
} {
  const r = seeded(31103);
  return { n4: periodic(4, r), n8: periodic(8, r), n32: periodic(32, r) };
}

/** A fresh albedo and normal map. Callers that share a look should cache the pair. */
export function createTexture(scene: Scene, kind: TexKind): TexPair {
  const { n4, n8, n32 } = buildNoises();
  const builders: Record<TexKind, () => TexPair> = {
    sand: () => paintPair(scene, "sand", 512, (u, v, rnd) => {
      const ripple = Math.sin(TAU * (10 * v + 1.4 * n4(u, v)));
      const peb = n32(u * 2.3, v * 2.3);
      const pebble = peb > 0.84 ? (peb - 0.84) * 5 : 0;
      const base = 206 + 26 * (n8(u, v) - 0.5) + 10 * ripple + (rnd() - 0.5) * 14;
      return { r: base + 4, g: base, b: base - 8, h: ripple * 0.32 + pebble + (n8(u, v) - 0.5) * 0.22 };
    }),
    grain: () => paintPair(scene, "grain", 256, (u, v, rnd) => {
      const n = n8(u, v) * 0.65 + n32(u, v) * 0.35;
      const pit = n32(u * 2.2, v * 2.2) > 0.9 ? -0.6 : 0;
      const base = 198 + (n - 0.5) * 34 + (rnd() - 0.5) * 8;
      return { r: base + 3, g: base, b: base - 3, h: (n - 0.5) * 0.5 + pit };
    }),
    ashlar: () => paintPair(scene, "ashlar", 256, (u, v, rnd) => {
      const row = Math.floor(v * 4);
      const cu = u * 3 + (row % 2) * 0.5;
      const col = Math.floor(cu);
      const fu = cu - col;
      const fv = v * 4 - row;
      const mortar = fu < 0.035 || fu > 0.965 || fv < 0.05 || fv > 0.95;
      const edge = Math.min(fu, 1 - fu, fv, 1 - fv);
      const bevel = Math.min(1, edge / 0.09);
      const tint = (((Math.sin(row * 7.1 + (col % 3) * 13.7) * 43758.5453) % 1) + 1) % 1;
      const stone = 176 + tint * 40 + 18 * (n32(u, v) - 0.5) + (rnd() - 0.5) * 10;
      const base = mortar ? 108 + (rnd() - 0.5) * 12 : stone;
      return { r: base, g: base * 0.985, b: base * 0.96, h: mortar ? -0.95 : 0.12 + bevel * 0.2 };
    }),
    wood: () => paintPair(scene, "wood", 256, (u, v, rnd) => {
      const ring = Math.sin(TAU * (9 * u + 1.6 * n4(u, v)));
      const pore = n32(u, v);
      const base = 184 + 26 * ring + 12 * (pore - 0.5) + (rnd() - 0.5) * 6;
      return { r: base + 10, g: base, b: base - 12, h: ring * 0.42 + (pore - 0.5) * 0.18 };
    }),
    cloth: () => paintPair(scene, "cloth", 128, (u, v) => {
      const weave = (Math.floor(u * 96) + Math.floor(v * 96)) & 1 ? 9 : -9;
      const fold = Math.sin(TAU * (2.2 * v + 0.45 * n4(u, v)));
      const base = 202 + weave + fold * 12 + 16 * (n8(u, v) - 0.5);
      return { r: base, g: base, b: base, h: fold * 0.5 + weave * 0.012 };
    }),
    stripes: () => paintPair(scene, "stripes", 128, (u, v) => {
      const on = Math.floor(v * 8) % 2 === 0;
      const thread = Math.sin(TAU * u * 36) * 5;
      const fold = Math.sin(TAU * (1.6 * v + 0.3 * u));
      const base = (on ? 214 : 142) + thread + 10 * (n8(u, v) - 0.5);
      return { r: base, g: base * 0.99, b: base * 0.97, h: (on ? 0.22 : -0.18) + fold * 0.28 };
    }),
    skin: () => paintPair(scene, "skin", 128, (u, v) => {
      const pores = n32(u, v);
      const blotch = n8(u, v);
      const base = 208 + (blotch - 0.5) * 12 + (pores - 0.5) * 8;
      return { r: base + 6, g: base, b: base - 5, h: (pores - 0.5) * 0.22 + (blotch - 0.5) * 0.08 };
    }),
    fur: () => paintPair(scene, "fur", 256, (u, v) => {
      const strand = Math.sin(TAU * (18 * u + 2.2 * n4(u, v)));
      const clump = n8(u, v);
      const base = 196 + strand * 12 + (clump - 0.5) * 16;
      return { r: base + 2, g: base, b: base - 3, h: strand * 0.28 + (clump - 0.5) * 0.2 };
    }),
    metal: () => paintPair(scene, "metal", 128, (u, v, rnd) => {
      const scratch = Math.abs(Math.sin(TAU * (34 * u + 1.5 * v))) < 0.035;
      const n = n32(u, v);
      const base = 200 + (n - 0.5) * 14 + (scratch ? -28 : 0) + (rnd() - 0.5) * 6;
      return { r: base, g: base, b: base + 3, h: (scratch ? -0.45 : 0) + (n - 0.5) * 0.12 };
    }),
    ripple: () => paintPair(scene, "ripple", 256, (u, v) => {
      // Integer frequencies so the tile meets itself. Amplitude stays small;
      // a steep normal turns into a checker under the low sun.
      const w1 = Math.sin(TAU * (3 * u + 2 * v));
      const w2 = Math.sin(TAU * (2 * v - u) + 1.2);
      const w3 = Math.sin(TAU * (5 * u + v) + 0.6);
      const h = w1 * 0.22 + w2 * 0.14 + w3 * 0.06;
      const base = 200 + h * 8;
      return { r: base - 6, g: base, b: base + 8, h };
    }),
    leaf: () => paintPair(scene, "leaf", 256, (u, v) => {
      const across = Math.abs(u - 0.5) * 2;
      const mid = Math.abs(u - 0.5) < 0.035;
      const side = Math.abs((v * 9) % 1 - 0.5) < 0.04 && across > 0.18 && across < 0.85;
      const base = 198 - across * 36 - (mid ? 22 : 0) - (side ? 10 : 0) + (n32(u, v) - 0.5) * 10;
      return { r: base - 6, g: base + 8, b: base - 10, h: (mid ? 0.75 : 0) + (side ? 0.28 : 0) - across * 0.15 };
    }),
    rock: () => paintPair(scene, "rock", 256, (u, v, rnd) => {
      const n = n8(u, v);
      const crackU = Math.abs(Math.sin(TAU * (5 * u + 3 * n4(u, v))));
      const crackV = Math.abs(Math.sin(TAU * (4 * v - 2.4 * n4(v, u))));
      const crack = Math.min(crackU, crackV) < 0.07;
      const pit = n32(u, v) > 0.93;
      const base = crack ? 120 : 188 + (n - 0.5) * 28 + (rnd() - 0.5) * 8;
      return { r: base, g: base * 0.985, b: base * 0.96, h: crack ? -0.9 : pit ? -0.35 : (n - 0.5) * 0.4 };
    }),
  };
  return builders[kind]();
}

/**
 * Close-up grit for the valley floor. The detail-map shader reads albedo from R
 * and the tangent normal from G (X) and A (Y).
 */
export function createGroundDetail(scene: Scene): Texture {
  const size = 256;
  const tex = new DynamicTexture("ground-detail", { width: size, height: size }, scene, true);
  const ctx = tex.getContext() as unknown as CanvasRenderingContext2D;
  const img = ctx.createImageData(size, size);
  const { n32 } = buildNoises();
  const heights = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const n = n32(u, v);
      const grit = n32(u * 3.1 + 0.2, v * 3.1 - 0.4);
      heights[y * size + x] = (n - 0.5) * 0.85 + (grit > 0.86 ? 0.55 : 0);
    }
  }
  const strength = 3.2;
  for (let y = 0; y < size; y++) {
    const y0 = y === 0 ? size - 1 : y - 1;
    const y1 = y === size - 1 ? 0 : y + 1;
    for (let x = 0; x < size; x++) {
      const x0 = x === 0 ? size - 1 : x - 1;
      const x1 = x === size - 1 ? 0 : x + 1;
      const dx = (heights[y * size + x1] - heights[y * size + x0]) * strength;
      const dy = (heights[y1 * size + x] - heights[y0 * size + x]) * strength;
      let nx = -dx;
      let ny = -dy;
      const len = Math.hypot(nx, ny, 1) || 1;
      nx /= len;
      ny /= len;
      const i = (y * size + x) * 4;
      const albedo = 118 + heights[y * size + x] * 28;
      img.data[i] = byte(albedo);
      img.data[i + 1] = byte(nx * 127.5 + 127.5);
      img.data[i + 2] = 128;
      img.data[i + 3] = byte(ny * 127.5 + 127.5);
    }
  }
  ctx.putImageData(img, 0, 0);
  tex.hasAlpha = true;
  tex.update(false);
  tex.wrapU = tex.wrapV = Texture.WRAP_ADDRESSMODE;
  tex.anisotropicFilteringLevel = 16;
  tex.updateSamplingMode(Texture.TRILINEAR_SAMPLINGMODE);
  return tex;
}
