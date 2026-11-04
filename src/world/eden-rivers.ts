import {
  Color3,
  DynamicTexture,
  Material,
  Mesh,
  MeshBuilder,
  PointLight,
  Scene,
  StandardMaterial,
  Texture,
  Vector3,
  VertexBuffer,
  VertexData,
} from "@babylonjs/core";
import { EDEN_PLACEMENTS } from "../data/layout";

const SOUTH_SIGN = { x: 2.6, z: -80 };
const EAST_GATE = { x: 80, z: 6.4 };

/** The spring in the midst, where the river parts into four heads. */
export const SPRING = { x: 22, z: 22, r: 5.15 };

export interface RiverCourse {
  name: string;
  width: number;
  points: { x: number; z: number }[];
}

const HEADS: readonly { name: string; x: number; z: number; width: number; waves: number; sway: number }[] = [
  { name: "feeder", x: 0, z: 8, width: 2.7, waves: 1.1, sway: 0.42 },
  { name: "pison", x: 60, z: 48, width: 3.15, waves: 1.7, sway: 1 },
  { name: "gihon", x: 54, z: 4, width: 2.9, waves: 2.3, sway: 0.85 },
  { name: "hiddekel", x: 74, z: 26, width: 2.85, waves: 0.6, sway: 1 },
  { name: "euphrates", x: 24, z: 64, width: 3.05, waves: 2.8, sway: 1 },
];

const WALK: readonly [number, number][] = [
  [0, -86],
  [0, -66],
  ...EDEN_PLACEMENTS.map((p) => [p.x, p.z] as [number, number]),
];

interface Seg {
  ax: number;
  az: number;
  bx: number;
  bz: number;
  half: number;
}

const CELL = 8;

function hypot(x: number, z: number): number {
  return Math.hypot(x, z);
}

function distSeg(x: number, z: number, ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax;
  const dz = bz - az;
  const len2 = dx * dx + dz * dz;
  const t = len2 < 1e-6 ? 0 : Math.min(1, Math.max(0, ((x - ax) * dx + (z - az) * dz) / len2));
  return hypot(x - (ax + dx * t), z - (az + dz * t));
}

function repel(x: number, z: number, cx: number, cz: number, rad: number): [number, number] {
  const dx = x - cx;
  const dz = z - cz;
  const d = hypot(dx, dz) || 0.001;
  if (d >= rad) return [x, z];
  const push = rad - d;
  return [x + (dx / d) * push, z + (dz / d) * push];
}

function pushPoint(x: number, z: number): [number, number] {
  let px = x;
  let pz = z;
  for (const p of EDEN_PLACEMENTS) {
    [px, pz] = repel(px, pz, p.x, p.z, 6.9);
  }
  [px, pz] = repel(px, pz, -2, 18, 6.5);
  [px, pz] = repel(px, pz, 10, 16, 6.3);
  [px, pz] = repel(px, pz, 64.4, 46.8, 6.2);
  [px, pz] = repel(px, pz, 0, -76, 5);
  [px, pz] = repel(px, pz, SOUTH_SIGN.x, SOUTH_SIGN.z, 6);
  [px, pz] = repel(px, pz, EAST_GATE.x, EAST_GATE.z, 5.5);
  for (let i = 1; i < WALK.length; i++) {
    const [ax, az] = WALK[i - 1];
    const [bx, bz] = WALK[i];
    const dx = bx - ax;
    const dz = bz - az;
    const len2 = dx * dx + dz * dz;
    const t = len2 < 1e-6 ? 0 : Math.min(1, Math.max(0, ((px - ax) * dx + (pz - az) * dz) / len2));
    const cx = ax + dx * t;
    const cz = az + dz * t;
    [px, pz] = repel(px, pz, cx, cz, 3.15);
  }
  [px, pz] = pushOut(px, pz, 57, 96, 0.2, 8.2);
  [px, pz] = pushOut(px, pz, -14, 2.2, -3.2, 2.2);
  [px, pz] = pushOut(px, pz, -11, 11, -60, -30);
  [px, pz] = pushOut(px, pz, 16.3, 22.7, -1, 13.2);
  return [px, pz];
}

/** Slide a point to the nearest edge of a box it has entered. */
function pushOut(x: number, z: number, minX: number, maxX: number, minZ: number, maxZ: number): [number, number] {
  if (x <= minX || x >= maxX || z <= minZ || z >= maxZ) return [x, z];
  const left = x - minX;
  const right = maxX - x;
  const bottom = z - minZ;
  const top = maxZ - z;
  const near = Math.min(left, right, bottom, top);
  if (near === left) return [minX, z];
  if (near === right) return [maxX, z];
  if (near === bottom) return [x, minZ];
  return [x, maxZ];
}

function meander(head: (typeof HEADS)[number]): { x: number; z: number }[] {
  const dx = head.x - SPRING.x;
  const dz = head.z - SPRING.z;
  const len = hypot(dx, dz) || 1;
  const ux = dx / len;
  const uz = dz / len;
  const nx = -uz;
  const nz = ux;
  const startX = SPRING.x + ux * (SPRING.r - 0.55);
  const startZ = SPRING.z + uz * (SPRING.r - 0.55);
    const steps = Math.max(18, Math.round(len / 0.85));
  const pts: { x: number; z: number }[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const env = Math.sin(t * Math.PI);
    const off =
      (Math.sin(t * Math.PI * 2.15 + head.waves) * 4.15 + Math.sin(t * Math.PI * 4.4 + head.waves * 1.7) * 1.65) *
      env *
      head.sway;
    const x = startX + (head.x - startX) * t + nx * off;
    const z = startZ + (head.z - startZ) * t + nz * off;
    pts.push(i === 0 || i === steps ? { x: i === 0 ? startX : head.x, z: i === 0 ? startZ : head.z } : { x, z });
  }
  for (let pass = 0; pass < 6; pass++) {
    for (let i = 1; i < pts.length - 1; i++) {
      const [x, z] = pushPoint(pts[i].x, pts[i].z);
      pts[i] = {
        x: x * 0.62 + (pts[i - 1].x + pts[i + 1].x) * 0.19,
        z: z * 0.62 + (pts[i - 1].z + pts[i + 1].z) * 0.19,
      };
    }
  }
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 1; i < pts.length - 1; i++) {
      if (turn(pts[i - 1], pts[i], pts[i + 1]) < 1.7) continue;
      pts[i] = { x: (pts[i - 1].x + pts[i + 1].x) / 2, z: (pts[i - 1].z + pts[i + 1].z) / 2 };
    }
  }
  const even = resample(pts, 0.72);
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 1; i < even.length - 1; i++) {
      even[i] = {
        x: even[i].x * 0.5 + (even[i - 1].x + even[i + 1].x) * 0.25,
        z: even[i].z * 0.5 + (even[i - 1].z + even[i + 1].z) * 0.25,
      };
    }
  }
  return even;
}

/** Even spacing, so a shoved vertex cannot stretch one bank quad across the garden. */
function resample(pts: { x: number; z: number }[], spacing: number): { x: number; z: number }[] {
  if (pts.length < 2) return pts;
  const out = [pts[0]];
  let ax = pts[0].x;
  let az = pts[0].z;
  let carry = 0;
  for (let i = 1; i < pts.length; i++) {
    let bx = pts[i].x;
    let bz = pts[i].z;
    let dist = hypot(bx - ax, bz - az);
    while (carry + dist >= spacing && dist > 1e-4) {
      const t = (spacing - carry) / dist;
      if (t <= 1e-4) break;
      ax += (bx - ax) * t;
      az += (bz - az) * t;
      out.push({ x: ax, z: az });
      dist = hypot(bx - ax, bz - az);
      carry = 0;
    }
    carry += dist;
    ax = bx;
    az = bz;
  }
  const last = pts[pts.length - 1];
  const end = out[out.length - 1];
  if (hypot(end.x - last.x, end.z - last.z) > spacing * 0.35) out.push(last);
  else out[out.length - 1] = last;
  return out;
}

export const COURSES: RiverCourse[] = HEADS.map((head) => ({
  name: head.name,
  width: head.width,
  points: meander(head),
}));

function turn(prev: { x: number; z: number }, at: { x: number; z: number }, next: { x: number; z: number }): number {
  const ax = at.x - prev.x;
  const az = at.z - prev.z;
  const bx = next.x - at.x;
  const bz = next.z - at.z;
  const al = hypot(ax, az) || 1;
  const bl = hypot(bx, bz) || 1;
  const dot = Math.max(-1, Math.min(1, (ax * bx + az * bz) / (al * bl)));
  return Math.acos(dot);
}

export const BENDS: { x: number; z: number }[] = COURSES.flatMap((course) => {
  const found: { x: number; z: number }[] = [];
  const pts = course.points;
  for (let i = 2; i < pts.length - 2; i++) {
    if (turn(pts[i - 1], pts[i], pts[i + 1]) > 0.42) found.push(pts[i]);
  }
  return found;
});

const SEGS: Seg[] = [];
const GRID = new Map<string, number[]>();

function addSeg(ax: number, az: number, bx: number, bz: number, half: number): void {
  const id = SEGS.length;
  SEGS.push({ ax, az, bx, bz, half });
  const minX = Math.min(ax, bx);
  const maxX = Math.max(ax, bx);
  const minZ = Math.min(az, bz);
  const maxZ = Math.max(az, bz);
  for (let gx = Math.floor((minX - half) / CELL); gx <= Math.floor((maxX + half) / CELL); gx++) {
    for (let gz = Math.floor((minZ - half) / CELL); gz <= Math.floor((maxZ + half) / CELL); gz++) {
      const key = `${gx}:${gz}`;
      const list = GRID.get(key);
      if (list) list.push(id);
      else GRID.set(key, [id]);
    }
  }
}

for (const course of COURSES) {
  const pts = course.points;
  for (let i = 1; i < pts.length; i++) {
    const t = (i - 0.5) / (pts.length - 1);
    const mouth = t > 0.84 ? (t - 0.84) / 0.16 : 0;
    const half = (course.width / 2) * (1 + mouth * 0.9);
    addSeg(pts[i - 1].x, pts[i - 1].z, pts[i].x, pts[i].z, half);
  }
}

function pathClose(x: number, z: number): boolean {
  for (let i = 1; i < WALK.length; i++) {
    const [ax, az] = WALK[i - 1];
    const [bx, bz] = WALK[i];
    if (distSeg(x, z, ax, az, bx, bz) < 2.15) return true;
  }
  return false;
}

/** Negative inside the water. */
export function waterSigned(x: number, z: number): number {
  let best = hypot(x - SPRING.x, z - SPRING.z) - SPRING.r;
  const gx = Math.floor(x / CELL);
  const gz = Math.floor(z / CELL);
  for (let ix = gx - 1; ix <= gx + 1; ix++) {
    for (let iz = gz - 1; iz <= gz + 1; iz++) {
      const list = GRID.get(`${ix}:${iz}`);
      if (!list) continue;
      for (const id of list) {
        const s = SEGS[id];
        best = Math.min(best, distSeg(x, z, s.ax, s.az, s.bx, s.bz) - s.half);
      }
    }
  }
  return best;
}

export function waterDist(x: number, z: number): number {
  return Math.max(0, waterSigned(x, z));
}

export function pathDist(x: number, z: number): number {
  let best = 999;
  for (let i = 1; i < WALK.length; i++) {
    const [ax, az] = WALK[i - 1];
    const [bx, bz] = WALK[i];
    best = Math.min(best, distSeg(x, z, ax, az, bx, bz));
  }
  return best;
}

function flatZone(x: number, z: number): boolean {
  for (const p of EDEN_PLACEMENTS) {
    if (hypot(p.x - x, p.z - z) < 2.45) return true;
  }
  if (Math.abs(x) < 2.5 && z < -64) return true;
  if (x > 58 && Math.abs(z - 4) < 2.5) return true;
  if (Math.abs(x) < 11 && z < -30.5 && z > -59.5) return true;
  if (x > -13.4 && x < 1.4 && z > -2.8 && z < 1.8) return true;
  if (Math.abs(x - 19.5) < 2.5 && z > -0.6 && z < 12.8) return true;
  if (hypot(x - 64.4, z - 46.8) < 5) return true;
  if (hypot(x - SOUTH_SIGN.x, z - SOUTH_SIGN.z) < 3.2) return true;
  if (hypot(x - EAST_GATE.x, z - EAST_GATE.z) < 3.2) return true;
  if (hypot(x + 2, z - 18) < 2.3) return true;
  if (hypot(x - 10, z - 16) < 2.3) return true;
  return false;
}

/** Sunken bed: deepest in the channel, rising across a soft bank to level ground. */
export function bedHeight(x: number, z: number): number {
  if (flatZone(x, z)) return 0;
  const sd = waterSigned(x, z);
  const lip = 2.85;
  if (sd >= lip) return 0;
  const ford = pathClose(x, z);
  const edge = ford ? -0.16 : -0.4;
  const deep = ford ? -0.26 : -0.76;
  if (sd <= 0) {
    const t = Math.min(1, -sd / 1.55);
    const s = t * t * (3 - 2 * t);
    return edge + (deep - edge) * s;
  }
  const u = sd / lip;
  const s = u * u * (3 - 2 * u);
  return edge * (1 - s);
}

export function displaceEdenGround(ground: Mesh): void {
  const pos = ground.getVerticesData(VertexBuffer.PositionKind);
  const indices = ground.getIndices();
  if (!pos || !indices) return;
  for (let i = 0; i < pos.length; i += 3) {
    const y = bedHeight(pos[i], pos[i + 2]);
    // The bank mesh is the visible bed. Keep this shell below it so facets cannot cut through.
    if (y !== 0) pos[i + 1] = y - 0.7;
  }
  ground.setVerticesData(VertexBuffer.PositionKind, pos);
  const normals = new Float32Array(pos.length);
  VertexData.ComputeNormals(pos, indices, normals);
  ground.setVerticesData(VertexBuffer.NormalKind, normals);
  ground.refreshBoundingInfo();
}

/** Water sits in the trench, below the grassy lip and above the mud bed. */
function surfaceY(x: number, z: number): number {
  return bedHeight(x, z) + 0.2;
}

function courseFrame(course: RiverCourse, i: number): { rx: number; rz: number; half: number; y: number; dist: number } {
  const pts = course.points;
  const prev = pts[Math.max(0, i - 1)];
  const next = pts[Math.min(pts.length - 1, i + 1)];
  let tx = next.x - prev.x;
  let tz = next.z - prev.z;
  const len = hypot(tx, tz) || 1;
  tx /= len;
  tz /= len;
  const t = i / Math.max(1, pts.length - 1);
  const mouth = t > 0.84 ? (t - 0.84) / 0.16 : 0;
  const half = (course.width / 2) * (1 + 0.08 * Math.sin(t * Math.PI * 3) + mouth * 0.85);
  let dist = 0;
  for (let k = 1; k <= i; k++) dist += hypot(pts[k].x - pts[k - 1].x, pts[k].z - pts[k - 1].z);
  return { rx: tz, rz: -tx, half, y: surfaceY(pts[i].x, pts[i].z), dist };
}

function buildRibbon(course: RiverCourse): { positions: number[]; indices: number[]; uvs: number[] } {
  const positions: number[] = [];
  const indices: number[] = [];
  const uvs: number[] = [];
  for (let i = 0; i < course.points.length; i++) {
    const p = course.points[i];
    const f = courseFrame(course, i);
    positions.push(p.x - f.rx * f.half, f.y, p.z - f.rz * f.half, p.x + f.rx * f.half, f.y, p.z + f.rz * f.half);
    const u = f.dist * 0.18;
    uvs.push(u, 0, u, 1);
    if (i > 0) {
      const a = (i - 1) * 2;
      indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  return { positions, indices, uvs };
}

function triUp(positions: number[], indices: number[], a: number, b: number, c: number): void {
  const ax = positions[a * 3];
  const az = positions[a * 3 + 2];
  const bx = positions[b * 3];
  const bz = positions[b * 3 + 2];
  const cx = positions[c * 3];
  const cz = positions[c * 3 + 2];
  const ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
  if (ny >= 0) indices.push(a, b, c);
  else indices.push(a, c, b);
}

function quad(positions: number[], indices: number[], a: number, b: number, c: number, d: number): void {
  triUp(positions, indices, a, c, b);
  triUp(positions, indices, b, c, d);
}

function bankTint(lat: number, half: number): [number, number, number] {
  const u = Math.min(1, Math.max(0, (lat - half * 0.25) / (half + 1.7)));
  const mud = [0.46, 0.32, 0.18];
  const wet = [0.34, 0.4, 0.2];
  const grass = [0.3, 0.5, 0.22];
  const inner = u < 0.45 ? mud : wet;
  const outer = u < 0.45 ? wet : grass;
  const t = u < 0.45 ? u / 0.45 : (u - 0.45) / 0.55;
  return [
    inner[0] + (outer[0] - inner[0]) * t,
    inner[1] + (outer[1] - inner[1]) * t,
    inner[2] + (outer[2] - inner[2]) * t,
  ];
}

/** Bed floor plus both banks. `lift` keeps neighboring courses from z-fighting where they meet. */
function buildBank(course: RiverCourse, lift: number): { positions: number[]; indices: number[]; colors: number[] } {
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const latsFor = (half: number) => [
    half * 0.34,
    half * 0.7,
    half + 0.05,
    half + 0.45,
    half + 0.95,
    half + 1.5,
    half + 2.15,
    half + 2.9,
  ];
  const strideOf = (n: number) => 1 + n * 2;
  let stride = 0;
  for (let i = 0; i < course.points.length; i++) {
    const p = course.points[i];
    const f = courseFrame(course, i);
    const lats = latsFor(f.half);
    stride = strideOf(lats.length);
    const drop = (x: number, z: number) => bedHeight(x, z) + lift;
    positions.push(p.x, drop(p.x, p.z), p.z);
    colors.push(0.4, 0.28, 0.16, 1);
    for (const lat of lats) {
      const tint = bankTint(lat, f.half);
      for (const sgn of [-1, 1]) {
        const x = p.x + f.rx * sgn * lat;
        const z = p.z + f.rz * sgn * lat;
        positions.push(x, drop(x, z), z);
        colors.push(tint[0], tint[1], tint[2], 1);
      }
    }
  }
  for (let i = 1; i < course.points.length; i++) {
    const base = (i - 1) * stride;
    const next = i * stride;
    quad(positions, indices, base, base + 2, next, next + 2);
    quad(positions, indices, base, next, base + 1, next + 1);
    const rings = (stride - 1) / 2;
    for (let r = 0; r < rings - 1; r++) {
      const left = base + 1 + r * 2;
      const right = left + 1;
      const left2 = left + 2;
      const right2 = right + 2;
      const nleft = next + 1 + r * 2;
      const nright = nleft + 1;
      const nleft2 = nleft + 2;
      const nright2 = nright + 2;
      quad(positions, indices, left, left2, nleft, nleft2);
      quad(positions, indices, right, nright, right2, nright2);
    }
  }
  return { positions, indices, colors };
}

function applyMesh(
  mesh: Mesh,
  positions: number[],
  indices: number[],
  uvs?: number[],
  colors?: number[],
): Mesh {
  const normals = new Float32Array(positions.length);
  const data = new VertexData();
  data.positions = positions;
  data.indices = indices;
  data.normals = Array.from(normals);
  VertexData.ComputeNormals(positions, indices, data.normals);
  if (uvs) data.uvs = uvs;
  if (colors) data.colors = colors;
  data.applyToMesh(mesh, true);
  mesh.useVertexColors = !!colors;
  mesh.isPickable = false;
  return mesh;
}

function springRing(): { positions: number[]; indices: number[]; colors: number[] } {
  const positions: number[] = [];
  const indices: number[] = [];
  const colors: number[] = [];
  const steps = 48;
  const rows = [0.4, 1.3, 2.4, 3.6, SPRING.r - 0.15, SPRING.r + 0.35, SPRING.r + 1.05, SPRING.r + 1.85, SPRING.r + 2.7];
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const cs = Math.cos(a);
    const sn = Math.sin(a);
    for (const rad of rows) {
      const x = SPRING.x + cs * rad;
      const z = SPRING.z + sn * rad;
      const tint = bankTint(Math.max(0, rad - (SPRING.r - 1.4)), 1.3);
      positions.push(x, bedHeight(x, z) + 0.05, z);
      colors.push(tint[0], tint[1], tint[2], 1);
    }
  }
  const stride = rows.length;
  for (let i = 0; i < steps; i++) {
    for (let r = 0; r < rows.length - 1; r++) {
      const a = i * stride + r;
      const b = a + 1;
      const c = (i + 1) * stride + r;
      const d = c + 1;
      quad(positions, indices, a, b, c, d);
    }
  }
  return { positions, indices, colors };
}

/** A private ripple, stronger than the oasis tile, so the current reads at a glance. */
function currentMaps(scene: Scene): { diffuse: DynamicTexture; bump: DynamicTexture } {
  const size = 128;
  const diffuse = new DynamicTexture("eden-current-diff", { width: size, height: size }, scene, false);
  const bump = new DynamicTexture("eden-current-bump", { width: size, height: size }, scene, false);
  const ctx = diffuse.getContext() as unknown as CanvasRenderingContext2D;
  const bctx = bump.getContext() as unknown as CanvasRenderingContext2D;
  const img = ctx.createImageData(size, size);
  const bimg = bctx.createImageData(size, size);
  const heights = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const along = Math.sin(Math.PI * 2 * (3 * u + 0.15 * v));
      const cross = Math.sin(Math.PI * 2 * (u * 0.5 + 2 * v));
      const glint = 0.5 + 0.5 * along;
      const h = along * 0.22 + cross * 0.08;
      heights[y * size + x] = h;
      const i = (y * size + x) * 4;
      img.data[i] = 78 + glint * 36;
      img.data[i + 1] = 142 + glint * 28;
      img.data[i + 2] = 162 + glint * 22;
      img.data[i + 3] = 255;
    }
  }
  const strength = 1.15;
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
      const nz = 1 / len;
      const i = (y * size + x) * 4;
      bimg.data[i] = nx * 127.5 + 127.5;
      bimg.data[i + 1] = ny * 127.5 + 127.5;
      bimg.data[i + 2] = nz * 127.5 + 127.5;
      bimg.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  bctx.putImageData(bimg, 0, 0);
  diffuse.update(false);
  bump.update(false);
  for (const tex of [diffuse, bump]) {
    tex.wrapU = tex.wrapV = Texture.WRAP_ADDRESSMODE;
    tex.anisotropicFilteringLevel = 8;
    tex.updateSamplingMode(Texture.TRILINEAR_SAMPLINGMODE);
  }
  return { diffuse, bump };
}

export interface EdenWaters {
  meshes: Mesh[];
  lamp: PointLight;
  tick(dt: number, time: number): void;
}

export function buildEdenRivers(scene: Scene): EdenWaters {
  const ripple = currentMaps(scene);
  ripple.bump.level = 0.45;
  const waterMat = new StandardMaterial("eden-water", scene);
  waterMat.diffuseTexture = ripple.diffuse;
  waterMat.bumpTexture = ripple.bump;
  waterMat.diffuseColor = new Color3(0.72, 0.84, 0.88);
  waterMat.specularColor = new Color3(0.92, 0.95, 0.96);
  waterMat.specularPower = 28;
  waterMat.emissiveColor = new Color3(0.05, 0.12, 0.14);
  waterMat.useSpecularOverAlpha = true;
  waterMat.alpha = 0.66;
  waterMat.transparencyMode = Material.MATERIAL_ALPHABLEND;
  waterMat.backFaceCulling = false;
  waterMat.zOffset = -2;

  const positions: number[] = [];
  const indices: number[] = [];
  const uvs: number[] = [];
  for (const course of COURSES) {
    const ribbon = buildRibbon(course);
    const base = positions.length / 3;
    positions.push(...ribbon.positions);
    uvs.push(...ribbon.uvs);
    for (const index of ribbon.indices) indices.push(index + base);
  }
  const springSteps = 40;
  const springBase = positions.length / 3;
  const sy = surfaceY(SPRING.x, SPRING.z);
  positions.push(SPRING.x, sy, SPRING.z);
  uvs.push(0.5, 0.5);
  for (let i = 0; i <= springSteps; i++) {
    const a = (i / springSteps) * Math.PI * 2;
    positions.push(SPRING.x + Math.cos(a) * SPRING.r, sy, SPRING.z + Math.sin(a) * SPRING.r);
    uvs.push(0.5 + Math.cos(a) * 0.5, 0.5 + Math.sin(a) * 0.5);
  }
  for (let i = 0; i < springSteps; i++) {
    indices.push(springBase, springBase + 1 + i, springBase + 2 + i);
  }

  const water = new Mesh("water", scene);
  applyMesh(water, positions, indices, uvs);
  water.material = waterMat;

  const bankPos: number[] = [];
  const bankIdx: number[] = [];
  const bankCol: number[] = [];
  COURSES.forEach((course, index) => {
    const bank = buildBank(course, 0.028 + index * 0.006);
    const base = bankPos.length / 3;
    bankPos.push(...bank.positions);
    bankCol.push(...bank.colors);
    for (const index of bank.indices) bankIdx.push(index + base);
  });
  const ring = springRing();
  const ringBase = bankPos.length / 3;
  bankPos.push(...ring.positions);
  bankCol.push(...ring.colors);
  for (const index of ring.indices) bankIdx.push(index + ringBase);
  const bankMat = new StandardMaterial("eden-bank", scene);
  bankMat.diffuseColor = new Color3(1, 1, 1);
  bankMat.specularColor = new Color3(0.04, 0.04, 0.03);
  bankMat.backFaceCulling = false;
  bankMat.twoSidedLighting = true;
  const bank = new Mesh("cover-bank", scene);
  applyMesh(bank, bankPos, bankIdx, undefined, bankCol);
  bank.material = bankMat;

  const upwellingMat = new StandardMaterial("eden-upwelling", scene);
  upwellingMat.diffuseColor = new Color3(0.62, 0.86, 0.95);
  upwellingMat.emissiveColor = new Color3(0.28, 0.52, 0.62);
  upwellingMat.specularColor = new Color3(0.9, 0.95, 1);
  upwellingMat.specularPower = 32;
  upwellingMat.alpha = 0.62;
  upwellingMat.transparencyMode = Material.MATERIAL_ALPHABLEND;
  upwellingMat.backFaceCulling = false;
  const upwelling = MeshBuilder.CreateCylinder(
    "water-spring",
    { height: 0.48, diameterTop: 0.28, diameterBottom: 3.1, tessellation: 20 },
    scene,
  );
  upwelling.position.set(SPRING.x, sy + 0.22, SPRING.z);
  upwelling.material = upwellingMat;

  const wispMat = new StandardMaterial("eden-wisp", scene);
  wispMat.diffuseColor = new Color3(0.75, 0.9, 1);
  wispMat.emissiveColor = new Color3(0.35, 0.55, 0.7);
  wispMat.specularColor = new Color3(0, 0, 0);
  wispMat.alpha = 0.28;
  wispMat.transparencyMode = Material.MATERIAL_ALPHABLEND;
  wispMat.backFaceCulling = false;
  const wisps: Mesh[] = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const wisp = MeshBuilder.CreatePlane("water-wisp", { width: 0.28, height: 1.5 }, scene);
    wisp.position.set(SPRING.x + Math.cos(a) * 0.7, sy + 0.95, SPRING.z + Math.sin(a) * 0.7);
    wisp.rotation.y = -a;
    wisp.material = wispMat;
    wisps.push(wisp);
  }

  const stones: Mesh[] = [];
  const stoneMat = new StandardMaterial("eden-spring-stone", scene);
  stoneMat.diffuseColor = new Color3(0.55, 0.5, 0.42);
  stoneMat.specularColor = new Color3(0.08, 0.07, 0.06);
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2 + 0.2;
    const rad = SPRING.r + 1.15 + (i % 3) * 0.28;
    const sx = SPRING.x + Math.cos(a) * rad;
    const sz = SPRING.z + Math.sin(a) * rad;
    const rock = MeshBuilder.CreateSphere("eden-spring-stone", { diameter: 0.55 + (i % 3) * 0.18, segments: 5 }, scene);
    rock.position.set(sx, bedHeight(sx, sz) + 0.16, sz);
    rock.scaling.set(1.15, 0.55, 0.9);
    rock.material = stoneMat;
    stones.push(rock);
  }

  const lamp = new PointLight("spring-light", new Vector3(SPRING.x, 1.35, SPRING.z), scene);
  lamp.diffuse = new Color3(0.62, 0.82, 1);
  lamp.specular = new Color3(0.45, 0.6, 0.7);
  lamp.intensity = 0.42;
  lamp.range = 18;

  let clock = 0;
  const tick = (dt: number, time: number) => {
    clock += dt;
    ripple.bump.uOffset = clock * 0.07;
    ripple.diffuse.uOffset = clock * 0.045;
    ripple.bump.vOffset = Math.sin(clock * 0.35) * 0.02;
    upwelling.scaling.y = 1 + Math.sin(time * 1.6) * 0.12;
    upwelling.position.y = sy + 0.2 + Math.sin(time * 1.6) * 0.04;
    for (let i = 0; i < wisps.length; i++) {
      const a = (i / wisps.length) * Math.PI * 2 + clock * 0.35;
      wisps[i].position.x = SPRING.x + Math.cos(a) * 0.72;
      wisps[i].position.z = SPRING.z + Math.sin(a) * 0.72;
      wisps[i].position.y = sy + 0.85 + Math.sin(time * 2 + i) * 0.08;
      wisps[i].rotation.y = -a;
    }
    lamp.intensity = 0.4 + Math.sin(time * 1.3) * 0.05;
  };

  return { meshes: [water, bank, upwelling, ...wisps, ...stones], lamp, tick };
}
