export type Site =
  | "arch"
  | "stones"
  | "oasis"
  | "ring"
  | "cemetery"
  | "pasture"
  | "scriptorium"
  | "tent";

export interface Placement {
  verse: number;
  x: number;
  z: number;
  y?: number;
  site: Site;
  area: string;
  /** Completes the sentence "Verse N rests ..." */
  landmark: string;
  owner?: "tobias";
}

const ARCH = "Ruined Arch of the First Light";
const STONES = "Standing Stones of the Firmament";
const OASIS = "Oasis of the Gathered Waters";
const RING = "Ring of the Great Lights";
const CEMETERY = "Old Cemetery";
const PASTURE = "Eli's Pasture";
const SCRIPTORIUM = "Ruined Scriptorium";

export const PLACEMENTS: readonly Placement[] = [
  { verse: 1, x: 0, z: -35, site: "arch", area: ARCH, landmark: "on the old road, just south of the ruined arch" },
  { verse: 2, x: -12, z: -25, site: "arch", area: ARCH, landmark: "west of the arch, among the fallen stones" },
  { verse: 3, x: 0, z: -25, site: "arch", area: ARCH, landmark: "beneath the ruined arch itself" },
  { verse: 4, x: -20, z: -40, site: "arch", area: ARCH, landmark: "south-west of the arch, out on the open sand" },
  { verse: 5, x: 22, z: -45, site: "arch", area: ARCH, landmark: "south-east of the arch, out on the open sand" },

  { verse: 6, x: -60, z: -10, site: "stones", area: STONES, landmark: "beside the southern pair of standing stones" },
  { verse: 7, x: -72, z: 10, site: "stones", area: STONES, landmark: "beside the western pair of standing stones" },
  { verse: 8, x: -50, z: 22, site: "stones", area: STONES, landmark: "beside the northern pair of standing stones" },

  { verse: 9, x: -40, z: 55, site: "oasis", area: OASIS, landmark: "on the east shore of the oasis" },
  { verse: 10, x: -60, z: 85, site: "oasis", area: OASIS, landmark: "on the north shore of the oasis" },
  { verse: 11, x: -82, z: 62, site: "oasis", area: OASIS, landmark: "on the west shore of the oasis" },
  { verse: 12, x: -45, z: 75, site: "oasis", area: OASIS, landmark: "on the north-east shore of the oasis, among the palms" },
  { verse: 13, x: -75, z: 40, site: "oasis", area: OASIS, landmark: "on the south-west shore of the oasis" },

  { verse: 14, x: 76, z: 0, site: "ring", area: RING, landmark: "inside the ring of pillars, on its east side" },
  { verse: 15, x: 73, z: 5.2, site: "ring", area: RING, landmark: "inside the ring of pillars, on its north-east side" },
  { verse: 16, x: 67, z: 5.2, site: "ring", area: RING, landmark: "inside the ring of pillars, on its north-west side" },
  { verse: 17, x: 64, z: 0, site: "ring", area: RING, landmark: "inside the ring of pillars, on its west side" },
  { verse: 18, x: 67, z: -5.2, site: "ring", area: RING, landmark: "inside the ring of pillars, on its south-west side" },
  { verse: 19, x: 73, z: -5.2, site: "ring", area: RING, landmark: "inside the ring of pillars, on its south-east side" },

  { verse: 20, x: 52, z: -62, site: "cemetery", area: CEMETERY, landmark: "in the north-west corner of the old cemetery" },
  { verse: 21, x: 56, z: -78, site: "cemetery", area: CEMETERY, landmark: "in the south-west corner of the old cemetery" },
  { verse: 22, x: 64, z: -66, site: "cemetery", area: CEMETERY, landmark: "in the middle of the old cemetery, between the graves" },
  { verse: 23, x: 71, z: -70, site: "cemetery", area: CEMETERY, landmark: "near the old cemetery's east wall" },

  { verse: 24, x: 25, z: 85, site: "pasture", area: PASTURE, landmark: "in the north-east corner of Eli's pasture" },
  { verse: 25, x: -5, z: 95, site: "pasture", area: PASTURE, landmark: "at the far north end of Eli's pasture" },

  { verse: 26, x: 55, z: 52, site: "scriptorium", area: SCRIPTORIUM, landmark: "inside the Ruined Scriptorium, just past the door on the left" },
  { verse: 27, x: 65, z: 54, site: "scriptorium", area: SCRIPTORIUM, landmark: "inside the Ruined Scriptorium, to the right of the door" },
  { verse: 28, x: 55, z: 62, y: 1.2, site: "scriptorium", area: SCRIPTORIUM, landmark: "inside the Ruined Scriptorium, on the old lectern" },
  { verse: 29, x: 65, z: 66, site: "scriptorium", area: SCRIPTORIUM, landmark: "inside the Ruined Scriptorium, along the east wall" },
  { verse: 30, x: 60, z: 69, site: "scriptorium", area: SCRIPTORIUM, landmark: "inside the Ruined Scriptorium, at the far end beneath the apse" },

  { verse: 31, x: 33, z: 29, y: 0.9, site: "tent", area: "Tobias's Tent", landmark: "on the table of Tobias the collector", owner: "tobias" },
];
