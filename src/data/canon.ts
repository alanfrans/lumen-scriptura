export interface CanonLevel {
  label: string;
  name: string;
  books: number;
  chapters: number;
  verses: number;
}

export const CANON_LEVELS: readonly CanonLevel[] = [
  { label: "I", name: "Hebrew Bible", books: 24, chapters: 929, verses: 23145 },
  { label: "II", name: "Protestant Bible", books: 66, chapters: 1189, verses: 31103 },
  { label: "III", name: "Catholic Bible", books: 73, chapters: 1334, verses: 35489 },
];

export const TORAH_VERSES = 5852;
export const GENESIS_VERSES = 1533;
export const GENESIS_CHAPTERS = 50;
