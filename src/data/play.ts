import type { RuleId } from "../challenge/rules";
import { PLACE_NOD, PLACE_SOUTH_ROAD, PLACE_THE_ARK } from "./era";

/** A point on the ground. Y comes from the place. */
export interface GroundPoint {
  x: number;
  z: number;
}

/**
 * A verse the Seeker cannot take by walking up to it.
 * Paying or trading still goes through the shut rules at the moment of the purchase.
 */
export interface OwnedVerse {
  verse: number;
  /** Matches `Placement.owner` and the rig the Seeker talks to. */
  owner: string;
  speaker: string;
  /** Toast when the Seeker stands at the tablet. */
  notice: string;
  /** What the owner says before the bargain. */
  pitch: string;
  /** Appended when the Seeker can afford neither the price nor the trade. */
  shortPurse?: string;
  /** What the owner says once the verse is in the Codex. */
  sold: string;
  price?: number;
  tradeItem?: "jar";
  tradeLabel?: string;
}

/** Coin and the one trade good the valley knows about. */
export interface Purse {
  coin: number;
  hasJar: boolean;
}

/** Where carried verses are set down. The camp mesh is built on this same point. */
export const SOUTH_ROAD_LECTERN: GroundPoint = { x: -8, z: -6 };

/** The lectern at the door of the ark. Genesis 6 files carried verses here. */
export const ARK_LECTERN: GroundPoint = { x: 8, z: 20 };

/**
 * Lectern for a place. A chapter that lists `carry` uses its own `lectern` if it
 * has one, and otherwise the point stored here. A place with no entry cannot host `carry`.
 */
export const PLACE_LECTERN: Readonly<Record<string, GroundPoint>> = {
  [PLACE_SOUTH_ROAD]: SOUTH_ROAD_LECTERN,
  [PLACE_THE_ARK]: ARK_LECTERN,
};

/**
 * Rig asked to walk with the Seeker when a chapter lists `witness` and names no companion.
 * The scene has to build a person with this root name. Any other person standing
 * at the tablet still counts; this is only who can be asked to follow.
 */
export const PLACE_COMPANION: Readonly<Record<string, string>> = {
  [PLACE_SOUTH_ROAD]: "joel",
  [PLACE_NOD]: "abel",
};

interface PlacePlay {
  place: string;
  rules: readonly RuleId[];
  lectern?: GroundPoint;
  companion?: string;
}

/** Fill lectern and companion from the place when the rule list needs them and the chapter did not. */
export function withPlacePlay<T extends PlacePlay>(spec: T): T {
  const lectern = spec.rules.includes("carry") ? (spec.lectern ?? PLACE_LECTERN[spec.place]) : spec.lectern;
  const companion = spec.rules.includes("witness") ? (spec.companion ?? PLACE_COMPANION[spec.place]) : spec.companion;
  if (lectern === spec.lectern && companion === spec.companion) return spec;
  return { ...spec, lectern, companion };
}

/** Verse 31 is not a proximity take. Coin or the oasis jar, then it enters the Codex. */
export const GENESIS_1_OWNED: readonly OwnedVerse[] = [
  {
    verse: 31,
    owner: "tobias",
    speaker: "Tobias the collector",
    notice: "This verse belongs to Tobias. Talk to him about it.",
    pitch:
      "Ah, a Seeker. I hold verse thirty-one. 'Very good,' it says, and so is my price: thirty coin. Or... I've long wanted a clay jar from the old wells at the oasis. Bring me one and we'll call it even.",
    shortPurse: " No coin? Your stipend comes every week. I'm a patient man.",
    sold: "It's yours now, and rightly. Carry it farther than my tent ever could.",
    price: 30,
    tradeItem: "jar",
    tradeLabel: "Trade the clay jar",
  },
];

/** Said when Genesis 1 seals. The south road is the way on; the next chapter is not in this valley. */
export const GENESIS_1_SEAL =
  "All thirty-one verses are in your Codex. A Hope Beacon rises over the Ruined Arch. The south road is open: press M when you are ready to leave the valley. This chapter counts toward Genesis, the Torah, and all three canon levels: the Hebrew Bible, the Protestant Bible, and the Catholic Bible. Press C to see your Codex.";
