import { Color3, Mesh, MeshBuilder, Scene, StandardMaterial } from "@babylonjs/core";
import { PLACEMENTS } from "../data/layout";
import type { Box } from "./collision";

export interface World {
  colliders: Box[];
  door: Mesh;
  doorBox: Box;
  key: Mesh;
  jar: Mesh;
  horse: Mesh;
  miriam: Mesh;
  eli: Mesh;
  tobias: Mesh;
  watchman: Mesh;
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

type RGB = [number, number, number];

function rng(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildWorld(scene: Scene): World {
  const colliders: Box[] = [];
  const mats = new Map<string, StandardMaterial>();
  const rand = rng(1189);

  const mat = (name: string, rgb: RGB, glowing = false): StandardMaterial => {
    let m = mats.get(name);
    if (!m) {
      m = new StandardMaterial(name, scene);
      m.diffuseColor = new Color3(...rgb);
      m.specularColor = new Color3(0.04, 0.04, 0.04);
      if (glowing) {
        m.emissiveColor = new Color3(...rgb);
        m.disableLighting = true;
      }
      mats.set(name, m);
    }
    return m;
  };

  const solidBox = (x: number, z: number, w: number, d: number): Box => {
    const b = { minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, solid: true };
    colliders.push(b);
    return b;
  };

  const block = (
    name: string,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    m: StandardMaterial,
    solid = true,
  ): Mesh => {
    const b = MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene);
    b.position.set(x, y, z);
    b.material = m;
    if (solid) solidBox(x, z, w, d);
    return b;
  };

  const wall = (x: number, z: number, w: number, d: number, h: number, m: StandardMaterial) =>
    block("wall", x, h / 2, z, w, h, d, m);

  const person = (name: string, x: number, z: number, cloth: RGB): Mesh => {
    const body = MeshBuilder.CreateCylinder(
      name,
      { height: 1.5, diameterTop: 0.55, diameterBottom: 0.95, tessellation: 14 },
      scene,
    );
    body.position.set(x, 0.75, z);
    body.material = mat(`${name}-cloth`, cloth);
    const head = MeshBuilder.CreateSphere(`${name}-head`, { diameter: 0.5, segments: 10 }, scene);
    head.parent = body;
    head.position.y = 1.0;
    head.material = mat("skin", [0.62, 0.45, 0.33]);
    return body;
  };

  const sand = mat("sand", [0.78, 0.67, 0.48]);
  const stone = mat("stone", [0.64, 0.58, 0.5]);
  const darkStone = mat("dark-stone", [0.43, 0.4, 0.37]);
  const wood = mat("wood", [0.42, 0.28, 0.16]);
  const palmGreen = mat("palm", [0.27, 0.45, 0.2]);
  const flame = mat("flame", [1, 0.55, 0.18], true);

  const ground = MeshBuilder.CreateGround("ground", { width: 340, height: 340 }, scene);
  ground.material = sand;

  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const dune = MeshBuilder.CreateSphere("dune", { diameter: 1, segments: 12 }, scene);
    dune.scaling.set(80, 16 + (i % 3) * 8, 80);
    dune.position.set(Math.cos(a) * 190, -3, Math.sin(a) * 190);
    dune.material = mat("dune", [0.72, 0.6, 0.42]);
  }

  // Camp (start). Miriam keeps it.
  block("log", 0, 0.15, -58, 1.6, 0.25, 0.3, wood, false);
  block("log", 0, 0.15, -58, 0.3, 0.25, 1.6, wood, false);
  const fire = MeshBuilder.CreateSphere("fire", { diameter: 0.7, segments: 8 }, scene);
  fire.scaling.y = 1.5;
  fire.position.set(0, 0.55, -58);
  fire.material = flame;
  for (const [tx, tz] of [
    [-7, -62],
    [8, -63],
  ]) {
    const tent = MeshBuilder.CreateCylinder("tent", { height: 3, diameterTop: 0, diameterBottom: 4.2, tessellation: 4 }, scene);
    tent.position.set(tx, 1.5, tz);
    tent.material = mat("tent-cloth", [0.66, 0.55, 0.4]);
    solidBox(tx, tz, 3, 3);
  }

  // Day 1: the ruined arch.
  wall(-4, -25, 1.3, 1.3, 6.5, stone);
  wall(4, -25, 1.3, 1.3, 6.5, stone);
  block("lintel", 0, 7, -25, 10, 1.2, 1.5, stone, false);
  block("fallen", -8, 0.5, -21, 2, 1, 1.2, stone);
  block("fallen", 7, 0.4, -29, 1.6, 0.8, 1.6, stone);

  // Day 2: standing stones.
  for (const [sx, sz] of [
    [-57, -12],
    [-63, -8],
    [-69, 13],
    [-75, 7],
    [-47, 24],
    [-53, 20],
  ]) {
    wall(sx, sz, 1.2, 0.8, 4.5 + rand() * 2, darkStone);
  }

  // Day 3: the oasis.
  const water = MeshBuilder.CreateDisc("water", { radius: 16, tessellation: 48 }, scene);
  water.rotation.x = Math.PI / 2;
  water.position.set(-60, 0.06, 60);
  const waterMat = mat("water", [0.18, 0.42, 0.55]);
  waterMat.specularColor = new Color3(0.35, 0.35, 0.35);
  waterMat.alpha = 0.92;
  water.material = waterMat;
  for (const deg of [20, 70, 115, 145, 200, 240, 280, 320]) {
    const a = (deg * Math.PI) / 180;
    const px = -60 + Math.cos(a) * 17.5;
    const pz = 60 + Math.sin(a) * 17.5;
    const trunk = MeshBuilder.CreateCylinder("palm", { height: 6, diameterTop: 0.3, diameterBottom: 0.55 }, scene);
    trunk.position.set(px, 3, pz);
    trunk.material = wood;
    const crown = MeshBuilder.CreateSphere("crown", { diameter: 1, segments: 8 }, scene);
    crown.scaling.set(3.4, 0.8, 3.4);
    crown.position.set(px, 6.1, pz);
    crown.material = palmGreen;
    solidBox(px, pz, 0.6, 0.6);
  }
  const well = MeshBuilder.CreateCylinder("well", { height: 1, diameter: 2.2, tessellation: 16 }, scene);
  well.position.set(-92, 0.5, 92);
  well.material = stone;
  solidBox(-92, 92, 2.2, 2.2);

  const jar = MeshBuilder.CreateCylinder("jar", { height: 0.8, diameterTop: 0.4, diameterBottom: 0.55, tessellation: 12 }, scene);
  jar.position.set(JAR_POS.x, 0.4, JAR_POS.z);
  jar.material = mat("clay", [0.62, 0.36, 0.22]);
  const jarSpark = MeshBuilder.CreateSphere("spark", { diameter: 0.18, segments: 6 }, scene);
  jarSpark.parent = jar;
  jarSpark.position.y = 0.75;
  jarSpark.material = mat("spark", [0.75, 0.9, 1], true);

  // Day 4: the ring of the great lights.
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    wall(70 + Math.cos(a) * 10, Math.sin(a) * 10, 1, 1, 4 + rand() * 3, stone);
  }
  block("altar", 70, 0.4, 0, 2, 0.8, 2, darkStone);

  // Day 5: the old cemetery, watched from the west.
  const lowWall = mat("low-wall", [0.55, 0.5, 0.44]);
  const cw = (x: number, z: number, w: number, d: number) => wall(x, z, w, d, 1.4, lowWall);
  cw(45, -77.5, 0.6, 9);
  cw(45, -62.5, 0.6, 9);
  cw(75, -74, 0.6, 16);
  cw(75, -60, 0.6, 4);
  cw(60, -58, 30.6, 0.6);
  cw(60, -82, 30.6, 0.6);
  const graveTargets = [...PLACEMENTS.filter((p) => p.site === "cemetery"), KEY_POS];
  for (let gx = 49; gx <= 71; gx += 4) {
    for (let gz = -79; gz <= -61; gz += 4) {
      if (graveTargets.some((t) => Math.hypot(t.x - gx, t.z - gz) < 2.5)) continue;
      const g = block("grave", gx, 0.5, gz, 0.9, 1, 0.25, darkStone, false);
      g.rotation.z = (rand() - 0.5) * 0.25;
    }
  }
  block("sexton-grave", KEY_POS.x, 0.35, KEY_POS.z - 1.2, 1.4, 0.7, 2.2, darkStone, false);
  block("sexton-stone", KEY_POS.x, 0.9, KEY_POS.z - 2.4, 1.2, 1.8, 0.3, darkStone, false);
  const key = MeshBuilder.CreateBox("key", { width: 0.5, height: 0.08, depth: 0.15 }, scene);
  key.position.set(KEY_POS.x, 0.75, KEY_POS.z - 1.2);
  key.material = mat("iron", [0.35, 0.33, 0.3]);
  const keySpark = MeshBuilder.CreateSphere("spark", { diameter: 0.18, segments: 6 }, scene);
  keySpark.parent = key;
  keySpark.position.y = 0.35;
  keySpark.material = mat("spark", [0.75, 0.9, 1], true);
  for (let z = -80; z <= -60; z += 5) {
    block("lantern-post", 35.5, 0.8, z, 0.15, 1.6, 0.15, wood, false);
    const l = MeshBuilder.CreateSphere("lantern", { diameter: 0.3, segments: 6 }, scene);
    l.position.set(35.5, 1.7, z);
    l.material = flame;
  }

  // Day 6: Eli's pasture.
  for (let x = -12; x <= 32; x += 4) {
    block("fence", x, 0.6, 52, 0.15, 1.2, 0.15, wood, false);
    block("fence", x, 0.6, 102, 0.15, 1.2, 0.15, wood, false);
  }
  for (let z = 52; z <= 102; z += 4) {
    block("fence", -12, 0.6, z, 0.15, 1.2, 0.15, wood, false);
    block("fence", 32, 0.6, z, 0.15, 1.2, 0.15, wood, false);
  }
  const wool = mat("wool", [0.9, 0.88, 0.82]);
  for (let i = 0; i < 9; i++) {
    const sx = -6 + rand() * 32;
    const sz = 60 + rand() * 36;
    const sheep = MeshBuilder.CreateBox("sheep", { width: 0.7, height: 0.6, depth: 1.1 }, scene);
    sheep.position.set(sx, 0.55, sz);
    sheep.rotation.y = rand() * Math.PI * 2;
    sheep.material = wool;
  }

  const horse = MeshBuilder.CreateBox("horse", { width: 0.8, height: 0.9, depth: 2 }, scene);
  horse.position.set(14, 1.25, 64);
  const horseMat = mat("horse", [0.4, 0.26, 0.15]);
  horse.material = horseMat;
  const neck = MeshBuilder.CreateBox("horse-neck", { width: 0.4, height: 0.9, depth: 0.5 }, scene);
  neck.parent = horse;
  neck.position.set(0, 0.55, 0.95);
  neck.rotation.x = -0.5;
  neck.material = horseMat;
  const hHead = MeshBuilder.CreateBox("horse-head", { width: 0.35, height: 0.35, depth: 0.75 }, scene);
  hHead.parent = horse;
  hHead.position.set(0, 0.95, 1.3);
  hHead.material = horseMat;
  for (const [lx, lz] of [
    [-0.28, -0.75],
    [0.28, -0.75],
    [-0.28, 0.75],
    [0.28, 0.75],
  ]) {
    const leg = MeshBuilder.CreateCylinder("horse-leg", { height: 0.9, diameter: 0.18 }, scene);
    leg.parent = horse;
    leg.position.set(lx, -0.85, lz);
    leg.material = horseMat;
  }

  // Day 6: the ruined scriptorium. Front door locked; the north wall has fallen in.
  const chapelStone = mat("chapel-stone", [0.7, 0.63, 0.54]);
  wall(52, 60, 1, 24, 6, chapelStone);
  wall(68, 60, 1, 24, 6, chapelStone);
  wall(55.25, 48, 6.5, 1, 6, chapelStone);
  wall(64.75, 48, 6.5, 1, 6, chapelStone);
  block("lintel", 60, 5.4, 48, 3, 1.2, 1, chapelStone, false);
  wall(57.5, 72, 11, 1, 6, chapelStone);
  wall(67, 72, 2, 1, 3, chapelStone);
  colliders.push({ minX: 58.5, maxX: 61.5, minZ: 47.5, maxZ: 48.5, solid: true, horseOnly: true });
  colliders.push({ minX: 63, maxX: 66, minZ: 71.5, maxZ: 72.5, solid: true, horseOnly: true });
  block("rubble", 61.8, 0.5, 74, 1.6, 1, 1.4, chapelStone, false);
  block("rubble", 67.4, 0.4, 74.6, 1.4, 0.8, 1.2, chapelStone, false);
  block("floor", 60, 0.02, 60, 15, 0.04, 23, mat("floor", [0.5, 0.45, 0.4]), false);
  block("lectern", 55, 0.6, 62, 1, 1.2, 0.8, wood);
  for (const z of [52, 58, 64, 70]) block("beam", 60, 6.2, z, 17, 0.4, 0.4, wood, false);
  const door = MeshBuilder.CreateBox("door", { width: 3, height: 4.6, depth: 0.25 }, scene);
  door.position.set(60, 2.3, 48);
  door.material = wood;
  const doorBox = solidBox(60, 48, 3, 0.8);

  // Tobias's tent.
  block("tobias-tent", 30, 1.5, 34, 6, 3, 6, mat("tobias-cloth", [0.36, 0.24, 0.45]));
  const roof = MeshBuilder.CreateCylinder("tobias-roof", { height: 2, diameterTop: 0, diameterBottom: 8.6, tessellation: 4 }, scene);
  roof.rotation.y = Math.PI / 4;
  roof.position.set(30, 4, 34);
  roof.material = mat("tobias-cloth", [0.36, 0.24, 0.45]);
  block("table", 33, 0.45, 29, 1.6, 0.9, 1, wood);

  // NPCs. Nine in ten would help you; the watchman is the exception here.
  const miriam = person("miriam", 4, -55, [0.55, 0.25, 0.2]);
  const eli = person("eli", 5, 65, [0.35, 0.4, 0.25]);
  const tobias = person("tobias", 30, 29.5, [0.3, 0.2, 0.45]);
  for (const n of [miriam, eli, tobias]) solidBox(n.position.x, n.position.z, 0.8, 0.8);
  const watchman = person("watchman", WATCH_HOME.x, WATCH_HOME.z, [0.12, 0.12, 0.14]);
  const lantern = MeshBuilder.CreateSphere("watch-lantern", { diameter: 0.3, segments: 6 }, scene);
  lantern.parent = watchman;
  lantern.position.set(0.55, 0.2, 0.2);
  lantern.material = mat("watch-flame", [1, 0.35, 0.15], true);

  // Scattered rocks, kept clear of sites and verses.
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
  for (let i = 0; i < 90; i++) {
    const x = (rand() - 0.5) * 280;
    const z = (rand() - 0.5) * 280;
    if (centers.some(([cx, cz]) => Math.hypot(cx - x, cz - z) < 22)) continue;
    if (PLACEMENTS.some((p) => Math.hypot(p.x - x, p.z - z) < 6)) continue;
    const s = 0.4 + rand() * 1.4;
    const rock = MeshBuilder.CreateSphere("rock", { diameter: 1, segments: 5 }, scene);
    rock.scaling.set(s * (1 + rand()), s * 0.6, s);
    rock.position.set(x, s * 0.2, z);
    rock.rotation.y = rand() * Math.PI;
    rock.material = darkStone;
  }

  return { colliders, door, doorBox, key, jar, horse, miriam, eli, tobias, watchman };
}
