export type Site =
  | "arch"
  | "stones"
  | "oasis"
  | "ring"
  | "cemetery"
  | "pasture"
  | "scriptorium"
  | "tent"
  | "rest"
  | "field"
  | "garden"
  | "rivers"
  | "naming"
  | "sleep";

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

const REST = "Sabbath Rest";
const FIELD = "Field Without Rain";
const GARDEN = "Garden of Eden";
const RIVERS = "The Four Rivers";
const NAMING = "Naming of the Beasts";
const SLEEP = "The Deep Sleep";

/** Genesis 2, in the order the verses open. Kept clear of trunks and stones. */
export const EDEN_PLACEMENTS: readonly Placement[] = [
  { verse: 1, x: 0, z: -52, site: "rest", area: REST, landmark: "on the threshold of the garden, where the finished work is kept" },
  { verse: 2, x: -10, z: -44, site: "rest", area: REST, landmark: "beside the resting stone of the seventh day" },
  { verse: 3, x: 10, z: -44, site: "rest", area: REST, landmark: "inside the circle that blesses the seventh day" },
  { verse: 4, x: 0, z: -34, site: "rest", area: REST, landmark: "beneath the lintel of the generations" },

  { verse: 5, x: -30, z: -28, site: "field", area: FIELD, landmark: "in the field where no plant has yet risen" },
  { verse: 6, x: -46, z: -16, site: "field", area: FIELD, landmark: "where the mist comes up from the earth" },
  { verse: 7, x: -34, z: -4, site: "field", area: FIELD, landmark: "at the mound of dust where the man was formed" },

  { verse: 8, x: -6, z: 2, site: "garden", area: GARDEN, landmark: "at the gate of the garden planted eastward in Eden" },
  { verse: 9, x: 4, z: 14, site: "garden", area: GARDEN, landmark: "in the midst of the garden, between the two trees" },

  { verse: 10, x: 12, z: 30, site: "rivers", area: RIVERS, landmark: "on the bank where the river parts into four heads" },
  { verse: 11, x: 36, z: 36, site: "rivers", area: RIVERS, landmark: "beside the Pison, on its way toward Havilah" },
  { verse: 12, x: 58, z: 40, site: "rivers", area: RIVERS, landmark: "among the gold, the bdellium, and the onyx of Havilah" },
  { verse: 13, x: 46, z: 14, site: "rivers", area: RIVERS, landmark: "along the Gihon, where that river bends away" },
  { verse: 14, x: 26, z: 46, site: "rivers", area: RIVERS, landmark: "where Hiddekel runs east and the Euphrates runs north" },

  { verse: 15, x: 14, z: 4, site: "garden", area: GARDEN, landmark: "in the worked ground where the man was set to keep the garden" },
  { verse: 16, x: -16, z: 16, site: "garden", area: GARDEN, landmark: "under a fruit tree of the garden" },
  { verse: 17, x: 14, z: 20, site: "garden", area: GARDEN, landmark: "at the foot of the tree of the knowledge of good and evil" },
  { verse: 18, x: -2, z: 32, site: "garden", area: GARDEN, landmark: "in the quiet north of the garden" },

  { verse: 19, x: -22, z: 30, site: "naming", area: NAMING, landmark: "where the beasts of the field and the fowl were brought" },
  { verse: 20, x: -38, z: 42, site: "naming", area: NAMING, landmark: "among the cattle, where no help meet was found" },

  { verse: 21, x: -8, z: 48, site: "sleep", area: SLEEP, landmark: "in the grove where a deep sleep falls" },
  { verse: 22, x: 8, z: 56, site: "sleep", area: SLEEP, landmark: "where the woman was brought to the man" },
  { verse: 23, x: -4, z: 64, site: "sleep", area: SLEEP, landmark: "where it was said, bone of my bones" },
  { verse: 24, x: 12, z: 70, site: "sleep", area: SLEEP, landmark: "on the path of leaving and cleaving" },
  { verse: 25, x: 0, z: 78, site: "sleep", area: SLEEP, landmark: "in the open beyond the grove, where they were not ashamed" },
];
