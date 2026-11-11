import type { Placement } from "./layout";
import { EAST_OF_EDEN_PLACEMENTS, EDEN_PLACEMENTS, GENERATIONS_PLACEMENTS, NOD_PLACEMENTS, PLACEMENTS } from "./layout";
import { GENESIS_1 } from "./genesis1";
import { GENESIS_2, GENESIS_3, GENESIS_4, GENESIS_5, GENESIS_6 } from "./genesis-later";
import { GENESIS_REST } from "./genesis-rest";

const TEXTS: readonly (readonly string[])[] = [
  GENESIS_1,
  GENESIS_2,
  GENESIS_3,
  GENESIS_4,
  GENESIS_5,
  GENESIS_6,
  ...GENESIS_REST,
];

export function chapterTexts(chapter: number): readonly string[] {
  const texts = TEXTS[chapter - 1];
  if (!texts) throw new Error(`No text for Genesis ${chapter}`);
  return texts;
}

/** Genesis 1 keeps its valley sites. Genesis 2 is the garden. Genesis 3 is east of it. Genesis 4 is the land of Nod. Genesis 5 is the book of the generations. Later chapters stand in a ring around the south-road camp. */
export function chapterPlacements(chapter: number): readonly Placement[] {
  if (chapter === 1) return PLACEMENTS;
  if (chapter === 2) {
    const count = chapterTexts(chapter).length;
    if (EDEN_PLACEMENTS.length !== count) {
      throw new Error(`Genesis 2 has ${count} verses and ${EDEN_PLACEMENTS.length} placements`);
    }
    return EDEN_PLACEMENTS;
  }
  if (chapter === 3) {
    const count = chapterTexts(chapter).length;
    if (EAST_OF_EDEN_PLACEMENTS.length !== count) {
      throw new Error(`Genesis 3 has ${count} verses and ${EAST_OF_EDEN_PLACEMENTS.length} placements`);
    }
    return EAST_OF_EDEN_PLACEMENTS;
  }
  if (chapter === 4) {
    const count = chapterTexts(chapter).length;
    if (NOD_PLACEMENTS.length !== count) {
      throw new Error(`Genesis 4 has ${count} verses and ${NOD_PLACEMENTS.length} placements`);
    }
    return NOD_PLACEMENTS;
  }
  if (chapter === 5) {
    const count = chapterTexts(chapter).length;
    if (GENERATIONS_PLACEMENTS.length !== count) {
      throw new Error(`Genesis 5 has ${count} verses and ${GENERATIONS_PLACEMENTS.length} placements`);
    }
    return GENERATIONS_PLACEMENTS;
  }
  const count = chapterTexts(chapter).length;
  const spots: Placement[] = [];
  for (let i = 0; i < count; i++) {
    const ring = Math.floor(i / 10);
    const slot = i % 10;
    const angle = (slot / 10) * Math.PI * 2 + chapter * 0.35;
    const radius = 14 + ring * 7;
    spots.push({
      verse: i + 1,
      x: Math.cos(angle) * radius,
      z: Math.sin(angle) * radius - 2,
      site: "tent",
      area: "South road camp",
      landmark: "in the camp beside the south road",
    });
  }
  return spots;
}
