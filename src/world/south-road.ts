import { Color3, Light, Mesh, MeshBuilder, PointLight, Scene, StandardMaterial, Texture, Vector3 } from "@babylonjs/core";
import type { Palette } from "../art/materials";
import { createTexture } from "../art/textures";
import { buildPerson } from "../art/models";
import type { Box } from "./collision";
import type { World } from "./world";

/** Where carried verses are set down. */
export const LECTERN = { x: -8, z: -6 };

/** The east side of the camp, where the path to the garden of Eden leaves. */
export const EAST_PATH = { x: 26, z: 2.2 };

/** A small camp past the south edge of the valley map. Flat ground, one road north. */
export function buildSouthRoad(scene: Scene, pal: Palette): World {
  const colliders: Box[] = [];
  const scenery: Mesh[] = [];
  const heightAt = () => 0;
  const solid = (x: number, z: number, w: number, d: number) => {
    colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, solid: true });
  };
  const keep = (mesh: Mesh): Mesh => {
    scenery.push(mesh);
    return mesh;
  };

  const ground = MeshBuilder.CreateGround("ground", { width: 300, height: 300, subdivisions: 2 }, scene);
  const groundMat = new StandardMaterial("camp-ground", scene);
  const sand = createTexture(scene, "sand");
  sand.diffuse.uScale = sand.diffuse.vScale = 14;
  sand.bump.uScale = sand.bump.vScale = 14;
  sand.bump.level = 0.6;
  groundMat.diffuseTexture = sand.diffuse;
  groundMat.bumpTexture = sand.bump;
  groundMat.diffuseColor.set(0.92, 0.76, 0.52);
  groundMat.specularColor.set(0.07, 0.06, 0.05);
  groundMat.specularPower = 22;
  ground.material = groundMat;

  const dirt = pal.mat("south-road-dirt", [0.45, 0.32, 0.18], "grain");
  const cloth = pal.mat("south-road-tent", [0.55, 0.42, 0.28], "cloth");
  const wood = pal.mat("wood", [0.45, 0.31, 0.19], "wood");
  const stone = pal.mat("stone", [0.68, 0.62, 0.53], "rock", 2);
  const leaf = pal.mat("south-leaf", [0.2, 0.36, 0.18], "leaf", 2);

  const road = keep(MeshBuilder.CreateBox("road", { width: 4.5, height: 0.04, depth: 90 }, scene));
  road.position.set(0, 0.02, 20);
  road.material = dirt;

  const tent = keep(MeshBuilder.CreateBox("tent-floor", { width: 4.6, height: 0.06, depth: 3.6 }, scene));
  tent.position.set(0, 0.04, -10);
  tent.material = cloth;
  for (const side of [-1, 1]) {
    const roof = keep(MeshBuilder.CreateBox("tent-roof", { width: 2.7, height: 0.08, depth: 4.2 }, scene));
    roof.position.set(side * 1.15, 1.7, -10);
    roof.rotation.z = side * -0.55;
    roof.material = cloth;
  }
  solid(0, -10, 4.6, 3.6);
  for (const [x, z] of [[-2.2, -8.1], [2.2, -8.1], [-2.2, -11.9], [2.2, -11.9]] as const) {
    const pole = keep(MeshBuilder.CreateCylinder("pole", { height: 2.3, diameter: 0.1, tessellation: 6 }, scene));
    pole.position.set(x, 1.15, z);
    pole.material = wood;
  }
  const ridge = keep(MeshBuilder.CreateCylinder("ridge", { height: 4.2, diameter: 0.08, tessellation: 6 }, scene));
  ridge.rotation.x = Math.PI / 2;
  ridge.position.set(0, 2.35, -10);
  ridge.material = wood;

  const well = keep(MeshBuilder.CreateCylinder("well", { height: 0.9, diameter: 1.8, tessellation: 16 }, scene));
  well.position.set(7, 0.45, -2);
  well.material = stone;
  solid(7, -2, 2, 2);
  const lip = keep(MeshBuilder.CreateTorus("well-lip", { diameter: 1.85, thickness: 0.12, tessellation: 14 }, scene));
  lip.position.set(7, 0.92, -2);
  lip.material = stone;
  const water = keep(MeshBuilder.CreateCylinder("well-water", { height: 0.08, diameter: 1.2, tessellation: 16 }, scene));
  water.position.set(7, 0.7, -2);
  const wellMat = pal.mat("well-water", [0.22, 0.42, 0.5], "ripple", 2);
  water.material = wellMat;
  for (const x of [6.1, 7.9]) {
    const post = keep(MeshBuilder.CreateBox("well-post", { width: 0.12, height: 1.6, depth: 0.12 }, scene));
    post.position.set(x, 1.7, -2);
    post.material = wood;
  }
  const beam = keep(MeshBuilder.CreateBox("well-beam", { width: 2.1, height: 0.1, depth: 0.12 }, scene));
  beam.position.set(7, 2.45, -2);
  beam.material = wood;
  const bucket = keep(MeshBuilder.CreateCylinder("bucket", { height: 0.28, diameterTop: 0.28, diameterBottom: 0.22, tessellation: 8 }, scene));
  bucket.position.set(7, 1.5, -2);
  bucket.material = wood;

  const fire = keep(MeshBuilder.CreateCylinder("fire-ring", { height: 0.25, diameter: 1.1, tessellation: 8 }, scene));
  fire.position.set(0, 0.12, 0);
  fire.material = stone;
  for (const rot of [0.2, 1.3, 2.4]) {
    const log = keep(MeshBuilder.CreateCylinder("log", { height: 0.9, diameter: 0.12, tessellation: 6 }, scene));
    log.position.set(0, 0.1, 0);
    log.rotation.z = Math.PI / 2;
    log.rotation.y = rot;
    log.material = wood;
  }
  const flame = keep(MeshBuilder.CreateSphere("flame", { diameter: 0.32, segments: 8 }, scene));
  flame.position.set(0, 0.42, 0);
  flame.material = pal.glow("flame", [1, 0.55, 0.18]);
  const ember = keep(MeshBuilder.CreateSphere("ember", { diameter: 0.16, segments: 6 }, scene));
  ember.position.set(0.08, 0.28, 0.05);
  ember.material = pal.glow("ember", [1, 0.28, 0.08]);

  for (const [x, z] of [
    [-14, 8],
    [16, -6],
    [-12, -18],
    [18, 22],
  ] as const) {
    const trunk = keep(MeshBuilder.CreateCylinder("trunk", { height: 2.4, diameterTop: 0.16, diameterBottom: 0.32, tessellation: 7 }, scene));
    trunk.position.set(x, 1.2, z);
    trunk.material = wood;
    for (const [dx, dy, dz, d] of [
      [0, 2.7, 0, 1.7],
      [0.45, 2.35, 0.2, 1.15],
      [-0.35, 2.4, -0.25, 1.05],
    ] as const) {
      const crown = keep(MeshBuilder.CreateSphere("crown", { diameter: d, segments: 7 }, scene));
      crown.position.set(x + dx, dy, z + dz);
      crown.material = leaf;
    }
    solid(x, z, 0.7, 0.7);
  }

  const track = keep(MeshBuilder.CreateBox("east-track", { width: 20, height: 0.04, depth: 2.4 }, scene));
  track.position.set(22, 0.025, 2.2);
  track.material = dirt;
  const signPost = keep(MeshBuilder.CreateBox("sign-post", { width: 0.12, height: 1.7, depth: 0.12 }, scene));
  signPost.position.set(26, 0.85, 4.3);
  signPost.material = wood;
  const board = keep(MeshBuilder.CreateBox("sign-board", { width: 1.15, height: 0.42, depth: 0.08 }, scene));
  board.position.set(26, 1.55, 4.3);
  board.material = wood;
  solid(26, 4.3, 0.5, 0.5);
  for (const x of [16, 20, 24, 28]) {
    const step = keep(MeshBuilder.CreateBox("step", { width: 0.7, height: 0.06, depth: 0.45 }, scene));
    step.position.set(x, 0.04, 2.2);
    step.material = stone;
  }

  const lectern = keep(MeshBuilder.CreateBox("lectern", { width: 0.7, height: 0.9, depth: 0.55 }, scene));
  lectern.position.set(LECTERN.x, 0.45, LECTERN.z);
  lectern.material = wood;
  const desk = keep(MeshBuilder.CreateBox("lectern-top", { width: 0.9, height: 0.08, depth: 0.7 }, scene));
  desk.position.set(LECTERN.x, 0.98, LECTERN.z);
  desk.rotation.x = -0.35;
  desk.material = wood;
  const page = keep(MeshBuilder.CreateBox("lectern-page", { width: 0.55, height: 0.02, depth: 0.4 }, scene));
  page.position.set(LECTERN.x, 1.04, LECTERN.z);
  page.rotation.x = -0.35;
  page.material = pal.mat("page", [0.9, 0.86, 0.74], "cloth");
  solid(LECTERN.x, LECTERN.z, 1.1, 0.7);

  const fireLight = new PointLight("south-fire", new Vector3(0, 0.85, 0), scene);
  fireLight.diffuse = new Color3(1, 0.58, 0.24);
  fireLight.specular = new Color3(1, 0.45, 0.18);
  fireLight.intensity = 0.3;
  fireLight.range = 8;
  fireLight.falloffType = Light.FALLOFF_STANDARD;
  const wellBump = wellMat.bumpTexture;

  const joel = buildPerson(scene, pal, "joel", {
    robe: [0.4, 0.32, 0.22],
    trim: [0.62, 0.5, 0.28],
    head: [0.55, 0.4, 0.28],
    headwear: "wrap",
    beard: [0.25, 0.18, 0.12],
    staff: true,
  });
  joel.root.position.set(-3, 0, 2);
  joel.root.rotation.y = 0.4;

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
    folk: [joel],
    wanderers: [],
    scenery,
    heightAt,
    lamps: [fireLight],
    tick(dt, time) {
      if (wellBump instanceof Texture) {
        wellBump.uOffset += dt * 0.03;
        wellBump.vOffset += dt * 0.018;
      }
      fireLight.intensity = 0.3 * (1 + Math.sin(time * 12) * 0.08 + Math.sin(time * 23) * 0.05);
    },
  };
}
