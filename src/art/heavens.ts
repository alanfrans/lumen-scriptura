import { Vector3 } from "@babylonjs/core";

/**
 * The playable valley stands in the Levant, about 32° north.
 * World axes: +X east, +Y up, +Z north.
 */
export let LATITUDE = (32 * Math.PI) / 180;

/** The sky follows the place you are standing in. */
export function setLatitude(degrees: number): void {
  LATITUDE = (degrees * Math.PI) / 180;
}

const DEG = Math.PI / 180;
const HOUR = Math.PI / 12;

/** Local sidereal time. Noon of this equinox day looks at right ascension 0. */
export function siderealTime(day: number): number {
  return (day - 0.5) * Math.PI * 2;
}

/**
 * Direction of a body in the sky. `hourAngle` is sidereal time minus right ascension.
 * The result is a unit vector.
 */
export function skyDirection(hourAngle: number, dec: number, out: Vector3): Vector3 {
  const cosD = Math.cos(dec);
  const east = -cosD * Math.sin(hourAngle);
  const up = Math.sin(LATITUDE) * Math.sin(dec) + Math.cos(LATITUDE) * cosD * Math.cos(hourAngle);
  const north = Math.cos(LATITUDE) * Math.sin(dec) - Math.sin(LATITUDE) * cosD * Math.cos(hourAngle);
  return out.set(east, up, north);
}

export interface StarSpec {
  ra: number;
  dec: number;
  /** Visual magnitude. Brighter stars are more negative. */
  mag: number;
  /** 0 white, 1 blue, 2 gold, 3 red. */
  tint: number;
}

/** [right ascension hours, declination degrees, magnitude, tint]. */
const NAMED: readonly (readonly [number, number, number, number])[] = [
  [2.53, 89.26, 2.0, 0],
  [11.062, 61.75, 1.8, 2],
  [11.031, 56.38, 2.3, 0],
  [11.897, 53.69, 2.4, 0],
  [12.257, 57.03, 3.3, 0],
  [12.9, 55.96, 1.8, 0],
  [13.399, 54.92, 2.2, 0],
  [13.792, 49.31, 1.9, 1],
  [0.675, 56.54, 2.2, 2],
  [0.153, 59.15, 2.3, 0],
  [0.945, 60.72, 2.2, 1],
  [1.43, 60.24, 2.7, 0],
  [1.906, 63.67, 3.4, 1],
  [5.919, 7.41, 0.4, 3],
  [5.419, 6.35, 1.6, 1],
  [5.533, -0.3, 2.2, 1],
  [5.603, -1.2, 1.7, 1],
  [5.679, -1.94, 1.8, 1],
  [5.796, -9.67, 2.1, 1],
  [5.242, -8.2, 0.15, 1],
  [6.753, -16.72, -1.46, 0],
  [7.655, 5.22, 0.34, 0],
  [6.399, -52.7, -0.74, 0],
  [5.278, 45.99, 0.08, 2],
  [4.599, 16.51, 0.85, 2],
  [7.755, 28.03, 1.14, 2],
  [7.576, 31.89, 1.58, 0],
  [3.792, 24.11, 2.9, 1],
  [3.772, 24.02, 3.6, 1],
  [3.749, 23.95, 3.7, 1],
  [3.804, 24.37, 3.7, 1],
  [3.788, 23.85, 3.9, 0],
  [3.811, 24.55, 4.3, 0],
  [18.616, 38.78, 0.03, 0],
  [20.69, 45.28, 1.25, 0],
  [19.846, 8.87, 0.76, 0],
  [14.261, 19.18, -0.05, 2],
  [10.139, 11.97, 1.35, 1],
  [13.42, -11.16, 0.97, 1],
  [16.49, -26.43, 1.06, 3],
  [22.961, -29.62, 1.16, 0],
  [5.438, 28.61, 1.65, 1],
  [0.14, 29.09, 2.06, 1],
  [2.119, 23.46, 2.0, 2],
];

function rng(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Galactic coordinates to equatorial. Used so the faint stars gather into the Milky Way. */
function galacticToEquatorial(lonDeg: number, latDeg: number): { ra: number; dec: number } {
  const l = lonDeg * DEG;
  const b = latDeg * DEG;
  const poleRa = 192.85948 * DEG;
  const poleDec = 27.12825 * DEG;
  const node = 122.93192 * DEG;
  const sinDec = Math.sin(poleDec) * Math.sin(b) + Math.cos(poleDec) * Math.cos(b) * Math.cos(node - l);
  const dec = Math.asin(Math.max(-1, Math.min(1, sinDec)));
  const y = Math.cos(b) * Math.sin(node - l);
  const x = Math.cos(poleDec) * Math.sin(b) - Math.sin(poleDec) * Math.cos(b) * Math.cos(node - l);
  return { ra: (Math.atan2(y, x) + poleRa + Math.PI * 2) % (Math.PI * 2), dec };
}

function namedStars(): StarSpec[] {
  return NAMED.map(([hours, dec, mag, tint]) => ({ ra: hours * HOUR, dec: dec * DEG, mag, tint }));
}

/** Dim field stars, denser along the Milky Way, plus a thin scatter everywhere else. */
function fieldStars(): StarSpec[] {
  const roll = rng(32);
  const stars: StarSpec[] = [];
  for (let i = 0; i < 220; i++) {
    const lon = roll() * 360;
    const band = roll() < 0.72;
    const lat = band ? (roll() + roll() + roll() - 1.5) * 14 : (roll() - 0.5) * 140;
    const { ra, dec } = galacticToEquatorial(lon, lat);
    if (dec < -60 * DEG) continue;
    stars.push({ ra, dec, mag: 3.1 + roll() * 1.8, tint: roll() < 0.15 ? 1 : roll() < 0.25 ? 2 : 0 });
  }
  return stars;
}

export function starCatalog(): StarSpec[] {
  return [...namedStars(), ...fieldStars()];
}

export function starDiameter(mag: number): number {
  return Math.max(0.6, 4.4 - mag * 0.72);
}

export interface PlanetSpec {
  name: string;
  ra: number;
  dec: number;
  diameter: number;
  color: [number, number, number];
}

/** Evening star west of the sunset, then Jupiter, Mars, and Saturn along the ecliptic. */
export function planets(): PlanetSpec[] {
  return [
    { name: "venus", ra: 2.2 * HOUR, dec: 10 * DEG, diameter: 7.2, color: [1, 0.96, 0.82] },
    { name: "jupiter", ra: 8.1 * HOUR, dec: 20 * DEG, diameter: 4.6, color: [0.94, 0.93, 0.86] },
    { name: "mars", ra: 14.4 * HOUR, dec: -8 * DEG, diameter: 3.4, color: [1, 0.45, 0.28] },
    { name: "saturn", ra: 21.2 * HOUR, dec: -16 * DEG, diameter: 3.1, color: [0.96, 0.88, 0.62] },
  ];
}
