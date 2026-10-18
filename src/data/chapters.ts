import { isRule, type HourWindow, type RuleId } from "../challenge/rules";
import { compileChapter } from "./compile";
import { PLACE_SOUTH_ROAD } from "./era";
import { BOOK_GENESIS, PLACE_JORDAN_HILLS } from "./identity";
import { chapterTexts } from "./reading";
import { GENESIS_CHAPTERS } from "./canon";

export interface ChapterSpec {
  book: string;
  chapter: number;
  place: string;
  /** Every rule must agree before the verse is taken. The first refusal is the hint. */
  rules: readonly RuleId[];
  hour?: HourWindow;
}

/** Evening through the night. Morning is the time these verses stay shut. */
const EVENING: HourWindow = { from: 0.65, to: 0.2, label: "evening" };

/**
 * Genesis 1 is only `near`. Each later chapter adds one rule, at the south-road camp.
 * Order, then evening, then a witness, then the words, then carrying the verse to the lectern.
 */
export const CHAPTERS: readonly ChapterSpec[] = [
  { book: BOOK_GENESIS, chapter: 1, place: PLACE_JORDAN_HILLS, rules: ["near"] },
  { book: BOOK_GENESIS, chapter: 2, place: PLACE_SOUTH_ROAD, rules: ["near", "order"] },
  { book: BOOK_GENESIS, chapter: 3, place: PLACE_SOUTH_ROAD, rules: ["near", "hour"], hour: EVENING },
  { book: BOOK_GENESIS, chapter: 4, place: PLACE_SOUTH_ROAD, rules: ["near", "witness"] },
  { book: BOOK_GENESIS, chapter: 5, place: PLACE_SOUTH_ROAD, rules: ["near", "words"] },
  { book: BOOK_GENESIS, chapter: 6, place: PLACE_SOUTH_ROAD, rules: ["near", "carry"] },
];

export function chapterKey(book: string, chapter: number): string {
  return `${book}.${chapter}`;
}

const compiled = new Map<string, ChapterSpec>();

function checkRules(spec: ChapterSpec): ChapterSpec {
  for (const rule of spec.rules) {
    if (!isRule(rule)) throw new Error(`Unknown rule ${rule} on ${spec.book} ${spec.chapter}`);
  }
  return spec;
}

/**
 * A listed chapter is used as written. Every other Genesis chapter is compiled
 * from its verses and its number, and walked at the south-road camp.
 */
export function chapterSpec(book: string, chapter: number): ChapterSpec {
  const found = CHAPTERS.find((spec) => spec.book === book && spec.chapter === chapter);
  if (found) return checkRules(found);
  if (book !== BOOK_GENESIS || chapter < 1 || chapter > GENESIS_CHAPTERS) {
    throw new Error(`No chapter ${book} ${chapter}`);
  }
  const key = chapterKey(book, chapter);
  const cached = compiled.get(key);
  if (cached) return cached;
  const spec = checkRules(compileChapter(book, chapter, chapterTexts(chapter), PLACE_SOUTH_ROAD));
  compiled.set(key, spec);
  return spec;
}

export function nextChapter(book: string, chapter: number): ChapterSpec | null {
  if (book !== BOOK_GENESIS || chapter >= GENESIS_CHAPTERS) return null;
  return chapterSpec(book, chapter + 1);
}
