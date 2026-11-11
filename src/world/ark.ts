import { Color3, DynamicTexture, Light, Mesh, MeshBuilder, PointLight, Scene, StandardMaterial, Vector3 } from "@babylonjs/core";
import type { Palette, RGB } from "../art/materials";
import { buildBeast, buildPerson, type BeastKind, type Rig } from "../art/models";
import { ARK_PLACEMENTS } from "../data/layout";
import { ARK_LECTERN } from "../data/play";
import type { Wanderer, World } from "./world";

/** East end of this ground, where the path back to the camp is taken. */
export const ARK_EAST = { x: 80, z: 2.4 };

/** Where the Hope Beacon rises once the chapter is sealed. Over the ark. */
export const ARK_BEACON = { x: 8, z: 31.5 };

/** A long box, the fashion the chapter gives: length, then breadth, then height. */
const HULL = { x0: -8, x1: 24, z0: 28.8, z1: 34.2, door0: 7.1, door1: 8.9, t: 0.55 };

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
 * Dry earth in the south, where men multiplied.
 * Scorched ground to the east, a greener house to the west, sawdust by the ark.
 */
function arkColor(x: number, z: number): RGB {
  let c: RGB = [132, 114, 76];
  if (z < -28) c = mix(c, [158, 134, 88], smooth(-22, -48, z));
  if (x > 18 && z < 20 && z > -28) c = mix(c, [108, 72, 48], smooth(18, 40, x));
  if (x < -22 && z > -16 && z < 22) c = mix(c, [96, 122, 66], smooth(-16, -40, x));
  if (z > 10) c = mix(c, [146, 122, 80], smooth(10, 26, z));
  if (x > HULL.x0 - 2 && x < HULL.x1 + 2 && z > HULL.z0 - 2 && z < HULL.z1 + 2) c = mix(c, [74, 60, 44], 0.7);
  if (x > 52 && Math.abs(z) < 2.8) c = mix(c, [116, 90, 56], 0.8);
  const basin = Math.hypot(x - 42, z - 32);
  if (basin < 8) c = mix(c, [70, 78, 84], 1 - smooth(1.6, 8, basin));
  const scorch = Math.hypot(x + 18, z + 16);
  if (scorch < 7) c = mix(c, [86, 58, 40], 1 - smooth(1.4, 7, scorch));
  const rim = Math.hypot(x, z);
  if (rim > 86) c = mix(c, [140, 120, 80], smooth(86, 130, rim));
  return c;
}

function paintArk(scene: Scene): StandardMaterial {
  const size = 1024;
  const span = 360;
  const tex = new DynamicTexture("ark-ground-tex", { width: size, height: size }, scene, false);
  const ctx = tex.getContext() as unknown as CanvasRenderingContext2D;
  const img = ctx.createImageData(size, size);
  const data = img.data;
  for (let y = 0; y < size; y++) {
    const z = (y / (size - 1) - 0.5) * span;
    for (let x = 0; x < size; x++) {
      const wx = (x / (size - 1) - 0.5) * span;
      const c = arkColor(wx, z);
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
  const mat = new StandardMaterial("ark-ground", scene);
  mat.diffuseTexture = tex;
  mat.specularColor = new Color3(0.04, 0.04, 0.03);
  return mat;
}

/**
 * Genesis 6. The camp is east of here.
 * Violence, Noah's house, and the animals lie around a pitched ark of three stories.
 * A verse leaves the ground into the arms. The lectern at the door files it.
 */
export function buildArk(scene: Scene, pal: Palette): World {
  const colliders: { minX: number; maxX: number; minZ: number; maxZ: number; solid: boolean }[] = [];
  const statics: Mesh[] = [];
  const rand = rng(606);
  const heightAt = () => 0;

  const solidBox = (x: number, z: number, w: number, d: number) => {
    for (const p of ARK_PLACEMENTS) {
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
  const darkStone = pal.mat("dark-stone", [0.45, 0.42, 0.39], "grain", 1.5);
  const wood = pal.mat("wood", [0.45, 0.31, 0.19], "wood");
  const darkWood = pal.mat("dark-wood", [0.3, 0.2, 0.12], "wood");
  const gopher = pal.mat("ark-gopher", [0.5, 0.32, 0.16], "wood", 2);
  const gopherDark = pal.mat("ark-gopher-dark", [0.32, 0.2, 0.1], "wood", 2);
  const pitch = pal.mat("ark-pitch", [0.07, 0.06, 0.05], "metal");
  const pitchSoft = pal.mat("ark-pitch-soft", [0.12, 0.09, 0.07], "grain");
  const soil = pal.mat("ark-soil", [0.42, 0.3, 0.16], "grain");
  const cloth = pal.mat("ark-cloth", [0.55, 0.42, 0.28], "cloth");
  const clothDark = pal.mat("ark-cloth-dark", [0.38, 0.28, 0.2], "cloth");
  const leaf = pal.mat("ark-leaf", [0.28, 0.42, 0.18], "leaf", 2);
  const olive = pal.mat("ark-olive", [0.36, 0.42, 0.2], "leaf", 2);
  const dry = pal.mat("ark-dry", [0.58, 0.5, 0.28], "grain");
  const shrub = pal.mat("ark-shrub", [0.4, 0.42, 0.22], "grain");
  const hide = pal.mat("ark-hide", [0.48, 0.32, 0.18], "fur");
  const rope = pal.mat("ark-rope", [0.46, 0.36, 0.2], "grain");
  const page = pal.mat("page", [0.9, 0.86, 0.74], "cloth");
  const sack = pal.mat("ark-sack", [0.62, 0.5, 0.28], "cloth");
  const grain = pal.mat("ark-grain", [0.72, 0.58, 0.28], "grain");
  const water = pal.mat("ark-basin", [0.28, 0.38, 0.42]);
  water.alpha = 0.55;
  const flameMat = pal.glow("ark-flame", [1, 0.5, 0.16]);
  const windowGlow = pal.glow("ark-window", [1, 0.78, 0.42]);

  const ground = MeshBuilder.CreateGround("ground", { width: 360, height: 360, subdivisions: 2 }, scene);
  ground.material = paintArk(scene);
  ground.receiveShadows = true;

  const clear = (x: number, z: number, r: number) =>
    ARK_PLACEMENTS.every((p) => Math.hypot(p.x - x, p.z - z) >= r) &&
    Math.hypot(x - ARK_LECTERN.x, z - ARK_LECTERN.z) >= r + 1.2 &&
    Math.hypot(x - ARK_EAST.x, z - ARK_EAST.z) >= r + 1 &&
    Math.hypot(x - 16, z - 14) >= r &&
    Math.hypot(x - -42, z - -2) >= r &&
    !(x > HULL.x0 - 3 && x < HULL.x1 + 3 && z > HULL.z0 - 4 && z < HULL.z1 + 4) &&
    !(x > 52 && Math.abs(z) < 4.5) &&
    !(z > 51 && z < 64 && x > -20 && x < 42);

  // The way back, on the east. The camp is behind the sign.
  box(70, 0.03, 0, 28, 0.05, 2.6, soil);
  box(ARK_EAST.x, 0.9, ARK_EAST.z, 0.14, 1.8, 0.14, wood, true);
  box(ARK_EAST.x, 1.62, ARK_EAST.z, 1.2, 0.42, 0.08, wood);

  const tent = (x: number, z: number, yaw: number) => {
    box(x, 0.04, z, 3.4, 0.06, 2.6, cloth, true, yaw);
    for (const side of [-1, 1]) {
      const roof = box(x + side * Math.cos(yaw) * 0.7, 1.15, z + side * Math.sin(yaw) * 0.7, 2.1, 0.06, 2.8, clothDark, false, yaw);
      roof.rotation.z = side * -0.5;
    }
  };
  tent(-22, -58, 0.2);
  tent(20, -56, -0.15);
  cyl(-8, 0.12, -46, 0.18, 1.1, 1.1, stone, 8);
  for (const rot of [0.4, 1.5, 2.6]) {
    const log = cyl(-8, 0.16, -46, 0.7, 0.1, 0.1, darkWood, 6);
    log.rotation.z = Math.PI / 2;
    log.rotation.y = rot;
  }

  // A hundred and twenty years, cut on a standing stone.
  box(-2, 0.9, -33, 0.7, 1.8, 0.28, stone, true);
  for (const y of [0.55, 0.95, 1.35]) box(-2, y, -33.16, 0.4, 0.04, 0.04, darkStone);

  // Giants among the stones.
  for (const [x, z, h] of [
    [-36, -34, 3.4],
    [-34, -22, 2.8],
    [-22, -24, 3.1],
  ] as const) {
    box(x, h / 2, z, 0.7, h, 0.45, stone, true);
    box(x, h + 0.12, z, 0.95, 0.22, 0.7, darkStone);
  }

  // The broken altar, and the sentence spoken over a scorched circle.
  box(28, 0.35, -38, 1.4, 0.7, 1.1, darkStone, true);
  const toppled = box(29.1, 0.7, -37.4, 0.35, 1.1, 0.9, stone);
  toppled.rotation.z = 0.7;
  box(-18, 0.02, -16, 4.2, 0.03, 4.2, pitchSoft);

  const griefTree = (x: number, z: number) => {
    cyl(x, 1.6, z, 3.2, 0.16, 0.42, darkWood, 8);
    ball(x, 3.3, z, 2.4, leaf, 8);
    ball(x + 0.7, 2.8, z - 0.3, 1.5, olive, 7);
    solidBox(x, z, 0.75, 0.75);
  };
  griefTree(10, -26);

  const oliveTree = (x: number, z: number, s = 1) => {
    cyl(x, 1.05 * s, z, 2.1 * s, 0.16 * s, 0.38 * s, darkWood, 8);
    const canopy = ball(x, 2.3 * s, z, 2.5 * s, olive, 8);
    canopy.scaling.y = 0.7;
    ball(x + 0.6 * s, 2.05 * s, z + 0.2 * s, 1.4 * s, leaf, 7);
    solidBox(x, z, 0.7, 0.7);
  };
  oliveTree(-62, -6, 1.1);
  oliveTree(-44, 12, 1.05);
  oliveTree(-30, 4);

  // Noah's house, west of the yard. The door faces the verse, which stands outside.
  box(-48, 1.3, -4, 6.2, 2.6, 4.2, gopherDark, true);
  box(-48, 2.85, -4, 6.8, 0.22, 4.8, gopher);
  box(-44.7, 1.15, -4, 0.12, 2.1, 1.1, darkWood);
  box(-46.2, 0.55, -5.6, 1.3, 0.12, 0.7, wood);

  // Violence: a cart on its side, a broken pen, a warning stone.
  const cart = box(46, 0.55, -16, 2.4, 0.9, 1.3, darkWood, true, 0.4);
  cart.rotation.z = 0.9;
  cyl(47.2, 0.28, -15.2, 0.18, 0.7, 0.7, pitchSoft, 8);
  box(56, 0.45, 4, 0.12, 0.9, 0.12, wood, true);
  box(58.4, 0.35, 6.2, 0.12, 0.7, 0.12, wood, true);
  const rail = box(57.2, 0.7, 5.1, 2.6, 0.08, 0.08, wood, false, 0.5);
  rail.rotation.z = 0.4;
  box(40, 0.85, 18, 0.55, 1.7, 0.24, darkStone, true);

  // Gopher logs and the pots the pitch is heated in.
  for (const [i, x] of [-22, -20.2, -18.4].entries()) {
    const log = cyl(x, 0.28 + i * 0.22, 10, 3.2, 0.32, 0.36, gopher, 8);
    log.rotation.z = Math.PI / 2;
    log.rotation.y = 0.15;
  }
  solidBox(-20, 10, 2.4, 1.5);
  cyl(-16.5, 0.35, 12.2, 0.7, 0.55, 0.62, pitch, 10);
  ball(-16.5, 0.72, 12.2, 0.42, pitchSoft, 8);
  const boil = ball(-16.2, 0.95, 12.4, 0.22, flameMat, 6);
  boil.scaling.y = 1.4;

  // The measure: two stakes the length of the hull, and a pole the height of it.
  for (const x of [HULL.x0, HULL.x1]) {
    box(x, 0.8, 24, 0.12, 1.6, 0.12, wood, true);
    box(x, 1.45, 24, 0.28, 0.08, 0.16, gopher);
  }
  box(8, 0.22, 24, HULL.x1 - HULL.x0, 0.04, 0.04, rope);
  box(26.4, 2.4, 26, 0.1, 4.8, 0.1, gopher, true);
  for (const y of [1.6, 3.15, 4.55]) box(26.55, y, 26, 0.16, 0.05, 0.16, wood);

  // The ark. Lower storey is pitched, and the door is in the south side.
  // Upper storeys are gopher, and they close over the door. Collision stays on the lower walls.
  const { x0, x1, z0, z1, door0, door1, t } = HULL;
  const midX = (x0 + x1) / 2;
  const midZ = (z0 + z1) / 2;
  const length = x1 - x0;
  const breadth = z1 - z0;
  const wallBand = (y0: number, y1: number, mat: StandardMaterial, openDoor: boolean) => {
    const h = y1 - y0;
    const y = (y0 + y1) / 2;
    const south = (a: number, b: number) => box((a + b) / 2, y, z0 + t / 2, b - a, h, t, mat, openDoor);
    if (openDoor) {
      south(x0, door0);
      south(door1, x1);
    } else south(x0, x1);
    box(midX, y, z1 - t / 2, length, h, t, mat, openDoor);
    box(x0 + t / 2, y, midZ, t, h, breadth, mat, openDoor);
    box(x1 - t / 2, y, midZ, t, h, breadth, mat, openDoor);
  };
  wallBand(0, 1.7, pitch, true);
  wallBand(1.7, 3.15, gopherDark, false);
  wallBand(3.15, 4.55, gopher, false);
  for (const y of [1.7, 3.15]) box(midX, y, z0 - 0.02, length + 0.3, 0.08, 0.08, wood);
  box(door0 - 0.08, 1.05, z0 - 0.06, 0.16, 2.1, 0.2, gopher);
  box(door1 + 0.08, 1.05, z0 - 0.06, 0.16, 2.1, 0.2, gopher);
  box(midX, 2.15, z0 - 0.06, door1 - door0 + 0.4, 0.16, 0.2, gopher);
  const ramp = box(midX, 0.12, z0 - 1.5, 1.7, 0.08, 2.6, gopherDark);
  ramp.rotation.x = -0.08;
  box(midX, 0.05, midZ, length - 1.4, 0.06, breadth - 1.3, pitchSoft);

  const roofS = box(midX, 5.05, midZ - 1.35, length + 1.4, 0.16, 3.2, gopherDark);
  roofS.rotation.x = 0.26;
  const roofN = box(midX, 5.05, midZ + 1.35, length + 1.4, 0.16, 3.2, gopherDark);
  roofN.rotation.x = -0.26;
  // A window finished a cubit above, along the ridge.
  box(midX, 4.95, midZ, 7.5, 0.22, 0.28, windowGlow);

  // The lectern at the door. The same point is ARK_LECTERN.
  box(ARK_LECTERN.x, 0.45, ARK_LECTERN.z, 0.7, 0.9, 0.55, wood, true);
  const desk = box(ARK_LECTERN.x, 0.98, ARK_LECTERN.z, 0.9, 0.08, 0.7, wood);
  desk.rotation.x = -0.35;
  const leafPage = box(ARK_LECTERN.x, 1.04, ARK_LECTERN.z, 0.55, 0.02, 0.4, page);
  leafPage.rotation.x = -0.35;

  // The flood foretold, still dry. A dark basin east of the hull.
  cyl(42, 0.04, 32, 0.06, 6.5, 6.5, water, 20);
  for (const [x, z] of [
    [39.2, 30.4],
    [44.6, 33.2],
    [41.4, 34.6],
  ] as const) {
    const clod = ball(x, 0.1, z, 0.45, soil, 6);
    clod.scaling.y = 0.4;
  }

  // The covenant, west of the door.
  box(-28, 0.55, 24, 0.8, 1.1, 0.45, stone, true);
  box(-28, 1.15, 24, 1.05, 0.12, 0.7, darkStone);

  // Food gathered for the ark.
  for (const [x, z] of [
    [-46, 36],
    [-44.2, 37.4],
    [-47.2, 38.2],
  ] as const) {
    cyl(x, 0.32, z, 0.55, 0.38, 0.46, gopher, 8);
  }
  for (const [x, z] of [
    [-42.5, 38.5],
    [-44.8, 40],
  ] as const) {
    const bag = ball(x, 0.28, z, 0.7, sack, 7);
    bag.scaling.y = 0.65;
  }
  cyl(-46.5, 0.2, 34.5, 0.28, 0.7, 0.7, grain, 8);

  // Pens. The verses stand south of the rails.
  const pen = (x0p: number, x1p: number, z0p: number, z1p: number) => {
    box((x0p + x1p) / 2, 0.45, z0p, x1p - x0p, 0.9, 0.1, wood, true);
    box((x0p + x1p) / 2, 0.45, z1p, x1p - x0p, 0.9, 0.1, wood, true);
    box(x0p, 0.45, (z0p + z1p) / 2, 0.1, 0.9, z1p - z0p, wood, true);
    box(x1p, 0.45, (z0p + z1p) / 2, 0.1, 0.9, z1p - z0p, wood, true);
  };
  pen(-18, -2, 53, 61);
  pen(24, 40, 53, 61);
  box(32, 1.7, 53.2, 0.1, 1.5, 0.1, wood, true);
  box(36, 2.15, 53.2, 4.2, 0.08, 0.1, wood);

  const perch = (x: number, y: number, z: number, yaw: number) => {
    const body = ball(x, y, z, 0.16, darkWood, 6);
    body.scaling.set(0.75, 0.65, 1.4);
    body.rotation.y = yaw;
    const beak = box(x + Math.sin(yaw) * 0.12, y, z + Math.cos(yaw) * 0.12, 0.04, 0.03, 0.08, grain);
    beak.rotation.y = yaw;
  };
  perch(31.2, 2.25, 53.2, 0.4);
  perch(34.6, 2.22, 53.15, -0.6);
  perch(33, 2.28, 53.3, 1.2);
  perch(midX + 2, 5.35, midZ, 2.4);
  box(11.6, 1.3, 25.6, 0.1, 2.6, 0.1, wood, true);
  const lamp = ball(11.6, 2.55, 25.6, 0.28, flameMat, 6);
  lamp.scaling.y = 1.2;
  const coat = ball(-44.35, 1.35, -5.2, 0.7, hide, 6);
  coat.scaling.set(0.45, 1.05, 0.18);

  // Creeping things, low, beside the east pen and not on a verse.
  const creep = (x: number, z: number) => {
    const path: Vector3[] = [];
    for (let i = 0; i <= 8; i++) {
      const tStep = i / 8;
      path.push(new Vector3(x + tStep * 0.8, 0.06, z + Math.sin(tStep * 6) * 0.12));
    }
    keep(MeshBuilder.CreateTube("creeper", { path, radius: 0.035, tessellation: 5, cap: Mesh.CAP_ALL }, scene), pitchSoft);
  };
  creep(22, 46);
  creep(23.4, 47.2);

  const thornBush = (x: number, z: number, s = 1) => {
    for (let k = 0; k < 4; k++) {
      const stem = cyl(x, 0.32 * s, z, 0.7 * s, 0.02, 0.045, dry, 4);
      stem.rotation.z = 0.35 + k * 0.4;
      stem.rotation.y = k * 0.9;
    }
    const tuft = ball(x, 0.22 * s, z, 0.4 * s, shrub, 5);
    tuft.scaling.y = 0.45;
  };
  for (let i = 0; i < 16; i++) {
    const x = 22 + rand() * 40;
    const z = -28 + rand() * 40;
    if (!clear(x, z, 3.4)) continue;
    thornBush(x, z, 0.8 + rand() * 0.5);
  }
  for (let i = 0; i < 10; i++) {
    const x = -70 + rand() * 40;
    const z = -20 + rand() * 40;
    if (!clear(x, z, 4.2)) continue;
    oliveTree(x, z, 0.75 + rand() * 0.35);
  }
  for (let i = 0; i < 18; i++) {
    const x = (rand() - 0.5) * 150;
    const z = (rand() - 0.5) * 120;
    if (!clear(x, z, 5)) continue;
    const s = 0.35 + rand() * 0.8;
    const rock = ball(x, s * 0.16, z, s, rand() < 0.5 ? stone : darkStone, 5);
    rock.scaling.set(1 + rand() * 0.4, 0.45, 1);
    if (s > 0.7) solidBox(x, z, s * 0.8, s * 0.6);
  }

  const groups = new Map<StandardMaterial, Mesh[]>();
  for (const mesh of statics) {
    const key = mesh.material as StandardMaterial;
    const list = groups.get(key) ?? [];
    list.push(mesh);
    groups.set(key, list);
  }
  const scenery: Mesh[] = [];
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
    solidBox(x, z, 0.8, 0.8);
    return rig;
  };
  const person = (
    name: string,
    x: number,
    z: number,
    face: number,
    look: Parameters<typeof buildPerson>[3],
    wide = 0.8,
  ) => {
    const rig = placeRig(buildPerson(scene, pal, name, look), x, z, face);
    if (wide !== 0.8) {
      colliders.pop();
      solidBox(x, z, wide, wide);
    }
    folk.push(rig);
    return rig;
  };

  person("noah", 16, 14, 0, {
    robe: [0.42, 0.3, 0.18],
    trim: [0.55, 0.4, 0.22],
    head: [0.5, 0.36, 0.24],
    beard: [0.32, 0.24, 0.16],
    headwear: "wrap",
    staff: true,
  });
  person("wife", -42, -2, 0.6, {
    robe: [0.45, 0.32, 0.28],
    trim: [0.62, 0.48, 0.32],
    head: [0.58, 0.42, 0.32],
    headwear: "wrap",
    scale: 0.96,
  });
  person("shem", -32, 22, 1.2, {
    robe: [0.34, 0.28, 0.2],
    trim: [0.5, 0.38, 0.22],
    head: [0.52, 0.38, 0.26],
    beard: [0.22, 0.16, 0.1],
    headwear: "wrap",
  });
  person("ham", -40, 14, 0.4, {
    robe: [0.28, 0.24, 0.2],
    trim: [0.42, 0.3, 0.16],
    head: [0.4, 0.28, 0.2],
    beard: [0.16, 0.1, 0.08],
    headwear: "hood",
  });
  person("japheth", -28, 16, -0.8, {
    robe: [0.48, 0.4, 0.26],
    trim: [0.62, 0.5, 0.3],
    head: [0.56, 0.42, 0.3],
    headwear: "turban",
    scale: 1.04,
  });
  person(
    "renown",
    -36,
    -24,
    0.8,
    {
      robe: [0.32, 0.26, 0.22],
      trim: [0.48, 0.38, 0.24],
      head: [0.48, 0.34, 0.24],
      beard: [0.2, 0.14, 0.1],
      headwear: "wrap",
      staff: true,
      scale: 1.78,
    },
    1.15,
  );
  person(
    "mighty",
    -24,
    -36,
    2.2,
    {
      robe: [0.36, 0.28, 0.2],
      trim: [0.22, 0.18, 0.14],
      head: [0.46, 0.32, 0.22],
      beard: [0.18, 0.12, 0.08],
      headwear: "hood",
      scale: 1.62,
    },
    1.05,
  );
  person("villager-a", -22, -48, 0.3, {
    robe: [0.4, 0.32, 0.24],
    trim: [0.55, 0.42, 0.28],
    head: [0.55, 0.4, 0.3],
    headwear: "wrap",
    scale: 0.94,
  });
  person("villager-b", 20, -44, -1.4, {
    robe: [0.46, 0.34, 0.28],
    trim: [0.32, 0.24, 0.2],
    head: [0.6, 0.44, 0.34],
    headwear: "hood",
    scale: 0.92,
  });

  const pace = (kind: BeastKind, ax: number, az: number, bx: number, bz: number, rate: number) => {
    const rig = buildBeast(scene, pal, `beast-${kind}-${wanderers.length}`, kind);
    rig.root.position.set(ax, 0, az);
    wanderers.push({ rig, ax, az, bx, bz, phase: rand() * 6, rate });
  };
  pace("sheep", -16, 55.5, -12, 58, 0.22);
  pace("sheep", -14, 57.5, -8, 55.2, 0.18);
  pace("calf", 28, 56, 32, 58.5, 0.2);
  pace("calf", 34, 55.4, 38, 57.6, 0.16);
  pace("camel", -8, 56.2, -4, 58.4, 0.14);
  pace("camel", -6, 58.6, -3, 55.8, 0.12);
  pace("dog", 26, 56.5, 30, 58.2, 0.28);
  pace("dog", 30, 58.4, 34, 56.2, 0.24);
  pace("cat", -34, 40, -30, 42.5, 0.2);
  pace("cat", -31, 42.8, -27, 39.6, 0.18);

  const doorLight = new PointLight("ark-door-light", new Vector3(midX, 2.4, z0 - 2.2), scene);
  doorLight.diffuse = new Color3(1, 0.62, 0.32);
  doorLight.specular = new Color3(1, 0.5, 0.22);
  doorLight.intensity = 0.45;
  doorLight.range = 14;
  doorLight.falloffType = Light.FALLOFF_STANDARD;
  const ridgeLight = new PointLight("ark-window-light", new Vector3(midX, 5.2, midZ), scene);
  ridgeLight.diffuse = new Color3(1, 0.78, 0.42);
  ridgeLight.specular = new Color3(1, 0.7, 0.35);
  ridgeLight.intensity = 0.35;
  ridgeLight.range = 12;
  ridgeLight.falloffType = Light.FALLOFF_STANDARD;
  const pitchLight = new PointLight("ark-pitch-light", new Vector3(-16.5, 1.1, 12.2), scene);
  pitchLight.diffuse = new Color3(1, 0.48, 0.16);
  pitchLight.specular = new Color3(1, 0.36, 0.1);
  pitchLight.intensity = 0.28;
  pitchLight.range = 8;
  pitchLight.falloffType = Light.FALLOFF_STANDARD;

  const tick = (_dt: number, time: number) => {
    const flicker = 1 + Math.sin(time * 11) * 0.08 + Math.sin(time * 23) * 0.05;
    doorLight.intensity = 0.45 * flicker;
    pitchLight.intensity = 0.28 * (1 + Math.sin(time * 14) * 0.12);
    ridgeLight.intensity = 0.35 * (1 + Math.sin(time * 2.5) * 0.06);
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
    lamps: [doorLight, ridgeLight, pitchLight],
    tick,
  };
}
