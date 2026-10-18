/** Genesis, and the valley its first chapter is walked in. */
export const BOOK_GENESIS = "genesis";
export const PLACE_JORDAN_HILLS = "jordan-hills";
export const GENESIS_1_CHAPTER = 1;

/** A verse that stays unique across books: `genesis.1.3`. */
export function verseId(book: string, chapter: number, verse: number): string {
  return `${book}.${chapter}.${verse}`;
}

export function compareVerseIds(a: string, b: string): number {
  const pa = a.split(".");
  const pb = b.split(".");
  const book = (pa[0] ?? "").localeCompare(pb[0] ?? "");
  if (book !== 0) return book;
  const chapter = Number(pa[1]) - Number(pb[1]);
  if (chapter !== 0) return chapter;
  return Number(pa[2]) - Number(pb[2]);
}
