import type { ChapterSpec } from "../data/chapters";
import { PLACE_EDEN, PLACE_SOUTH_ROAD, placeById } from "../data/era";

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
        : ` Genesis ${next.chapter} is at ${placeById(next.place).name}.${
            standingIn === PLACE_EDEN && next.place === PLACE_SOUTH_ROAD ? " The path back leaves to the south." : ""
          }`;
  return { body: `Genesis ${spec.chapter} is in the Codex.${nextLine}`, offerNext };
}
