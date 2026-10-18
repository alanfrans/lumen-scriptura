import type { HourWindow, RuleId } from "../challenge/rules";

export interface CompiledChapter {
  book: string;
  chapter: number;
  place: string;
  rules: readonly RuleId[];
  hour?: HourWindow;
}

const MORNING: HourWindow = { from: 0.25, to: 0.55, label: "morning" };
const EVENING: HourWindow = { from: 0.65, to: 0.2, label: "evening" };
const NIGHT: HourWindow = { from: 0.75, to: 0.28, label: "night" };

/** Order is the leftover. The others are chosen when the chapter's words ask for them. */
const ROTATION: readonly RuleId[] = ["order", "hour", "witness", "words", "carry"];

function count(text: string, pattern: RegExp): number {
  return text.match(pattern)?.length ?? 0;
}

/**
 * Rules for a chapter that was not written by hand.
 * The verses suggest hour, words, carry, or a witness. The chapter number
 * picks which of those to keep, and fills any slot the text left empty,
 * so two neighboring chapters do not play the same way.
 */
export function compileChapter(
  book: string,
  chapter: number,
  verses: readonly string[],
  place: string,
): CompiledChapter {
  const text = verses.join("\n").toLowerCase();
  const signals = new Set<RuleId>();
  if (/\b(night|evening|even|darkness|midnight|morning|dawn)\b/.test(text)) signals.add("hour");
  if (/\b(said|say|speak|spake|called|told|answered)\b/.test(text)) signals.add("words");
  if (/\b(went|go|departed|journeyed|arose|come|brought|carried)\b/.test(text)) signals.add("carry");
  if (/\b(man|woman|wife|brother|son|daughter|servant|people|brethren)\b/.test(text)) signals.add("witness");

  const want = chapter % 3 === 0 ? 2 : 1;
  const preferred = [...signals].sort((a, b) => {
    const ia = (ROTATION.indexOf(a) + chapter) % ROTATION.length;
    const ib = (ROTATION.indexOf(b) + chapter) % ROTATION.length;
    return ia - ib;
  });
  const extras: RuleId[] = [];
  for (const rule of preferred) {
    if (extras.length >= want) break;
    extras.push(rule);
  }
  let step = 0;
  while (extras.length < want && step < ROTATION.length) {
    const rule = ROTATION[(chapter + step) % ROTATION.length];
    step += 1;
    if (!extras.includes(rule)) extras.push(rule);
  }

  const rules: RuleId[] = ["near", ...extras];
  let hour: HourWindow | undefined;
  if (rules.includes("hour")) {
    const morning = count(text, /\b(morning|dawn)\b/g);
    const night = count(text, /\b(night|darkness|midnight)\b/g);
    const evening = count(text, /\b(evening|even)\b/g);
    if (morning > evening && morning >= night) hour = MORNING;
    else if (night > evening) hour = NIGHT;
    else hour = EVENING;
  }
  return { book, chapter, place, rules, hour };
}
