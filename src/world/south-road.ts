import { Mesh, MeshBuilder, Scene, StandardMaterial } from "@babylonjs/core";
import type { Palette } from "../art/materials";
import { textureFactory } from "../art/textures";
import { buildPerson } from "../art/models";
import type { Box } from "./collision";
import type { World } from "./world";

/** Where carried verses are set down. */
export const LECTERN = { x: -8, z: -6 };

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
  const sand = textureFactory(scene)("sand");
  sand.uScale = sand.vScale = 16;
  groundMat.diffuseTexture = sand;
  groundMat.diffuseColor.set(0.78, 0.64, 0.42);
  groundMat.specularColor.set(0.02, 0.02, 0.02);
  ground.material = groundMat;

  const dirt = pal.mat("south-road-dirt", [0.45, 0.32, 0.18], "grain");
  const cloth = pal.mat("south-road-tent", [0.55, 0.42, 0.28], "cloth");
  const wood = pal.mat("wood", [0.45, 0.31, 0.19], "wood");
  const stone = pal.mat("stone", [0.68, 0.62, 0.53], "grain", 2);
  const leaf = pal.mat("cypress", [0.16, 0.3, 0.17], "grain", 2);

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
  water.material = pal.mat("well-water", [0.2, 0.35, 0.42]);
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
  };
}
