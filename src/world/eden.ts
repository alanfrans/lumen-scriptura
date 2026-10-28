import { Color3, DynamicTexture, Mesh, MeshBuilder, Scene, StandardMaterial } from "@babylonjs/core";
import type { Palette, RGB } from "../art/materials";
import { buildBeast, buildPerson, type BeastKind, type Rig } from "../art/models";
import { EDEN_PLACEMENTS } from "../data/layout";
import type { Wanderer, World } from "./world";

/** South of the planted garden, where the path back to the camp is taken. */
export const EDEN_PATH = { x: 0, z: -76 };

const SPRING = { x: 22, z: 22, r: 3.3 };

/** The river that waters the garden, then the four heads: Pison, Gihon, Hiddekel, Euphrates. */
const STREAMS: readonly [number, number, number, number, number][] = [
  [16, 18, 0, 8, 1.5],
  [22, 22, 60, 48, 2.5],
  [22, 22, 54, 4, 2.2],
  [22, 22, 74, 26, 2.1],
  [22, 22, 24, 64, 2.3],
];

const WALK: readonly [number, number][] = [
  [0, -86],
  [0, -66],
  ...EDEN_PLACEMENTS.map((p) => [p.x, p.z] as [number, number]),
];

function rng(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function distSeg(x: number, z: number, ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax;
  const dz = bz - az;
  const len2 = dx * dx + dz * dz;
  const t = len2 < 1e-6 ? 0 : Math.min(1, Math.max(0, ((x - ax) * dx + (z - az) * dz) / len2));
  return Math.hypot(x - (ax + dx * t), z - (az + dz * t));
}

function mix(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function smooth(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function waterDist(x: number, z: number): number {
  let best = Math.max(0, Math.hypot(x - SPRING.x, z - SPRING.z) - SPRING.r);
  for (const [ax, az, bx, bz, width] of STREAMS) {
    best = Math.min(best, Math.max(0, distSeg(x, z, ax, az, bx, bz) - width / 2));
  }
  return best;
}

function pathDist(x: number, z: number): number {
  let best = 999;
  for (let i = 1; i < WALK.length; i++) {
    const [ax, az] = WALK[i - 1];
    const [bx, bz] = WALK[i];
    best = Math.min(best, distSeg(x, z, ax, az, bx, bz));
  }
  return best;
}

/** Grass in the planting, dust in the field, sand at the sabbath court, and the four rivers. */
function edenColor(x: number, z: number): RGB {
  const garden = Math.hypot(x - 2, z - 16);
  let c: RGB = mix([112, 118, 72], [78, 124, 58], 1 - smooth(18, 42, garden));
  if (x < -14 && z < 8) c = mix(c, [168, 146, 96], smooth(-8, -22, x) * smooth(10, -6, z));
  if (z < -26) c = mix(c, [154, 136, 96], smooth(-26, -40, z));
  if (x > 44 && z > 30) c = mix(c, [186, 156, 78], smooth(44, 58, x) * smooth(30, 42, z));
  const rim = Math.hypot(x, z - 8);
  if (rim > 78) c = mix(c, [132, 122, 78], smooth(78, 120, rim));
  const bank = waterDist(x, z);
  if (bank < 5) c = mix(c, [58, 92, 64], 1 - smooth(1.2, 5, bank));
  const worn = pathDist(x, z);
  if (worn < 2.6 && bank > 1.1) c = mix(c, [138, 112, 72], 1 - smooth(1.1, 2.6, worn));
  if (bank < 1.15) c = mix([42, 96, 112], [28, 72, 88], smooth(0, 1.15, bank));
  return c;
}

function paintEden(scene: Scene): StandardMaterial {
  const size = 1024;
  const span = 360;
  const tex = new DynamicTexture("eden-ground-tex", { width: size, height: size }, scene, false);
  const ctx = tex.getContext() as unknown as CanvasRenderingContext2D;
  const img = ctx.createImageData(size, size);
  const data = img.data;
  for (let y = 0; y < size; y++) {
    const z = (y / (size - 1) - 0.5) * span;
    for (let x = 0; x < size; x++) {
      const wx = (x / (size - 1) - 0.5) * span;
      const c = edenColor(wx, z);
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
  const mat = new StandardMaterial("eden-ground", scene);
  mat.diffuseTexture = tex;
  mat.specularColor = new Color3(0.04, 0.04, 0.03);
  return mat;
}

/**
 * The garden of Genesis 2.
 * South is the seventh day, west the field before rain, the midst the two trees,
 * and the river east of them parts toward Havilah, Gihon, Hiddekel, and the Euphrates.
 * The verses open in that order along the worn path.
 */
export function buildEden(scene: Scene, pal: Palette): World {
  const colliders: { minX: number; maxX: number; minZ: number; maxZ: number; solid: boolean }[] = [];
  const statics: Mesh[] = [];
  const rand = rng(202);
  const heightAt = () => 0;

  const solidBox = (x: number, z: number, w: number, d: number) => {
    for (const p of EDEN_PLACEMENTS) {
      const dx = Math.max(Math.abs(p.x - x) - w / 2, 0);
      const dz = Math.max(Math.abs(p.z - z) - d / 2, 0);
      const gap = Math.hypot(dx, dz);
      if (gap < 1.35) throw new Error(`Verse ${p.verse} is ${gap.toFixed(2)} m from a collider at ${x}, ${z}`);
    }
    colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, solid: true });
  };
  const keep = (mesh: Mesh, mat: StandardMaterial): Mesh => {
    mesh.material = mat;
    statics.push(mesh);
    return mesh;
  };
  const box = (x: number, y: number, z: number, w: number, h: number, d: number, mat: StandardMaterial, solid = false, rotY = 0) => {
    const b = keep(MeshBuilder.CreateBox("box", { width: w, height: h, depth: d }, scene), mat);
    b.position.set(x, y, z);
    b.rotation.y = rotY;
    if (solid) solidBox(x, z, w, d);
    return b;
  };
  const cyl = (x: number, y: number, z: number, h: number, dTop: number, dBottom: number, mat: StandardMaterial, tess = 10) => {
    const c = keep(MeshBuilder.CreateCylinder("cyl", { height: h, diameterTop: dTop, diameterBottom: dBottom, tessellation: tess }, scene), mat);
    c.position.set(x, y, z);
    return c;
  };
  const ball = (x: number, y: number, z: number, d: number, mat: StandardMaterial, seg = 8) => {
    const s = keep(MeshBuilder.CreateSphere("ball", { diameter: d, segments: seg }, scene), mat);
    s.position.set(x, y, z);
    return s;
  };

  const stone = pal.mat("stone", [0.68, 0.62, 0.53], "grain", 2);
  const ashlar = pal.mat("ashlar", [0.74, 0.67, 0.57], "ashlar");
  const darkStone = pal.mat("dark-stone", [0.45, 0.42, 0.39], "grain", 1.5);
  const wood = pal.mat("wood", [0.45, 0.31, 0.19], "wood");
  const darkWood = pal.mat("dark-wood", [0.3, 0.2, 0.12], "wood");
  const palmLeaf = pal.mat("palm-leaf", [0.3, 0.48, 0.2], "grain");
  const shrub = pal.mat("shrub", [0.42, 0.45, 0.25], "grain");
  const dryGrass = pal.mat("dry-grass", [0.62, 0.55, 0.32], "grain");
  const cypress = pal.mat("cypress", [0.16, 0.3, 0.17], "grain", 2);
  const clay = pal.mat("clay", [0.68, 0.4, 0.25], "grain");
  const soil = pal.mat("eden-soil", [0.36, 0.26, 0.14], "grain");
  const lifeLeaf = pal.mat("eden-life", [0.46, 0.66, 0.3], "grain");
  const knowledgeLeaf = pal.mat("eden-knowledge", [0.2, 0.32, 0.16], "grain");
  const apple = pal.mat("eden-apple", [0.62, 0.18, 0.12]);
  const plum = pal.mat("eden-plum", [0.42, 0.16, 0.38]);
  const lifeFruit = pal.glow("eden-life-fruit", [0.95, 0.82, 0.4]);
  const knowledgeFruit = pal.mat("eden-knowledge-fruit", [0.46, 0.05, 0.07]);
  const gold = pal.mat("eden-gold", [0.78, 0.62, 0.22], "grain");
  const amber = pal.mat("eden-amber", [0.72, 0.46, 0.18]);
  const onyx = pal.mat("eden-onyx", [0.16, 0.16, 0.18]);
  const onyxBand = pal.mat("eden-onyx-band", [0.82, 0.8, 0.74]);
  const linen = pal.mat("eden-linen", [0.78, 0.74, 0.62], "cloth");
  const mist = pal.mat("eden-mist", [0.8, 0.86, 0.82]);
  mist.alpha = 0.42;
  const breath = pal.glow("eden-breath", [0.7, 0.86, 0.95]);
  const bloom = pal.mat("eden-bloom", [0.9, 0.88, 0.74]);
  const bloomGold = pal.mat("eden-bloom-gold", [0.86, 0.7, 0.28]);
  const bird = pal.mat("eden-bird", [0.38, 0.24, 0.14]);
  const capGold = pal.mat("eden-cap-gold", [0.84, 0.68, 0.28]);
  const capGreen = pal.mat("eden-cap-green", [0.2, 0.36, 0.24]);
  const capBlue = pal.mat("eden-cap-blue", [0.28, 0.4, 0.5]);

  const ground = MeshBuilder.CreateGround("ground", { width: 360, height: 360, subdivisions: 2 }, scene);
  ground.material = paintEden(scene);

  const clear = (x: number, z: number, r: number) =>
    EDEN_PLACEMENTS.every((p) => Math.hypot(p.x - x, p.z - z) >= r) &&
    Math.hypot(x - 2, z - 6) >= r &&
    Math.hypot(x - 2, z - 60) >= r &&
    Math.hypot(x, z + 66) >= 3 &&
    Math.hypot(x, z + 76) >= 2.4;

  // Sabbath court. The first four verses stand here, in order.
  box(0, 0.04, -52, 3.4, 0.06, 1.7, ashlar);
  for (const x of [-5.2, 5.2]) {
    box(x, 1.35, -52, 0.55, 2.7, 0.55, ashlar, true);
    box(x, 2.85, -52, 0.85, 0.28, 0.85, stone);
  }
  box(-15.4, 0.28, -44, 1.7, 0.5, 0.85, stone, true);
  box(-15.4, 0.58, -44, 1.5, 0.1, 0.7, ashlar);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const h = 0.7 + (i % 3) * 0.28;
    box(10 + Math.cos(a) * 4.6, h / 2, -44 + Math.sin(a) * 4.6, 0.5, h, 0.38, i % 2 ? darkStone : stone, true);
  }
  box(-2.55, 1.65, -34, 0.48, 3.3, 0.48, ashlar, true);
  box(2.55, 1.65, -34, 0.48, 3.3, 0.48, ashlar, true);
  box(0, 3.45, -34, 6.3, 0.42, 0.72, ashlar);
  box(4.4, 0.85, -31.2, 0.7, 1.7, 0.28, darkStone, true);
  for (const y of [0.45, 0.8, 1.15]) box(4.4, y, -31.02, 0.42, 0.06, 0.06, onyxBand);

  // The field before rain, then the mound of dust.
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const r = 2.5 + (i % 3) * 0.55;
    const puff = ball(-46 + Math.cos(a) * r, 0.4 + (i % 2) * 0.35, -16 + Math.sin(a) * r, 1.15 + (i % 3) * 0.25, mist, 6);
    puff.scaling.y = 0.4;
  }
  for (const [dx, dz, s] of [
    [0, 0, 1.7],
    [0.75, 0.35, 1.15],
    [-0.65, 0.25, 0.95],
    [0.25, -0.7, 1.05],
  ] as const) {
    const clod = ball(-39 + dx, s * 0.22, -4 + dz, s, clay, 8);
    clod.scaling.y = 0.42;
  }
  ball(-39, 1.15, -4, 0.28, breath, 6);
  cyl(-24, 0.35, -20, 0.7, 0.35, 0.5, darkWood, 7);
  ball(-24, 0.7, -20, 0.55, dryGrass, 6);

  // Gate into the planting.
  for (const x of [-12, 0]) {
    box(x, 1.55, -1, 0.5, 3.1, 0.5, ashlar, true);
    cyl(x, 3.2, -1, 0.7, 0.12, 0.16, darkWood, 6);
  }
  box(-6, 3.15, -1, 12.4, 0.28, 0.55, wood);

  const fruitTree = (x: number, z: number, scale = 1) => {
    cyl(x, 1.15 * scale, z, 2.3 * scale, 0.16 * scale, 0.34 * scale, darkWood, 8);
    const canopy = ball(x, 2.55 * scale, z, 2.3 * scale, palmLeaf, 8);
    canopy.scaling.y = 0.72;
    ball(x + 0.7 * scale, 2.2 * scale, z + 0.25 * scale, 1.5 * scale, shrub, 7);
    ball(x - 0.55 * scale, 2.35 * scale, z - 0.35 * scale, 1.3 * scale, palmLeaf, 7);
    for (let k = 0; k < 4; k++) {
      const a = rand() * Math.PI * 2;
      const radius = (0.35 + rand() * 0.65) * scale;
      ball(x + Math.cos(a) * radius, 2.05 * scale + rand() * 0.45, z + Math.sin(a) * radius, 0.16, k % 2 ? apple : plum, 5);
    }
    solidBox(x, z, 0.7, 0.7);
  };
  fruitTree(-20, 18, 1.35);
  ball(-17.4, 2.5, 16.7, 2.8, palmLeaf, 7);
  fruitTree(-24, 6);
  fruitTree(-10, 26);
  fruitTree(8, -2);
  fruitTree(24, 12);
  fruitTree(-14, 8);

  const cypressTree = (x: number, z: number, h = 6.2) => {
    cyl(x, h * 0.55, z, h, 0.08, h * 0.22, cypress, 10);
    cyl(x, h * 0.82, z, h * 0.4, 0.02, h * 0.08, cypress, 8);
    cyl(x, 0.4, z, 0.8, 0.2, 0.28, darkWood, 7);
    solidBox(x, z, 0.7, 0.7);
  };
  for (const [x, z, h] of [
    [-18, -54, 5.4],
    [18, -54, 6.4],
    [-20, -32, 5.8],
    [20, -36, 6.6],
    [-14, 54, 6.8],
    [16, 54, 6.2],
    [-14, 72, 5.6],
    [18, 66, 7],
    [2, 88, 6.4],
    [-32, 22, 5.2],
    [-48, 36, 6.6],
    [-30, 50, 5.8],
    [42, -16, 5.4],
    [-62, -36, 6.2],
    [78, 18, 7.2],
    [48, 72, 6],
    [-24, 84, 5.6],
    [-6, -72, 5.2],
    [6, -72, 6.4],
  ] as const) {
    cypressTree(x, z, h);
  }

  // The two trees in the midst.
  cyl(-2, 2.7, 18, 5.4, 0.22, 0.55, darkWood, 10);
  ball(-2, 5.4, 18, 3.5, lifeLeaf, 9);
  ball(-0.8, 4.7, 18.5, 2.3, lifeLeaf, 8);
  ball(-3, 4.9, 17.4, 2.1, palmLeaf, 8);
  ball(-2, 6.5, 18, 1.7, lifeLeaf, 8);
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2;
    ball(-2 + Math.cos(a) * 1.15, 4.7 + (k % 3) * 0.5, 18 + Math.sin(a) * 1.15, 0.24, lifeFruit, 6);
  }
  solidBox(-2, 18, 0.85, 0.85);

  cyl(10, 2.35, 16, 4.7, 0.18, 0.5, darkWood, 10);
  const lean = cyl(10.2, 2.5, 16, 4.3, 0.12, 0.28, darkWood, 8);
  lean.rotation.z = 0.12;
  ball(10, 4.8, 16, 3.2, knowledgeLeaf, 9);
  ball(10.9, 4.3, 15.5, 2.1, knowledgeLeaf, 8);
  ball(9.2, 4.4, 16.6, 1.8, shrub, 7);
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + 0.5;
    ball(10 + Math.cos(a) * 1.05, 4.2 + (k % 2) * 0.45, 16 + Math.sin(a) * 1.05, 0.22, knowledgeFruit, 6);
  }
  solidBox(10, 16, 0.85, 0.85);

  // Worked beds, where the man was set to keep the garden.
  for (const z of [1.5, 6.5, 11]) {
    box(19.5, 0.05, z, 3.2, 0.08, 1.1, soil);
    for (let i = 0; i < 4; i++) {
      const sprout = cyl(18.2 + i * 0.7, 0.28, z, 0.5, 0, 0.08, palmLeaf, 4);
      sprout.rotation.z = (i - 1.5) * 0.15;
    }
  }
  cyl(17.2, 0.28, 8.6, 0.35, 0.34, 0.28, wood, 8);
  cyl(17.2, 0.7, 8.6, 0.9, 0.05, 0.05, darkWood, 5);
  box(17.2, 1.15, 8.6, 0.34, 0.08, 0.16, darkWood, false, 0.4);

  // River, spring, and the four heads.
  const waterMat = new StandardMaterial("eden-water", scene);
  waterMat.diffuseColor = new Color3(0.16, 0.4, 0.5);
  waterMat.specularColor = new Color3(0.55, 0.58, 0.58);
  waterMat.specularPower = 48;
  waterMat.emissiveColor = new Color3(0.02, 0.05, 0.07);
  waterMat.alpha = 0.9;
  const waters: Mesh[] = [];
  const wet = (mesh: Mesh) => {
    mesh.material = waterMat;
    waters.push(mesh);
    return mesh;
  };
  const pool = wet(MeshBuilder.CreateCylinder("spring", { height: 0.08, diameter: SPRING.r * 2, tessellation: 28 }, scene));
  pool.position.set(SPRING.x, 0.05, SPRING.z);
  for (const [x0, z0, x1, z1, width] of STREAMS) {
    const dx = x1 - x0;
    const dz = z1 - z0;
    const len = Math.hypot(dx, dz);
    const ribbon = wet(MeshBuilder.CreateBox("river", { width, height: 0.06, depth: len }, scene));
    ribbon.position.set((x0 + x1) / 2, 0.045, (z0 + z1) / 2);
    ribbon.rotation.y = Math.atan2(dx, dz);
  }
  const river = waters.length > 1 ? Mesh.MergeMeshes(waters, true, true) : waters[0];
  if (!river) throw new Error("The rivers of Eden failed to build");
  river.name = "water";

  const head = (x: number, z: number, cap: StandardMaterial) => {
    cyl(x, 0.7, z, 1.4, 0.55, 0.7, stone, 10);
    box(x, 1.5, z, 0.85, 0.22, 0.85, cap);
    solidBox(x, z, 0.8, 0.8);
  };
  head(62, 50, capGold);
  head(56, 2, capGreen);
  head(72, 28, capBlue);
  head(22, 66, ashlar);

  for (const [x, z, s] of [
    [63, 44, 0.7],
    [66, 49, 0.95],
    [61, 50, 0.55],
    [68, 46, 0.4],
  ] as const) {
    const nugget = ball(x, s * 0.28, z, s, gold, 6);
    nugget.scaling.y = 0.55;
    if (s > 0.5) solidBox(x, z, s, s * 0.7);
  }
  ball(65, 0.22, 47, 0.45, amber, 6);
  ball(64.4, 0.16, 47.5, 0.28, amber, 5);
  box(64.2, 0.28, 45.2, 0.55, 0.45, 0.32, onyx, true);
  box(64.2, 0.42, 45.2, 0.57, 0.08, 0.34, onyxBand);

  for (const [x0, z0, x1, z1] of STREAMS) {
    const dx = x1 - x0;
    const dz = z1 - z0;
    const len = Math.hypot(dx, dz);
    const steps = Math.floor(len / 4);
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const cx = x0 + dx * t;
      const cz = z0 + dz * t;
      if (Math.hypot(cx - SPRING.x, cz - SPRING.z) < SPRING.r + 1.5) continue;
      const side = i % 2 === 0 ? 1 : -1;
      const ox = (-dz / len) * side * (1.8 + (i % 3) * 0.25);
      const oz = (dx / len) * side * (1.8 + (i % 3) * 0.25);
      const x = cx + ox;
      const z = cz + oz;
      if (!clear(x, z, 3.2)) continue;
      const h = 0.9 + rand() * 0.7;
      const reed = cyl(x, h / 2, z, h, 0.02, 0.055, shrub, 5);
      reed.rotation.z = (rand() - 0.5) * 0.3;
    }
  }

  // Naming ground and the grove of sleep.
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    box(-28 + Math.cos(a) * 2.2, 0.22, 26 + Math.sin(a) * 2.2, 0.55, 0.4, 0.4, darkStone, true);
  }
  box(-12.2, 0.08, 46.2, 2, 0.1, 1.05, linen);
  box(-12.2, 0.16, 46.6, 0.7, 0.12, 0.35, linen);

  // Westward path, back to the camp.
  const home = box(0, 0.03, -78, 3.2, 0.05, 22, soil);
  home.material = soil;
  box(2.6, 0.9, -80, 0.14, 1.8, 0.14, wood, true);
  box(2.6, 1.6, -80, 1.05, 0.4, 0.08, wood);

  const perch = (x: number, y: number, z: number, yaw: number) => {
    const body = ball(x, y, z, 0.16, bird, 6);
    body.scaling.set(0.75, 0.65, 1.45);
    body.rotation.y = yaw;
    const beak = box(x + Math.sin(yaw) * 0.12, y, z + Math.cos(yaw) * 0.12, 0.04, 0.035, 0.08, gold);
    beak.rotation.y = yaw;
  };
  perch(-32, 4.3, 22, 0.6);
  perch(-19, 3.3, 18.4, 1.2);
  perch(-1, 6.2, 18.2, 0.4);
  perch(11, 5.3, 16.2, -0.8);
  perch(-48, 5.2, 36.4, 2);

  for (let i = 0; i < 42; i++) {
    const x = -20 + rand() * 46;
    const z = -2 + rand() * 36;
    if (!clear(x, z, 4.2)) continue;
    const stem = cyl(x, 0.16, z, 0.28, 0.02, 0.03, shrub, 4);
    stem.rotation.z = (rand() - 0.5) * 0.4;
    ball(x, 0.32, z, 0.16 + rand() * 0.08, rand() < 0.5 ? bloom : bloomGold, 5);
  }
  for (let i = 0; i < 28; i++) {
    const x = -55 + rand() * 30;
    const z = -40 + rand() * 40;
    if (!clear(x, z, 4)) continue;
    for (let k = 0; k < 3; k++) {
      const blade = cyl(x + (rand() - 0.5) * 0.3, 0.26, z + (rand() - 0.5) * 0.3, 0.5, 0, 0.06, dryGrass, 4);
      blade.rotation.z = (rand() - 0.5) * 0.6;
    }
  }
  for (let i = 0; i < 36; i++) {
    const x = (rand() - 0.5) * 180;
    const z = (rand() - 0.4) * 180;
    if (!clear(x, z, 6) || Math.hypot(x - 2, z - 16) < 26) continue;
    const s = 0.35 + rand() * 0.9;
    const rock = ball(x, s * 0.2, z, s, rand() < 0.5 ? stone : darkStone, 5);
    rock.scaling.set(1 + rand() * 0.6, 0.55, 1);
    if (s > 0.7) solidBox(x, z, s, s * 0.8);
  }
  for (let i = 0; i < 24; i++) {
    const x = (rand() - 0.5) * 150;
    const z = -10 + rand() * 100;
    if (!clear(x, z, 5) || (x > -24 && x < 28 && z > -4 && z < 40)) continue;
    const b = ball(x, 0.32, z, 0.7 + rand() * 0.4, shrub, 6);
    b.scaling.y = 0.5;
  }

  const groups = new Map<StandardMaterial, Mesh[]>();
  for (const mesh of statics) {
    const key = mesh.material as StandardMaterial;
    const list = groups.get(key) ?? [];
    list.push(mesh);
    groups.set(key, list);
  }
  const scenery: Mesh[] = [river];
  for (const list of groups.values()) {
    const merged = list.length > 1 ? Mesh.MergeMeshes(list, true, true) : list[0];
    merged?.freezeWorldMatrix();
    if (merged) scenery.push(merged);
  }

  const folk: Rig[] = [];
  const wanderers: Wanderer[] = [];
  const placeRig = (rig: Rig, x: number, z: number, faceY = 0) => {
    rig.root.position.set(x, 0, z);
    rig.root.rotation.y = faceY;
    return rig;
  };
  const adam = placeRig(
    buildPerson(scene, pal, "adam", {
      robe: [0.42, 0.34, 0.22],
      trim: [0.58, 0.44, 0.24],
      head: [0.55, 0.4, 0.28],
      beard: [0.28, 0.18, 0.12],
      headwear: "wrap",
      staff: true,
    }),
    2,
    6,
    Math.PI,
  );
  const eve = placeRig(
    buildPerson(scene, pal, "eve", {
      robe: [0.72, 0.64, 0.5],
      trim: [0.55, 0.32, 0.28],
      head: [0.62, 0.46, 0.36],
      headwear: "wrap",
      scale: 0.96,
    }),
    2,
    60,
    Math.PI,
  );
  for (const rig of [adam, eve]) solidBox(rig.root.position.x, rig.root.position.z, 0.8, 0.8);
  folk.push(adam, eve);

  const pace = (kind: BeastKind, ax: number, az: number, bx: number, bz: number, rate: number) => {
    const rig = buildBeast(scene, pal, `beast-${kind}-${wanderers.length}`, kind);
    rig.root.position.set(ax, 0, az);
    wanderers.push({ rig, ax, az, bx, bz, phase: rand() * 6, rate });
  };
  const sit = (kind: BeastKind, x: number, z: number, face = 0) => {
    const rig = buildBeast(scene, pal, `beast-${kind}-${folk.length}`, kind);
    rig.root.position.set(x, 0, z);
    rig.root.rotation.y = face;
    folk.push(rig);
  };
  pace("sheep", -32, 16, -28, 26, 0.32);
  pace("calf", -48, 34, -48, 52, 0.28);
  pace("camel", 20, 6, 28, 14, 0.18);
  pace("dog", 14, -36, 18, -50, 0.55);
  pace("sheep", 18, 60, 22, 76, 0.26);
  pace("calf", -6, 8, -16, 4, 0.3);
  sit("sheep", -44, 38, 0.4);
  sit("calf", -34, 48, 1.2);
  sit("cat", -28, 36, 0.8);
  sit("dog", 6, -58, Math.PI);

  return {
    colliders,
    ground,
    door: null,
    doorBox: null,
    key: null,
    jar: null,
    horse: null,
    miriam: null,
    eli: null,
    tobias: null,
    watchman: null,
    folk,
    wanderers,
    scenery,
    heightAt,
  };
}
