import { Color3, Mesh, MeshBuilder, Scene, StandardMaterial, Vector3 } from "@babylonjs/core";
import type { Palette } from "../art/materials";
import { buildHorse, buildPerson, type Rig } from "../art/models";
import { PLACEMENTS } from "../data/layout";
import type { Box } from "./collision";
import { createTerrain, heightAt } from "./terrain";

export interface World {
  colliders: Box[];
  ground: Mesh;
  door: Mesh;
  doorBox: Box;
  key: Mesh;
  jar: Mesh;
  horse: Rig;
  miriam: Rig;
  eli: Rig;
  tobias: Rig;
  watchman: Rig;
}

export const CHAPEL = { minX: 52, maxX: 68, minZ: 48, maxZ: 72 };
export const DOOR_POS = { x: 60, z: 47 };
export const REAR_GAP = { x: 64.5, z: 74 };
export const KEY_POS = { x: 68, z: -78 };
export const JAR_POS = { x: -90, z: 88 };
export const WATCH_HOME = { x: 38, z: -70 };
export const WATCH_PATROL = [
  { x: 38, z: -78 },
  { x: 38, z: -62 },
];

function rng(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const JAR_SHAPE = [
  [0, 0],
  [0.17, 0.02],
  [0.28, 0.24],
  [0.26, 0.52],
  [0.13, 0.72],
  [0.1, 0.82],
  [0.15, 0.87],
].map(([r, y]) => new Vector3(r, y, 0));

export function buildWorld(scene: Scene, pal: Palette): World {
  const colliders: Box[] = [];
  const statics: Mesh[] = [];
  const rand = rng(1189);
  const gy = heightAt;

  const solidBox = (x: number, z: number, w: number, d: number): Box => {
    const b = { minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, solid: true };
    colliders.push(b);
    return b;
  };
  const keep = (m: Mesh, mat: StandardMaterial): Mesh => {
    m.material = mat;
    statics.push(m);
    return m;
  };
  const box = (x: number, y: number, z: number, w: number, h: number, d: number, mat: StandardMaterial, solid = false, rotY = 0) => {
    const b = keep(MeshBuilder.CreateBox("box", { width: w, height: h, depth: d }, scene), mat);
    b.position.set(x, y, z);
    b.rotation.y = rotY;
    if (solid) solidBox(x, z, w, d);
    return b;
  };
  const cyl = (x: number, y: number, z: number, h: number, dTop: number, dBottom: number, mat: StandardMaterial, tess = 12) => {
    const c = keep(MeshBuilder.CreateCylinder("cyl", { height: h, diameterTop: dTop, diameterBottom: dBottom, tessellation: tess }, scene), mat);
    c.position.set(x, y, z);
    return c;
  };
  const ball = (x: number, y: number, z: number, d: number, mat: StandardMaterial, seg = 8) => {
    const s = keep(MeshBuilder.CreateSphere("ball", { diameter: d, segments: seg }, scene), mat);
    s.position.set(x, y, z);
    return s;
  };
  /** Axis-aligned wall split into ~3 m blocks so the stone texture keeps its scale. */
  const segWall = (x0: number, z0: number, x1: number, z1: number, h: number, t: number, mat: StandardMaterial) => {
    const alongX = z0 === z1;
    const len = alongX ? x1 - x0 : z1 - z0;
    const n = Math.max(1, Math.round(len / 3));
    const seg = len / n;
    for (let i = 0; i < n; i++) {
      const c = (alongX ? x0 : z0) + seg * (i + 0.5);
      if (alongX) box(c, h / 2, z0, seg, h, t, mat);
      else box(x0, h / 2, c, t, h, seg, mat);
    }
    if (alongX) solidBox((x0 + x1) / 2, z0, len, t);
    else solidBox(x0, (z0 + z1) / 2, t, len);
  };
  const lathe = (x: number, z: number, s: number, mat: StandardMaterial) => {
    const j = MeshBuilder.CreateLathe("jar", { shape: JAR_SHAPE, tessellation: 14, sideOrientation: Mesh.DOUBLESIDE }, scene);
    j.scaling.setAll(s);
    j.position.set(x, gy(x, z), z);
    j.material = mat;
    return j;
  };

  const sand = pal.mat("sand", [0.82, 0.7, 0.52], "sand", 40);
  const stone = pal.mat("stone", [0.68, 0.62, 0.53], "grain", 2);
  const ashlar = pal.mat("ashlar", [0.74, 0.67, 0.57], "ashlar");
  const lowWall = pal.mat("low-wall", [0.62, 0.57, 0.5], "ashlar");
  const darkStone = pal.mat("dark-stone", [0.45, 0.42, 0.39], "grain", 1.5);
  const wood = pal.mat("wood", [0.45, 0.31, 0.19], "wood");
  const darkWood = pal.mat("dark-wood", [0.3, 0.2, 0.12], "wood");
  const palmLeaf = pal.mat("palm-leaf", [0.3, 0.48, 0.2], "grain");
  const palmTrunk = pal.mat("palm-trunk", [0.5, 0.38, 0.26], "wood", 2);
  const shrub = pal.mat("shrub", [0.42, 0.45, 0.25], "grain");
  const dryGrass = pal.mat("dry-grass", [0.62, 0.55, 0.32], "grain");
  const cypress = pal.mat("cypress", [0.16, 0.3, 0.17], "grain", 2);
  const flame = pal.glow("flame", [1, 0.55, 0.18]);
  const iron = pal.mat("iron", [0.25, 0.24, 0.23]);
  const clay = pal.mat("clay", [0.68, 0.4, 0.25], "grain");
  const wool = pal.mat("wool", [0.92, 0.9, 0.84], "cloth");
  const sheepFace = pal.mat("sheep-face", [0.18, 0.15, 0.13]);
  const windowDark = pal.mat("window", [0.06, 0.05, 0.05]);
  const bronze = pal.mat("bronze", [0.55, 0.4, 0.2]);
  const tentCloth = pal.mat("tent-cloth", [0.66, 0.55, 0.4], "stripes");
  const rugMat = pal.mat("rug", [0.55, 0.2, 0.16], "stripes", 2);
  const tobiasCloth = pal.mat("tobias-cloth", [0.38, 0.25, 0.48], "stripes");
  const tableCloth = pal.mat("table-cloth", [0.75, 0.62, 0.32], "cloth");
  const spark = pal.glow("spark", [0.75, 0.9, 1]);

  const ground = createTerrain(scene, sand);

  // Camp (start). Miriam keeps it.
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    ball(Math.cos(a) * 0.75, 0.12, -58 + Math.sin(a) * 0.75, 0.32, darkStone, 6);
  }
  for (const rot of [0.4, -0.5, 1.6]) {
    const log = cyl(0, 0.14, -58, 1.3, 0.14, 0.16, darkWood, 8);
    log.rotation.z = Math.PI / 2;
    log.rotation.y = rot;
  }
  cyl(0, 0.55, -58, 0.9, 0, 0.55, flame, 8);
  for (const [tx, tz, rot] of [
    [-7, -62, 0.3],
    [8, -63, -0.4],
  ]) {
    const tent = cyl(tx, 1.5, tz, 3, 0.15, 4.4, tentCloth, 6);
    tent.rotation.y = rot;
    cyl(tx, 3.2, tz, 0.6, 0.06, 0.06, darkWood, 6);
    solidBox(tx, tz, 3.2, 3.2);
  }
  box(3.5, 0.02, -60.5, 2.2, 0.03, 1.4, rugMat, false, 0.2);
  for (const [jx, jz, s] of [
    [-4.2, -59.5, 1],
    [-4.8, -58.8, 0.75],
    [5.8, -61, 0.9],
  ]) {
    statics.push(lathe(jx, jz, s, clay));
  }

  // Day 1: the ruined arch, built from stacked column drums.
  for (const px of [-4, 4]) {
    for (let i = 0; i < 5; i++) cyl(px + (rand() - 0.5) * 0.06, 0.65 + i * 1.28, -25, 1.25, 1.18, 1.25, stone, 14);
    box(px, 6.55, -25, 1.6, 0.35, 1.6, ashlar);
    solidBox(px, -25, 1.3, 1.3);
  }
  box(0, 7.2, -25, 10, 1.1, 1.5, ashlar);
  box(0, 7.95, -25, 1.3, 0.5, 1.5, ashlar);
  for (const [fx, fz, rot] of [
    [-8.5, -21, 0.3],
    [7, -29.5, -0.8],
  ]) {
    const drum = cyl(fx, 0.62, fz, 1.25, 1.18, 1.25, stone, 14);
    drum.rotation.z = Math.PI / 2;
    drum.rotation.y = rot;
    solidBox(fx, fz, 1.4, 1.4);
  }

  // Day 2: standing stones.
  for (const [sx, sz] of [
    [-57, -12],
    [-63, -8],
    [-69, 13],
    [-75, 7],
    [-47, 24],
    [-53, 20],
  ]) {
    const h = 4.5 + rand() * 2;
    const s = box(sx, gy(sx, sz) + h / 2 - 0.2, sz, 1.3, h, 0.8, darkStone, true, rand() * Math.PI);
    s.rotation.z = (rand() - 0.5) * 0.12;
  }

  // Day 3: the oasis.
  const water = MeshBuilder.CreateDisc("water", { radius: 17, tessellation: 64 }, scene);
  water.rotation.x = Math.PI / 2;
  water.position.set(-60, -0.15, 60);
  const waterMat = new StandardMaterial("water", scene);
  waterMat.diffuseColor = new Color3(0.12, 0.32, 0.42);
  waterMat.specularColor = new Color3(0.6, 0.6, 0.6);
  waterMat.specularPower = 64;
  waterMat.emissiveColor = new Color3(0.02, 0.06, 0.08);
  waterMat.alpha = 0.88;
  water.material = waterMat;

  const palm = (px: number, pz: number) => {
    const lean = rand() * Math.PI * 2;
    let x = px;
    let z = pz;
    let y = gy(px, pz);
    for (let i = 0; i < 6; i++) {
      cyl(x, y + 0.55, z, 1.12, 0.32 - i * 0.025, 0.38 - i * 0.025, palmTrunk, 8);
      y += 1.05;
      x += Math.cos(lean) * i * 0.06;
      z += Math.sin(lean) * i * 0.06;
    }
    for (let k = 0; k < 9; k++) {
      const yaw = (k / 9) * Math.PI * 2 + rand() * 0.3;
      const droop = 0.35 + rand() * 0.35;
      const len = 2.8;
      const f = box(
        x + Math.sin(yaw) * Math.cos(droop) * len * 0.5,
        y - Math.sin(droop) * len * 0.5,
        z + Math.cos(yaw) * Math.cos(droop) * len * 0.5,
        0.55,
        0.05,
        len,
        palmLeaf,
      );
      f.rotation.y = yaw;
      f.rotation.x = droop;
    }
    for (let k = 0; k < 3; k++) ball(x + (rand() - 0.5) * 0.4, y - 0.25, z + (rand() - 0.5) * 0.4, 0.22, clay, 6);
    solidBox(px, pz, 0.7, 0.7);
  };
  for (const deg of [20, 70, 115, 145, 200, 240, 280, 320]) {
    const a = (deg * Math.PI) / 180;
    palm(-60 + Math.cos(a) * 17.5, 60 + Math.sin(a) * 17.5);
  }
  for (let i = 0; i < 40; i++) {
    const a = rand() * Math.PI * 2;
    const r = 14.5 + rand() * 2;
    const rx = -60 + Math.cos(a) * r;
    const rz = 60 + Math.sin(a) * r;
    const reed = cyl(rx, gy(rx, rz) + 0.6, rz, 1.2 + rand() * 0.6, 0.02, 0.06, shrub, 5);
    reed.rotation.z = (rand() - 0.5) * 0.3;
  }

  cyl(-92, 0.5, 92, 1, 2.3, 2.4, stone, 18);
  cyl(-92, 1.02, 92, 0.04, 1.7, 1.7, windowDark, 18);
  for (const ox of [-1.2, 1.2]) box(-92 + ox, 1.3, 92, 0.15, 2.6, 0.15, darkWood);
  box(-92, 2.55, 92, 2.7, 0.15, 0.15, darkWood);
  solidBox(-92, 92, 2.4, 2.4);

  const jar = lathe(JAR_POS.x, JAR_POS.z, 1, clay);
  const jarSpark = MeshBuilder.CreateSphere("spark", { diameter: 0.18, segments: 6 }, scene);
  jarSpark.parent = jar;
  jarSpark.position.y = 1.15;
  jarSpark.material = spark;

  // Day 4: the ring of the great lights.
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const px = 70 + Math.cos(a) * 10;
    const pz = Math.sin(a) * 10;
    const h = 4 + rand() * 3;
    cyl(px, h / 2, pz, h, 0.85, 1, stone, 12);
    box(px, h + 0.15, pz, 1.25, 0.3, 1.25, ashlar);
    solidBox(px, pz, 1, 1);
  }
  for (const a of [0.9, 3.6]) {
    const fx = 70 + Math.cos(a) * 14;
    const fz = Math.sin(a) * 14;
    const fallen = cyl(fx, 0.45, fz, 5, 0.85, 0.9, stone, 12);
    fallen.rotation.z = Math.PI / 2;
    fallen.rotation.y = a;
  }
  box(70, 0.45, 0, 2.2, 0.9, 2.2, darkStone, true);
  box(70, 0.95, 0, 2.5, 0.1, 2.5, ashlar);

  // Day 5: the old cemetery, watched from the west.
  segWall(45, -82, 45, -73, 1.4, 0.6, lowWall);
  segWall(45, -67, 45, -58, 1.4, 0.6, lowWall);
  segWall(75, -82, 75, -66, 1.4, 0.6, lowWall);
  segWall(75, -62, 75, -58, 1.4, 0.6, lowWall);
  segWall(45, -58, 75, -58, 1.4, 0.6, lowWall);
  segWall(45, -82, 75, -82, 1.4, 0.6, lowWall);
  for (let x = 48; x <= 72; x += 6) {
    cyl(x, 3.6, -55.5, 7, 0.1, 1.7, cypress, 10);
    cyl(x, 0.4, -55.5, 0.8, 0.25, 0.25, darkWood, 6);
    solidBox(x, -55.5, 1, 1);
  }
  const graveTargets = [...PLACEMENTS.filter((p) => p.site === "cemetery"), KEY_POS];
  for (let gx = 49; gx <= 71; gx += 4) {
    for (let gz = -79; gz <= -61; gz += 4) {
      if (graveTargets.some((t) => Math.hypot(t.x - gx, t.z - gz) < 2.5)) continue;
      if (rand() < 0.25) {
        box(gx, 0.6, gz, 0.15, 1.2, 0.15, darkStone);
        box(gx, 0.85, gz, 0.6, 0.15, 0.15, darkStone);
      } else {
        box(gx, 0.4, gz, 0.8, 0.8, 0.2, darkStone);
        const top = cyl(gx, 0.8, gz, 0.2, 0.8, 0.8, darkStone, 14);
        top.rotation.x = Math.PI / 2;
      }
      box(gx, 0.08, gz + 0.95, 0.85, 0.16, 1.6, stone);
    }
  }
  box(KEY_POS.x, 0.3, KEY_POS.z - 1.2, 1.4, 0.6, 2.2, ashlar);
  box(KEY_POS.x, 1.0, KEY_POS.z - 2.4, 0.2, 2, 0.2, darkStone);
  box(KEY_POS.x, 1.45, KEY_POS.z - 2.4, 1, 0.2, 0.2, darkStone);
  const key = MeshBuilder.CreateBox("key", { width: 0.5, height: 0.08, depth: 0.15 }, scene);
  key.position.set(KEY_POS.x, 0.65, KEY_POS.z - 1.2);
  key.material = iron;
  const keySpark = MeshBuilder.CreateSphere("spark", { diameter: 0.18, segments: 6 }, scene);
  keySpark.parent = key;
  keySpark.position.y = 0.35;
  keySpark.material = spark;
  for (let z = -80; z <= -60; z += 5) {
    box(35.5, 0.8, z, 0.15, 1.6, 0.15, darkWood);
    box(35.5, 1.65, z, 0.3, 0.32, 0.3, iron);
    ball(35.5, 1.65, z, 0.2, flame, 6);
  }

  // Day 6: Eli's pasture.
  const postsX: number[] = [];
  for (let x = -12; x <= 32; x += 4) postsX.push(x);
  const postsZ: number[] = [];
  for (let z = 52; z <= 102; z += 5) postsZ.push(z);
  for (const x of postsX) {
    for (const z of [52, 102]) {
      if (z === 52 && x > 6 && x < 14) continue;
      box(x, gy(x, z) + 0.6, z, 0.16, 1.2, 0.16, darkWood);
    }
  }
  for (const z of postsZ) for (const x of [-12, 32]) box(x, gy(x, z) + 0.6, z, 0.16, 1.2, 0.16, darkWood);
  for (const z of [52, 102]) {
    for (const [x0, x1] of z === 52 ? [[-12, 6], [14, 32]] : [[-12, 32]]) {
      for (const h of [0.5, 0.95]) box((x0 + x1) / 2, h, z, x1 - x0, 0.07, 0.06, wood);
    }
  }
  for (const x of [-12, 32]) for (const h of [0.5, 0.95]) box(x, h, 77, 0.06, 0.07, 50, wood);
  box(18, 0.35, 70, 2.5, 0.5, 0.7, wood, true);
  box(18, 0.58, 70, 2.3, 0.06, 0.5, pal.mat("trough-water", [0.15, 0.3, 0.38]));
  for (let i = 0; i < 9; i++) {
    const sx = -6 + rand() * 32;
    const sz = 60 + rand() * 36;
    const rot = rand() * Math.PI * 2;
    const fx = Math.sin(rot);
    const fz = Math.cos(rot);
    const body = ball(sx, 0.62, sz, 1, wool, 10);
    body.scaling.set(0.75, 0.62, 1.05);
    body.rotation.y = rot;
    ball(sx + fx * 0.55, 0.78, sz + fz * 0.55, 0.32, sheepFace, 8);
    for (const [lx, lz] of [
      [-0.2, 0.3],
      [0.2, 0.3],
      [-0.2, -0.3],
      [0.2, -0.3],
    ]) {
      cyl(sx + lx * fz + lz * fx, 0.2, sz - lx * fx + lz * fz, 0.4, 0.07, 0.07, sheepFace, 5);
    }
  }

  // Day 6: the ruined scriptorium. Front door locked; the north wall has fallen in.
  segWall(52, 48, 52, 72, 6, 1, ashlar);
  segWall(68, 48, 68, 72, 6, 1, ashlar);
  segWall(52, 48, 58.5, 48, 6, 1, ashlar);
  segWall(61.5, 48, 68, 48, 6, 1, ashlar);
  segWall(52, 72, 63, 72, 6, 1, ashlar);
  segWall(66, 72, 68, 72, 2.6, 1, ashlar);
  colliders.push({ minX: 58.5, maxX: 61.5, minZ: 47.5, maxZ: 48.5, solid: true, horseOnly: true });
  colliders.push({ minX: 63, maxX: 66, minZ: 71.5, maxZ: 72.5, solid: true, horseOnly: true });
  for (const [bx, bz] of [
    [51.6, 47.6],
    [68.4, 47.6],
    [51.6, 72.4],
  ]) {
    box(bx, 3.2, bz, 1.6, 6.4, 1.6, ashlar, true);
  }
  box(60, 5.4, 48, 3.2, 1.2, 1.1, ashlar);
  box(60, 7.1, 48, 4, 2.2, 1, ashlar);
  box(60, 7.1, 47.45, 1.3, 1.5, 0.1, windowDark);
  ball(60, 7.2, 47.6, 0.6, bronze, 10);
  for (const z of [54, 60, 66]) {
    for (const wx of [51.45, 52.55, 67.45, 68.55]) {
      box(wx, 3.3, z, 0.1, 1.8, 0.9, windowDark);
      const top = cyl(wx, 4.2, z, 0.1, 0.9, 0.9, windowDark, 14);
      top.rotation.z = Math.PI / 2;
    }
  }
  box(60, 0.03, 60, 15, 0.06, 23, pal.mat("floor", [0.55, 0.5, 0.45], "ashlar", 5));
  for (const z of [52, 58, 64, 70]) box(60, 6.2, z, 17, 0.4, 0.4, darkWood);
  box(55, 0.6, 62, 1, 1.2, 0.8, wood, true);
  cyl(55.4, 1.35, 61.75, 0.25, 0.06, 0.06, pal.mat("wax", [0.92, 0.88, 0.78]), 6);
  ball(55.4, 1.53, 61.75, 0.08, flame, 5);
  for (const z of [57, 60.5]) box(60, 0.3, z, 4, 0.6, 0.6, wood, true);
  box(52.85, 1.5, 58, 0.6, 3, 4, darkWood, true);
  for (let i = 0; i < 18; i++) {
    const shelf = Math.floor(i / 6);
    const bz = 56.3 + (i % 6) * 0.6 + rand() * 0.1;
    const tint: [number, number, number] = [[0.45, 0.15, 0.12], [0.2, 0.25, 0.4], [0.35, 0.3, 0.15]][i % 3] as [number, number, number];
    box(53.1, 0.75 + shelf * 0.9, bz, 0.35, 0.55 + rand() * 0.15, 0.18, pal.mat(`book-${i % 3}`, tint, "cloth"));
  }
  for (const [rx, rz, s] of [
    [61.6, 74, 1.2],
    [67.6, 74.5, 1],
    [64.6, 75.6, 0.6],
    [63.2, 70.6, 0.7],
  ]) {
    const r = box(rx, s * 0.4, rz, s * 1.3, s * 0.8, s, ashlar);
    r.rotation.y = rand() * Math.PI;
  }
  const door = MeshBuilder.CreateBox("door", { width: 3, height: 4.6, depth: 0.25 }, scene);
  door.position.set(60, 2.3, 48);
  door.material = darkWood;
  for (const by of [-1.4, 1.4]) {
    const band = MeshBuilder.CreateBox("door-band", { width: 3, height: 0.15, depth: 0.3 }, scene);
    band.parent = door;
    band.position.y = by;
    band.material = iron;
  }
  const ring = MeshBuilder.CreateTorus("door-ring", { diameter: 0.25, thickness: 0.04, tessellation: 12 }, scene);
  ring.parent = door;
  ring.position.set(0.9, 0, -0.17);
  ring.rotation.x = Math.PI / 2;
  ring.material = iron;
  const doorBox = solidBox(60, 48, 3, 0.8);

  // Tobias's tent.
  box(30, 1.5, 34, 6, 3, 6, tobiasCloth, true);
  const roof = cyl(30, 4, 34, 2, 0, 8.6, tobiasCloth, 4);
  roof.rotation.y = Math.PI / 4;
  const awning = box(30, 2.75, 29.6, 6.4, 0.08, 3, tobiasCloth);
  awning.rotation.x = 0.18;
  for (const ax of [27.2, 32.8]) box(ax, 1.25, 28.2, 0.12, 2.5, 0.12, darkWood);
  box(30, 0.02, 29.8, 5, 0.03, 2.8, rugMat);
  box(33, 0.45, 29, 1.6, 0.9, 1, wood, true);
  box(33, 0.91, 29, 1.7, 0.03, 1.1, tableCloth);
  for (const [cx, cz] of [
    [27.6, 30.6],
    [28.4, 30.8],
  ]) {
    box(cx, 0.3, cz, 0.8, 0.6, 0.55, darkWood, true);
    box(cx, 0.62, cz, 0.84, 0.06, 0.58, bronze);
  }
  statics.push(lathe(34.2, 30.4, 0.8, clay));

  // People. Nine in ten would help you; the watchman is the exception here.
  const placeRig = (rig: Rig, x: number, z: number, faceY = 0) => {
    rig.root.position.set(x, gy(x, z), z);
    rig.root.rotation.y = faceY;
    return rig;
  };
  const miriam = placeRig(
    buildPerson(scene, pal, "miriam", { robe: [0.55, 0.22, 0.18], trim: [0.8, 0.7, 0.5], head: [0.86, 0.8, 0.7], scale: 0.95 }),
    4,
    -55,
    Math.PI,
  );
  const eli = placeRig(
    buildPerson(scene, pal, "eli", { robe: [0.45, 0.4, 0.28], trim: [0.3, 0.25, 0.18], head: [0.7, 0.65, 0.55], beard: [0.75, 0.73, 0.7], staff: true }),
    5,
    65,
    Math.PI,
  );
  const tobias = placeRig(
    buildPerson(scene, pal, "tobias", { robe: [0.32, 0.18, 0.42], trim: [0.8, 0.62, 0.25], head: [0.28, 0.16, 0.32], beard: [0.15, 0.1, 0.08], headwear: "turban", scale: 1.05 }),
    30,
    29.5,
    Math.PI,
  );
  for (const r of [miriam, eli, tobias]) solidBox(r.root.position.x, r.root.position.z, 0.8, 0.8);
  const watchman = placeRig(
    buildPerson(scene, pal, "watchman", { robe: [0.14, 0.14, 0.16], trim: [0.35, 0.1, 0.08], head: [0.1, 0.1, 0.12], headwear: "hood", lantern: true, staff: true, scale: 1.08 }),
    WATCH_HOME.x,
    WATCH_HOME.z,
  );
  const horse = placeRig(buildHorse(scene, pal), 14, 64, -0.6);

  // Scattered rocks and scrub, kept clear of sites and verses.
  const centers = [
    [0, -60],
    [0, -25],
    [60, 60],
    [60, -70],
    [70, 0],
    [-60, 60],
    [10, 77],
    [30, 32],
  ];
  const clear = (x: number, z: number, siteR: number) =>
    !centers.some(([cx, cz]) => Math.hypot(cx - x, cz - z) < siteR) &&
    !PLACEMENTS.some((p) => Math.hypot(p.x - x, p.z - z) < 6);
  for (let i = 0; i < 110; i++) {
    const x = (rand() - 0.5) * 290;
    const z = (rand() - 0.5) * 290;
    if (!clear(x, z, 22)) continue;
    const s = 0.4 + rand() * 1.6;
    const rock = ball(x, gy(x, z) + s * 0.15, z, 1, rand() < 0.5 ? stone : darkStone, 5);
    rock.scaling.set(s * (1 + rand()), s * 0.6, s);
    rock.rotation.y = rand() * Math.PI;
  }
  for (let i = 0; i < 220; i++) {
    const x = (rand() - 0.5) * 290;
    const z = (rand() - 0.5) * 290;
    if (!clear(x, z, 12)) continue;
    const y = gy(x, z);
    if (rand() < 0.5) {
      const b = ball(x, y + 0.25, z, 0.6 + rand() * 0.7, shrub, 6);
      b.scaling.y = 0.6;
    } else {
      for (let k = 0; k < 4; k++) {
        const blade = cyl(x + (rand() - 0.5) * 0.4, y + 0.3, z + (rand() - 0.5) * 0.4, 0.6, 0, 0.08, dryGrass, 4);
        blade.rotation.z = (rand() - 0.5) * 0.6;
        blade.rotation.x = (rand() - 0.5) * 0.6;
      }
    }
  }

  // Merge static scenery per material: thousands of parts become a few dozen draw calls.
  const groups = new Map<StandardMaterial, Mesh[]>();
  for (const m of statics) {
    const k = m.material as StandardMaterial;
    const list = groups.get(k) ?? [];
    list.push(m);
    groups.set(k, list);
  }
  for (const list of groups.values()) {
    const merged = list.length > 1 ? Mesh.MergeMeshes(list, true, true) : list[0];
    merged?.freezeWorldMatrix();
  }

  return { colliders, ground, door, doorBox, key, jar, horse, miriam, eli, tobias, watchman };
}
