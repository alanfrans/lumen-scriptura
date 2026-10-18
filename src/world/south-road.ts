import { Mesh, MeshBuilder, Scene, StandardMaterial } from "@babylonjs/core";
import type { Palette } from "../art/materials";
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
  groundMat.diffuseColor.set(0.62, 0.5, 0.32);
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

  const tent = keep(MeshBuilder.CreateBox("tent", { width: 5, height: 2.4, depth: 4 }, scene));
  tent.position.set(0, 1.2, -10);
  tent.material = cloth;
  solid(0, -10, 5, 4);
  for (const x of [-2.6, 2.6]) {
    const pole = keep(MeshBuilder.CreateCylinder("pole", { height: 2.6, diameter: 0.12, tessellation: 6 }, scene));
    pole.position.set(x, 1.3, -8.1);
    pole.material = wood;
  }

  const well = keep(MeshBuilder.CreateCylinder("well", { height: 0.9, diameter: 1.8, tessellation: 12 }, scene));
  well.position.set(7, 0.45, -2);
  well.material = stone;
  solid(7, -2, 2, 2);
  const water = keep(MeshBuilder.CreateCylinder("well-water", { height: 0.08, diameter: 1.2, tessellation: 12 }, scene));
  water.position.set(7, 0.7, -2);
  water.material = pal.mat("well-water", [0.2, 0.35, 0.42]);

  const fire = keep(MeshBuilder.CreateCylinder("fire-ring", { height: 0.25, diameter: 1.1, tessellation: 8 }, scene));
  fire.position.set(0, 0.12, 0);
  fire.material = stone;
  const flame = keep(MeshBuilder.CreateSphere("flame", { diameter: 0.35, segments: 6 }, scene));
  flame.position.set(0, 0.45, 0);
  flame.material = pal.glow("flame", [1, 0.55, 0.18]);

  for (const [x, z] of [
    [-14, 8],
    [16, -6],
    [-12, -18],
    [18, 22],
  ] as const) {
    const trunk = keep(MeshBuilder.CreateCylinder("trunk", { height: 2.2, diameterTop: 0.2, diameterBottom: 0.35, tessellation: 6 }, scene));
    trunk.position.set(x, 1.1, z);
    trunk.material = wood;
    const crown = keep(MeshBuilder.CreateSphere("crown", { diameter: 2.4, segments: 6 }, scene));
    crown.position.set(x, 2.6, z);
    crown.material = leaf;
    solid(x, z, 0.7, 0.7);
  }

  const lectern = keep(MeshBuilder.CreateBox("lectern", { width: 1.1, height: 1.1, depth: 0.7 }, scene));
  lectern.position.set(LECTERN.x, 0.55, LECTERN.z);
  lectern.material = wood;
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
