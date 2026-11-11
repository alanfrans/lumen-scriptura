import { Color3, DynamicTexture, Light, Mesh, MeshBuilder, PointLight, Scene, StandardMaterial, Vector3 } from "@babylonjs/core";
import type { Palette, RGB } from "../art/materials";
import { buildBeast, buildPerson, type BeastKind, type Rig } from "../art/models";
import { GENERATIONS_PLACEMENTS } from "../data/layout";
import type { Wanderer, World } from "./world";

/** West end of the avenue, where the path back to the camp is taken. */
export const GENERATIONS_WEST = { x: -82, z: 2.4 };

/** The stone book, and where the Hope Beacon rises once the chapter is sealed. */
export const GENERATIONS_BOOK = { x: -58, z: 0 };

const ENOCH_RING = { x: 52, z: -10 };

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
 * Limestone avenue. Grass through the living generations, a pale ring
 * where Enoch was taken, and worked ground at the east end where Noah still lives.
 */
function generationsColor(x: number, z: number): RGB {
  let c: RGB = [158, 140, 104];
  if (x > -46 && x < 44) c = mix(c, [128, 146, 84], 0.5 * (1 - smooth(8, 20, Math.abs(z))));
  if (Math.abs(z) < 3.2 && x > -90 && x < 116) c = mix(c, [108, 82, 50], 1 - smooth(0.7, 3.2, Math.abs(z)));
  const book = Math.hypot(x - GENERATIONS_BOOK.x, z - GENERATIONS_BOOK.z);
  if (book < 11) c = mix(c, [184, 170, 136], 1 - smooth(2.4, 11, book));
  const enoch = Math.hypot(x - ENOCH_RING.x, z - ENOCH_RING.z);
  if (enoch < 12) c = mix(c, [220, 208, 170], 1 - smooth(2, 12, enoch));
  const meth = Math.hypot(x - 70, z - 10);
  if (meth < 9) c = mix(c, [142, 120, 82], 1 - smooth(2, 9, meth));
  if (x > 96) c = mix(c, [112, 128, 70], smooth(96, 114, x) * (1 - smooth(5, 16, Math.abs(z - 2))));
  const rim = Math.hypot(x - 16, z);
  if (rim > 88) c = mix(c, [132, 114, 76], smooth(88, 128, rim));
  return c;
}

function paintGenerations(scene: Scene): StandardMaterial {
  const size = 1024;
  const span = 360;
  const tex = new DynamicTexture("generations-ground-tex", { width: size, height: size }, scene, false);
  const ctx = tex.getContext() as unknown as CanvasRenderingContext2D;
  const img = ctx.createImageData(size, size);
  const data = img.data;
  for (let y = 0; y < size; y++) {
    const z = (y / (size - 1) - 0.5) * span;
    for (let x = 0; x < size; x++) {
      const wx = (x / (size - 1) - 0.5) * span;
      const c = generationsColor(wx, z);
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
  const mat = new StandardMaterial("generations-ground", scene);
  mat.diffuseTexture = tex;
  mat.specularColor = new Color3(0.04, 0.04, 0.03);
  return mat;
}

/**
 * Genesis 5, the book of the generations of Adam.
 * West is the way back to the camp. A stone book opens the avenue, then a stele
 * for each life that ends "and he died." Enoch's court is an empty ring.
 * The east end is Noah, still living, with Shem, Ham, and Japheth.
 * Any verse may be taken once its ending is read truly.
 */
export function buildGenerations(scene: Scene, pal: Palette): World {
  const colliders: { minX: number; maxX: number; minZ: number; maxZ: number; solid: boolean }[] = [];
  const statics: Mesh[] = [];
  const rand = rng(505);
  const heightAt = () => 0;

  const solidBox = (x: number, z: number, w: number, d: number) => {
    for (const p of GENERATIONS_PLACEMENTS) {
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

  const stone = pal.mat("gen-stone", [0.72, 0.66, 0.56], "ashlar");
  const ashlar = pal.mat("gen-ashlar", [0.78, 0.72, 0.6], "ashlar");
  const darkStone = pal.mat("gen-dark-stone", [0.42, 0.38, 0.34], "rock", 1.5);
  const wood = pal.mat("gen-wood", [0.45, 0.31, 0.19], "wood");
  const darkWood = pal.mat("gen-dark-wood", [0.3, 0.2, 0.12], "wood");
  const soil = pal.mat("gen-soil", [0.4, 0.28, 0.16], "grain");
  const linen = pal.mat("gen-linen", [0.86, 0.8, 0.66], "cloth");
  const page = pal.mat("gen-page", [0.8, 0.74, 0.58], "cloth");
  const ink = pal.mat("gen-ink", [0.18, 0.14, 0.1]);
  const shrub = pal.mat("gen-shrub", [0.4, 0.46, 0.24], "leaf");
  const dryGrass = pal.mat("gen-grass", [0.62, 0.55, 0.32], "leaf");
  const cypressMat = pal.mat("gen-cypress", [0.16, 0.3, 0.16], "leaf", 2);
  const olive = pal.mat("gen-olive", [0.4, 0.46, 0.22], "leaf");
  const clay = pal.mat("gen-clay", [0.66, 0.4, 0.24], "grain");
  const hide = pal.mat("gen-hide", [0.5, 0.34, 0.2], "fur");
  const takenMat = pal.glow("gen-taken", [0.96, 0.9, 0.68]);
  takenMat.alpha = 0.45;
  const haloMat = pal.glow("gen-halo", [0.98, 0.9, 0.62]);
  const lampFlame = pal.glow("gen-lamp", [1, 0.62, 0.28]);

  const ground = MeshBuilder.CreateGround("ground", { width: 360, height: 360, subdivisions: 2 }, scene);
  ground.material = paintGenerations(scene);
  ground.receiveShadows = true;

  const clear = (x: number, z: number, r: number) =>
    GENERATIONS_PLACEMENTS.every((p) => Math.hypot(p.x - x, p.z - z) >= r) &&
    Math.hypot(x - GENERATIONS_WEST.x, z - GENERATIONS_WEST.z) >= r + 1.2 &&
    Math.hypot(x - GENERATIONS_BOOK.x, z - GENERATIONS_BOOK.z) >= r + 1.4 &&
    Math.hypot(x - ENOCH_RING.x, z - ENOCH_RING.z) >= r + 1.6 &&
    Math.hypot(x + 74, z) >= 3.2 &&
    Math.hypot(x + 22, z - 12) >= r &&
    Math.hypot(x - 58, z + 16) >= r &&
    Math.hypot(x - 104, z - 14) >= r;

  // The way back, on the west. The camp is the other end of this sign.
  box(GENERATIONS_WEST.x, 0.9, GENERATIONS_WEST.z, 0.14, 1.8, 0.14, wood, true);
  box(GENERATIONS_WEST.x, 1.62, GENERATIONS_WEST.z, 1.25, 0.42, 0.08, wood);

  // The book the chapter names. Pages rise off a low stand, with a spine between them.
  box(GENERATIONS_BOOK.x, 0.22, GENERATIONS_BOOK.z, 2.2, 0.44, 1.45, stone, true);
  box(GENERATIONS_BOOK.x, 0.58, 0, 0.14, 0.42, 1.3, darkWood);
  const leftPage = box(GENERATIONS_BOOK.x - 0.62, 0.86, 0, 1.12, 0.045, 1.22, linen);
  leftPage.rotation.z = 0.62;
  const rightPage = box(GENERATIONS_BOOK.x + 0.62, 0.86, 0, 1.12, 0.045, 1.22, page);
  rightPage.rotation.z = -0.62;
  for (const side of [-1, 1]) {
    for (let row = 0; row < 5; row++) {
      const line = box(GENERATIONS_BOOK.x + side * 0.62, 0.9, -0.42 + row * 0.21, 0.72, 0.01, 0.025, ink);
      line.rotation.z = side * -0.62;
    }
  }
  box(-58, 0.28, 3.15, 0.7, 0.36, 0.48, stone, true);
  box(-58, 0.28, -3.15, 0.7, 0.36, 0.48, stone, true);
  cyl(-56.2, 0.85, 0.95, 0.16, 0.16, 0.18, clay, 8);
  ball(-56.2, 0.98, 0.95, 0.1, lampFlame, 6);

  const stele = (x: number, z: number, h: number) => {
    box(x, h / 2, z, 0.72, h, 0.46, ashlar, true);
    box(x, h + 0.08, z, 0.92, 0.14, 0.62, stone);
    box(x, h * 0.62, z, 0.8, 0.07, 0.52, darkStone);
    cyl(x, 0.15, z, 0.3, 1.15, 1.2, stone, 10);
  };
  // One stone for each life that ends. Height follows the years, loosely.
  stele(-44, -15.5, 5.2);
  stele(-30, 15.5, 5.1);
  stele(-14, -15.5, 5.05);
  stele(2, 15.5, 5.1);
  stele(18, -15.5, 4.95);
  stele(34, 15.5, 5.35);
  stele(70, 16.2, 7.4);
  stele(90, -15.5, 4.35);

  const cypress = (x: number, z: number, h = 5.4) => {
    cyl(x, h * 0.52, z, h, 0.06, h * 0.18, cypressMat, 8);
    cyl(x, 0.35, z, 0.7, 0.16, 0.22, darkWood, 6);
    solidBox(x, z, 0.55, 0.55);
  };
  for (const [x, z] of [
    [-44, -19.2],
    [-30, 19.2],
    [-14, -19.2],
    [2, 19.2],
    [18, -19.2],
    [34, 19.2],
    [70, 20.2],
    [90, -19.2],
  ] as const) {
    cypress(x, z, z > 0 ? 5.6 : 5.1);
  }

  // Enoch has no grave. A broken ring, footprints, and a light where he was taken.
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + 0.2;
    // Leave the north side open, toward the path.
    if (Math.sin(a) > 0.45) continue;
    const x = ENOCH_RING.x + Math.cos(a) * 2.55;
    const z = ENOCH_RING.z + Math.sin(a) * 2.55;
    box(x, 0.28 + (i % 3) * 0.08, z, 0.36, 0.42 + (i % 2) * 0.16, 0.28, i % 2 ? ashlar : stone, true, a);
  }
  for (let i = 0; i < 7; i++) {
    const t = i / 6;
    const fx = 46 + t * 14;
    const fz = 13.4;
    const step = box(fx, 0.02, fz, 0.28, 0.02, 0.16, darkStone, false, 0.4);
    step.position.x += (i % 2 === 0 ? -0.16 : 0.16);
  }
  const shaft = cyl(ENOCH_RING.x, 3.1, ENOCH_RING.z, 6.2, 0.22, 0.5, takenMat, 10);
  shaft.material = takenMat;

  // Noah is not buried here. Three short stones name his sons, and a plow waits.
  for (const [x, z, h] of [
    [98, -6.5, 1.35],
    [104, -8.2, 1.55],
    [110, -6.5, 1.25],
  ] as const) {
    box(x, h / 2, z, 0.42, h, 0.32, ashlar, true);
    box(x, 0.08, z, 0.7, 0.1, 0.55, stone);
  }
  box(96, 0.04, 11, 3.2, 0.04, 2.2, soil);
  const plow = box(96.2, 0.28, 12.2, 1.5, 0.1, 0.28, wood, false, 0.5);
  plow.rotation.z = 0.08;
  box(96.8, 0.18, 12.6, 0.08, 0.36, 0.42, darkWood);
  const tent = box(108, 1.15, 13.5, 3.2, 0.08, 2.4, hide);
  tent.rotation.z = 0.15;
  for (const [x, z] of [
    [106.6, 12.4],
    [109.4, 12.4],
    [106.6, 14.6],
    [109.4, 14.6],
  ] as const) {
    cyl(x, 0.7, z, 1.4, 0.08, 0.1, wood, 6);
  }
  solidBox(108, 13.5, 2.4, 1.6);

  const oliveTree = (x: number, z: number) => {
    cyl(x, 1.15, z, 2.3, 0.12, 0.32, darkWood, 7);
    const canopy = ball(x, 2.45, z, 2.4, olive, 7);
    canopy.scaling.y = 0.55;
    ball(x + 0.45, 2.15, z + 0.2, 1.3, shrub, 6);
    solidBox(x, z, 0.6, 0.6);
  };
  oliveTree(-52, 14);
  oliveTree(-6, -14);
  oliveTree(42, -14);
  oliveTree(78, 15);
  oliveTree(114, 8);

  for (const x of [-72, -66, -50, -36, -8, 10, 42, 62, 84, 100]) {
    if (!clear(x, 0.4, 2.2)) continue;
    box(x, 0.025, 0.35, 0.85, 0.03, 0.42, stone);
  }

  for (let i = 0; i < 40; i++) {
    const x = -70 + rand() * 180;
    const z = (rand() < 0.5 ? -1 : 1) * (12 + rand() * 10);
    if (!clear(x, z, 3.4)) continue;
    for (let k = 0; k < 3; k++) {
      const blade = cyl(x + (rand() - 0.5) * 0.35, 0.22, z + (rand() - 0.5) * 0.35, 0.46, 0, 0.06, dryGrass, 4);
      blade.rotation.z = (rand() - 0.5) * 0.5;
    }
  }
  for (let i = 0; i < 16; i++) {
    const x = -78 + rand() * 190;
    const z = (rand() - 0.5) * 48;
    if (!clear(x, z, 4.2) || Math.abs(z) < 5) continue;
    const s = 0.35 + rand() * 0.7;
    const rock = ball(x, s * 0.16, z, s, rand() < 0.5 ? stone : darkStone, 5);
    rock.scaling.set(1 + rand() * 0.4, 0.45, 1);
    if (s > 0.7) solidBox(x, z, s * 0.8, s * 0.55);
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

  const halo = MeshBuilder.CreateTorus("gen-taken-halo", { diameter: 1.35, thickness: 0.05, tessellation: 18 }, scene);
  halo.position.set(ENOCH_RING.x, 4.6, ENOCH_RING.z);
  halo.material = haloMat;
  scenery.push(halo);

  const folk: Rig[] = [];
  const wanderers: Wanderer[] = [];
  const placeRig = (rig: Rig, x: number, z: number, faceY = 0) => {
    rig.root.position.set(x, 0, z);
    rig.root.rotation.y = faceY;
    return rig;
  };
  const seth = placeRig(
    buildPerson(scene, pal, "seth", {
      robe: [0.42, 0.32, 0.22],
      trim: [0.72, 0.6, 0.38],
      head: [0.58, 0.42, 0.3],
      beard: [0.32, 0.24, 0.16],
      headwear: "wrap",
      staff: true,
    }),
    -22,
    12,
    Math.PI,
  );
  const enoch = placeRig(
    buildPerson(scene, pal, "enoch", {
      robe: [0.78, 0.74, 0.62],
      trim: [0.86, 0.72, 0.4],
      head: [0.7, 0.56, 0.42],
      beard: [0.55, 0.48, 0.36],
      headwear: "wrap",
      scale: 1.02,
    }),
    58,
    -16,
    0.4,
  );
  const noah = placeRig(
    buildPerson(scene, pal, "noah", {
      robe: [0.36, 0.4, 0.26],
      trim: [0.48, 0.32, 0.18],
      head: [0.52, 0.38, 0.28],
      beard: [0.22, 0.16, 0.1],
      headwear: "wrap",
      staff: true,
      scale: 1.04,
    }),
    104,
    14,
    Math.PI,
  );
  const daughter = placeRig(
    buildPerson(scene, pal, "gen-folk-daughter", {
      robe: [0.5, 0.32, 0.28],
      trim: [0.75, 0.62, 0.42],
      head: [0.64, 0.46, 0.36],
      headwear: "wrap",
      scale: 0.94,
    }),
    -18,
    -15,
    0.2,
  );
  const son = placeRig(
    buildPerson(scene, pal, "gen-folk-son", {
      robe: [0.32, 0.36, 0.44],
      trim: [0.62, 0.5, 0.3],
      head: [0.5, 0.36, 0.26],
      beard: [0.2, 0.14, 0.1],
      headwear: "turban",
    }),
    28,
    16,
    Math.PI,
  );
  const younger = placeRig(
    buildPerson(scene, pal, "gen-folk-younger", {
      robe: [0.55, 0.42, 0.28],
      trim: [0.4, 0.26, 0.16],
      head: [0.62, 0.46, 0.34],
      headwear: "wrap",
      scale: 0.92,
    }),
    86,
    16,
    Math.PI,
  );
  for (const rig of [seth, enoch, noah, daughter, son, younger]) {
    solidBox(rig.root.position.x, rig.root.position.z, 0.8, 0.8);
    folk.push(rig);
  }

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
  pace("sheep", -50, 20, -28, 21, 0.22);
  pace("sheep", -40, 18.5, -16, 20, 0.2);
  pace("sheep", 72, -18, 96, -17, 0.18);
  pace("sheep", 40, 20, 62, 19, 0.2);
  sit("dog", -66, -4, 0.6);
  sit("sheep", 112, 8, Math.PI);

  const bookLight = new PointLight("gen-book-light", new Vector3(-56.2, 1.3, 0.95), scene);
  bookLight.diffuse = new Color3(1, 0.62, 0.3);
  bookLight.specular = new Color3(1, 0.5, 0.22);
  bookLight.intensity = 0.28;
  bookLight.range = 7;
  bookLight.falloffType = Light.FALLOFF_STANDARD;
  const takenLight = new PointLight("gen-taken-light", new Vector3(ENOCH_RING.x, 3.2, ENOCH_RING.z), scene);
  takenLight.diffuse = new Color3(1, 0.92, 0.7);
  takenLight.specular = new Color3(1, 0.86, 0.6);
  takenLight.intensity = 0.42;
  takenLight.range = 12;
  takenLight.falloffType = Light.FALLOFF_STANDARD;

  const tick = (dt: number, time: number) => {
    halo.rotation.y += dt * 0.35;
    bookLight.intensity = 0.28 * (1 + Math.sin(time * 9) * 0.1 + Math.sin(time * 17) * 0.05);
    takenLight.intensity = 0.42 * (1 + Math.sin(time * 2.2) * 0.08);
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
    lamps: [bookLight, takenLight],
    tick,
  };
}
