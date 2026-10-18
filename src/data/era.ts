import { PLACE_JORDAN_HILLS } from "./identity";

/** The camp where the brick road leaves the valley map. */
export const PLACE_SOUTH_ROAD = "south-road";

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
