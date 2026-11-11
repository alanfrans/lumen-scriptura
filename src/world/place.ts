import type { Scene } from "@babylonjs/core";
import type { Palette } from "../art/materials";
import { PLACE_EAST_OF_EDEN, PLACE_EDEN, PLACE_GENERATIONS, PLACE_NOD, PLACE_SOUTH_ROAD } from "../data/era";
import { PLACE_JORDAN_HILLS } from "../data/identity";
import { buildEden } from "./eden";
import { buildFall } from "./fall";
import { buildGenerations } from "./generations";
import { buildNod } from "./nod";
import { buildSouthRoad } from "./south-road";
import { buildWorld, type World } from "./world";

/** Build the walkable district for a place id. */
export function loadPlace(scene: Scene, pal: Palette, id: string): World {
  if (id === PLACE_JORDAN_HILLS) return buildWorld(scene, pal);
  if (id === PLACE_SOUTH_ROAD) return buildSouthRoad(scene, pal);
  if (id === PLACE_EDEN) return buildEden(scene, pal);
  if (id === PLACE_EAST_OF_EDEN) return buildFall(scene, pal);
  if (id === PLACE_NOD) return buildNod(scene, pal);
  if (id === PLACE_GENERATIONS) return buildGenerations(scene, pal);
  throw new Error(`No place named ${id}`);
}
