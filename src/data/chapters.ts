import { HOUR_EVENING, isRule, type HourWindow, type RuleId } from "../challenge/rules";
import { compileChapter } from "./compile";
import { PLACE_EAST_OF_EDEN, PLACE_EDEN, PLACE_NOD, PLACE_SOUTH_ROAD } from "./era";
import { BOOK_GENESIS, PLACE_JORDAN_HILLS } from "./identity";
import { chapterTexts } from "./reading";
import { GENESIS_CHAPTERS } from "./canon";
import { GENESIS_1_OWNED, GENESIS_1_SEAL, withPlacePlay, type GroundPoint, type OwnedVerse } from "./play";

export interface ChapterSpec {
  book: string;
  chapter: number;
  place: string;
  /**
   * Every rule must agree before the verse is collected. Shut rules (`order`,
   * `hour`, `witness`) refuse first. `near`, `words`, and `carry` are the take.
   */
  rules: readonly RuleId[];
  hour?: HourWindow;
  /** Verses bought or traded instead of walked up to. The placement's `owner` names the same person. */
  owned?: readonly OwnedVerse[];
  /** Where `carry` is filed. Filled from the place when the chapter does not name one. */
  lectern?: GroundPoint;
  /** Rig that can be asked to walk along. Filled from the place when `witness` is listed. */
  companion?: string;
  /** Replaces the default seal paragraph. */
  seal?: string;
}

/**
 * Genesis 1 is only `near`, in the valley. Verse 31 is owned.
 * Genesis 2 is walked in the garden, and the verses open in order.
 * Genesis 3 is walked east of that garden, and the verses open in the evening.
 * Genesis 4 is the land of Nod. Abel must stand at the tablet.
 * Each chapter after that adds one rule, at the south-road camp.
 * Order, then evening, then a witness, then the words, then carrying the verse to the lectern.
 * A chapter left out of this list is compiled from its text.
 */
export const CHAPTERS: readonly ChapterSpec[] = [
  {
    book: BOOK_GENESIS,
    chapter: 1,
    place: PLACE_JORDAN_HILLS,
    rules: ["near"],
    owned: GENESIS_1_OWNED,
    seal: GENESIS_1_SEAL,
  },
  { book: BOOK_GENESIS, chapter: 2, place: PLACE_EDEN, rules: ["near", "order"] },
  { book: BOOK_GENESIS, chapter: 3, place: PLACE_EAST_OF_EDEN, rules: ["near", "hour"], hour: HOUR_EVENING },
  { book: BOOK_GENESIS, chapter: 4, place: PLACE_NOD, rules: ["near", "witness"] },
  { book: BOOK_GENESIS, chapter: 5, place: PLACE_SOUTH_ROAD, rules: ["near", "words"] },
  { book: BOOK_GENESIS, chapter: 6, place: PLACE_SOUTH_ROAD, rules: ["near", "carry"] },
];

export function chapterKey(book: string, chapter: number): string {
  return `${book}.${chapter}`;
}

const compiled = new Map<string, ChapterSpec>();

function checkRules(spec: ChapterSpec): ChapterSpec {
  if (!spec.rules.includes("near")) {
    throw new Error(`Chapter ${spec.book} ${spec.chapter} has no near rule`);
  }
  for (const rule of spec.rules) {
    if (!isRule(rule)) throw new Error(`Unknown rule ${rule} on ${spec.book} ${spec.chapter}`);
  }
  if (spec.rules.includes("hour") && !spec.hour) {
    throw new Error(`Chapter ${spec.book} ${spec.chapter} lists hour without a window`);
  }
  if (spec.rules.includes("carry") && !spec.lectern) {
    throw new Error(`Chapter ${spec.book} ${spec.chapter} lists carry but ${spec.place} has no lectern`);
  }
  const seen = new Set<number>();
  for (const owned of spec.owned ?? []) {
    if (!Number.isInteger(owned.verse) || owned.verse < 1) {
      throw new Error(`Owned verse ${owned.verse} on ${spec.book} ${spec.chapter} is not a verse number`);
    }
    if (seen.has(owned.verse)) throw new Error(`Verse ${owned.verse} is owned twice on ${spec.book} ${spec.chapter}`);
    seen.add(owned.verse);
    if ((owned.price == null || owned.price < 0) && !owned.tradeItem) {
      throw new Error(`Owned verse ${owned.verse} on ${spec.book} ${spec.chapter} cannot be acquired`);
    }
  }
  return spec;
}

/**
 * A listed chapter is used as written. Every other Genesis chapter is compiled
 * from its verses and its number, and walked at the south-road camp.
 */
export function chapterSpec(book: string, chapter: number): ChapterSpec {
  const found = CHAPTERS.find((spec) => spec.book === book && spec.chapter === chapter);
  if (found) return checkRules(withPlacePlay(found));
  if (book !== BOOK_GENESIS || chapter < 1 || chapter > GENESIS_CHAPTERS) {
    throw new Error(`No chapter ${book} ${chapter}`);
  }
  const key = chapterKey(book, chapter);
  const cached = compiled.get(key);
  if (cached) return cached;
  const spec = checkRules(withPlacePlay(compileChapter(book, chapter, chapterTexts(chapter), PLACE_SOUTH_ROAD)));
  compiled.set(key, spec);
  return spec;
}

export function nextChapter(book: string, chapter: number): ChapterSpec | null {
  if (book !== BOOK_GENESIS || chapter >= GENESIS_CHAPTERS) return null;
  return chapterSpec(book, chapter + 1);
}
