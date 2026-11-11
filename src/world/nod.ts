import { Color3, DynamicTexture, Light, Mesh, MeshBuilder, PointLight, Scene, StandardMaterial, Vector3 } from "@babylonjs/core";
import type { Palette, RGB } from "../art/materials";
import { buildBeast, buildPerson, type BeastKind, type Rig } from "../art/models";
import { NOD_PLACEMENTS } from "../data/layout";
import type { Wanderer, World } from "./world";

/** West end of this ground, where the path back toward the gate is taken. */
export const NOD_WEST = { x: -82, z: 2.2 };

/** Over the city of Enoch, once the chapter is sealed. */
export const NOD_BEACON = { x: 108, z: 32 };

const CAIN_ALTAR = { x: -30, z: -8 };
const ABEL_ALTAR = { x: -10, z: 22 };
const DOOR = { x: 4, z: 14 };
const MARK = { x: 62, z: -14 };
const FORGE = { x: 96, z: -27 };
const HARP = { x: 78, z: -33 };
const TENTS = { x: 62, z: -32 };
const SETH = { x: 18, z: -44 };
const CITY = { x: 108, z: 31 };

/** People who stand still. None of them may rest within witness reach of a tablet. */
const PEOPLE = [
  { name: "abel", x: -66, z: 6 },
  { name: "adam", x: -76, z: 14 },
  { name: "eve", x: -72, z: 18 },
  { name: "cain", x: -4, z: 24 },
] as const;

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

function distToSeg(x: number, z: number, ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax;
  const dz = bz - az;
  const len2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / len2));
  return Math.hypot(x - (ax + dx * t), z - (az + dz * t));
}

/**
 * Pasture in the west, a darker field where the blood cried,
 * then pale ground, and the warmer earth of the city.
 */
function nodColor(x: number, z: number): RGB {
  let c: RGB = [118, 132, 72];
  if (x > -36) c = mix(c, [148, 124, 70], smooth(-36, -8, x));
  if (x > 24) c = mix(c, [156, 118, 64], smooth(24, 58, x));
  if (x > 66) c = mix(c, [186, 156, 96], smooth(66, 96, x));
  const city = Math.hypot(x - CITY.x, z - CITY.z);
  if (city < 28) c = mix(c, [168, 132, 84], 1 - smooth(10, 28, city));
  const fold = Math.hypot(x + 52, z - 18);
  if (fold < 16) c = mix(c, [96, 128, 62], 1 - smooth(6, 16, fold));
  const blood = Math.hypot(x - 20, z + 6);
  if (blood < 14 && x > 4 && x < 48) c = mix(c, [112, 72, 48], 1 - smooth(3, 14, blood));
  const seth = Math.hypot(x - 12, z + 34);
  if (seth < 16) c = mix(c, [104, 126, 68], 1 - smooth(5, 16, seth));
  const worn = Math.min(
    distToSeg(x, z, -86, 0, 72, 0),
    distToSeg(x, z, 72, 0, 90, 30),
    distToSeg(x, z, 20, -2, 16, -40),
  );
  if (worn < 2.5) c = mix(c, [132, 102, 64], 1 - smooth(1.05, 2.5, worn));
  const rim = Math.hypot(x - 20, z);
  if (rim > 86) c = mix(c, [150, 128, 82], smooth(86, 130, rim));
  return c;
}

function paintNod(scene: Scene): StandardMaterial {
  const size = 1024;
  const span = 360;
  const tex = new DynamicTexture("nod-ground-tex", { width: size, height: size }, scene, false);
  const ctx = tex.getContext() as unknown as CanvasRenderingContext2D;
  const img = ctx.createImageData(size, size);
  const data = img.data;
  for (let y = 0; y < size; y++) {
    const z = (y / (size - 1) - 0.5) * span;
    for (let x = 0; x < size; x++) {
      const wx = (x / (size - 1) - 0.5) * span;
      const c = nodColor(wx, z);
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
  const mat = new StandardMaterial("nod-ground", scene);
  mat.diffuseTexture = tex;
  mat.specularColor = new Color3(0.04, 0.04, 0.03);
  return mat;
}

/**
 * Genesis 4, the land of Nod.
 * West is the way back toward the gate. The brothers' altars, the field,
 * and the crying ground stand along the path. East is Cain's city,
 * and south of the field men begin to call upon the name of the LORD.
 * The verses open when Abel stands at the tablet.
 */
export function buildNod(scene: Scene, pal: Palette): World {
  const colliders: { minX: number; maxX: number; minZ: number; maxZ: number; solid: boolean }[] = [];
  const statics: Mesh[] = [];
  const rand = rng(404);
  const heightAt = () => 0;

  for (const person of PEOPLE) {
    for (const p of NOD_PLACEMENTS) {
      const gap = Math.hypot(p.x - person.x, p.z - person.z);
      if (gap < 5) throw new Error(`${person.name} is ${gap.toFixed(2)} m from verse ${p.verse}`);
    }
  }

  const solidBox = (x: number, z: number, w: number, d: number) => {
    for (const p of NOD_PLACEMENTS) {
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
  const clay = pal.mat("clay", [0.68, 0.4, 0.25], "grain");
  const soil = pal.mat("nod-soil", [0.42, 0.3, 0.16], "grain");
  const leaf = pal.mat("nod-leaf", [0.3, 0.46, 0.2], "grain");
  const fruit = pal.mat("nod-fruit", [0.62, 0.16, 0.1]);
  const grain = pal.mat("nod-grain", [0.78, 0.66, 0.28], "grain");
  const hide = pal.mat("nod-hide", [0.5, 0.34, 0.2], "fur");
  const wool = pal.mat("nod-wool", [0.9, 0.88, 0.8], "fur");
  const thorn = pal.mat("nod-thorn", [0.42, 0.34, 0.18], "wood");
  const blood = pal.mat("nod-blood", [0.42, 0.08, 0.06]);
  const tentCloth = pal.mat("nod-tent", [0.62, 0.48, 0.3], "stripes");
  const cityClay = pal.mat("nod-city", [0.72, 0.48, 0.32], "grain");
  const bronze = pal.mat("nod-bronze", [0.62, 0.42, 0.18], "metal");
  const iron = pal.mat("nod-iron", [0.35, 0.34, 0.32], "metal");
  const markGlow = pal.glow("nod-mark", [0.95, 0.78, 0.28]);
  const forgeGlow = pal.glow("nod-forge", [1, 0.42, 0.12]);
  const flame = pal.glow("nod-flame", [1, 0.62, 0.22]);

  const ground = MeshBuilder.CreateGround("ground", { width: 360, height: 360, subdivisions: 2 }, scene);
  ground.material = paintNod(scene);
  ground.receiveShadows = true;

  const anchors = [NOD_WEST, CAIN_ALTAR, ABEL_ALTAR, DOOR, MARK, FORGE, HARP, TENTS, SETH, CITY, ...PEOPLE];
  const clear = (x: number, z: number, r: number) =>
    NOD_PLACEMENTS.every((p) => Math.hypot(p.x - x, p.z - z) >= r) &&
    anchors.every((a) => Math.hypot(a.x - x, a.z - z) >= r) &&
    distToSeg(x, z, -86, 0, 90, 30) >= r &&
    !(x > 96 && x < 120 && z > 20 && z < 42);

  // The way back, on the west. The gate is behind the sign.
  box(-74, 0.03, 0, 28, 0.05, 2.8, soil);
  box(NOD_WEST.x, 0.9, NOD_WEST.z, 0.14, 1.8, 0.14, wood, true);
  box(NOD_WEST.x, 1.62, NOD_WEST.z, 1.2, 0.42, 0.08, wood);

  const fruitTree = (x: number, z: number, scaleN = 1) => {
    cyl(x, 1.15 * scaleN, z, 2.3 * scaleN, 0.16 * scaleN, 0.34 * scaleN, darkWood, 8);
    const canopy = ball(x, 2.55 * scaleN, z, 2.3 * scaleN, leaf, 8);
    canopy.scaling.y = 0.72;
    ball(x + 0.55 * scaleN, 2.2 * scaleN, z + 0.2 * scaleN, 1.4 * scaleN, shrub, 7);
    for (let k = 0; k < 3; k++) {
      const a = rand() * Math.PI * 2;
      const radius = (0.35 + rand() * 0.5) * scaleN;
      ball(x + Math.cos(a) * radius, 2.05 * scaleN + rand() * 0.35, z + Math.sin(a) * radius, 0.14, fruit, 5);
    }
    solidBox(x, z, 0.7, 0.7);
  };
  fruitTree(-86, 10, 1.1);
  fruitTree(-88, 24, 0.95);
  fruitTree(-58, -18, 1.05);

  const acacia = (x: number, z: number) => {
    cyl(x, 1.35, z, 2.7, 0.1, 0.28, darkWood, 7);
    const canopy = ball(x, 2.9, z, 3.1, dryGrass, 8);
    canopy.scaling.set(1.45, 0.28, 1.45);
    const under = ball(x + 0.35, 2.45, z - 0.25, 2.1, shrub, 7);
    under.scaling.set(1.15, 0.22, 1.05);
    solidBox(x, z, 0.7, 0.7);
  };
  acacia(70, 20);
  acacia(84, -10);
  acacia(58, 22);
  acacia(-18, -24);

  // Adam and Eve's booth, north of the path. Abel stands south of it.
  const booth = box(-80, 1.15, 18, 4.2, 2.3, 3.4, tentCloth, true);
  booth.rotation.y = 0.2;
  box(-80, 2.45, 18, 4.6, 0.1, 3.8, hide, false, 0.2);
  for (const [x, z] of [
    [-82, 16.4],
    [-78, 16.5],
    [-82.1, 19.6],
    [-77.9, 19.5],
  ] as const) {
    box(x, 1.2, z, 0.1, 2.4, 0.1, wood);
  }

  // The sheepfold, open on the south. Abel's flock stays inside.
  for (const x of [-58, -50, -44]) box(x, 0.55, 22, 0.12, 1.1, 0.12, wood, true);
  for (const x of [-58, -44]) box(x, 0.55, 14, 0.12, 1.1, 0.12, wood, true);
  box(-51, 0.85, 22, 14, 0.06, 0.06, wood);
  box(-58, 0.85, 18, 0.06, 0.06, 8, wood);
  box(-44, 0.85, 18, 0.06, 0.06, 8, wood);

  const altar = (x: number, z: number, kind: "fruit" | "flock") => {
    box(x, 0.45, z, 1.5, 0.9, 1.15, stone, true);
    box(x, 0.95, z, 1.7, 0.12, 1.35, ashlar);
    if (kind === "fruit") {
      for (let i = 0; i < 4; i++) {
        const sheaf = box(x - 0.4 + (i % 2) * 0.45, 1.15, z - 0.15 + Math.floor(i / 2) * 0.3, 0.08, 0.4, 0.28, grain);
        sheaf.rotation.z = (i - 1.5) * 0.15;
      }
      ball(x + 0.15, 1.12, z + 0.15, 0.16, fruit, 6);
      ball(x - 0.2, 1.1, z + 0.2, 0.12, clay, 5);
    } else {
      const fat = ball(x, 1.12, z, 0.28, hide, 6);
      fat.scaling.set(1.1, 0.45, 0.7);
      box(x + 0.28, 1.08, z, 0.16, 0.06, 0.22, wool);
    }
  };
  altar(CAIN_ALTAR.x, CAIN_ALTAR.z, "fruit");
  altar(ABEL_ALTAR.x, ABEL_ALTAR.z, "flock");

  // Furrows in the ground Cain tilled.
  for (let i = 0; i < 6; i++) {
    box(-34 + i * 1.3, 0.02, -16, 0.7, 0.03, 3.2, soil, false, 0.15);
  }

  // Sin at the door: a frame standing by itself, nothing hung in it.
  box(DOOR.x - 0.7, 1.15, DOOR.z, 0.14, 2.3, 0.14, darkWood, true);
  box(DOOR.x + 0.7, 1.15, DOOR.z, 0.14, 2.3, 0.14, darkWood, true);
  box(DOOR.x, 2.35, DOOR.z, 1.7, 0.16, 0.16, darkWood);
  const leafDoor = box(DOOR.x + 0.15, 1.1, DOOR.z + 0.08, 1.15, 2, 0.06, darkWood);
  leafDoor.rotation.y = 0.5;

  // The field, and the ground that opened its mouth.
  for (let i = 0; i < 7; i++) {
    const stain = ball(16 + (i % 4) * 1.1, 0.04, -15 + Math.floor(i / 4) * 0.8, 0.7 + (i % 3) * 0.15, blood, 6);
    stain.scaling.y = 0.12;
  }
  const clod = ball(20, 0.16, -12.5, 0.9, clay, 7);
  clod.scaling.y = 0.35;
  for (const [x, z] of [
    [36, -8],
    [48, -4],
    [44, 20],
    [54, 18],
    [38, 10],
  ] as const) {
    for (let k = 0; k < 4; k++) {
      const stem = cyl(x, 0.32, z, 0.7, 0.02, 0.05, thorn, 4);
      stem.rotation.z = 0.45 + k * 0.4;
      stem.rotation.y = k * 0.9;
    }
    const dry = ball(x, 0.22, z, 0.4, dryGrass, 5);
    dry.scaling.y = 0.4;
  }

  // The mark, cut into a standing stone. The same sign is on Cain.
  box(MARK.x, 1.35, MARK.z, 0.55, 2.7, 0.28, darkStone, true);
  const chevron = box(MARK.x, 1.7, MARK.z + 0.16, 0.28, 0.28, 0.04, markGlow);
  chevron.rotation.z = 0.78;

  // Where the land of Nod begins: a low cairn beside the path.
  for (const [dx, dy, dz, s] of [
    [0, 0.2, 0, 0.7],
    [0.35, 0.45, 0.1, 0.45],
    [-0.25, 0.4, -0.15, 0.4],
  ] as const) {
    const rock = ball(76 + dx, dy, 14 + dz, s, stone, 6);
    rock.scaling.y = 0.7;
  }

  // The city called Enoch. The gate faces the path. The verses stand outside the walls.
  const wall = (x: number, z: number, w: number, d: number) => {
    box(x, 1.6, z, w, 3.2, d, cityClay, true);
    box(x, 3.3, z, w + 0.1, 0.2, d + 0.1, ashlar);
  };
  wall(98, 24.2, 0.7, 4.4);
  wall(98, 36.8, 0.7, 6.4);
  wall(118, 31, 0.7, 18);
  wall(108, 22, 20, 0.7);
  wall(108, 40, 20, 0.7);
  box(98, 3.55, 30, 0.9, 0.28, 8.2, ashlar);
  for (const [x, z, w, d] of [
    [106, 28, 4.2, 3.2],
    [112, 35, 3.4, 3],
    [103, 36, 3, 2.6],
  ] as const) {
    box(x, 1.3, z, w, 2.6, d, cityClay, true);
    box(x, 2.7, z, w + 0.4, 0.16, d + 0.4, darkWood);
  }
  cyl(108, 0.4, 30, 0.7, 1.3, 1.4, stone, 12);
  cyl(108, 0.78, 30, 0.06, 0.9, 0.9, darkStone, 12);

  // Jabal's tents, Jubal's harp, Tubal-cain's forge.
  for (const [dx, dz] of [
    [0, 0],
    [3.2, 0.4],
  ] as const) {
    const tent = cyl(TENTS.x + dx, 1.15, TENTS.z + dz, 2.3, 0.2, 3.2, tentCloth, 8);
    tent.rotation.y = 0.4 + dx;
    solidBox(TENTS.x + dx, TENTS.z + dz, 2.4, 2.4);
  }
  box(HARP.x, 0.85, HARP.z, 0.12, 1.7, 0.5, darkWood, true);
  const neck = box(HARP.x + 0.28, 1.35, HARP.z, 0.55, 0.1, 0.12, darkWood);
  neck.rotation.z = 0.7;
  for (let i = 0; i < 4; i++) box(HARP.x + 0.08, 0.45 + i * 0.32, HARP.z, 0.01, 0.28, 0.01, bronze);

  box(FORGE.x, 0.55, FORGE.z, 1.6, 1.1, 1.2, darkStone, true);
  box(FORGE.x, 1.15, FORGE.z - 0.15, 1.15, 0.7, 0.7, darkStone);
  ball(FORGE.x, 1.35, FORGE.z - 0.15, 0.28, forgeGlow, 6);
  box(FORGE.x + 1.3, 0.45, FORGE.z + 0.2, 0.7, 0.7, 0.4, wood, true);
  box(FORGE.x + 1.3, 0.85, FORGE.z + 0.2, 0.35, 0.12, 0.22, iron);

  // Seth, and the altar where men began to call upon the name of the LORD.
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const rx = SETH.x + Math.cos(a) * 1.7;
    const rz = SETH.z + Math.sin(a) * 1.7;
    box(rx, 0.28, rz, 0.35, 0.5, 0.28, stone, true, a);
  }
  cyl(SETH.x, 0.35, SETH.z, 0.5, 0.9, 1, stone, 12);
  ball(SETH.x, 0.85, SETH.z, 0.22, flame, 6);
  fruitTree(8, -42, 0.9);
  fruitTree(26, -46, 0.85);

  for (let i = 0; i < 18; i++) {
    const x = -70 + rand() * 40;
    const z = -8 + rand() * 28;
    if (!clear(x, z, 4.2)) continue;
    const stem = cyl(x, 0.16, z, 0.28, 0.02, 0.03, shrub, 4);
    stem.rotation.z = (rand() - 0.5) * 0.4;
    ball(x, 0.32, z, 0.12 + rand() * 0.06, rand() < 0.5 ? grain : fruit, 5);
  }
  for (let i = 0; i < 16; i++) {
    const x = 30 + rand() * 40;
    const z = (rand() - 0.5) * 36;
    if (!clear(x, z, 4)) continue;
    for (let k = 0; k < 3; k++) {
      const stem = cyl(x, 0.28, z, 0.6, 0.02, 0.04, thorn, 4);
      stem.rotation.z = 0.4 + k * 0.5;
      stem.rotation.y = rand() * Math.PI;
    }
  }
  for (let i = 0; i < 22; i++) {
    const x = (rand() - 0.2) * 180;
    const z = (rand() - 0.5) * 90;
    if (!clear(x, z, 6)) continue;
    const s = 0.35 + rand() * 0.8;
    const rock = ball(x, s * 0.16, z, s, rand() < 0.5 ? stone : darkStone, 5);
    rock.scaling.set(1 + rand() * 0.4, 0.5, 1);
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
    return rig;
  };
  const abel = placeRig(
    buildPerson(scene, pal, "abel", {
      robe: [0.55, 0.48, 0.32],
      trim: [0.35, 0.28, 0.16],
      head: [0.62, 0.48, 0.36],
      beard: [0.35, 0.26, 0.16],
      headwear: "wrap",
      staff: true,
    }),
    PEOPLE[0].x,
    PEOPLE[0].z,
    Math.PI,
  );
  const adam = placeRig(
    buildPerson(scene, pal, "adam", {
      robe: [0.46, 0.32, 0.2],
      trim: [0.32, 0.2, 0.12],
      head: [0.55, 0.4, 0.28],
      beard: [0.28, 0.18, 0.12],
      headwear: "wrap",
    }),
    PEOPLE[1].x,
    PEOPLE[1].z,
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
    PEOPLE[2].x,
    PEOPLE[2].z,
    0.6,
  );
  const cain = placeRig(
    buildPerson(scene, pal, "cain", {
      robe: [0.28, 0.16, 0.12],
      trim: [0.45, 0.22, 0.12],
      head: [0.4, 0.24, 0.18],
      beard: [0.18, 0.1, 0.08],
      headwear: "hood",
    }),
    PEOPLE[3].x,
    PEOPLE[3].z,
    -Math.PI / 2,
  );
  const cainMark = MeshBuilder.CreateSphere("cain-mark", { diameter: 0.07, segments: 6 }, scene);
  cainMark.parent = cain.root;
  cainMark.position.set(0, 1.62, 0.12);
  cainMark.material = markGlow;
  // Abel follows, so he has no standing box. A box left on the path blocks the road,
  // and a box that moves with him shoves him into the Seeker.
  for (const rig of [adam, eve, cain]) solidBox(rig.root.position.x, rig.root.position.z, 0.8, 0.8);
  folk.push(abel, adam, eve, cain);

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
  pace("sheep", -56, 16, -48, 20, 0.24);
  pace("sheep", -54, 18, -46, 16, 0.2);
  pace("sheep", -50, 15, -47, 21, 0.22);
  pace("calf", 58, -30, 70, -34, 0.18);
  sit("sheep", ABEL_ALTAR.x + 1.6, ABEL_ALTAR.z + 0.4, Math.PI);
  sit("dog", -62, 3, 0.4);

  const markLight = new PointLight("nod-mark-light", new Vector3(MARK.x, 1.8, MARK.z), scene);
  markLight.diffuse = new Color3(1, 0.78, 0.35);
  markLight.specular = new Color3(1, 0.6, 0.25);
  markLight.intensity = 0.22;
  markLight.range = 6;
  markLight.falloffType = Light.FALLOFF_STANDARD;
  const forgeLight = new PointLight("nod-forge-light", new Vector3(FORGE.x, 1.5, FORGE.z), scene);
  forgeLight.diffuse = new Color3(1, 0.45, 0.16);
  forgeLight.specular = new Color3(1, 0.35, 0.12);
  forgeLight.intensity = 0.4;
  forgeLight.range = 8;
  forgeLight.falloffType = Light.FALLOFF_STANDARD;
  const sethLight = new PointLight("nod-seth-light", new Vector3(SETH.x, 1.1, SETH.z), scene);
  sethLight.diffuse = new Color3(1, 0.62, 0.28);
  sethLight.specular = new Color3(1, 0.5, 0.2);
  sethLight.intensity = 0.28;
  sethLight.range = 7;
  sethLight.falloffType = Light.FALLOFF_STANDARD;

  const tick = (_dt: number, time: number) => {
    forgeLight.intensity = 0.4 * (1 + Math.sin(time * 11) * 0.14 + Math.sin(time * 23) * 0.07);
    sethLight.intensity = 0.28 * (1 + Math.sin(time * 8) * 0.1 + Math.sin(time * 17) * 0.05);
    markLight.intensity = 0.22 * (1 + Math.sin(time * 2.2) * 0.08);
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
    lamps: [markLight, forgeLight, sethLight],
    tick,
  };
}
