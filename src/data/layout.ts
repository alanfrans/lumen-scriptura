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
  | "sleep"
  | "serpent"
  | "fig"
  | "hiding"
  | "curse"
  | "thorns"
  | "skins"
  | "gate"
  | "multiply"
  | "giants"
  | "wickedness"
  | "grief"
  | "grace"
  | "sons"
  | "violence"
  | "gopher"
  | "measure"
  | "ark"
  | "flood"
  | "covenant"
  | "beasts"
  | "stores"
  | "obedience";

export interface Placement {
  verse: number;
  x: number;
  z: number;
  y?: number;
  site: Site;
  area: string;
  /** Completes the sentence "Verse N rests ..." */
  landmark: string;
  /**
   * Someone else holds this tablet. The same verse must be an `OwnedVerse` on the chapter,
   * which is what names the price and the trade. Walking up to it does not collect it.
   */
  owner?: string;
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

const SERPENT = "The Serpent's Tree";
const FIG = "The Fig Tree";
const COOL = "Cool of the Day";
const CURSE = "The Curses";
const THORNS = "The Cursed Ground";
const SKINS = "Coats of Skins";
const GATE = "The East Gate";

/**
 * Genesis 3, east of the garden. +X is east, toward the gate.
 * Any verse may be taken once the evening window is open.
 * Kept clear of trunks, pillars, and the two who hide.
 */
export const EAST_OF_EDEN_PLACEMENTS: readonly Placement[] = [
  { verse: 1, x: -50, z: 8, site: "serpent", area: SERPENT, landmark: "where the serpent asks whether God has said" },
  { verse: 2, x: -58, z: -6, site: "serpent", area: SERPENT, landmark: "where the woman answers the serpent" },
  { verse: 3, x: -42, z: 16, site: "serpent", area: SERPENT, landmark: "at the foot of the tree that was not to be touched" },
  { verse: 4, x: -40, z: -8, site: "serpent", area: SERPENT, landmark: "where the serpent says, Ye shall not surely die" },
  { verse: 5, x: -30, z: 6, site: "serpent", area: SERPENT, landmark: "where the serpent promises that their eyes will be opened" },
  { verse: 6, x: -24, z: -8, site: "serpent", area: SERPENT, landmark: "where the fruit was taken, and eaten, and given" },

  { verse: 7, x: -10, z: 4, site: "fig", area: FIG, landmark: "where fig leaves were sewn into aprons" },

  { verse: 8, x: 2, z: 12, site: "hiding", area: COOL, landmark: "among the trees, where they hid in the cool of the day" },
  { verse: 9, x: 12, z: 2, site: "hiding", area: COOL, landmark: "where the voice calls, Where art thou" },
  { verse: 10, x: 6, z: -12, site: "hiding", area: COOL, landmark: "where the man says he was afraid, because he was naked" },
  { verse: 11, x: 20, z: 14, site: "hiding", area: COOL, landmark: "where it is asked whether they have eaten of the tree" },
  { verse: 12, x: 28, z: 2, site: "hiding", area: COOL, landmark: "where the man says the woman gave him of the tree" },
  { verse: 13, x: 22, z: -12, site: "hiding", area: COOL, landmark: "where the woman says the serpent beguiled her" },

  { verse: 14, x: 38, z: 8, site: "curse", area: CURSE, landmark: "in the dust, where the serpent is cursed to go upon its belly" },
  { verse: 15, x: 48, z: -4, site: "curse", area: CURSE, landmark: "where enmity is put between the serpent and the woman" },
  { verse: 16, x: 40, z: -16, site: "curse", area: CURSE, landmark: "where sorrow is spoken over the woman" },

  { verse: 17, x: 58, z: 12, site: "thorns", area: THORNS, landmark: "where the ground is cursed for Adam's sake" },
  { verse: 18, x: 66, z: -6, site: "thorns", area: THORNS, landmark: "among the thorns and the thistles" },
  { verse: 19, x: 74, z: 6, site: "thorns", area: THORNS, landmark: "at the mound of dust, where it is said, dust thou art" },

  { verse: 20, x: 64, z: 20, site: "skins", area: SKINS, landmark: "where the woman is named Eve, the mother of all living" },
  { verse: 21, x: 78, z: -12, site: "skins", area: SKINS, landmark: "where the coats of skins were laid" },

  { verse: 22, x: 84, z: 6, site: "gate", area: GATE, landmark: "within sight of the tree of life, which is kept from them" },
  { verse: 23, x: 112, z: 8, site: "gate", area: GATE, landmark: "outside the gate, where the man is sent to till the ground" },
  { verse: 24, x: 94, z: -4, site: "gate", area: GATE, landmark: "before the cherubim and the flaming sword" },
];

const MULTIPLY = "Where Men Multiplied";
const RENOWN = "Men of Renown";
const WICKED = "The Wickedness of Man";
const GRIEF = "The Grief of the LORD";
const HOUSE = "Noah's House";
const SONS = "Shem, Ham, and Japheth";
const VIOLENCE = "The Earth Filled with Violence";
const GOPHER = "Gopher Wood and Pitch";
const MEASURE = "The Measure of the Ark";
const ARK = "The Ark";
const FLOOD = "The Flood Foretold";
const COVENANT = "The Covenant";
const PAIRS = "Two of Every Sort";
const STORES = "The Food Gathered";
const DONE = "According to All He Commanded";

/**
 * Genesis 6, where the ark is built.
 * +X is east, toward the camp. +Z is north.
 * Any verse may be lifted. The lectern at the door is (8, 20), and these spots stay clear of it.
 */
export const ARK_PLACEMENTS: readonly Placement[] = [
  { verse: 1, x: -16, z: -54, site: "multiply", area: MULTIPLY, landmark: "where men began to multiply on the face of the earth" },
  { verse: 2, x: 14, z: -50, site: "multiply", area: MULTIPLY, landmark: "where the sons of God took wives of the daughters of men" },
  { verse: 3, x: -2, z: -38, site: "multiply", area: MULTIPLY, landmark: "at the stone that numbers the days of man at a hundred and twenty years" },
  { verse: 4, x: -30, z: -30, site: "giants", area: RENOWN, landmark: "among the standing stones, where the giants walked, men of renown" },

  { verse: 5, x: 24, z: -34, site: "wickedness", area: WICKED, landmark: "at the broken altar, where every imagination of the heart was only evil" },
  { verse: 6, x: 6, z: -22, site: "grief", area: GRIEF, landmark: "under the lone tree, where it grieved the LORD at his heart" },
  { verse: 7, x: -18, z: -16, site: "wickedness", area: WICKED, landmark: "in the scorched circle, where the sentence of destruction was spoken" },

  { verse: 8, x: -40, z: -8, site: "grace", area: HOUSE, landmark: "at the door of the house where Noah found grace" },
  { verse: 9, x: -58, z: 8, site: "grace", area: HOUSE, landmark: "on the path where Noah walked with God" },
  { verse: 10, x: -36, z: 18, site: "sons", area: SONS, landmark: "where Shem, Ham, and Japheth stand" },

  { verse: 11, x: 40, z: -12, site: "violence", area: VIOLENCE, landmark: "by the overturned cart, where the earth was filled with violence" },
  { verse: 12, x: 50, z: 8, site: "violence", area: VIOLENCE, landmark: "beside the road in, where all flesh had corrupted its way" },
  { verse: 13, x: 36, z: 14, site: "violence", area: VIOLENCE, landmark: "at the warning stone, where the end of all flesh was declared" },

  { verse: 14, x: -14, z: 6, site: "gopher", area: GOPHER, landmark: "beside the gopher logs and the pots of pitch" },
  { verse: 15, x: 30, z: 8, site: "measure", area: MEASURE, landmark: "at the stakes that mark the length, the breadth, and the height" },
  { verse: 16, x: 8, z: 44, site: "ark", area: ARK, landmark: "north of the ark, under the window finished above" },

  { verse: 17, x: 42, z: 32, site: "flood", area: FLOOD, landmark: "in the dry basin, where a flood of waters was foretold" },
  { verse: 18, x: -24, z: 28, site: "covenant", area: COVENANT, landmark: "west of the door, where the covenant was spoken over Noah's house" },

  { verse: 19, x: -20, z: 50, site: "beasts", area: PAIRS, landmark: "at the west pen, where two of every sort were brought" },
  { verse: 20, x: 28, z: 50, site: "beasts", area: PAIRS, landmark: "at the east pen, where fowl and cattle and creeping things came" },
  { verse: 21, x: -40, z: 34, site: "stores", area: STORES, landmark: "among the jars and the sacks of food gathered for the ark" },
  { verse: 22, x: 2, z: -4, site: "obedience", area: DONE, landmark: "in the worked yard, where Noah did according to all that God commanded" },
];
