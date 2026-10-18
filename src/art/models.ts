import { Mesh, MeshBuilder, Scene, StandardMaterial, TransformNode } from "@babylonjs/core";
import type { Palette, RGB } from "./materials";

/** A posable figure. `root` sits at the feet; `speed` is ground speed in m/s. */
export interface Rig {
  root: Mesh;
  meshes: Mesh[];
  animate(dt: number, speed: number): void;
  setSeated(seated: boolean): void;
}

export interface PersonLook {
  robe: RGB;
  trim: RGB;
  head: RGB;
  skin?: RGB;
  scale?: number;
  headwear?: "wrap" | "hood" | "turban";
  beard?: RGB;
  staff?: boolean;
  lantern?: boolean;
  satchel?: boolean;
}

export function buildPerson(scene: Scene, pal: Palette, name: string, look: PersonLook): Rig {
  const root = new Mesh(name, scene);
  const body = new TransformNode(`${name}-body`, scene);
  body.parent = root;
  body.scaling.setAll(look.scale ?? 1);
  const meshes: Mesh[] = [];
  const skinRgb = look.skin ?? [0.62, 0.45, 0.33];
  const robe = pal.mat(`${name}-robe`, look.robe, "cloth");
  const trim = pal.mat(`${name}-trim`, look.trim, "cloth");
  const headMat = pal.mat(`${name}-headwear`, look.head, "cloth");
  const skin = pal.mat(`skin-${skinRgb.join("-")}`, skinRgb);
  const leather = pal.mat("leather", [0.3, 0.2, 0.13], "grain");

  const part = (m: Mesh, parent: TransformNode, material: StandardMaterial, x = 0, y = 0, z = 0) => {
    m.parent = parent;
    m.material = material;
    m.position.set(x, y, z);
    meshes.push(m);
    return m;
  };

  const hips = [-1, 1].map((side) => {
    const hip = new TransformNode(`${name}-hip`, scene);
    hip.parent = body;
    hip.position.set(side * 0.12, 0.82, 0);
    part(MeshBuilder.CreateCylinder(`${name}-leg`, { height: 0.78, diameterTop: 0.16, diameterBottom: 0.12, tessellation: 8 }, scene), hip, trim, 0, -0.39, 0);
    part(MeshBuilder.CreateBox(`${name}-foot`, { width: 0.13, height: 0.08, depth: 0.26 }, scene), hip, leather, 0, -0.78, 0.05);
    return hip;
  });

  part(MeshBuilder.CreateCylinder(`${name}-robe`, { height: 1.02, diameterTop: 0.44, diameterBottom: 0.74, tessellation: 16 }, scene), body, robe, 0, 0.93, 0);
  const chest = part(MeshBuilder.CreateSphere(`${name}-chest`, { diameter: 0.52, segments: 10 }, scene), body, robe, 0, 1.43, 0);
  chest.scaling.set(1, 0.62, 0.72);
  part(MeshBuilder.CreateTorus(`${name}-sash`, { diameter: 0.5, thickness: 0.07, tessellation: 18 }, scene), body, trim, 0, 1.1, 0);

  const shoulders = [-1, 1].map((side) => {
    const sh = new TransformNode(`${name}-shoulder`, scene);
    sh.parent = body;
    sh.position.set(side * 0.27, 1.5, 0);
    sh.rotation.z = side * 0.12;
    part(MeshBuilder.CreateCylinder(`${name}-arm`, { height: 0.6, diameterTop: 0.15, diameterBottom: 0.12, tessellation: 8 }, scene), sh, robe, 0, -0.3, 0);
    part(MeshBuilder.CreateSphere(`${name}-hand`, { diameter: 0.11, segments: 6 }, scene), sh, skin, 0, -0.62, 0);
    return sh;
  });

  part(MeshBuilder.CreateCylinder(`${name}-neck`, { height: 0.14, diameter: 0.12, tessellation: 8 }, scene), body, skin, 0, 1.62, 0);
  part(MeshBuilder.CreateSphere(`${name}-head`, { diameter: 0.3, segments: 12 }, scene), body, skin, 0, 1.78, 0);

  const wear = look.headwear ?? "wrap";
  if (wear === "turban") {
    part(MeshBuilder.CreateTorus(`${name}-turban`, { diameter: 0.27, thickness: 0.12, tessellation: 16 }, scene), body, headMat, 0, 1.86, 0);
    part(MeshBuilder.CreateSphere(`${name}-turban-top`, { diameter: 0.26, segments: 8, slice: 0.5 }, scene), body, headMat, 0, 1.88, 0);
  } else {
    const d = wear === "hood" ? 0.4 : 0.35;
    part(MeshBuilder.CreateSphere(`${name}-cover`, { diameter: d, segments: 12, slice: 0.5 }, scene), body, headMat, 0, 1.78, -0.01);
    part(MeshBuilder.CreateBox(`${name}-drape`, { width: d * 0.92, height: wear === "hood" ? 0.5 : 0.36, depth: 0.06 }, scene), body, headMat, 0, wear === "hood" ? 1.6 : 1.66, -0.15);
    if (wear === "wrap") {
      part(MeshBuilder.CreateTorus(`${name}-band`, { diameter: 0.33, thickness: 0.035, tessellation: 16 }, scene), body, trim, 0, 1.83, 0);
    }
  }
  if (look.beard) {
    const beard = part(MeshBuilder.CreateSphere(`${name}-beard`, { diameter: 0.2, segments: 8 }, scene), body, pal.mat(`${name}-beard`, look.beard), 0, 1.68, 0.1);
    beard.scaling.set(1, 1.2, 0.7);
  }
  if (look.staff) {
    part(MeshBuilder.CreateCylinder(`${name}-staff`, { height: 1.9, diameter: 0.05, tessellation: 6 }, scene), shoulders[1], pal.mat("staff-wood", [0.4, 0.28, 0.17], "wood"), 0, -0.3, 0.08);
  }
  if (look.lantern) {
    part(MeshBuilder.CreateBox(`${name}-lantern-frame`, { width: 0.16, height: 0.22, depth: 0.16 }, scene), shoulders[0], pal.mat("iron", [0.25, 0.24, 0.23]), 0, -0.78, 0.04);
    part(MeshBuilder.CreateSphere(`${name}-lantern-flame`, { diameter: 0.12, segments: 6 }, scene), shoulders[0], pal.glow("watch-flame", [1, 0.42, 0.15]), 0, -0.78, 0.04);
  }
  if (look.satchel) {
    part(MeshBuilder.CreateBox(`${name}-satchel`, { width: 0.1, height: 0.28, depth: 0.3 }, scene), body, leather, -0.37, 1.0, 0);
  }

  let phase = 0;
  let amp = 0;
  let idle = Math.random() * 10;
  let seated = false;

  return {
    root,
    meshes,
    animate(dt, speed) {
      idle += dt;
      const target = seated ? 0 : Math.min(0.75, speed * 0.085);
      amp += (target - amp) * Math.min(1, dt * 8);
      phase += dt * (2.2 + speed * 0.95);
      const s = Math.sin(phase) * amp;
      const breathe = Math.sin(idle * 1.4) * 0.03;
      if (!seated) {
        hips[0].rotation.x = s;
        hips[1].rotation.x = -s;
      }
      shoulders[0].rotation.x = -s * 0.8 + breathe;
      shoulders[1].rotation.x = s * (look.staff ? 0.25 : 0.8) - breathe;
      body.position.y = Math.abs(Math.cos(phase)) * amp * 0.06;
    },
    setSeated(v) {
      seated = v;
      hips.forEach((hip, i) => {
        hip.rotation.x = v ? -1.1 : 0;
        hip.rotation.z = v ? (i === 0 ? -1 : 1) * 0.35 : 0;
      });
    },
  };
}

export function buildHorse(scene: Scene, pal: Palette): Rig {
  const root = new Mesh("horse", scene);
  const meshes: Mesh[] = [];
  const coat = pal.mat("horse-coat", [0.42, 0.27, 0.15], "grain");
  const mane = pal.mat("horse-mane", [0.12, 0.09, 0.07], "grain");
  const hoof = pal.mat("horse-hoof", [0.15, 0.13, 0.12]);
  const saddle = pal.mat("saddle-cloth", [0.55, 0.18, 0.15], "stripes");

  const part = (m: Mesh, parent: TransformNode | Mesh, material: StandardMaterial, x = 0, y = 0, z = 0) => {
    m.parent = parent;
    m.material = material;
    m.position.set(x, y, z);
    meshes.push(m);
    return m;
  };

  const bodyMesh = part(MeshBuilder.CreateCapsule("horse-body", { radius: 0.42, height: 2.0, tessellation: 14 }, scene), root, coat, 0, 1.3, 0);
  bodyMesh.rotation.x = Math.PI / 2;
  bodyMesh.scaling.x = 0.85;
  part(MeshBuilder.CreateBox("horse-saddle", { width: 0.82, height: 0.08, depth: 0.7 }, scene), root, saddle, 0, 1.7, -0.05);

  const neckPivot = new TransformNode("horse-neck-pivot", scene);
  neckPivot.parent = root;
  neckPivot.position.set(0, 1.5, 0.82);
  neckPivot.rotation.x = 0.6;
  part(MeshBuilder.CreateCylinder("horse-neck", { height: 0.95, diameterTop: 0.3, diameterBottom: 0.5, tessellation: 12 }, scene), neckPivot, coat, 0, 0.42, 0);
  part(MeshBuilder.CreateBox("horse-mane", { width: 0.07, height: 0.9, depth: 0.12 }, scene), neckPivot, mane, 0, 0.45, -0.18);

  const headPivot = new TransformNode("horse-head-pivot", scene);
  headPivot.parent = neckPivot;
  headPivot.position.set(0, 0.88, 0);
  headPivot.rotation.x = 0.45;
  part(MeshBuilder.CreateBox("horse-head", { width: 0.26, height: 0.28, depth: 0.66 }, scene), headPivot, coat, 0, 0, 0.24);
  part(MeshBuilder.CreateBox("horse-muzzle", { width: 0.22, height: 0.22, depth: 0.2 }, scene), headPivot, mane, 0, -0.02, 0.58);
  for (const side of [-1, 1]) {
    part(MeshBuilder.CreateCylinder("horse-ear", { height: 0.14, diameterTop: 0, diameterBottom: 0.07, tessellation: 6 }, scene), headPivot, coat, side * 0.08, 0.2, -0.02);
  }

  const tailPivot = new TransformNode("horse-tail-pivot", scene);
  tailPivot.parent = root;
  tailPivot.position.set(0, 1.5, -1.12);
  tailPivot.rotation.x = -2.5;
  part(MeshBuilder.CreateCylinder("horse-tail", { height: 0.85, diameterTop: 0.16, diameterBottom: 0.05, tessellation: 8 }, scene), tailPivot, mane, 0, 0.42, 0);

  const legs = (
    [
      [-0.24, 0.72],
      [0.24, 0.72],
      [-0.24, -0.72],
      [0.24, -0.72],
    ] as const
  ).map(([x, z]) => {
    const hip = new TransformNode("horse-leg-pivot", scene);
    hip.parent = root;
    hip.position.set(x, 1.06, z);
    part(MeshBuilder.CreateCylinder("horse-upper-leg", { height: 0.56, diameterTop: 0.22, diameterBottom: 0.13, tessellation: 8 }, scene), hip, coat, 0, -0.27, 0);
    part(MeshBuilder.CreateCylinder("horse-lower-leg", { height: 0.46, diameter: 0.1, tessellation: 8 }, scene), hip, coat, 0, -0.76, 0);
    part(MeshBuilder.CreateCylinder("horse-hoof", { height: 0.1, diameter: 0.15, tessellation: 8 }, scene), hip, hoof, 0, -1.01, 0.02);
    return hip;
  });

  let phase = 0;
  let amp = 0;
  let idle = Math.random() * 10;

  return {
    root,
    meshes,
    animate(dt, speed) {
      idle += dt;
      amp += (Math.min(0.6, speed * 0.045) - amp) * Math.min(1, dt * 6);
      phase += dt * (1.5 + speed * 0.6);
      const s = Math.sin(phase) * amp;
      legs[0].rotation.x = s;
      legs[3].rotation.x = s;
      legs[1].rotation.x = -s;
      legs[2].rotation.x = -s;
      neckPivot.rotation.x = 0.6 + Math.sin(phase * 2) * amp * 0.12 + Math.sin(idle * 0.7) * 0.04;
      tailPivot.rotation.z = Math.sin(idle * 1.3) * 0.15;
      bodyMesh.position.y = 1.3 + Math.abs(Math.sin(phase)) * amp * 0.1;
    },
    setSeated() {},
  };
}

export type BeastKind = "sheep" | "camel" | "calf" | "dog" | "cat";

/** A small walked animal. Names start with `beast` so they stay out of the shadow map. */
export function buildBeast(scene: Scene, pal: Palette, name: string, kind: BeastKind): Rig {
  const root = new Mesh(name, scene);
  const meshes: Mesh[] = [];
  const spec = {
    sheep: { coat: [0.9, 0.88, 0.82] as RGB, dark: [0.2, 0.16, 0.14] as RGB, y: 0.72, len: 0.9, rad: 0.38, leg: 0.42, neck: 0.15, wool: true },
    camel: { coat: [0.72, 0.55, 0.32] as RGB, dark: [0.45, 0.3, 0.16] as RGB, y: 1.45, len: 1.5, rad: 0.32, leg: 1.05, neck: 0.85, wool: false },
    calf: { coat: [0.55, 0.32, 0.18] as RGB, dark: [0.92, 0.9, 0.84] as RGB, y: 0.85, len: 1.15, rad: 0.32, leg: 0.58, neck: 0.28, wool: false },
    dog: { coat: [0.45, 0.3, 0.16] as RGB, dark: [0.28, 0.18, 0.1] as RGB, y: 0.42, len: 0.7, rad: 0.16, leg: 0.28, neck: 0.16, wool: false },
    cat: { coat: [0.72, 0.5, 0.28] as RGB, dark: [0.35, 0.22, 0.12] as RGB, y: 0.26, len: 0.46, rad: 0.1, leg: 0.16, neck: 0.08, wool: false },
  }[kind];
  const coat = pal.mat(`${kind}-coat`, spec.coat, kind === "sheep" ? "cloth" : "grain");
  const dark = pal.mat(`${kind}-dark`, spec.dark);
  const part = (m: Mesh, parent: TransformNode | Mesh, material: StandardMaterial, x = 0, y = 0, z = 0) => {
    m.parent = parent;
    m.material = material;
    m.position.set(x, y, z);
    meshes.push(m);
    return m;
  };

  const body = part(MeshBuilder.CreateCapsule(`${name}-body`, { radius: spec.rad, height: spec.len, tessellation: 10 }, scene), root, coat, 0, spec.y, 0);
  body.rotation.x = Math.PI / 2;
  if (spec.wool) body.scaling.set(1.15, 1, 1);
  if (kind === "camel") {
    part(MeshBuilder.CreateSphere(`${name}-hump`, { diameter: 0.55, segments: 8 }, scene), root, coat, 0, spec.y + 0.38, 0.05);
  }
  if (kind === "calf") {
    const patch = part(MeshBuilder.CreateSphere(`${name}-patch`, { diameter: 0.28, segments: 6 }, scene), root, dark, 0.12, spec.y + 0.12, 0.1);
    patch.scaling.set(1.4, 0.7, 0.8);
  }

  const neck = new TransformNode(`${name}-neck`, scene);
  neck.parent = root;
  neck.position.set(0, spec.y + spec.rad * 0.2, spec.len * 0.42);
  neck.rotation.x = kind === "camel" ? 0.9 : 0.5;
  part(MeshBuilder.CreateCylinder(`${name}-neck`, { height: spec.neck, diameterTop: spec.rad * 0.45, diameterBottom: spec.rad * 0.7, tessellation: 8 }, scene), neck, coat, 0, spec.neck * 0.45, 0);
  const head = part(
    MeshBuilder.CreateBox(`${name}-head`, { width: spec.rad * 0.8, height: spec.rad * 0.7, depth: spec.rad * 1.3 }, scene),
    neck,
    kind === "sheep" ? dark : coat,
    0,
    spec.neck * 0.85,
    spec.rad * 0.7,
  );
  if (kind === "sheep") head.scaling.set(1, 1, 1.1);
  part(MeshBuilder.CreateBox(`${name}-snout`, { width: spec.rad * 0.5, height: spec.rad * 0.4, depth: spec.rad * 0.45 }, scene), neck, dark, 0, spec.neck * 0.75, spec.rad * 1.35);

  const earH = kind === "cat" || kind === "dog" ? spec.rad * 0.7 : spec.rad * 0.35;
  for (const side of [-1, 1]) {
    const ear = part(
      MeshBuilder.CreateCylinder(`${name}-ear`, { height: earH, diameterTop: 0, diameterBottom: spec.rad * 0.28, tessellation: 5 }, scene),
      neck,
      kind === "sheep" ? dark : coat,
      side * spec.rad * 0.35,
      spec.neck * 0.95 + earH * 0.3,
      spec.rad * 0.3,
    );
    if (kind === "dog") ear.rotation.z = side * 0.8;
    if (kind === "cat") ear.rotation.z = side * 0.15;
  }

  const tail = new TransformNode(`${name}-tail`, scene);
  tail.parent = root;
  tail.position.set(0, spec.y + spec.rad * 0.3, -spec.len * 0.48);
  tail.rotation.x = kind === "cat" ? 1.4 : kind === "dog" ? -0.8 : -2.2;
  part(MeshBuilder.CreateCylinder(`${name}-tail`, { height: spec.len * 0.45, diameterTop: spec.rad * 0.2, diameterBottom: spec.rad * 0.08, tessellation: 6 }, scene), tail, kind === "cat" ? dark : coat, 0, spec.len * 0.2, 0);

  const legs = (
    [
      [-1, 1],
      [1, 1],
      [-1, -1],
      [1, -1],
    ] as const
  ).map(([sx, sz]) => {
    const hip = new TransformNode(`${name}-hip`, scene);
    hip.parent = root;
    hip.position.set(sx * spec.rad * 0.55, spec.y - spec.rad * 0.3, sz * spec.len * 0.32);
    part(MeshBuilder.CreateCylinder(`${name}-leg`, { height: spec.leg, diameterTop: spec.rad * 0.28, diameterBottom: spec.rad * 0.16, tessellation: 6 }, scene), hip, kind === "sheep" ? dark : coat, 0, -spec.leg * 0.5, 0);
    return hip;
  });

  let phase = Math.random() * 6;
  let amp = 0;
  return {
    root,
    meshes,
    animate(dt, speed) {
      phase += dt * (kind === "cat" || kind === "dog" ? 6 : 3) * (0.4 + speed * 0.15);
      amp += (Math.min(0.7, speed * (kind === "camel" ? 0.04 : 0.12)) - amp) * Math.min(1, dt * 6);
      const s = Math.sin(phase) * amp;
      legs[0].rotation.x = s;
      legs[3].rotation.x = s;
      legs[1].rotation.x = -s;
      legs[2].rotation.x = -s;
      tail.rotation.z = Math.sin(phase * 0.7) * (kind === "dog" ? 0.5 : 0.25);
      if (kind === "cat") tail.rotation.x = 1.2 + Math.sin(phase * 0.4) * 0.2;
      body.position.y = spec.y + Math.abs(Math.sin(phase)) * amp * spec.rad * 0.15;
    },
    setSeated() {},
  };
}
