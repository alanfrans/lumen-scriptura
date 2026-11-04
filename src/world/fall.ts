import { Color3, DynamicTexture, Light, Mesh, MeshBuilder, PointLight, Scene, StandardMaterial, Vector3 } from "@babylonjs/core";
import type { Palette, RGB } from "../art/materials";
import { buildBeast, buildPerson, type BeastKind, type Rig } from "../art/models";
import { EAST_OF_EDEN_PLACEMENTS } from "../data/layout";
import type { Wanderer, World } from "./world";

/** West end of this ground, where the path back to the garden is taken. */
export const FALL_WEST = { x: -80, z: 2.6 };

/** Where the sword stands, and where the Hope Beacon rises once the chapter is sealed. */
export const FALL_GATE = { x: 102, z: 0 };

const TREE = { x: -40, z: 2 };
const LIFE = { x: 90, z: 18 };

function rng(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function mix(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function smooth(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/**
 * Garden green in the west, a cooler shade where they hide,
 * then thorns, then the pale ground outside the gate.
 */
function fallColor(x: number, z: number): RGB {
  let c: RGB = [92, 122, 64];
  if (x > -16) c = mix(c, [74, 108, 86], smooth(-16, 18, x));
  if (x > 28) c = mix(c, [118, 108, 70], smooth(28, 52, x));
  if (x > 54) c = mix(c, [146, 122, 74], smooth(54, 84, x));
  if (x > 100) c = mix(c, [176, 148, 96], smooth(100, 116, x));
  const rim = Math.hypot(x - 20, z);
  if (rim > 78) c = mix(c, [132, 116, 74], smooth(78, 120, rim));
  const dust = Math.hypot(x - 42, z - 2);
  if (dust < 9 && x < 96) c = mix(c, [158, 132, 88], 1 - smooth(2.2, 9, dust));
  if (Math.abs(z) < 3.4 && x > -82 && x < 108) c = mix(c, [128, 100, 66], 1 - smooth(1.15, 3.4, Math.abs(z)));
  return c;
}

function paintFall(scene: Scene): StandardMaterial {
  const size = 1024;
  const span = 360;
  const tex = new DynamicTexture("fall-ground-tex", { width: size, height: size }, scene, false);
  const ctx = tex.getContext() as unknown as CanvasRenderingContext2D;
  const img = ctx.createImageData(size, size);
  const data = img.data;
  for (let y = 0; y < size; y++) {
    const z = (y / (size - 1) - 0.5) * span;
    for (let x = 0; x < size; x++) {
      const wx = (x / (size - 1) - 0.5) * span;
      const c = fallColor(wx, z);
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
  const mat = new StandardMaterial("fall-ground", scene);
  mat.diffuseTexture = tex;
  mat.specularColor = new Color3(0.04, 0.04, 0.03);
  return mat;
}

/**
 * Genesis 3, east of the garden.
 * West is the way back. The serpent's tree, the fig leaves, and the cool of the day
 * stand along the path. The ground dries into thorns, and the east gate
 * keeps the tree of life with a sword that turns.
 * The verses open in the evening, in any order.
 */
export function buildFall(scene: Scene, pal: Palette): World {
  const colliders: { minX: number; maxX: number; minZ: number; maxZ: number; solid: boolean }[] = [];
  const statics: Mesh[] = [];
  const rand = rng(303);
  const heightAt = () => 0;

  const solidBox = (x: number, z: number, w: number, d: number) => {
    for (const p of EAST_OF_EDEN_PLACEMENTS) {
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
  const shrub = pal.mat("shrub", [0.42, 0.45, 0.25], "grain");
  const dryGrass = pal.mat("dry-grass", [0.62, 0.55, 0.32], "grain");
  const cypressMat = pal.mat("cypress", [0.16, 0.3, 0.17], "grain", 2);
  const clay = pal.mat("clay", [0.68, 0.4, 0.25], "grain");
  const soil = pal.mat("fall-soil", [0.4, 0.28, 0.16], "grain");
  const leaf = pal.mat("fall-leaf", [0.28, 0.42, 0.2], "grain");
  const figLeaf = pal.mat("fall-fig", [0.34, 0.5, 0.22], "grain");
  const knowledgeLeaf = pal.mat("fall-knowledge", [0.18, 0.28, 0.14], "grain");
  const lifeLeaf = pal.mat("fall-life", [0.42, 0.58, 0.26], "grain");
  const fruit = pal.mat("fall-fruit", [0.62, 0.14, 0.1]);
  const lifeFruit = pal.glow("fall-life-fruit", [0.95, 0.78, 0.32]);
  const scale = pal.mat("fall-scale", [0.3, 0.38, 0.18], "grain");
  const scaleDark = pal.mat("fall-scale-dark", [0.16, 0.2, 0.1], "grain");
  const feather = pal.mat("fall-feather", [0.9, 0.86, 0.74], "cloth");
  const gold = pal.mat("fall-gold", [0.78, 0.62, 0.22], "metal");
  const hide = pal.mat("fall-hide", [0.5, 0.34, 0.2], "fur");
  const thorn = pal.mat("fall-thorn", [0.42, 0.34, 0.18], "wood");
  const mist = pal.mat("fall-mist", [0.76, 0.84, 0.88]);
  mist.alpha = 0.4;
  const swordFire = pal.glow("fall-sword", [1, 0.46, 0.12]);
  const swordCore = pal.glow("fall-sword-core", [1, 0.86, 0.55]);
  const haloMat = pal.glow("fall-halo", [0.95, 0.82, 0.45]);
  const bloom = pal.mat("fall-bloom", [0.82, 0.78, 0.7]);
  const bird = pal.mat("fall-bird", [0.32, 0.22, 0.14]);

  const ground = MeshBuilder.CreateGround("ground", { width: 360, height: 360, subdivisions: 2 }, scene);
  ground.material = paintFall(scene);
  ground.receiveShadows = true;

  const clear = (x: number, z: number, r: number) =>
    EAST_OF_EDEN_PLACEMENTS.every((p) => Math.hypot(p.x - x, p.z - z) >= r) &&
    Math.hypot(x - TREE.x, z - TREE.z) >= r &&
    Math.hypot(x - LIFE.x, z - LIFE.z) >= r &&
    Math.hypot(x - FALL_GATE.x, z - FALL_GATE.z) >= r + 1.5 &&
    Math.hypot(x - FALL_WEST.x, z - FALL_WEST.z) >= 2.6 &&
    Math.hypot(x - 10, z - 6) >= r &&
    Math.hypot(x - 18, z + 4) >= r;

  // The way back, on the west. The garden is behind the sign.
  box(-74, 0.03, 0, 28, 0.05, 2.8, soil);
  box(FALL_WEST.x, 0.9, FALL_WEST.z, 0.14, 1.8, 0.14, wood, true);
  box(FALL_WEST.x, 1.62, FALL_WEST.z, 1.2, 0.42, 0.08, wood);

  const fruitTree = (x: number, z: number, scaleN = 1) => {
    cyl(x, 1.15 * scaleN, z, 2.3 * scaleN, 0.16 * scaleN, 0.34 * scaleN, darkWood, 8);
    const canopy = ball(x, 2.55 * scaleN, z, 2.3 * scaleN, leaf, 8);
    canopy.scaling.y = 0.72;
    ball(x + 0.65 * scaleN, 2.2 * scaleN, z + 0.2 * scaleN, 1.45 * scaleN, shrub, 7);
    ball(x - 0.5 * scaleN, 2.3 * scaleN, z - 0.3 * scaleN, 1.25 * scaleN, leaf, 7);
    for (let k = 0; k < 3; k++) {
      const a = rand() * Math.PI * 2;
      const radius = (0.4 + rand() * 0.55) * scaleN;
      ball(x + Math.cos(a) * radius, 2.05 * scaleN + rand() * 0.4, z + Math.sin(a) * radius, 0.15, fruit, 5);
    }
    solidBox(x, z, 0.7, 0.7);
  };
  fruitTree(-62, 16, 1.15);
  fruitTree(-54, -18, 1.05);
  fruitTree(-32, -18);

  const cypressTree = (x: number, z: number, h = 6) => {
    cyl(x, h * 0.55, z, h, 0.08, h * 0.2, cypressMat, 10);
    cyl(x, h * 0.82, z, h * 0.38, 0.02, h * 0.08, cypressMat, 8);
    cyl(x, 0.4, z, 0.8, 0.2, 0.26, darkWood, 7);
    solidBox(x, z, 0.7, 0.7);
  };
  for (const [x, z, h] of [
    [-72, 22, 5.6],
    [-70, -20, 6.4],
    [-56, 28, 6.8],
    [-52, -26, 5.4],
    [-34, 30, 6.2],
    [-28, -22, 5.8],
    [-8, 26, 6.6],
    [8, 28, 5.6],
    [24, 26, 6.4],
    [36, -22, 5.2],
    [52, 26, 6],
    [-78, -8, 5.4],
  ] as const) {
    cypressTree(x, z, h);
  }

  // The tree of the knowledge of good and evil, and the serpent in it.
  cyl(TREE.x, 2.6, TREE.z, 5.2, 0.22, 0.55, darkWood, 10);
  const lean = cyl(TREE.x + 0.15, 2.7, TREE.z, 4.4, 0.12, 0.28, darkWood, 8);
  lean.rotation.z = -0.1;
  ball(TREE.x, 5.1, TREE.z, 3.4, knowledgeLeaf, 9);
  ball(TREE.x + 0.9, 4.5, TREE.z - 0.4, 2.2, knowledgeLeaf, 8);
  ball(TREE.x - 0.8, 4.6, TREE.z + 0.5, 1.9, shrub, 7);
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    ball(TREE.x + Math.cos(a) * 1.15, 4.3 + (k % 3) * 0.4, TREE.z + Math.sin(a) * 1.15, 0.22, fruit, 6);
  }
  solidBox(TREE.x, TREE.z, 0.9, 0.9);
  const bitten = ball(-26.2, 0.12, -5.6, 0.2, fruit, 6);
  bitten.scaling.y = 0.75;

  const wind = (cx: number, cy: number, cz: number) => {
    const turns = 3.25;
    const path: Vector3[] = [];
    const steps = 52;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const a = t * turns * Math.PI * 2;
      const r = 0.95 - t * 0.4;
      path.push(new Vector3(cx + Math.cos(a) * r, cy + t * 3.3, cz + Math.sin(a) * r));
    }
    keep(MeshBuilder.CreateTube("serpent", { path, radius: 0.1, tessellation: 8, cap: Mesh.CAP_ALL }, scene), scale);
    const end = path[path.length - 1];
    const head = ball(end.x, end.y, end.z, 0.28, scaleDark, 7);
    head.scaling.set(0.8, 0.7, 1.4);
    const look = Math.atan2(end.x - cx, end.z - cz);
    head.rotation.y = look;
    for (const side of [-1, 1]) {
      ball(end.x + Math.cos(look) * 0.08 + side * 0.07, end.y + 0.06, end.z + Math.sin(look) * 0.08, 0.045, darkStone, 5);
    }
  };
  wind(TREE.x, 0.45, TREE.z);

  // Fig trees, and the aprons sewn from their leaves.
  const figTree = (x: number, z: number) => {
    cyl(x, 1.05, z, 2.1, 0.18, 0.4, darkWood, 8);
    const canopy = ball(x, 2.35, z, 2.6, figLeaf, 8);
    canopy.scaling.set(1.25, 0.62, 1.25);
    ball(x + 0.7, 2.05, z + 0.3, 1.5, figLeaf, 7);
    ball(x - 0.55, 2.1, z - 0.4, 1.3, leaf, 7);
    solidBox(x, z, 0.75, 0.75);
  };
  figTree(-18, 8);
  figTree(-6, 14);
  const apron = (x: number, y: number, z: number, yaw: number) => {
    const cloth = box(x, y, z, 0.55, 0.7, 0.06, figLeaf, false, yaw);
    cloth.rotation.z = 0.08;
    box(x, y + 0.38, z, 0.5, 0.06, 0.08, shrub, false, yaw);
  };
  apron(-17.3, 1.25, 8.5, 0.4);
  apron(-16.6, 1.15, 7.6, -0.5);
  box(-8.2, 0.04, 6.2, 0.7, 0.04, 0.45, figLeaf, false, 0.3);

  // The grove where they hid, in the cool of the day.
  const groveTree = (x: number, z: number, s = 1) => {
    cyl(x, 1.3 * s, z, 2.6 * s, 0.16 * s, 0.38 * s, darkWood, 8);
    ball(x, 2.9 * s, z, 2.4 * s, leaf, 8);
    ball(x + 0.75 * s, 2.45 * s, z + 0.3 * s, 1.6 * s, cypressMat, 7);
    ball(x - 0.6 * s, 2.5 * s, z - 0.35 * s, 1.4 * s, shrub, 7);
    solidBox(x, z, 0.75, 0.75);
  };
  groveTree(-2, 0, 1.15);
  groveTree(4, -2, 1.05);
  groveTree(14, -8);
  groveTree(30, 20, 1.1);
  groveTree(32, -8, 0.95);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const puff = ball(12 + Math.cos(a) * (3.5 + (i % 3)), 0.55 + (i % 2) * 0.35, 2 + Math.sin(a) * (2.4 + (i % 2)), 1.3, mist, 6);
    puff.scaling.y = 0.38;
  }

  // The curse: a serpent on its belly, then thorns, then dust.
  const crawl: Vector3[] = [];
  for (let i = 0; i <= 18; i++) {
    const t = i / 18;
    crawl.push(new Vector3(40.2 + t * 2.8, 0.1 + Math.sin(t * Math.PI) * 0.06, 0.2 + Math.sin(t * 6) * 0.32));
  }
  keep(MeshBuilder.CreateTube("serpent-belly", { path: crawl, radius: 0.09, tessellation: 7, cap: Mesh.CAP_ALL }, scene), scale);
  const nose = crawl[crawl.length - 1];
  const lowHead = ball(nose.x, 0.22, nose.z, 0.24, scaleDark, 6);
  lowHead.scaling.set(0.8, 0.55, 1.35);
  for (let i = 0; i < 6; i++) {
    const clod = ball(41 + (i % 3) * 0.7, 0.1, 1.4 - (i % 2) * 0.8, 0.45 + (i % 3) * 0.1, clay, 6);
    clod.scaling.y = 0.4;
  }

  const thornBush = (x: number, z: number, s = 1) => {
    for (let k = 0; k < 4; k++) {
      const stem = cyl(x, 0.35 * s, z, 0.75 * s, 0.02, 0.05, thorn, 4);
      stem.rotation.z = 0.4 + k * 0.35;
      stem.rotation.y = k * 0.8;
    }
    const dry = ball(x, 0.28 * s, z, 0.45 * s, dryGrass, 5);
    dry.scaling.y = 0.45;
  };
  for (const [x, z] of [
    [56, -14],
    [50, 20],
    [70, -16],
    [80, 16],
    [86, -10],
    [108, -8],
    [118, 16],
    [120, -4],
  ] as const) {
    thornBush(x, z, 1.15);
  }

  for (const [dx, dz, s] of [
    [0, 0, 1.5],
    [0.7, 0.35, 1],
    [-0.45, 0.2, 0.85],
  ] as const) {
    const clod = ball(77 + dx, s * 0.2, 11 + dz, s, clay, 7);
    clod.scaling.y = 0.4;
  }

  // Eve's name, and the coats of skins.
  box(64.8, 0.18, 22.4, 0.7, 0.32, 0.45, darkStone, true);
  for (const x of [85.2, 87.4]) box(x, 1.05, -16.4, 0.1, 2.1, 0.1, wood, true);
  box(86.3, 2.05, -16.4, 2.5, 0.1, 0.1, wood);
  for (const [x, yaw] of [
    [85.6, 0.15],
    [86.8, -0.2],
  ] as const) {
    const coat = ball(x, 1.25, -16.2, 0.95, hide, 7);
    coat.scaling.set(0.55, 1.15, 0.22);
    coat.rotation.y = yaw;
  }

  // The tree of life, still inside, kept from the hand.
  cyl(LIFE.x, 2.5, LIFE.z, 5, 0.2, 0.5, darkWood, 10);
  ball(LIFE.x, 5, LIFE.z, 3.2, lifeLeaf, 9);
  ball(LIFE.x + 0.7, 4.4, LIFE.z + 0.4, 2, lifeLeaf, 8);
  ball(LIFE.x - 0.6, 4.5, LIFE.z - 0.3, 1.7, leaf, 7);
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2;
    ball(LIFE.x + Math.cos(a) * 1.1, 4.5 + (k % 3) * 0.45, LIFE.z + Math.sin(a) * 1.1, 0.22, lifeFruit, 6);
  }
  solidBox(LIFE.x, LIFE.z, 0.85, 0.85);

  // The east gate: two pillars, two cherubim, and the sword that turns.
  for (const z of [6.8, -6.8]) {
    box(FALL_GATE.x, 2.3, z, 1.35, 4.6, 1.35, ashlar, true);
    box(FALL_GATE.x, 4.75, z, 1.7, 0.32, 1.7, stone);
  }
  for (let i = -2; i <= 2; i++) {
    box(FALL_GATE.x, 5.05, i * 2.6, 1.45, 0.48, 2.5, ashlar);
  }

  const sword = new Mesh("sword", scene);
  sword.position.set(FALL_GATE.x, 0, FALL_GATE.z);
  const blade = MeshBuilder.CreateBox("sword-blade", { width: 0.16, height: 2.7, depth: 0.05 }, scene);
  blade.parent = sword;
  blade.position.y = 2.15;
  blade.material = swordFire;
  const core = MeshBuilder.CreateBox("sword-core", { width: 0.05, height: 2.35, depth: 0.07 }, scene);
  core.parent = sword;
  core.position.y = 2.2;
  core.material = swordCore;
  const guard = MeshBuilder.CreateBox("sword-guard", { width: 0.72, height: 0.08, depth: 0.12 }, scene);
  guard.parent = sword;
  guard.position.y = 0.85;
  guard.material = gold;
  const hilt = MeshBuilder.CreateCylinder("sword-hilt", { height: 0.55, diameter: 0.08, tessellation: 8 }, scene);
  hilt.parent = sword;
  hilt.position.y = 0.55;
  hilt.material = darkWood;
  sword.rotation.z = 0.35;

  // Outside the gate, the ground he was sent to till.
  for (const [x, z] of [
    [110, -8],
    [116, -2],
    [120, 4],
    [112, 14],
    [122, 12],
  ] as const) {
    box(x, 0.02, z, 3.4, 0.035, 1.5, soil);
  }
  box(118, 0.2, -6, 0.8, 0.35, 0.3, darkStone, true);

  const perch = (x: number, y: number, z: number, yaw: number) => {
    const body = ball(x, y, z, 0.16, bird, 6);
    body.scaling.set(0.75, 0.65, 1.4);
    body.rotation.y = yaw;
    const beak = box(x + Math.sin(yaw) * 0.12, y, z + Math.cos(yaw) * 0.12, 0.04, 0.03, 0.08, gold);
    beak.rotation.y = yaw;
  };
  perch(TREE.x + 1.2, 5.5, TREE.z, 0.8);
  perch(-18, 3.1, 8.4, 1.4);
  perch(4, 3.4, -2.2, -0.4);
  perch(LIFE.x, 5.6, LIFE.z + 0.4, 2.2);

  for (let i = 0; i < 26; i++) {
    const x = -70 + rand() * 48;
    const z = -16 + rand() * 36;
    if (!clear(x, z, 4)) continue;
    const stem = cyl(x, 0.16, z, 0.28, 0.02, 0.03, shrub, 4);
    stem.rotation.z = (rand() - 0.5) * 0.35;
    ball(x, 0.32, z, 0.14 + rand() * 0.06, rand() < 0.6 ? bloom : fruit, 5);
  }
  for (let i = 0; i < 34; i++) {
    const x = 50 + rand() * 70;
    const z = (rand() - 0.5) * 40;
    if (!clear(x, z, 3.6)) continue;
    thornBush(x, z, 0.75 + rand() * 0.5);
  }
  for (let i = 0; i < 22; i++) {
    const x = -20 + rand() * 70;
    const z = -24 + rand() * 28;
    if (!clear(x, z, 4.5)) continue;
    for (let k = 0; k < 3; k++) {
      const bladeG = cyl(x + (rand() - 0.5) * 0.3, 0.25, z + (rand() - 0.5) * 0.3, 0.5, 0, 0.06, dryGrass, 4);
      bladeG.rotation.z = (rand() - 0.5) * 0.55;
    }
  }
  for (let i = 0; i < 28; i++) {
    const x = (rand() - 0.35) * 200;
    const z = (rand() - 0.5) * 90;
    if (!clear(x, z, 6) || (x > -48 && x < -20 && Math.abs(z) < 20)) continue;
    const s = 0.35 + rand() * 0.85;
    const rock = ball(x, s * 0.18, z, s, rand() < 0.5 ? stone : darkStone, 5);
    rock.scaling.set(1 + rand() * 0.5, 0.5, 1);
    if (s > 0.75) solidBox(x, z, s * 0.9, s * 0.7);
  }

  const groups = new Map<StandardMaterial, Mesh[]>();
  for (const mesh of statics) {
    const key = mesh.material as StandardMaterial;
    const list = groups.get(key) ?? [];
    list.push(mesh);
    groups.set(key, list);
  }
  const scenery: Mesh[] = [sword];
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
  const cherub = (name: string, x: number, z: number) => {
    const rig = placeRig(
      buildPerson(scene, pal, name, {
        robe: [0.9, 0.86, 0.72],
        trim: [0.78, 0.62, 0.22],
        head: [0.93, 0.86, 0.62],
        headwear: "wrap",
        scale: 1.08,
      }),
      x,
      z,
      -Math.PI / 2,
    );
    for (const side of [-1, 1]) {
      for (let layer = 0; layer < 3; layer++) {
        const wing = MeshBuilder.CreateBox(`${name}-wing`, { width: 0.07, height: 0.85 + layer * 0.28, depth: 0.32 }, scene);
        wing.parent = rig.root;
        wing.material = feather;
        wing.position.set(side * 0.16, 1.35, 0.02);
        wing.rotation.z = side * (0.45 + layer * 0.38);
        wing.rotation.y = side * 0.15;
      }
    }
    const halo = MeshBuilder.CreateTorus(`${name}-halo`, { diameter: 0.42, thickness: 0.03, tessellation: 16 }, scene);
    halo.parent = rig.root;
    halo.material = haloMat;
    halo.position.y = 1.95;
    halo.rotation.x = Math.PI / 2;
    folk.push(rig);
    solidBox(x, z, 0.8, 0.8);
  };
  cherub("cherub-n", 98, 9);
  cherub("cherub-s", 98, -9);

  const adam = placeRig(
    buildPerson(scene, pal, "adam", {
      robe: [0.46, 0.32, 0.2],
      trim: [0.32, 0.2, 0.12],
      head: [0.55, 0.4, 0.28],
      beard: [0.28, 0.18, 0.12],
      headwear: "wrap",
    }),
    10,
    6,
    Math.PI,
  );
  const eve = placeRig(
    buildPerson(scene, pal, "eve", {
      robe: [0.34, 0.4, 0.22],
      trim: [0.42, 0.3, 0.18],
      head: [0.62, 0.46, 0.36],
      headwear: "wrap",
      scale: 0.96,
    }),
    18,
    -4,
    0.4,
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
  pace("sheep", -66, 8, -60, 18, 0.26);
  pace("sheep", -48, 20, -40, 26, 0.22);
  sit("dog", -66, -14, 0.6);

  const swordLight = new PointLight("fall-sword-light", new Vector3(FALL_GATE.x, 2.3, FALL_GATE.z), scene);
  swordLight.diffuse = new Color3(1, 0.55, 0.22);
  swordLight.specular = new Color3(1, 0.45, 0.18);
  swordLight.intensity = 0.55;
  swordLight.range = 16;
  swordLight.falloffType = Light.FALLOFF_STANDARD;

  const tick = (dt: number, time: number) => {
    sword.rotation.y += dt * 1.15;
    swordLight.intensity = 0.55 * (1 + Math.sin(time * 9) * 0.12 + Math.sin(time * 17) * 0.06);
  };

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
    lamps: [swordLight],
    tick,
  };
}
