import type { ChapterSpec } from "../data/chapters";
import { PLACE_EAST_OF_EDEN, PLACE_EDEN, PLACE_SOUTH_ROAD, placeById } from "../data/era";

/** Joel's summary of the active rule list. One sentence per rule that needs saying. */
export function ruleBrief(spec: ChapterSpec, following: boolean): string {
  const bits: string[] = [];
  if (spec.rules.includes("order")) bits.push("Take them in order. The first verse of the chapter opens the next.");
  if (spec.rules.includes("hour")) bits.push(`These verses open in the ${spec.hour?.label ?? "evening"}.`);
  if (spec.rules.includes("witness")) {
    bits.push(
      following
        ? "I'm with you. Stand close to a verse, and I will stand close too."
        : "These verses stay shut unless someone stands with you.",
    );
  }
  if (spec.rules.includes("words")) bits.push("Read the ending carefully. Only one of the three lines is the verse.");
  if (spec.rules.includes("carry")) bits.push("The lectern is west of the fire. Carry a verse there. Three at a time.");
  if (!bits.length) bits.push("Press M when you want the way back to the valley.");
  return bits.join(" ");
}

/** How to walk from the place you sealed toward the next chapter, when it is not here. */
function pathNote(standingIn: string, nextPlace: string): string {
  if (standingIn === PLACE_EDEN && nextPlace === PLACE_SOUTH_ROAD) return " The path back leaves to the south.";
  if (standingIn === PLACE_EDEN && nextPlace === PLACE_EAST_OF_EDEN) return " A path leaves the east side of the garden.";
  if (standingIn === PLACE_EAST_OF_EDEN && nextPlace === PLACE_SOUTH_ROAD) {
    return " The path west returns to the garden, and the camp is south from there.";
  }
  return "";
}

/**
 * The seal dialog. A chapter may replace the body. The offer to begin the next
 * chapter appears only when that chapter is walked in the place the Seeker is standing.
 */
export function sealCopy(
  spec: ChapterSpec,
  next: ChapterSpec | null,
  standingIn: string,
): { body: string; offerNext: boolean } {
  const offerNext = next != null && next.place === standingIn;
  if (spec.seal) return { body: spec.seal, offerNext };
  const nextLine =
    next == null
      ? ""
      : offerNext
        ? ` Genesis ${next.chapter} is here in the camp whenever you are ready.`
        : ` Genesis ${next.chapter} is at ${placeById(next.place).name}.${pathNote(standingIn, next.place)}`;
  return { body: `Genesis ${spec.chapter} is in the Codex.${nextLine}`, offerNext };
}
