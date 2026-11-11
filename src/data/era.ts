import { PLACE_JORDAN_HILLS } from "./identity";

/** The camp where the brick road leaves the valley map. */
export const PLACE_SOUTH_ROAD = "south-road";

/** The garden planted eastward in Eden. Reached on foot from the south-road camp. */
export const PLACE_EDEN = "eden";

/**
 * The ground east of that garden: the serpent, the cool of the day, and the gate.
 * Reached on foot once Genesis 2 is in the Codex.
 */
export const PLACE_EAST_OF_EDEN = "east-of-eden";

/**
 * The field of the brothers, and the land where Cain dwelt, east of Eden.
 * Reached on foot once Genesis 3 is in the Codex.
 */
export const PLACE_NOD = "nod";

/**
 * The book of the generations of Adam, written out as a stone avenue.
 * Reached on foot from the south-road camp once Genesis 4 is in the Codex.
 */
export const PLACE_GENERATIONS = "generations";

/**
 * The ground where Noah builds the ark while the earth is filled with violence.
 * Reached from the north-west side of the camp once Genesis 5 is sealed.
 */
export const PLACE_THE_ARK = "the-ark";

export interface EraPlace {
  id: string;
  name: string;
  /** Pin on the era map. Origin is the top-left of the picture. */
  mapX: number;
  mapY: number;
  /** Degrees north. The sky uses this. */
  latitude: number;
  /** Where you stand the first time you arrive. */
  spawn: { x: number; z: number };
}

export interface EraRoad {
  from: string;
  to: string;
  days: number;
  name: string;
  telling: string;
  /** Said when walking the road back toward its start. */
  homeward: string;
}

/** The world of the patriarchs, drawn as the valley and the road that leaves it. */
export const PATRIARCHS = {
  map: "/maps/genesis-1.jpg",
  places: [
    {
      id: PLACE_JORDAN_HILLS,
      name: "The valley",
      mapX: 0.47,
      mapY: 0.78,
      latitude: 32,
      spawn: { x: 0, z: -64 },
    },
    {
      id: PLACE_SOUTH_ROAD,
      name: "South road camp",
      mapX: 0.2,
      mapY: 0.9,
      latitude: 32,
      spawn: { x: 0, z: 36 },
    },
    {
      id: PLACE_EDEN,
      name: "The garden of Eden",
      // Stored with the place. The travel map does not draw the garden; the path from the camp is the way in.
      mapX: 0.86,
      mapY: 0.62,
      latitude: 32,
      spawn: { x: 0, z: -66 },
    },
    {
      id: PLACE_EAST_OF_EDEN,
      name: "East of Eden",
      // Stored with the place. The travel map does not draw this ground; the path is the way in.
      mapX: 0.93,
      mapY: 0.56,
      latitude: 32,
      spawn: { x: -74, z: 0 },
    },
    {
      id: PLACE_NOD,
      name: "Land of Nod",
      // Stored with the place. The travel map does not draw this ground; the path is the way in.
      mapX: 0.97,
      mapY: 0.48,
      latitude: 32,
      spawn: { x: -74, z: 0 },
    },
    {
      id: PLACE_GENERATIONS,
      name: "The generations",
      // Stored with the place. The travel map does not draw the avenue; the west path from the camp is the way in.
      mapX: 0.08,
      mapY: 0.84,
      latitude: 32,
      spawn: { x: -74, z: 0 },
    },
    {
      id: PLACE_THE_ARK,
      name: "The ark",
      // Stored with the place. The travel map does not draw this ground; the path is the way in.
      mapX: 0.14,
      mapY: 0.72,
      latitude: 32,
      spawn: { x: 72, z: 0 },
    },
  ] as const satisfies readonly EraPlace[],
  roads: [
    {
      from: PLACE_JORDAN_HILLS,
      to: PLACE_SOUTH_ROAD,
      days: 2,
      name: "The south road",
      telling: "The brick road runs off the map. Two days south is a camp for travelers.",
      homeward: "Two days north returns you to the valley.",
    },
  ] satisfies readonly EraRoad[],
};

export interface RoadHop {
  road: EraRoad;
  destination: EraPlace;
  homeward: boolean;
}

export function placeById(id: string): EraPlace {
  const found = PATRIARCHS.places.find((place) => place.id === id);
  if (!found) throw new Error(`No place named ${id}`);
  return found;
}

/** Roads that leave a place, in either direction. */
export function roadsFrom(id: string): RoadHop[] {
  const hops: RoadHop[] = [];
  for (const road of PATRIARCHS.roads) {
    if (road.from === id) hops.push({ road, destination: placeById(road.to), homeward: false });
    else if (road.to === id) hops.push({ road, destination: placeById(road.from), homeward: true });
  }
  return hops;
}
