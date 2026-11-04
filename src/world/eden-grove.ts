import {
  Color3,
  Matrix,
  Mesh,
  MeshBuilder,
  Quaternion,
  Scene,
  StandardMaterial,
  Vector3,
} from "@babylonjs/core";
import type { Palette, RGB } from "../art/materials";
import { EDEN_PLACEMENTS } from "../data/layout";
import { LAKE } from "./eden-rivers";

/**
 * Extra planting for the garden of Genesis 2.
 * One mesh per species part, repeated with thin instances.
 * Verse tablets, the worn path, and the south sign stay open.
 */
export interface EdenCourse {
  name: string;
  width: number;
  points: readonly { x: number; z: number }[];
}

export interface EdenGround {
  waterDist: (x: number, z: number) => number;
  pathDist: (x: number, z: number) => number;
  courses: readonly EdenCourse[];
  bends: readonly { x: number; z: number }[];
  heightAt: (x: number, z: number) => number;
  solidTrunk: (x: number, z: number) => void;
}

type Kind = "tree" | "shrub" | "cover" | "reed" | "pot" | "vine";

/** Trunks already standing in eden.ts. New trees keep their distance. */
const KNOWN: readonly [number, number][] = [
  [-20, 18],
  [-24, 6],
  [-10, 26],
  [8, -2],
  [24, 12],
  [-14, 8],
  [-18, -54],
  [18, -54],
  [-20, -32],
  [20, -36],
  [-14, 54],
  [16, 54],
  [-14, 72],
  [18, 66],
  [2, 88],
  [-32, 22],
  [-48, 36],
  [-30, 50],
  [42, -16],
  [-62, -36],
  [78, 18],
  [48, 72],
  [-24, 84],
  [-6, -72],
  [6, -72],
  [-2, 18],
  [10, 16],
];

/** Animals pace these lines. Trunks stay off them. */
const WANDER: readonly [number, number, number, number][] = [
  [-32, 16, -28, 26],
  [-48, 34, -48, 52],
  [20, 6, 28, 14],
  [14, -36, 18, -50],
  [18, 60, 22, 76],
  [-6, 8, -16, 4],
];

const RESERVED: readonly [number, number, number][] = [
  [2, 6, 2.4],
  [2, 60, 2.4],
  [2.6, -80, 2.6],
  [-12, -1, 1.5],
  [0, -1, 1.5],
  [-15.4, -44, 2.3],
  [10, -44, 6.2],
  [-12.2, 46.2, 2.3],
  [-28, 26, 3.3],
  [-24, -20, 1.7],
  [62, 50, 2.8],
  [56, 2, 2.8],
  [72, 28, 2.8],
  [22, 66, 2.8],
  [-44, 38, 1.6],
  [-34, 48, 1.6],
  [-28, 36, 1.6],
  [6, -58, 1.6],
  [80, 6.4, 4.2],
];

const APPROACH: readonly [number, number][] = [
  [0, -86],
  [0, -66],
  ...EDEN_PLACEMENTS.map((p) => [p.x, p.z] as [number, number]),
];

const _m = Matrix.Identity();
const _q = Quaternion.Identity();
const _p = new Vector3();
const _s = new Vector3();

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

class Batch {
  private readonly buf: Float32Array;
  private count = 0;

  constructor(
    readonly mesh: Mesh,
    cap: number,
  ) {
    this.buf = new Float32Array(cap * 16);
  }

  add(
    x: number,
    y: number,
    z: number,
    yaw: number,
    sx: number,
    sy: number,
    sz: number,
    pitch = 0,
    roll = 0,
  ): void {
    if (this.count >= this.buf.length / 16) return;
    Quaternion.RotationYawPitchRollToRef(yaw, pitch, roll, _q);
    _p.set(x, y, z);
    _s.set(sx, sy, sz);
    Matrix.ComposeToRef(_s, _q, _p, _m);
    _m.copyToArray(this.buf, this.count * 16);
    this.count++;
  }

  commit(): Mesh | null {
    if (!this.count) {
      this.mesh.dispose(false, false);
      return null;
    }
    const data = new Float32Array(this.buf.subarray(0, this.count * 16));
    this.mesh.freezeWorldMatrix();
    this.mesh.thinInstanceSetBuffer("matrix", data, 16, true);
    this.mesh.thinInstanceRefreshBoundingInfo(false);
    this.mesh.doNotSyncBoundingInfo = true;
    this.mesh.isPickable = false;
    return this.mesh;
  }
}

interface Plant {
  place(
    x: number,
    z: number,
    yaw: number,
    scale: number,
    y?: number,
    pitch?: number,
    roll?: number,
    sy?: number,
  ): void;
}

export function plantEdenGrove(scene: Scene, pal: Palette, ground: EdenGround): Mesh[] {
  const rand = rng(9042);
  const spin = () => rand() * Math.PI * 2;
  const span = (a: number, b: number) => a + rand() * (b - a);
  const batches: Batch[] = [];
  const marks: { x: number; z: number; kind: Kind }[] = [];
  const trunks: [number, number][] = [];

  const batch = (mesh: Mesh, cap: number) => {
    const made = new Batch(mesh, cap);
    batches.push(made);
    return made;
  };
  const plant = (parts: Batch[]): Plant => ({
    place(x, z, yaw, scale, y = 0, pitch = 0, roll = 0, sy = scale) {
      for (const part of parts) part.add(x, y, z, yaw, scale, sy, scale, pitch, roll);
    },
  });

  const bake = (mesh: Mesh): Mesh => {
    mesh.bakeCurrentTransformIntoVertices();
    mesh.computeWorldMatrix(true);
    return mesh;
  };
  const at = (
    mesh: Mesh,
    x: number,
    y: number,
    z: number,
    rx = 0,
    ry = 0,
    rz = 0,
    sx = 1,
    sy = 1,
    sz = 1,
  ): Mesh => {
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, rz);
    mesh.scaling.set(sx, sy, sz);
    return bake(mesh);
  };
  const sphere = (d: number, seg = 6) => MeshBuilder.CreateSphere("part", { diameter: d, segments: seg }, scene);
  const cube = (w: number, h: number, d: number) => MeshBuilder.CreateBox("part", { width: w, height: h, depth: d }, scene);
  const cylinder = (h: number, dTop: number, dBot: number, tess = 7) =>
    MeshBuilder.CreateCylinder(
      "part",
      {
        height: h,
        diameterTop: Math.max(0.02, dTop),
        diameterBottom: Math.max(0.02, dBot),
        tessellation: tess,
      },
      scene,
    );
  const aim = (mesh: Mesh, from: Vector3, to: Vector3, axis: "y" | "z"): Mesh => {
    const delta = to.subtract(from);
    const len = delta.length() || 0.001;
    const dir = delta.scale(1 / len);
    if (axis === "y") mesh.scaling.y = len;
    else mesh.scaling.z = len;
    mesh.position.copyFrom(from.add(to).scale(0.5));
    const base = axis === "y" ? Vector3.Up() : new Vector3(0, 0, 1);
    const dot = Math.max(-1, Math.min(1, Vector3.Dot(base, dir)));
    const cross = Vector3.Cross(base, dir);
    if (cross.lengthSquared() > 1e-8) {
      mesh.rotationQuaternion = Quaternion.RotationAxis(cross.normalize(), Math.acos(dot));
    } else if (dot < 0) {
      mesh.rotation.x = Math.PI;
    }
    return bake(mesh);
  };

  const paint = (name: string, rgb: RGB, kind?: "leaf" | "wood" | "grain", scale = 1, flat = false) => {
    const mat = pal.mat(name, rgb, kind, scale);
    if (flat) {
      mat.backFaceCulling = false;
      mat.twoSidedLighting = true;
    }
    return mat;
  };
  const petal = (name: string, rgb: RGB) => {
    const mat = pal.mat(name, rgb);
    mat.emissiveColor = new Color3(rgb[0] * 0.14, rgb[1] * 0.12, rgb[2] * 0.1);
    mat.specularColor = new Color3(0.14, 0.12, 0.1);
    return mat;
  };

  const bark = paint("grove-bark", [0.28, 0.18, 0.1], "wood", 1.4);
  const palmLeaf = paint("grove-palm", [0.24, 0.5, 0.16], "leaf", 1.4, true);
  const date = paint("grove-date", [0.72, 0.42, 0.14], "grain", 2);
  const cedarLeaf = paint("grove-cedar", [0.1, 0.28, 0.16], "leaf", 1.3, true);
  const cedarWarm = paint("grove-cedar-warm", [0.2, 0.36, 0.14], "leaf", 1.3, true);
  const appleLeaf = paint("grove-apple-leaf", [0.32, 0.55, 0.18], "leaf", 1.5);
  const pomLeaf = paint("grove-pom-leaf", [0.18, 0.4, 0.16], "leaf", 1.5);
  const citronLeaf = paint("grove-citron-leaf", [0.46, 0.52, 0.16], "leaf", 1.5);
  const figLeaf = paint("grove-fig-leaf", [0.16, 0.34, 0.14], "leaf", 1.4);
  const appleFruit = petal("grove-apple", [0.72, 0.16, 0.12]);
  const pomFruit = petal("grove-pom", [0.55, 0.08, 0.16]);
  const citronFruit = petal("grove-citron", [0.86, 0.68, 0.16]);
  const figFruit = petal("grove-fig", [0.42, 0.16, 0.36]);
  const shrubLeaf = paint("grove-shrub", [0.22, 0.46, 0.18], "leaf", 1.6);
  const bushA = paint("grove-bush", [0.26, 0.44, 0.16], "leaf", 1.5);
  const bushB = paint("grove-bush-deep", [0.14, 0.32, 0.14], "leaf", 1.5);
  const fernA = paint("grove-fern", [0.2, 0.52, 0.22], "leaf", 1.8, true);
  const fernB = paint("grove-fern-blue", [0.14, 0.4, 0.28], "leaf", 1.8, true);
  const grassA = paint("grove-grass", [0.3, 0.55, 0.16], "leaf", 1.8, true);
  const grassB = paint("grove-grass-gold", [0.5, 0.52, 0.18], "leaf", 1.8, true);
  const reedA = paint("grove-reed", [0.32, 0.48, 0.2], "leaf", 1.6, true);
  const reedB = paint("grove-reed-dark", [0.24, 0.36, 0.14], "leaf", 1.6, true);
  const reedHead = paint("grove-reed-head", [0.48, 0.4, 0.22], "grain", 2);
  const vineStem = paint("grove-vine", [0.28, 0.36, 0.14], "wood", 2);
  const vineLeaf = paint("grove-vine-leaf", [0.22, 0.48, 0.16], "leaf", 1.8, true);
  const stemMat = paint("grove-stem", [0.24, 0.42, 0.16], "leaf", 2);
  const rose = petal("grove-rose", [0.78, 0.28, 0.4]);
  const white = petal("grove-white", [0.94, 0.92, 0.86]);
  const gold = petal("grove-gold", [0.92, 0.72, 0.2]);
  const violet = petal("grove-violet", [0.48, 0.28, 0.66]);
  const coral = petal("grove-coral", [0.86, 0.4, 0.32]);
  const poppy = petal("grove-poppy", [0.8, 0.1, 0.12]);
  const iris = petal("grove-iris", [0.32, 0.28, 0.72]);
  const lilyPink = petal("grove-lily", [0.92, 0.64, 0.72]);
  const flax = petal("grove-flax", [0.32, 0.48, 0.84]);
  const heart = petal("grove-heart", [0.32, 0.18, 0.08]);
  const clay = paint("grove-clay", [0.64, 0.36, 0.22], "grain", 2);
  const clayDark = paint("grove-clay-dark", [0.4, 0.22, 0.14], "grain", 2);
  clay.backFaceCulling = false;
  clay.twoSidedLighting = true;
  clayDark.backFaceCulling = false;
  clayDark.twoSidedLighting = true;

  const fuse = (name: string, mat: StandardMaterial, parts: Mesh[], flat = false): Mesh => {
    for (const part of parts) {
      part.material = mat;
      if (flat) part.sideOrientation = Mesh.DOUBLESIDE;
    }
    const merged = parts.length === 1 ? parts[0] : Mesh.MergeMeshes(parts, true, true);
    if (!merged) throw new Error(`Eden could not shape ${name}`);
    merged.name = name;
    merged.material = mat;
    if (flat) merged.sideOrientation = Mesh.DOUBLESIDE;
    merged.position.set(0, 0, 0);
    merged.rotation.set(0, 0, 0);
    merged.scaling.set(1, 1, 1);
    merged.computeWorldMatrix(true);
    merged.refreshBoundingInfo(true);
    merged.isPickable = false;
    return merged;
  };
  const tint = (source: Mesh, name: string, mat: StandardMaterial): Mesh => {
    const mesh = source.clone(name, null, true);
    if (!mesh) throw new Error(`Eden could not copy ${name}`);
    mesh.name = name;
    mesh.material = mat;
    mesh.isPickable = false;
    mesh.position.set(0, 0, 0);
    mesh.rotation.set(0, 0, 0);
    mesh.scaling.set(1, 1, 1);
    mesh.computeWorldMatrix(true);
    mesh.refreshBoundingInfo(true);
    return mesh;
  };
  const restOnGround = (mesh: Mesh): Mesh => {
    mesh.computeWorldMatrix(true);
    mesh.refreshBoundingInfo(true);
    const bb = mesh.getBoundingInfo().boundingBox;
    mesh.position.x -= (bb.minimumWorld.x + bb.maximumWorld.x) / 2;
    mesh.position.y -= bb.minimumWorld.y;
    mesh.position.z -= (bb.minimumWorld.z + bb.maximumWorld.z) / 2;
    bake(mesh);
    mesh.refreshBoundingInfo(true);
    return mesh;
  };

  const palm = (() => {
    const lean = 0.55;
    const trunks: Mesh[] = [];
    let x = 0;
    let z = 0;
    let y = 0;
    for (let i = 0; i < 5; i++) {
      const h = 1.02;
      const seg = cylinder(h, 0.36 - i * 0.04, 0.44 - i * 0.04, 7);
      seg.position.set(x, y + h / 2, z);
      seg.rotation.set(-Math.sin(lean) * 0.04 * i, 0, Math.cos(lean) * 0.04 * i);
      trunks.push(bake(seg));
      y += h * 0.94;
      x += Math.cos(lean) * 0.07 * i;
      z += Math.sin(lean) * 0.07 * i;
    }
    const crownY = y + 0.1;
    const fronds: Mesh[] = [at(sphere(0.5, 6), x, crownY, z)];
    for (let k = 0; k < 9; k++) {
      const yaw = lean + (k / 9) * Math.PI * 2;
      const droop = 0.4 + (k % 3) * 0.12;
      const len = 2.45;
      for (const [t, w, depth] of [
        [0.36, 0.48, len * 0.46],
        [0.76, 0.16, len * 0.38],
      ] as const) {
        const along = len * t;
        const blade = cube(w, 0.028, depth);
        blade.position.set(
          x + Math.sin(yaw) * Math.cos(droop) * along,
          crownY - Math.sin(droop) * along,
          z + Math.cos(yaw) * Math.cos(droop) * along,
        );
        blade.rotation.y = yaw;
        blade.rotation.x = droop;
        fronds.push(bake(blade));
      }
    }
    const dates: Mesh[] = [];
    for (let k = 0; k < 5; k++) {
      const a = lean + k * 1.25;
      dates.push(at(sphere(0.15, 5), x + Math.cos(a) * 0.2, crownY - 0.32, z + Math.sin(a) * 0.2));
    }
    return plant([
      batch(fuse("eden-palm-trunk", bark, trunks), 80),
      batch(fuse("eden-palm-frond", palmLeaf, fronds, true), 80),
      batch(fuse("eden-palm-date", date, dates), 80),
    ]);
  })();

  const cedarFoliage = (() => {
    const tiers: Mesh[] = [];
    const add = (yBase: number, h: number, dBot: number, dTop: number) => {
      tiers.push(at(cylinder(h, dTop, dBot, 8), 0, yBase + h / 2, 0));
    };
    add(0.55, 2.05, 3.05, 1.7);
    add(1.9, 1.85, 2.25, 1.05);
    add(3.2, 1.6, 1.45, 0.4);
    add(4.4, 1.25, 0.6, 0.04);
    return fuse("eden-cedar-leaf", cedarLeaf, tiers, true);
  })();
  const cedarTrunk = batch(fuse("eden-cedar-trunk", bark, [at(cylinder(1.15, 0.2, 0.38, 7), 0, 0.58, 0)]), 80);
  const cedars = [
    plant([cedarTrunk, batch(cedarFoliage, 36)]),
    plant([cedarTrunk, batch(tint(cedarFoliage, "eden-cedar-warm", cedarWarm), 36)]),
  ];

  const fruitTrunk = (name: string, h: number, dBot: number) =>
    fuse(name, bark, [
      at(cylinder(h, dBot * 0.4, dBot, 7), 0, h / 2, 0),
      at(cylinder(h * 0.48, 0.06, 0.1, 5), h * 0.16, h * 0.7, 0.05, 0, 0.35, 1.05),
      at(cylinder(h * 0.4, 0.05, 0.08, 5), -h * 0.12, h * 0.58, -0.04, 0.2, -0.4, -0.95),
    ]);
  const canopy = (name: string, mat: StandardMaterial, wide: boolean) => {
    const balls = wide
      ? [
          at(sphere(2.7, 7), 0, 1.85, 0, 0, 0, 0, 1.15, 0.5, 1.05),
          at(sphere(1.7, 6), 0.85, 1.7, 0.25, 0, 0, 0, 1, 0.6, 1),
          at(sphere(1.45, 6), -0.7, 1.65, -0.3, 0, 0, 0, 1, 0.55, 1),
          at(sphere(1.2, 6), 0.15, 2.15, -0.45),
        ]
      : [
          at(sphere(2.15, 7), 0, 2.45, 0, 0, 0, 0, 1, 0.72, 1),
          at(sphere(1.4, 6), 0.62, 2.2, 0.2),
          at(sphere(1.2, 6), -0.5, 2.28, -0.22),
          at(sphere(1.05, 6), 0.1, 2.85, -0.2),
        ];
    return fuse(name, mat, balls);
  };
  const fruits = (name: string, mat: StandardMaterial, y: number, radius: number) => {
    const parts: Mesh[] = [];
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + 0.35;
      const r = radius * (0.42 + (k % 3) * 0.16);
      parts.push(at(sphere(0.16, 5), Math.cos(a) * r, y + (k % 2) * 0.16, Math.sin(a) * r));
    }
    return fuse(name, mat, parts);
  };
  const roundTrunk = batch(fruitTrunk("eden-fruit-trunk", 2.15, 0.38), 72);
  const roundCanopy = canopy("eden-apple-leaf", appleLeaf, false);
  const roundFruit = fruits("eden-apple-fruit", appleFruit, 2.15, 0.85);
  const wideTrunk = batch(fruitTrunk("eden-fig-trunk", 1.55, 0.46), 36);
  const fruitTrees = [
    plant([roundTrunk, batch(roundCanopy, 32), batch(roundFruit, 32)]),
    plant([
      roundTrunk,
      batch(tint(roundCanopy, "eden-pom-leaf", pomLeaf), 32),
      batch(tint(roundFruit, "eden-pom-fruit", pomFruit), 32),
    ]),
    plant([
      roundTrunk,
      batch(tint(roundCanopy, "eden-citron-leaf", citronLeaf), 32),
      batch(tint(roundFruit, "eden-citron-fruit", citronFruit), 32),
    ]),
    plant([
      wideTrunk,
      batch(canopy("eden-fig-leaf", figLeaf, true), 32),
      batch(fruits("eden-fig-fruit", figFruit, 1.7, 1.05), 32),
    ]),
  ];

  const shrubBlooms = (() => {
    const parts: Mesh[] = [];
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 2;
      parts.push(at(sphere(0.2, 5), Math.cos(a) * 0.48, 0.58 + (k % 3) * 0.1, Math.sin(a) * 0.42));
    }
    return fuse("eden-shrub-bloom", rose, parts);
  })();
  const shrubLeaves = batch(
    fuse("eden-shrub-leaf", shrubLeaf, [
      at(sphere(1.15, 7), 0, 0.42, 0, 0, 0, 0, 1.05, 0.58, 1),
      at(sphere(0.82, 6), 0.36, 0.5, 0.12),
      at(sphere(0.7, 6), -0.32, 0.36, -0.16),
    ]),
    220,
  );
  const bloomColors = [rose, white, gold, violet, coral];
  const shrubs = bloomColors.map((mat, i) =>
    plant([
      shrubLeaves,
      batch(i === 0 ? shrubBlooms : tint(shrubBlooms, `eden-shrub-bloom-${i}`, mat), 80),
    ]),
  );
  const bushMesh = fuse("eden-bush", bushA, [
    at(sphere(1.05, 7), 0, 0.38, 0, 0, 0, 0, 1.1, 0.62, 1),
    at(sphere(0.72, 6), 0.28, 0.42, 0.18),
    at(sphere(0.6, 6), -0.24, 0.32, -0.14),
  ]);
  const bushes = [plant([batch(bushMesh, 200)]), plant([batch(tint(bushMesh, "eden-bush-deep", bushB), 200)])];

  const fernMesh = (() => {
    const parts: Mesh[] = [];
    for (let k = 0; k < 6; k++) {
      const yaw = (k / 6) * Math.PI * 2 + (k % 2) * 0.12;
      const s = Math.sin(yaw);
      const c = Math.cos(yaw);
      const reach = 1.12;
      const lift = (t: number) => Math.sin((t / reach) * Math.PI) * 0.52;
      const stations = [0.02, 0.36, 0.7, reach];
      const widths = [0.38, 0.5, 0.28];
      for (let i = 0; i < stations.length - 1; i++) {
        const t0 = stations[i];
        const t1 = stations[i + 1];
        parts.push(
          aim(
            cube(widths[i], 0.05, 1),
            new Vector3(s * t0, 0.04 + lift(t0), c * t0),
            new Vector3(s * t1, 0.04 + lift(t1), c * t1),
            "z",
          ),
        );
      }
      for (const t of [0.4, 0.74]) {
        const mid = new Vector3(s * t, 0.06 + lift(t), c * t);
        const len = t < 0.55 ? 0.34 : 0.22;
        for (const sgn of [-1, 1]) {
          parts.push(
            aim(
              cube(0.12, 0.035, 1),
              mid,
              new Vector3(mid.x - c * sgn * len, mid.y - 0.05, mid.z + s * sgn * len),
              "z",
            ),
          );
        }
      }
    }
    return fuse("cover-fern", fernA, parts, true);
  })();
  const ferns = [plant([batch(fernMesh, 420)]), plant([batch(tint(fernMesh, "cover-fern-blue", fernB), 420)])];

  const grassMesh = (() => {
    const parts: Mesh[] = [];
    const blade = (a: number, h: number, w: number, lean: number, rad: number) => {
      const base = new Vector3(Math.cos(a) * rad, 0, Math.sin(a) * rad);
      const tip = new Vector3(
        Math.cos(a) * (rad + Math.sin(lean) * h),
        Math.cos(lean) * h,
        Math.sin(a) * (rad + Math.sin(lean) * h),
      );
      parts.push(aim(cube(w, 1, 0.028), base, tip, "y"));
    };
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2;
      blade(a, 0.95 + (k % 3) * 0.28, 0.1 + (k % 2) * 0.04, 0.12 + (k % 3) * 0.08, 0.08 + (k % 2) * 0.05);
    }
    for (let k = 0; k < 3; k++) {
      blade((k / 3) * Math.PI * 2 + 0.5, 0.55 + k * 0.08, 0.08, 0.08, 0.03);
    }
    return fuse("cover-grass", grassA, parts, true);
  })();
  const grasses = [plant([batch(grassMesh, 1200)]), plant([batch(tint(grassMesh, "cover-grass-gold", grassB), 1200)])];

  const reedTips: Vector3[] = [];
  const reedMesh = (() => {
    const parts: Mesh[] = [];
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2;
      const h = 1.35 + (k % 3) * 0.32;
      const base = new Vector3(Math.cos(a) * 0.2, 0, Math.sin(a) * 0.2);
      const tip = new Vector3(base.x * 1.45, h, base.z * 1.45);
      reedTips.push(tip);
      parts.push(aim(cylinder(1, 0.045, 0.08, 5), base, tip, "y"));
    }
    return fuse("cover-reed", reedA, parts, true);
  })();
  const reedHeadMesh = fuse(
    "cover-reed-head",
    reedHead,
    reedTips.map((tip) => at(sphere(0.16, 5), tip.x, tip.y - 0.04, tip.z, 0, 0, 0, 0.55, 1.85, 0.55)),
  );
  const reedHeads = batch(reedHeadMesh, 280);
  const reeds = [
    plant([batch(reedMesh, 180), reedHeads]),
    plant([batch(tint(reedMesh, "cover-reed-dark", reedB), 180), reedHeads]),
  ];

  const vineOf = (name: string, climbing: boolean) => {
    const stems: Mesh[] = [];
    const leaves: Mesh[] = [];
    const blooms: Mesh[] = [];
    const steps = climbing ? 8 : 7;
    const point = (i: number) => {
      const t = i / steps;
      if (climbing) {
        const a = t * Math.PI * 2 * 1.35 + 0.4;
        const r = 0.58 + t * 0.55;
        return new Vector3(Math.cos(a) * r, 0.1 + t * 2.15, Math.sin(a) * r);
      }
      const a = t * 1.2;
      return new Vector3(Math.sin(a) * 1.85, 0.08 + Math.sin(t * Math.PI) * 0.1, (t - 0.5) * 0.62);
    };
    const addLeaf = (x: number, y: number, z: number, yaw: number, tilt: number, w: number, len: number) => {
      const blade = cube(w, 0.04, len);
      blade.position.set(x, y, z);
      blade.rotation.set(tilt, yaw, 0);
      leaves.push(bake(blade));
    };
    for (let i = 0; i < steps; i++) {
      const p0 = point(i);
      const p1 = point(i + 1);
      stems.push(aim(cylinder(1, 0.03, 0.042, 5), p0, p1, "y"));
      if (climbing) {
        const radial = Math.hypot(p1.x, p1.z) || 1;
        const ox = p1.x / radial;
        const oz = p1.z / radial;
        const yaw = Math.atan2(ox, oz);
        addLeaf(p1.x + ox * 0.22, p1.y + 0.04, p1.z + oz * 0.22, yaw, -0.85, 0.24, 0.46);
        addLeaf(p1.x + ox * 0.12, p1.y + 0.08, p1.z + oz * 0.12, yaw + 0.7, -0.45, 0.16, 0.32);
      } else {
        const side = i % 2 === 0 ? 1 : -1;
        addLeaf(p1.x, 0.06, p1.z + side * 0.12, side * 0.5, -1.2, 0.26, 0.4);
        addLeaf(p1.x + 0.08, 0.05, p1.z, side * 1.1, -1.25, 0.18, 0.3);
      }
      if (i % 3 === 1) blooms.push(at(sphere(0.14, 5), p1.x, p1.y + 0.12, p1.z));
    }
    const bloomMat = climbing ? rose : white;
    return plant([
      batch(fuse(`${name}-stem`, vineStem, stems), 80),
      batch(fuse(`${name}-leaf`, vineLeaf, leaves, true), 80),
      batch(fuse(`${name}-bloom`, bloomMat, blooms), 80),
    ]);
  };
  const climbing = vineOf("eden-vine-climb", true);
  const trailing = vineOf("eden-vine-trail", false);

  const flower = (stemH: number, bloomParts: Mesh[], bloomMat: StandardMaterial, name: string, heartParts?: Mesh[]) => {
    const stem = fuse(`${name}-stem`, stemMat, [at(cylinder(stemH, 0.02, 0.028, 5), 0, stemH / 2, 0)]);
    const bloom = fuse(`${name}-bloom`, bloomMat, bloomParts);
    const parts = [batch(stem, 800), batch(bloom, 800)];
    if (heartParts) parts.push(batch(fuse(`${name}-heart`, heart, heartParts), 800));
    return plant(parts);
  };
  const daisy = flower(
    0.36,
    [at(sphere(0.42, 7), 0, 0.48, 0, 0, 0, 0, 1.15, 0.36, 1.15)],
    white,
    "cover-daisy",
    [at(sphere(0.12, 5), 0, 0.58, 0)],
  );
  const poppyFlower = flower(
    0.42,
    [at(sphere(0.36, 6), 0, 0.54, 0, 0, 0, 0, 1, 0.55, 1)],
    poppy,
    "cover-poppy",
    [at(sphere(0.1, 4), 0, 0.62, 0.02)],
  );
  const irisFlower = (() => {
    const leaves = [0, Math.PI].map((yaw) => {
      const blade = cube(0.09, 0.48, 0.02);
      blade.position.set(Math.sin(yaw) * 0.05, 0.18, Math.cos(yaw) * 0.05);
      blade.rotation.y = yaw;
      blade.rotation.z = yaw === 0 ? 0.25 : -0.25;
      return bake(blade);
    });
    const stem = fuse("cover-iris-leaf", fernA, leaves, true);
    const bloom = fuse("cover-iris-bloom", iris, [
      at(sphere(0.26, 6), 0, 0.52, 0.02, 0, 0, 0, 0.75, 1.15, 0.6),
      at(sphere(0.18, 5), 0, 0.42, 0.12, 0.45, 0, 0, 0.85, 0.7, 0.55),
    ]);
    return plant([batch(stem, 800), batch(bloom, 800)]);
  })();
  const lilyPetals = (name: string, mat: StandardMaterial) => {
    const parts: Mesh[] = [];
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2;
      const petalMesh = sphere(0.22, 5);
      petalMesh.position.set(Math.sin(a) * 0.06, 0.62, Math.cos(a) * 0.06);
      petalMesh.scaling.set(0.7, 1.25, 0.45);
      petalMesh.rotation.z = Math.sin(a) * 0.4;
      petalMesh.rotation.x = Math.cos(a) * 0.4;
      parts.push(bake(petalMesh));
    }
    parts.push(at(sphere(0.05, 4), 0, 0.66, 0));
    return fuse(name, mat, parts);
  };
  const lilyStem = batch(fuse("cover-lily-stem", stemMat, [at(cylinder(0.58, 0.02, 0.026, 5), 0, 0.29, 0)]), 800);
  const lilies = [
    plant([lilyStem, batch(lilyPetals("cover-lily-white", white), 420)]),
    plant([lilyStem, batch(lilyPetals("cover-lily-pink", lilyPink), 420)]),
  ];
  const flaxFlower = flower(0.52, [at(sphere(0.22, 5), 0, 0.58, 0)], flax, "cover-flax");
  const marigold = flower(
    0.26,
    [0, 1, 2, 3].map((k) => {
      const a = (k / 4) * Math.PI * 2;
      return at(sphere(0.17, 5), Math.cos(a) * 0.07, 0.36 + (k % 2) * 0.04, Math.sin(a) * 0.07);
    }),
    gold,
    "cover-marigold",
  );
  const bellGlow = pal.glow("grove-bell", [0.4, 0.88, 1]);
  const glassbell = flower(
    0.58,
    [at(sphere(0.24, 6), 0, 0.66, 0, 0, 0, 0, 0.85, 1.35, 0.85)],
    bellGlow,
    "cover-bell",
  );
  const starLeaf = paint("grove-star-leaf", [0.55, 0.62, 0.2], "leaf", 1.6, true);
  const starGlow = pal.glow("grove-star", [1, 0.78, 0.28]);
  const starflare = (() => {
    const blades: Mesh[] = [];
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2;
      blades.push(
        aim(cube(0.1, 0.03, 1), new Vector3(0, 0.06, 0), new Vector3(Math.cos(a) * 0.46, 0.1, Math.sin(a) * 0.46), "z"),
      );
    }
    return plant([
      batch(fuse("cover-star", starLeaf, blades, true), 500),
      batch(fuse("cover-star-heart", starGlow, [at(sphere(0.16, 5), 0, 0.14, 0)]), 500),
    ]);
  })();
  const flowers = [daisy, poppyFlower, irisFlower, lilies[0], lilies[1], flaxFlower, marigold, glassbell, starflare];

  const oliveLeaf = paint("grove-olive", [0.45, 0.5, 0.28], "leaf", 1.4);
  const oliveFruitMat = paint("grove-olive-fruit", [0.28, 0.3, 0.16], "grain", 2);
  const almondLeaf = paint("grove-almond-leaf", [0.4, 0.55, 0.28], "leaf", 1.4);
  const almondBloom = petal("grove-almond", [0.95, 0.72, 0.78]);
  const lampLeaf = paint("grove-lamp-leaf", [0.2, 0.42, 0.18], "leaf", 1.4, true);
  const prismLeaf = paint("grove-prism-leaf", [0.55, 0.78, 0.82], "grain", 1.2);
  const moonLeaf = paint("grove-moon-leaf", [0.62, 0.68, 0.6], "leaf", 1.3);
  const emberLeaf = paint("grove-ember-leaf", [0.28, 0.1, 0.12], "leaf", 1.3);
  const coilLeaf = paint("grove-coil-leaf", [0.15, 0.45, 0.42], "leaf", 1.4, true);
  const crownLeaf = paint("grove-crown-leaf", [0.2, 0.38, 0.48], "leaf", 1.3);
  const jewelLeaf = paint("grove-jewel-leaf", [0.12, 0.32, 0.28], "leaf", 1.4);
  const ribbonMat = paint("grove-ribbon", [0.5, 0.22, 0.4], "leaf", 1.6, true);
  const lampGlow = pal.glow("grove-lamp-fruit", [1, 0.68, 0.22]);
  const prismGlow = pal.glow("grove-prism-fruit", [0.3, 0.85, 1]);
  const moonGlow = pal.glow("grove-moon-fruit", [0.86, 0.9, 1]);
  const emberGlow = pal.glow("grove-ember-fruit", [1, 0.32, 0.06]);
  const podGlow = pal.glow("grove-pod", [0.7, 0.32, 1]);
  const rubyGlow = pal.glow("grove-ruby", [1, 0.12, 0.32]);
  const amethyst = pal.glow("grove-amethyst", [0.62, 0.35, 1]);
  const emerald = pal.glow("grove-emerald", [0.2, 1, 0.55]);
  const exoticTrunk = (name: string, h: number, top: number, bot: number) =>
    batch(fuse(name, bark, [at(cylinder(h, top, bot, 6), 0, h / 2, 0)]), 24);
  const orbFruit = (name: string, mat: StandardMaterial, y: number, r: number, n: number, d: number) => {
    const parts: Mesh[] = [];
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      parts.push(at(sphere(d, 5), Math.cos(a) * r, y + (k % 2) * 0.12, Math.sin(a) * r));
    }
    return batch(fuse(name, mat, parts), 24);
  };
  const olive = plant([
    exoticTrunk("eden-olive-trunk", 1.65, 0.14, 0.34),
    batch(
      fuse("eden-olive-leaf", oliveLeaf, [
        at(sphere(2.5, 6), 0, 1.65, 0, 0, 0, 0, 1.35, 0.42, 1.05),
        at(sphere(1.3, 5), 0.75, 1.5, 0.15, 0, 0, 0, 1, 0.38, 0.8),
      ]),
      24,
    ),
    orbFruit("eden-olive-fruit", oliveFruitMat, 1.4, 0.55, 6, 0.14),
  ]);
  const almond = plant([
    exoticTrunk("eden-almond-trunk", 1.9, 0.12, 0.3),
    batch(
      fuse("eden-almond-leaf", almondLeaf, [at(sphere(2.1, 6), 0, 2.15, 0, 0, 0, 0, 1.05, 0.7, 1)]),
      24,
    ),
    orbFruit("eden-almond-bloom", almondBloom, 2.35, 0.7, 8, 0.16),
  ]);
  const lampTree = (() => {
    const cords: Mesh[] = [];
    const fruit: Mesh[] = [];
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      const from = new Vector3(Math.cos(a) * 0.12, 2.25, Math.sin(a) * 0.12);
      const to = new Vector3(Math.cos(a) * 0.72, 1.2, Math.sin(a) * 0.72);
      cords.push(aim(cylinder(1, 0.035, 0.045, 4), from, to, "y"));
      fruit.push(at(sphere(0.3, 5), to.x, to.y - 0.02, to.z));
    }
    return plant([
      exoticTrunk("eden-lamp-trunk", 2.35, 0.1, 0.28),
      batch(fuse("eden-lamp-leaf", lampLeaf, cords, true), 24),
      batch(fuse("eden-lamp-fruit", lampGlow, fruit), 24),
    ]);
  })();
  const prismTree = (() => {
    const crystals: Mesh[] = [];
    for (let k = 0; k < 4; k++) {
      const gem = cube(0.72 - k * 0.1, 0.5, 0.72 - k * 0.1);
      gem.position.set(0, 1.45 + k * 0.38, 0);
      gem.rotation.y = k * 0.55;
      crystals.push(bake(gem));
    }
    return plant([
      exoticTrunk("eden-prism-trunk", 1.35, 0.12, 0.26),
      batch(fuse("eden-prism-leaf", prismLeaf, crystals), 24),
      orbFruit("eden-prism-fruit", prismGlow, 2.5, 0.35, 4, 0.18),
    ]);
  })();
  const moonTree = plant([
    exoticTrunk("eden-moon-trunk", 2.05, 0.12, 0.3),
    batch(
      fuse("eden-moon-leaf", moonLeaf, [
        at(sphere(2.2, 6), 0, 2.3, 0, 0, 0, 0, 1, 0.75, 1),
        at(sphere(1.2, 5), 0.45, 2.7, -0.2),
      ]),
      24,
    ),
    batch(
      fuse(
        "eden-moon-fruit",
        moonGlow,
        [0, 1, 2, 3, 4].map((k) => {
          const a = (k / 5) * Math.PI * 2;
          return at(sphere(0.22, 5), Math.cos(a) * 0.55, 2.15, Math.sin(a) * 0.55, 0, 0, 0, 0.75, 1.45, 0.75);
        }),
      ),
      24,
    ),
  ]);
  const emberTree = plant([
    exoticTrunk("eden-ember-trunk", 1.8, 0.14, 0.34),
    batch(
      fuse("eden-ember-leaf", emberLeaf, [
        at(sphere(2.3, 6), 0, 2.05, 0, 0, 0, 0, 1.1, 0.6, 1),
        at(sphere(1.1, 5), -0.55, 1.85, 0.25),
      ]),
      24,
    ),
    orbFruit("eden-ember-fruit", emberGlow, 1.9, 0.6, 6, 0.2),
  ]);
  const coilTree = (() => {
    const coils: Mesh[] = [];
    const pads: Mesh[] = [];
    const pods: Mesh[] = [];
    for (let i = 0; i < 8; i++) {
      const a0 = i * 0.78;
      const a1 = a0 + 0.78;
      const y0 = 0.2 + i * 0.3;
      const r = 0.28;
      coils.push(
        aim(
          cylinder(1, 0.11, 0.13, 5),
          new Vector3(Math.cos(a0) * r, y0, Math.sin(a0) * r),
          new Vector3(Math.cos(a1) * r, y0 + 0.3, Math.sin(a1) * r),
          "y",
        ),
      );
      if (i % 2 === 0) {
        pads.push(at(sphere(0.42, 5), Math.cos(a1) * (r + 0.2), y0 + 0.34, Math.sin(a1) * (r + 0.2), 0, a1, 0, 1, 0.2, 0.7));
        pods.push(at(sphere(0.16, 4), Math.cos(a1) * r, y0 + 0.2, Math.sin(a1) * r));
      }
    }
    return plant([
      batch(fuse("eden-coil-trunk", bark, coils), 24),
      batch(fuse("eden-coil-leaf", coilLeaf, pads, true), 24),
      batch(fuse("eden-coil-fruit", podGlow, pods), 24),
    ]);
  })();
  const crownTree = plant([
    exoticTrunk("eden-crown-trunk", 1.15, 0.16, 0.32),
    batch(
      fuse("eden-crown-leaf", crownLeaf, [
        at(sphere(2.6, 6), 0, 1.35, 0, 0, 0, 0, 1.2, 0.32, 1.2),
        at(sphere(0.8, 5), 0, 1.85, 0),
        at(sphere(0.55, 4), 0.7, 1.7, 0.2),
        at(sphere(0.5, 4), -0.55, 1.65, -0.25),
      ]),
      24,
    ),
    orbFruit("eden-crown-fruit", rubyGlow, 1.7, 0.85, 7, 0.2),
  ]);
  const jewelShrub = plant([
    batch(tint(bushMesh, "eden-jewel-leaf", jewelLeaf), 40),
    orbFruit("eden-jewel-amethyst", amethyst, 0.55, 0.42, 5, 0.14),
    orbFruit("eden-jewel-emerald", emerald, 0.48, 0.28, 4, 0.12),
  ]);
  const ribbonFern = (() => {
    const parts: Mesh[] = [];
    for (let k = 0; k < 5; k++) {
      const yaw = (k / 5) * Math.PI * 2;
      const s = Math.sin(yaw);
      const c = Math.cos(yaw);
      parts.push(aim(cube(0.22, 0.04, 1), new Vector3(s * 0.05, 0.05, c * 0.05), new Vector3(s * 0.55, 0.7, c * 0.55), "z"));
      parts.push(aim(cube(0.12, 0.03, 1), new Vector3(s * 0.55, 0.7, c * 0.55), new Vector3(s * 0.95, 0.35, c * 0.95), "z"));
    }
    return plant([batch(fuse("cover-ribbon", ribbonMat, parts, true), 240)]);
  })();
  const wonderTrees = [olive, almond, lampTree, prismTree, moonTree, emberTree, coilTree, crownTree];

  const JAR = [
    [0.015, 0],
    [0.12, 0.02],
    [0.2, 0.14],
    [0.18, 0.34],
    [0.09, 0.48],
    [0.12, 0.54],
  ].map(([r, y]) => new Vector3(r, y, 0));
  const BOWL = [
    [0.02, 0],
    [0.16, 0.02],
    [0.24, 0.09],
    [0.21, 0.15],
  ].map(([r, y]) => new Vector3(r, y, 0));
  const vessel = (name: string, shape: Vector3[], arc: number, fallen: boolean, chipX: number) => {
    const body = MeshBuilder.CreateLathe(
      name,
      { shape, tessellation: 12, arc, cap: Mesh.NO_CAP, sideOrientation: Mesh.DOUBLESIDE },
      scene,
    );
    const chip = cube(0.13, 0.02, 0.08);
    chip.sideOrientation = Mesh.DOUBLESIDE;
    chip.position.set(chipX, 0.035, 0.05);
    chip.rotation.set(0.45, 0.3, 0.8);
    const mesh = fuse(name, fallen ? clayDark : clay, [body, bake(chip)], true);
    mesh.sideOrientation = Mesh.DOUBLESIDE;
    if (fallen) mesh.rotation.z = 1.22;
    return restOnGround(mesh);
  };
  const pots = [
    plant([batch(vessel("eden-pot-jar", JAR, 0.78, false, 0.18), 20)]),
    plant([batch(vessel("eden-pot-fallen", JAR, 0.7, true, 0.18), 20)]),
    plant([batch(vessel("eden-pot-bowl", BOWL, 0.66, false, 0.2), 32)]),
  ];
  const shardMesh = restOnGround(
    (() => {
      const shard = MeshBuilder.CreateCylinder(
        "eden-shard",
        {
          height: 0.16,
          diameterTop: 0.34,
          diameterBottom: 0.42,
          tessellation: 12,
          arc: 0.28,
          cap: Mesh.NO_CAP,
          enclose: true,
          sideOrientation: Mesh.DOUBLESIDE,
        },
        scene,
      );
      shard.rotation.set(1.05, 0.4, 0.2);
      shard.position.y = 0.08;
      return bake(shard);
    })(),
  );
  shardMesh.material = clay;
  shardMesh.name = "eden-shard";
  const flakeMesh = restOnGround(at(cube(0.18, 0.02, 0.11), 0, 0.03, 0, 0.4, 0.2, -0.25));
  flakeMesh.material = clayDark;
  flakeMesh.name = "eden-flake";
  flakeMesh.sideOrientation = Mesh.DOUBLESIDE;
  const shard = plant([batch(shardMesh, 80)]);
  const flake = plant([batch(flakeMesh, 80)]);

  const allows = (x: number, z: number, radius: number, kind: Kind): boolean => {
    if (Math.hypot(x, z - 8) > 86) return false;
    if (kind !== "pot" && x < -18 && z < 6 && z > -38) return false;
    if (Math.abs(x) < 10.5 && z < -31.5 && z > -58.5) return false;
    if (x > -13.2 && x < 1.2 && z > -2.6 && z < 1.5) return false;
    if (Math.abs(x - 19.5) < 2.35 && z > -0.4 && z < 12.6) return false;
    if (Math.hypot(x - 64.4, z - 46.8) < 4.6) return false;
    if (x > 57 && Math.abs(z - 4) < 3.5) return false;
    if (Math.hypot(x - 80, z - 6.4) < (kind === "tree" ? 7.4 : 4.4)) return false;
    if (kind === "tree" && inGlade(x, z)) return false;
    const wet = ground.waterDist(x, z);
    if (kind === "reed") {
      if (wet < 1.45 || wet > 3.4) return false;
    } else if (kind === "tree") {
      if (wet < 3.4) return false;
    } else if (kind === "shrub") {
      if (wet < 2.55) return false;
    } else if (kind === "vine") {
      if (wet < 3) return false;
    } else if (wet < 1.9) return false;
    const pathGap = kind === "tree" ? 5.5 : kind === "shrub" ? 4.15 : kind === "vine" ? 4.4 : 2.7;
    if (ground.pathDist(x, z) < pathGap) return false;
    const signGap = kind === "tree" ? 6.5 : kind === "shrub" || kind === "vine" ? 3.4 : 2.8;
    if (Math.hypot(x - 2.6, z + 80) < signGap) return false;
    for (const p of EDEN_PLACEMENTS) {
      if (Math.hypot(p.x - x, p.z - z) < radius) return false;
    }
    for (const [sx, sz, sr] of RESERVED) {
      if (Math.hypot(sx - x, sz - z) < sr) return false;
    }
    const trunkNeed = kind === "tree" ? 3.8 : kind === "shrub" ? 2.05 : kind === "pot" ? 1.2 : 0.55;
    for (const [tx, tz] of KNOWN) {
      if (Math.hypot(tx - x, tz - z) < trunkNeed) return false;
    }
    if (kind === "tree" || kind === "shrub") {
      const gap = kind === "tree" ? 1.9 : 1.15;
      for (const [ax, az, bx, bz] of WANDER) {
        if (distSeg(x, z, ax, az, bx, bz) < gap) return false;
      }
    }
    return true;
  };
  const tooClose = (x: number, z: number, kind: Kind): boolean => {
    for (const p of marks) {
      const d = Math.hypot(p.x - x, p.z - z);
      if (d >= 6) continue;
      if (kind === "tree" && p.kind === "tree" && d < 4.35) return true;
      if ((kind === "tree" || p.kind === "tree") && (kind === "shrub" || p.kind === "shrub") && d < 3.1) return true;
      if (kind === "shrub" && p.kind === "shrub" && d < 2.15) return true;
      if ((kind === "pot" || p.kind === "pot") && (kind === "tree" || p.kind === "tree") && d < 2.3) return true;
      if ((kind === "pot" || p.kind === "pot") && (kind === "shrub" || p.kind === "shrub") && d < 1.5) return true;
      if (kind === "pot" && p.kind === "pot" && d < 3) return true;
      if ((kind === "cover" || kind === "reed") && p.kind === "pot" && d < 0.8) return true;
      if ((kind === "cover" || kind === "reed") && p.kind === "tree" && d < 0.6) return true;
      if (kind === "cover" && p.kind === "shrub" && d < 0.8) return true;
      if (kind === "cover" && p.kind === "cover" && d < 0.34) return true;
      if (kind === "reed" && p.kind === "reed" && d < 0.72) return true;
      if (kind === "vine" && p.kind === "vine" && d < 1.4) return true;
    }
    return false;
  };
  const note = (x: number, z: number, kind: Kind) => marks.push({ x, z, kind });

  const disc = (cx: number, cz: number, rx: number, rz: number): [number, number] => {
    const a = rand() * Math.PI * 2;
    const u = Math.sqrt(rand());
    return [cx + Math.cos(a) * u * rx, cz + Math.sin(a) * u * rz];
  };
  const besidePath = (): [number, number] => {
    const i = 1 + Math.floor(rand() * (APPROACH.length - 1));
    const [ax, az] = APPROACH[i - 1];
    const [bx, bz] = APPROACH[i];
    const t = rand();
    const x = ax + (bx - ax) * t;
    const z = az + (bz - az) * t;
    const dx = bx - ax;
    const dz = bz - az;
    const len = Math.hypot(dx, dz) || 1;
    const side = rand() < 0.5 ? -1 : 1;
    const off = 3.15 + rand() * 3.3;
    return [x + (-dz / len) * side * off, z + (dx / len) * side * off];
  };
  const alongBank = (): [number, number] => {
    const course = ground.courses[Math.floor(rand() * ground.courses.length)];
    const pts = course.points;
    const i = Math.min(pts.length - 2, Math.floor(rand() * (pts.length - 1)));
    const a = pts[i];
    const b = pts[i + 1];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dz) || 1;
    const t = rand();
    const side = rand() < 0.5 ? -1 : 1;
    const off = course.width / 2 + 1.55 + rand() * 1.55;
    return [a.x + dx * t + (-dz / len) * side * off, a.z + dz * t + (dx / len) * side * off];
  };
  const inGlade = (x: number, z: number) =>
    Math.hypot(x - 4, z - 17) < 7.4 || Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r + 4.2 || Math.hypot(x, z - 78) < 7.5;
  const alongShore = (): [number, number] => {
    if (rand() < 0.46) {
      const a = rand() * Math.PI * 2;
      const rad = LAKE.r + 1.55 + rand() * 1.65;
      return [LAKE.x + Math.cos(a) * rad, LAKE.z + Math.sin(a) * rad];
    }
    return alongBank();
  };
  const anyPlant = (): [number, number] => {
    const u = rand();
    if (u < 0.46) return disc(4, 26, 40, 80);
    if (u < 0.64) return disc(4, 18, 20, 18);
    if (u < 0.8) return besidePath();
    if (u < 0.9) return disc(0, -54, 20, 16);
    return disc(2, 64, 24, 18);
  };

  const putTree = (which: Plant, x: number, z: number, lo: number, hi: number, radius: number): boolean => {
    if (!allows(x, z, radius, "tree") || tooClose(x, z, "tree")) return false;
    for (const spot of EDEN_PLACEMENTS) {
      if (Math.hypot(spot.x - x, spot.z - z) < 2.2) return false;
    }
    which.place(x, z, spin(), span(lo, hi));
    note(x, z, "tree");
    trunks.push([x, z]);
    ground.solidTrunk(x, z);
    return true;
  };
  const scatterTrees = (
    n: number,
    radius: number,
    sample: () => [number, number],
    which: (i: number) => Plant,
    lo: number,
    hi: number,
  ) => {
    let placed = 0;
    for (let i = 0; i < n * 28 && placed < n; i++) {
      const [x, z] = sample();
      if (putTree(which(placed), x, z, lo, hi, radius)) placed++;
    }
  };
  const sprinkle = (
    n: number,
    kind: Kind,
    radius: number,
    sample: () => [number, number],
    put: (x: number, z: number) => void | false,
  ) => {
    let placed = 0;
    for (let i = 0; i < n * 28 && placed < n; i++) {
      const [x, z] = sample();
      if (!allows(x, z, radius, kind) || tooClose(x, z, kind)) continue;
      if (put(x, z) === false) continue;
      note(x, z, kind);
      placed++;
    }
  };

  const POTS: readonly [number, number][] = [
    [-15, 4.5],
    [16.6, 14.4],
    [23.4, 3.2],
    [-19, 23],
    [9.5, 38],
    [-15.5, 57],
    [19, 61],
    [31, 27],
    [45, 18],
    [39, 48],
    [-14, -27],
    [15.5, -27],
    [-17, 11],
    [8, 27],
    [-7, 42],
    [27, 9],
    [-27, 17],
    [21, 38],
    [50, 34],
    [-9, 68],
    [13, -64],
    [-21, -49],
    [33, -8],
    [-4, 50],
  ];
  POTS.forEach(([x, z], i) => {
    for (let attempt = 0; attempt < 5; attempt++) {
      const jx = x + (attempt === 0 ? 0 : (rand() - 0.5) * 2);
      const jz = z + (attempt === 0 ? 0 : (rand() - 0.5) * 2);
      if (!allows(jx, jz, 2.45, "pot") || tooClose(jx, jz, "pot")) continue;
      pots[i % pots.length].place(jx, jz, spin(), span(0.75, 1.2), 0.01);
      note(jx, jz, "pot");
      for (let k = 0; k < 3; k++) {
        const a = rand() * Math.PI * 2;
        const d = 0.28 + rand() * 0.5;
        const sx = jx + Math.cos(a) * d;
        const sz = jz + Math.sin(a) * d;
        if (!allows(sx, sz, 1.9, "pot")) continue;
        const piece = rand() < 0.55 ? shard : flake;
        piece.place(sx, sz, spin(), span(0.7, 1.3), 0.01, (rand() - 0.5) * 0.45, (rand() - 0.5) * 0.45);
      }
      break;
    }
  });

  const yOf = (x: number, z: number) => ground.heightAt(x, z);
  const grove = (cx: number, cz: number, r: number) => () => disc(cx, cz, r, r * 0.82);
  for (const [x, z] of [
    [-14, -50],
    [14, -50],
    [-14, -63],
    [14, -63],
    [-12, 82],
    [14, 80],
  ] as const) {
    putTree(palm, x, z, 0.9, 1.15, 3.8);
  }
  scatterTrees(18, 3.8, grove(-18, 66, 12), () => palm, 0.85, 1.2);
  scatterTrees(16, 3.8, grove(22, -16, 11), () => palm, 0.82, 1.15);
  scatterTrees(12, 3.8, grove(-46, 14, 9), () => palm, 0.85, 1.15);
  scatterTrees(16, 3.8, grove(-30, 52, 11), (i) => cedars[i % 2], 0.78, 1.2);
  scatterTrees(12, 3.8, grove(40, 70, 9), (i) => cedars[i % 2], 0.8, 1.16);
  scatterTrees(16, 3.8, grove(-30, 16, 11), (i) => fruitTrees[i % fruitTrees.length], 0.74, 1.14);
  scatterTrees(14, 3.8, grove(36, -20, 10), (i) => fruitTrees[(i + 1) % fruitTrees.length], 0.72, 1.08);
  (
    [
      [-34, 24, 9],
      [-36, 60, 8],
      [42, -26, 9],
      [32, 78, 8],
      [24, -36, 8],
      [-42, 30, 8],
      [14, -26, 8],
      [56, -16, 8],
    ] as const
  ).forEach(([cx, cz, r], index) => {
    scatterTrees(8, 3.7, grove(cx, cz, r), () => wonderTrees[index], 0.78, 1.16);
  });
  scatterTrees(6, 3.6, grove(-50, 38, 8), () => wonderTrees[0], 0.8, 1.12);
  scatterTrees(6, 3.6, grove(-22, 76, 7), () => wonderTrees[1], 0.8, 1.12);
  scatterTrees(6, 3.6, grove(30, -42, 8), () => wonderTrees[2], 0.82, 1.14);
  scatterTrees(6, 3.6, grove(-50, 54, 7), () => wonderTrees[5], 0.8, 1.12);
  scatterTrees(10, 3.6, grove(-8, -20, 9), (i) => fruitTrees[i % fruitTrees.length], 0.74, 1.1);
  scatterTrees(8, 3.6, grove(52, 60, 8), (i) => cedars[i % 2], 0.8, 1.14);
  {
    let n = 0;
    const mixTrees = [palm, cedars[0], cedars[1], ...fruitTrees, ...wonderTrees];
    for (let i = 1; i < APPROACH.length; i++) {
      const [ax, az] = APPROACH[i - 1];
      const [bx, bz] = APPROACH[i];
      const dx = bx - ax;
      const dz = bz - az;
      const len = Math.hypot(dx, dz) || 1;
      const steps = Math.max(1, Math.floor(len / 18));
      for (let s = 1; s <= steps; s++) {
        const t = s / (steps + 1);
        const side = n % 2 === 0 ? 1 : -1;
        const off = 7.8 + (n % 3) * 1.1;
        putTree(
          mixTrees[n % mixTrees.length],
          ax + dx * t + (-dz / len) * side * off,
          az + dz * t + (dx / len) * side * off,
          0.82,
          1.18,
          4.5,
        );
        n++;
      }
    }
  }

  const lay = (which: Plant, x: number, z: number, scale: number, sy = scale) => {
    which.place(x, z, spin(), scale, yOf(x, z), (rand() - 0.5) * 0.15, (rand() - 0.5) * 0.15, sy);
  };
  sprinkle(110, "shrub", 3.05, () => {
    if (rand() < 0.34 && ground.bends.length) {
      const bend = ground.bends[Math.floor(rand() * ground.bends.length)];
      return [bend.x + (rand() - 0.5) * 5.5, bend.z + (rand() - 0.5) * 5.5];
    }
    return rand() < 0.5 ? anyPlant() : besidePath();
  }, (x, z) => {
    const s = span(0.7, 1.35);
    shrubs[Math.floor(rand() * shrubs.length)].place(x, z, spin(), s, yOf(x, z), 0, 0, s * span(0.75, 1.15));
  });
  sprinkle(160, "shrub", 2.7, anyPlant, (x, z) => {
    const low = rand() < 0.55;
    const s = low ? span(0.85, 1.5) : span(0.6, 1.15);
    const sy = low ? s * span(0.4, 0.62) : s * span(0.9, 1.25);
    bushes[rand() < 0.5 ? 0 : 1].place(x, z, spin(), s, yOf(x, z), 0, 0, sy);
  });
  sprinkle(24, "shrub", 2.8, () => (rand() < 0.5 ? disc(-28, 40, 10, 8) : disc(44, -26, 10, 8)), (x, z) => {
    jewelShrub.place(x, z, spin(), span(0.85, 1.25), yOf(x, z));
  });

  for (let i = 0; i < trunks.length; i += 3) {
    const [tx, tz] = trunks[i];
    const a = rand() * Math.PI * 2;
    const climbingHere = i % 6 !== 0;
    const dist = climbingHere ? 0.12 : 1.7;
    const x = tx + Math.cos(a) * dist;
    const z = tz + Math.sin(a) * dist;
    if (!allows(x, z, 2.2, "vine") || tooClose(x, z, "vine")) continue;
    (climbingHere ? climbing : trailing).place(x, z, a, span(0.85, 1.2), yOf(x, z));
    note(x, z, "vine");
  }
  sprinkle(32, "vine", 2.2, () => (rand() < 0.45 ? alongBank() : anyPlant()), (x, z) => {
    (rand() < 0.5 ? climbing : trailing).place(x, z, spin(), span(0.75, 1.2), yOf(x, z));
  });

  const carpet = (cx: number, cz: number, r0: number, r1: number, count: number) => {
    for (let k = 0; k < count; k++) {
      const a = rand() * Math.PI * 2;
      const rad = r0 + rand() * (r1 - r0);
      const x = cx + Math.cos(a) * rad;
      const z = cz + Math.sin(a) * rad * (cz === 17 ? 0.82 : 1);
      if (!allows(x, z, 2.15, "cover") || tooClose(x, z, "cover")) continue;
      lay(flowers[k % flowers.length], x, z, span(0.78, 1.25));
      note(x, z, "cover");
    }
  };
  carpet(4, 17, 5.2, 7.5, 96);
  carpet(LAKE.x, LAKE.z, LAKE.r + 2.7, LAKE.r + 6.2, 110);

  const beds: [number, number][] = [];
  for (let i = 0; i < 520 && beds.length < 58; i++) {
    const bend = ground.bends.length && rand() < 0.3 ? ground.bends[Math.floor(rand() * ground.bends.length)] : null;
    const [x, z] = bend
      ? [bend.x + (rand() - 0.5) * 5, bend.z + (rand() - 0.5) * 5]
      : rand() < 0.48
        ? besidePath()
        : disc(4, 26, 38, 46);
    if (!allows(x, z, 2.3, "cover")) continue;
    if (beds.some(([bx, bz]) => Math.hypot(bx - x, bz - z) < 5.1)) continue;
    beds.push([x, z]);
    const main = flowers[Math.floor(rand() * flowers.length)];
    const accent = flowers[Math.floor(rand() * flowers.length)];
    const count = 26 + Math.floor(rand() * 12);
    const radius = 1.6 + rand() * 0.95;
    for (let k = 0; k < count; k++) {
      const a = rand() * Math.PI * 2;
      const u = Math.sqrt(rand()) * radius;
      const fx = x + Math.cos(a) * u;
      const fz = z + Math.sin(a) * u;
      if (!allows(fx, fz, 2.15, "cover") || tooClose(fx, fz, "cover")) continue;
      lay(rand() < 0.72 ? main : accent, fx, fz, span(0.75, 1.28));
      note(fx, fz, "cover");
    }
  }
  sprinkle(300, "cover", 2.15, () => (rand() < 0.62 ? besidePath() : anyPlant()), (x, z) => {
    lay(flowers[Math.floor(rand() * flowers.length)], x, z, span(0.72, 1.22));
  });

  for (const [tx, tz] of trunks) {
    const n = 3 + Math.floor(rand() * 3);
    for (let k = 0; k < n; k++) {
      const a = rand() * Math.PI * 2;
      const d = 1.5 + rand() * 1.7;
      const x = tx + Math.cos(a) * d;
      const z = tz + Math.sin(a) * d;
      if (!allows(x, z, 2.25, "cover") || tooClose(x, z, "cover") || ground.waterDist(x, z) < 2.9) continue;
      const which = rand() < 0.22 ? ribbonFern : ferns[rand() < 0.5 ? 0 : 1];
      which.place(x, z, spin(), span(0.85, 1.25), yOf(x, z));
      note(x, z, "cover");
    }
  }
  sprinkle(180, "cover", 2.25, anyPlant, (x, z) => {
    if (ground.waterDist(x, z) < 2.9) return false;
    const which = rand() < 0.3 ? ribbonFern : ferns[rand() < 0.55 ? 0 : 1];
    which.place(x, z, spin(), span(0.8, 1.25), yOf(x, z));
  });
  sprinkle(1500, "cover", 2.15, anyPlant, (x, z) => {
    const s = span(0.85, 1.4);
    grasses[rand() < 0.58 ? 0 : 1].place(x, z, spin(), s, yOf(x, z), 0, 0, s * span(0.75, 1.35));
  });
  sprinkle(170, "reed", 2.15, alongShore, (x, z) => {
    const s = span(0.9, 1.3);
    reeds[rand() < 0.5 ? 0 : 1].place(x, z, spin(), s, yOf(x, z), (rand() - 0.5) * 0.05, (rand() - 0.5) * 0.05, s * span(0.9, 1.2));
  });

  const scenery: Mesh[] = [];
  for (const made of batches) {
    const mesh = made.commit();
    if (mesh) scenery.push(mesh);
  }
  return scenery;
}
