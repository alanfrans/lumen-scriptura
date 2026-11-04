import { chapterKey } from "../data/chapters";
import { PLACE_EAST_OF_EDEN, PLACE_SOUTH_ROAD } from "../data/era";
import { BOOK_GENESIS, PLACE_JORDAN_HILLS } from "../data/identity";
import type { OwnedVerse, Purse } from "../data/play";
import {
  CARRY_LIMIT,
  holdsShut,
  blockReason,
  NEAR_REACH,
  OWNED_NOTICE_REACH,
  PROMPT_REACH,
  type HourWindow,
  type RuleId,
  type RuleQuery,
} from "./rules";

export interface ApproachSpot {
  verse: number;
  distance: number;
  /** Distance from this tablet to the nearest person who is not the Seeker. */
  witness: number;
  owned: boolean;
  collected: boolean;
  carried: boolean;
}

export interface ApproachInput {
  rules: readonly RuleId[];
  hour?: HourWindow;
  /** 0–1, noon at 0.5. */
  day: number;
  /** Codex only. A verse that is merely in the arms does not satisfy `order`. */
  has: (verse: number) => boolean;
  arms: number;
  /** True while a wrong line or a full armful has the tablets quiet. */
  quiet: boolean;
  spots: readonly ApproachSpot[];
}

export type TakeAction = "quiz" | "lift" | "arms-full" | "collect";

export interface ApproachFrame {
  /** Nearest shut refusal inside the prompt reach, or null when nothing nearby is shut. */
  prompt: string | null;
  /** An owned verse the Seeker is standing on. The owner is the only way to take it. */
  owned: number | null;
  /** What to do with the tablets that agreed this frame, in placement order. */
  takes: { verse: number; action: TakeAction }[];
}

export type WordsAnswer =
  | { action: "wrong" }
  | { action: "shut"; reason: string }
  | { action: "arms-full" }
  | { action: "lift" }
  | { action: "collect" };

function queryFor(input: ApproachInput, spot: ApproachSpot): RuleQuery {
  return {
    verse: spot.verse,
    distance: spot.distance,
    has: input.has,
    day: input.day,
    witness: spot.witness,
    hour: input.hour,
  };
}

/**
 * One frame of walking among a chapter's tablets.
 *
 * The order is the one the chapter rules require:
 * 1. An owned verse never opens by proximity, and it does not show a shut prompt.
 * 2. `order`, `hour`, or `witness` keeps the column shut. The nearest refusal inside 8 metres is the prompt.
 * 3. `near` must pass. Its refusal is not a prompt; the column simply waits until the Seeker is close enough.
 * 4. `words` opens the line. `carry` lifts it, up to three. Otherwise it is collected on the spot.
 * A quiz, a lift that fills the arms, or a full armful stops the rest of the frame.
 * Further free tablets in the same frame are still collected.
 */
export function approachFrame(input: ApproachInput): ApproachFrame {
  let prompt: string | null = null;
  let promptDist = PROMPT_REACH;
  let owned: number | null = null;
  let arms = input.arms;
  let quiet = input.quiet;
  const takes: ApproachFrame["takes"] = [];

  for (const spot of input.spots) {
    if (spot.collected || spot.carried) continue;
    if (spot.owned) {
      if (owned == null && spot.distance < OWNED_NOTICE_REACH) owned = spot.verse;
      continue;
    }
    const query = queryFor(input, spot);
    const hold = holdsShut(input.rules, query);
    if (hold) {
      if (spot.distance < promptDist) {
        prompt = hold;
        promptDist = spot.distance;
      }
      continue;
    }
    // `near` fails closed, with no prompt. `words` and `carry` agree inside blockReason.
    if (blockReason(input.rules, query)) continue;
    if (spot.distance > NEAR_REACH) continue;
    if (quiet) continue;
    if (input.rules.includes("words")) {
      takes.push({ verse: spot.verse, action: "quiz" });
      break;
    }
    if (input.rules.includes("carry")) {
      if (arms >= CARRY_LIMIT) {
        takes.push({ verse: spot.verse, action: "arms-full" });
        quiet = true;
        break;
      }
      takes.push({ verse: spot.verse, action: "lift" });
      arms += 1;
      continue;
    }
    takes.push({ verse: spot.verse, action: "collect" });
  }

  return { prompt, owned, takes };
}

/**
 * The line has been answered. Shut rules are read again, so a window that closed
 * while the dialog was open refuses a correct line. `carry` then lifts the verse
 * instead of collecting it. The lectern does not come back through here.
 */
export function answerWords(rules: readonly RuleId[], query: RuleQuery, correct: boolean, arms: number): WordsAnswer {
  if (!correct) return { action: "wrong" };
  const reason = holdsShut(rules, query);
  if (reason) return { action: "shut", reason };
  if (rules.includes("carry")) {
    if (arms >= CARRY_LIMIT) return { action: "arms-full" };
    return { action: "lift" };
  }
  return { action: "collect" };
}

export function canPay(owned: OwnedVerse, purse: Purse): boolean {
  return owned.price != null && purse.coin >= owned.price;
}

export function canTrade(owned: OwnedVerse, purse: Purse): boolean {
  return owned.tradeItem === "jar" && purse.hasJar;
}

/** Neither price nor trade is in hand, so the owner mentions the stipend. */
export function shortPurse(owned: OwnedVerse, purse: Purse): boolean {
  return !canPay(owned, purse) && !canTrade(owned, purse);
}

export function payFor(owned: OwnedVerse, purse: Purse): Purse | null {
  if (!canPay(owned, purse) || owned.price == null) return null;
  return { ...purse, coin: purse.coin - owned.price };
}

export function tradeFor(owned: OwnedVerse, purse: Purse): Purse | null {
  if (!canTrade(owned, purse)) return null;
  return { ...purse, hasJar: false };
}

/** A book is complete when every chapter key from 1 to its count is sealed. */
export function bookIsComplete(sealed: readonly string[], book: string, chapters: number): boolean {
  if (chapters < 1) return false;
  for (let n = 1; n <= chapters; n++) {
    if (!sealed.includes(chapterKey(book, n))) return false;
  }
  return true;
}

/**
 * How many of the given books are fully sealed.
 * Genesis is in every canon level the Codex draws, so the same count fills each book bar.
 */
export function completedBookCount(sealed: readonly string[], books: readonly { id: string; chapters: number }[]): number {
  return books.filter((book) => bookIsComplete(sealed, book.id, book.chapters)).length;
}

/** The valley's south road watches the Genesis 1 seal. Every other road is open. */
export function roadIsOpen(fromPlace: string, sealed: readonly string[]): boolean {
  if (fromPlace === PLACE_JORDAN_HILLS) return sealed.includes(chapterKey(BOOK_GENESIS, 1));
  return true;
}

/**
 * Arriving at the camp from the valley, with Genesis 1 sealed, begins Genesis 2.
 * Arriving east of Eden, with Genesis 2 sealed and still the active chapter, begins Genesis 3.
 * The caller still sets the clock to dawn. Dawn is outside the evening window.
 */
export function chapterAfterRoad(from: string, to: string, chapter: number, sealed: readonly string[]): number {
  if (from === PLACE_JORDAN_HILLS && to === PLACE_SOUTH_ROAD && chapter === 1 && sealed.includes(chapterKey(BOOK_GENESIS, 1))) {
    return 2;
  }
  if (to === PLACE_EAST_OF_EDEN && chapter === 2 && sealed.includes(chapterKey(BOOK_GENESIS, 2))) {
    return 3;
  }
  return chapter;
}
