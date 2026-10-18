export interface VerseChoice {
  text: string;
  right: boolean;
}

export interface VerseQuiz {
  stem: string;
  choices: VerseChoice[];
}

/** The last words of the verse, plus two other endings. The right one moves with the verse number. */
export function verseQuiz(text: string, verse: number): VerseQuiz {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const tail = Math.min(7, Math.max(3, Math.floor(words.length / 3)));
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
  const other = verse % 2 === 0 ? "and the morning and the evening were the first day." : "and he called the darkness Day.";
  const choices: VerseChoice[] = [
    { text: right, right: true },
    { text: wrong, right: false },
    { text: other, right: false },
  ];
  const turn = verse % choices.length;
  return { stem, choices: [...choices.slice(turn), ...choices.slice(0, turn)] };
}
