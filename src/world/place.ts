import type { Scene } from "@babylonjs/core";
import type { Palette } from "../art/materials";
import { PLACE_EDEN, PLACE_SOUTH_ROAD } from "../data/era";
import { PLACE_JORDAN_HILLS } from "../data/identity";
import { buildEden } from "./eden";
import { buildSouthRoad } from "./south-road";
import { buildWorld, type World } from "./world";

/** Build the walkable district for a place id. */
export function loadPlace(scene: Scene, pal: Palette, id: string): World {
  if (id === PLACE_JORDAN_HILLS) return buildWorld(scene, pal);
  if (id === PLACE_SOUTH_ROAD) return buildSouthRoad(scene, pal);
  if (id === PLACE_EDEN) return buildEden(scene, pal);
  throw new Error(`No place named ${id}`);
}
