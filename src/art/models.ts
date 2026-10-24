import { Mesh, MeshBuilder, Scene, StandardMaterial, TransformNode, Vector3 } from "@babylonjs/core";
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
  const skinRgb = look.skin ?? [0.72, 0.52, 0.38];
  const robe = pal.mat(`${name}-robe`, look.robe, "cloth");
  const trim = pal.mat(`${name}-trim`, look.trim, "cloth");
  const headMat = pal.mat(`${name}-headwear`, look.head, "cloth");
  const skin = pal.mat(`skin-${skinRgb.join("-")}`, skinRgb);
  const leather = pal.mat("leather", [0.3, 0.2, 0.13], "grain");
  const eyeWhite = pal.mat("eye-white", [0.95, 0.93, 0.9]);
  const iris = pal.mat("iris", [0.35, 0.2, 0.12]);
  const pupil = pal.mat("pupil", [0.06, 0.04, 0.03]);
  const brow = pal.mat("brow", [0.22, 0.14, 0.1]);
  const lip = pal.mat("lip", [0.42, 0.22, 0.18]);
  const vestRgb: RGB = [
    look.robe[0] * 0.35 + look.trim[0] * 0.65,
    look.robe[1] * 0.35 + look.trim[1] * 0.65,
    look.robe[2] * 0.35 + look.trim[2] * 0.65,
  ];
  const vestMat = pal.mat(`${name}-vest`, vestRgb, "cloth");

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
    hip.position.set(side * 0.09, 0.16, 0);
    const sandal = part(MeshBuilder.CreateBox(`${name}-foot`, { width: 0.09, height: 0.04, depth: 0.2 }, scene), hip, leather, 0, -0.1, 0.03);
    sandal.rotation.x = 0.08;
    part(MeshBuilder.CreateBox(`${name}-strap`, { width: 0.07, height: 0.03, depth: 0.04 }, scene), hip, leather, 0, -0.06, 0.1);
    return hip;
  });

  const tunic = part(
    MeshBuilder.CreateLathe(
      `${name}-robe`,
      {
        shape: [
          new Vector3(0.1, 0.05, 0),
          new Vector3(0.26, 0.1, 0),
          new Vector3(0.24, 0.4, 0),
          new Vector3(0.18, 0.85, 0),
          new Vector3(0.2, 1.15, 0),
          new Vector3(0.26, 1.4, 0),
          new Vector3(0.12, 1.52, 0),
        ],
        tessellation: 18,
        sideOrientation: Mesh.DOUBLESIDE,
      },
      scene,
    ),
    body,
    robe,
  );
  tunic.receiveShadows = true;
  part(MeshBuilder.CreateTorus(`${name}-sash`, { diameter: 0.4, thickness: 0.04, tessellation: 16 }, scene), body, trim, 0, 1.0, 0);
  for (const side of [-1, 1]) {
    part(MeshBuilder.CreateBox(`${name}-vest`, { width: 0.15, height: 0.42, depth: 0.025 }, scene), body, vestMat, side * 0.07, 1.16, 0.23);
  }
  part(MeshBuilder.CreateCylinder(`${name}-neck`, { height: 0.14, diameterTop: 0.1, diameterBottom: 0.13, tessellation: 12 }, scene), body, skin, 0, 1.52, 0.02);

  const shoulders = [-1, 1].map((side) => {
    const sh = new TransformNode(`${name}-shoulder`, scene);
    sh.parent = body;
    sh.position.set(side * 0.22, 1.36, 0);
    sh.rotation.z = side * 0.28;
    sh.rotation.x = 0.08;
    part(MeshBuilder.CreateSphere(`${name}-shoulder-cap`, { diameter: 0.13, segments: 10 }, scene), sh, robe, 0, 0.02, 0);
    part(MeshBuilder.CreateCapsule(`${name}-arm`, { radius: 0.05, height: 0.3, tessellation: 10 }, scene), sh, robe, 0, -0.14, 0);
    const elbow = new TransformNode(`${name}-elbow`, scene);
    elbow.parent = sh;
    elbow.position.y = -0.26;
    elbow.rotation.x = 0.12;
    part(MeshBuilder.CreateCapsule(`${name}-forearm`, { radius: 0.042, height: 0.26, tessellation: 10 }, scene), elbow, robe, 0, -0.12, 0);
    part(MeshBuilder.CreateTorus(`${name}-cuff`, { diameter: 0.1, thickness: 0.018, tessellation: 10 }, scene), elbow, trim, 0, -0.22, 0);
    const wrist = new TransformNode(`${name}-wrist`, scene);
    wrist.parent = elbow;
    wrist.position.set(0, -0.28, 0);
    const palm = part(MeshBuilder.CreateSphere(`${name}-palm`, { diameter: 0.08, segments: 8 }, scene), wrist, skin, 0, -0.015, 0.01);
    palm.scaling.set(1.15, 0.7, 0.55);
    for (let i = 0; i < 4; i++) {
      const finger = part(
        MeshBuilder.CreateCapsule(`${name}-finger`, { radius: 0.012, height: 0.075, tessellation: 6 }, scene),
        wrist,
        skin,
        (i - 1.5) * 0.02,
        -0.085,
        0.012,
      );
      finger.rotation.z = (i - 1.5) * -0.06;
    }
    const thumb = part(MeshBuilder.CreateCapsule(`${name}-thumb`, { radius: 0.013, height: 0.055, tessellation: 6 }, scene), wrist, skin, side * 0.05, -0.03, 0.02);
    thumb.rotation.z = side * -1.05;
    return sh;
  });

  const head = part(MeshBuilder.CreateSphere(`${name}-head`, { diameter: 0.34, segments: 18 }, scene), body, skin, 0, 1.74, 0.02);
  head.scaling.set(0.98, 1.06, 0.86);
  for (const side of [-1, 1]) {
    const ear = part(MeshBuilder.CreateSphere(`${name}-ear`, { diameter: 0.06, segments: 8 }, scene), body, skin, side * 0.155, 1.72, 0.02);
    ear.scaling.set(0.38, 0.95, 0.55);
    const white = part(MeshBuilder.CreateSphere(`${name}-eye`, { diameter: 0.05, segments: 10 }, scene), body, eyeWhite, side * 0.052, 1.765, 0.155);
    white.scaling.set(1.35, 0.85, 0.28);
    part(MeshBuilder.CreateSphere(`${name}-iris`, { diameter: 0.026, segments: 8 }, scene), body, iris, side * 0.052, 1.763, 0.168);
    part(MeshBuilder.CreateSphere(`${name}-pupil`, { diameter: 0.012, segments: 6 }, scene), body, pupil, side * 0.052, 1.763, 0.174);
    part(MeshBuilder.CreateSphere(`${name}-catch`, { diameter: 0.006, segments: 4 }, scene), body, eyeWhite, side * 0.06, 1.77, 0.176);
    const lid = part(MeshBuilder.CreateBox(`${name}-brow`, { width: 0.07, height: 0.014, depth: 0.02 }, scene), body, brow, side * 0.055, 1.8, 0.155);
    lid.rotation.z = side * -0.18;
    lid.rotation.x = -0.3;
  }
  const nose = part(
    MeshBuilder.CreateCylinder(`${name}-nose`, { height: 0.07, diameterTop: 0.012, diameterBottom: 0.04, tessellation: 8 }, scene),
    body,
    skin,
    0,
    1.72,
    0.16,
  );
  nose.rotation.x = Math.PI / 2;
  const mouth = part(MeshBuilder.CreateBox(`${name}-mouth`, { width: 0.05, height: 0.007, depth: 0.012 }, scene), body, lip, 0, 1.66, 0.162);
  mouth.rotation.x = -0.2;

  const wear = look.headwear ?? "wrap";
  if (wear === "turban") {
    part(MeshBuilder.CreateTorus(`${name}-turban`, { diameter: 0.32, thickness: 0.08, tessellation: 14 }, scene), body, headMat, 0, 1.88, 0);
    part(MeshBuilder.CreateSphere(`${name}-turban-top`, { diameter: 0.28, segments: 10, slice: 0.55 }, scene), body, headMat, 0, 1.94, 0);
    part(MeshBuilder.CreateTorus(`${name}-turban-band`, { diameter: 0.34, thickness: 0.03, tessellation: 12 }, scene), body, trim, 0, 1.82, 0);
  } else if (wear === "hood") {
    const hood = part(MeshBuilder.CreateSphere(`${name}-cover`, { diameter: 0.42, segments: 14, slice: 0.62 }, scene), body, headMat, 0, 1.8, -0.02);
    hood.rotation.x = 0.25;
    part(MeshBuilder.CreateBox(`${name}-drape`, { width: 0.3, height: 0.36, depth: 0.06 }, scene), body, headMat, 0, 1.58, -0.16);
  } else {
    const cap = part(MeshBuilder.CreateSphere(`${name}-cover`, { diameter: 0.36, segments: 14, slice: 0.55 }, scene), body, headMat, 0, 1.8, 0.01);
    cap.rotation.x = 0.05;
    part(MeshBuilder.CreateTorus(`${name}-band`, { diameter: 0.32, thickness: 0.018, tessellation: 14 }, scene), body, trim, 0, 1.78, 0.01);
  }
  if (look.beard) {
    const hair = pal.mat(`${name}-beard`, look.beard);
    const chin = part(MeshBuilder.CreateSphere(`${name}-beard`, { diameter: 0.14, segments: 10 }, scene), body, hair, 0, 1.6, 0.1);
    chin.scaling.set(1.2, 0.75, 0.65);
    for (const side of [-1, 1]) {
      const jaw = part(MeshBuilder.CreateSphere(`${name}-jaw`, { diameter: 0.09, segments: 8 }, scene), body, hair, side * 0.08, 1.64, 0.09);
      jaw.scaling.set(0.7, 1.15, 0.65);
    }
    const mustache = part(MeshBuilder.CreateSphere(`${name}-mustache`, { diameter: 0.07, segments: 8 }, scene), body, hair, 0, 1.67, 0.155);
    mustache.scaling.set(1.5, 0.35, 0.45);
  }
  if (look.staff) {
    const wood = pal.mat("staff-wood", [0.4, 0.28, 0.17], "wood");
    part(MeshBuilder.CreateCylinder(`${name}-staff`, { height: 1.55, diameter: 0.032, tessellation: 10 }, scene), shoulders[1], wood, 0.04, -0.7, 0.04);
    const crook = part(MeshBuilder.CreateTorus(`${name}-crook`, { diameter: 0.16, thickness: 0.028, tessellation: 16 }, scene), shoulders[1], wood, 0.04, 0.05, 0.04);
    crook.rotation.x = Math.PI / 2;
  }
  if (look.lantern) {
    const iron = pal.mat("iron", [0.25, 0.24, 0.23]);
    for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
      part(MeshBuilder.CreateBox(`${name}-lantern-bar`, { width: 0.015, height: 0.16, depth: 0.015 }, scene), shoulders[0], iron, lx * 0.05, -0.55, lz * 0.05);
    }
    part(MeshBuilder.CreateBox(`${name}-lantern-cap`, { width: 0.12, height: 0.015, depth: 0.12 }, scene), shoulders[0], iron, 0, -0.46, 0);
    part(MeshBuilder.CreateSphere(`${name}-lantern-flame`, { diameter: 0.07, segments: 6 }, scene), shoulders[0], pal.glow("watch-flame", [1, 0.42, 0.15]), 0, -0.54, 0);
  }
  if (look.satchel) {
    const bag = part(MeshBuilder.CreateBox(`${name}-satchel`, { width: 0.16, height: 0.2, depth: 0.08 }, scene), body, leather, -0.2, 1.05, -0.08);
    bag.rotation.z = 0.15;
    part(MeshBuilder.CreateBox(`${name}-strap-bag`, { width: 0.03, height: 0.4, depth: 0.02 }, scene), body, leather, -0.16, 1.28, -0.02);
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
  const horseEye = pal.mat("horse-eye", [0.08, 0.06, 0.05]);
  for (const side of [-1, 1]) {
    part(MeshBuilder.CreateSphere("horse-eye", { diameter: 0.06, segments: 6 }, scene), headPivot, horseEye, side * 0.12, 0.06, 0.42);
    part(MeshBuilder.CreateCylinder("horse-ear", { height: 0.16, diameterTop: 0.02, diameterBottom: 0.07, tessellation: 6 }, scene), headPivot, coat, side * 0.08, 0.2, -0.02);
  }
  part(MeshBuilder.CreateTorus("horse-bridle", { diameter: 0.28, thickness: 0.025, tessellation: 10 }, scene), headPivot, hoof, 0, -0.02, 0.42);

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
  const beastEye = pal.mat("beast-eye", [0.1, 0.08, 0.06]);
  for (const side of [-1, 1]) {
    part(
      MeshBuilder.CreateSphere(`${name}-eye`, { diameter: Math.max(0.03, spec.rad * 0.16), segments: 5 }, scene),
      neck,
      beastEye,
      side * spec.rad * 0.28,
      spec.neck * 0.9,
      spec.rad * 1.05,
    );
  }

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
