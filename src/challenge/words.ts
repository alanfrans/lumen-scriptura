export interface VerseChoice {
  text: string;
  right: boolean;
}

export interface VerseQuiz {
  stem: string;
  choices: VerseChoice[];
}

function lineWords(text: string): string[] {
  return text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
}

function tailSize(count: number): number {
  return Math.min(7, Math.max(3, Math.floor(count / 3)));
}

function sameLine(a: string, b: string): boolean {
  return a.replace(/\s+/g, " ").trim().toLowerCase() === b.replace(/\s+/g, " ").trim().toLowerCase();
}

/** A wrong ending from another verse in this chapter, or a fixed line when every tail collides. */
function otherEnding(chapter: readonly string[], verse: number, right: string, wrong: string): string {
  const fallback = verse % 2 === 0 ? "and the morning and the evening were the first day." : "and he called the darkness Day.";
  const count = chapter.length;
  if (count < 2) return fallback;
  for (let step = 1; step < count; step++) {
    const index = (verse - 1 + step) % count;
    const words = lineWords(chapter[index] ?? "");
    if (!words.length) continue;
    const cut = Math.min(tailSize(words.length), words.length);
    const candidate = words.slice(words.length - cut).join(" ");
    if (!candidate || sameLine(candidate, right) || sameLine(candidate, wrong)) continue;
    return candidate;
  }
  return fallback;
}

/**
 * The last words of the verse, plus two other endings. The right one moves with the verse number.
 * The third ending is the tail of another verse in `chapter`.
 */
export function verseQuiz(text: string, verse: number, chapter: readonly string[]): VerseQuiz {
  const words = lineWords(text);
  const tail = Math.min(tailSize(words.length), words.length);
  const stem = words.slice(0, words.length - tail).join(" ");
  const right = words.slice(words.length - tail).join(" ");
  const swaps: ReadonlyArray<readonly [RegExp, string]> = [
    [/\bGod\b/, "man"],
    [/\bLORD\b/, "serpent"],
    [/\bearth\b/i, "sea"],
    [/\bday\b/i, "night"],
    [/\bman\b/i, "beast"],
  ];
  let wrong = right;
  for (const [pattern, to] of swaps) {
    if (pattern.test(right)) {
      wrong = right.replace(pattern, to);
      break;
    }
  }
  if (wrong === right) wrong = "and it was not so.";
  const choices: VerseChoice[] = [
    { text: right, right: true },
    { text: wrong, right: false },
    { text: otherEnding(chapter, verse, right, wrong), right: false },
  ];
  const turn = verse % choices.length;
  return { stem, choices: [...choices.slice(turn), ...choices.slice(0, turn)] };
}
