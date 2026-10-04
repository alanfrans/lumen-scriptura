import { DynamicTexture, Scene, Texture } from "@babylonjs/core";

/** Grayscale, tileable textures. Materials tint them with their diffuse color. */
export type TexKind = "sand" | "grain" | "ashlar" | "wood" | "cloth" | "stripes";

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

function paint(
  scene: Scene,
  name: string,
  size: number,
  shade: (u: number, v: number, rand: () => number) => number,
): Texture {
  const tex = new DynamicTexture(name, { width: size, height: size }, scene, true);
  const ctx = tex.getContext() as unknown as CanvasRenderingContext2D;
  const img = ctx.createImageData(size, size);
  const rand = seeded(size * 31 + name.length * 977);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const v = Math.max(0, Math.min(255, shade(x / size, y / size, rand)));
      const i = (y * size + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  tex.update();
  tex.wrapU = tex.wrapV = Texture.WRAP_ADDRESSMODE;
  tex.anisotropicFilteringLevel = 8;
  return tex;
}

/** Returns a builder that paints a fresh texture of the given kind on each call. */
export function textureFactory(scene: Scene): (kind: TexKind) => Texture {
  const r = seeded(31103);
  const n4 = periodic(4, r);
  const n8 = periodic(8, r);
  const n32 = periodic(32, r);
  const TAU = Math.PI * 2;

  const builders: Record<TexKind, () => Texture> = {
    sand: () => paint(
      scene,
      "sand-tex",
      512,
      (u, v, rnd) => 205 + 30 * (n8(u, v) - 0.5) + 9 * Math.sin(TAU * (12 * v + 1.2 * n4(u, v))) + (rnd() - 0.5) * 22,
    ),
    grain: () => paint(
      scene,
      "grain-tex",
      256,
      (u, v, rnd) => 200 + 40 * (n8(u, v) - 0.5) + 22 * (n32(u, v) - 0.5) + (rnd() - 0.5) * 18,
    ),
    ashlar: () => paint(scene, "ashlar-tex", 256, (u, v, rnd) => {
      const row = Math.floor(v * 4);
      const cu = u * 3 + (row % 2) * 0.5;
      const col = Math.floor(cu);
      const fu = cu - col;
      const fv = v * 4 - row;
      if (fu < 0.025 || fu > 0.975 || fv < 0.035 || fv > 0.965) return 115 + (rnd() - 0.5) * 20;
      const tint = (((Math.sin(row * 7.1 + (col % 3) * 13.7) * 43758.5453) % 1) + 1) % 1;
      return 175 + tint * 45 + 25 * (n32(u, v) - 0.5) + (rnd() - 0.5) * 14;
    }),
    wood: () => paint(
      scene,
      "wood-tex",
      256,
      (u, v, rnd) => 175 + 28 * Math.sin(TAU * (10 * u + 1.5 * n4(u, v))) + 18 * (n32(u, v) - 0.5) + (rnd() - 0.5) * 10,
    ),
    cloth: () => paint(
      scene,
      "cloth-tex",
      128,
      (u, v, rnd) =>
        205 +
        ((Math.floor(u * 128) + Math.floor(v * 128)) & 2 ? 9 : -9) +
        26 * (n8(u, v) - 0.5) +
        (rnd() - 0.5) * 8,
    ),
    stripes: () => paint(
      scene,
      "stripes-tex",
      128,
      (u, v, rnd) => (Math.floor(v * 8) % 2 ? 215 : 140) + 18 * (n8(u, v) - 0.5) + (rnd() - 0.5) * 8,
    ),
  };
  return (kind) => builders[kind]();
}
