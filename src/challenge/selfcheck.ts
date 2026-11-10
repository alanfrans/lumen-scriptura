import { sealCopy } from "./brief";
import {
  answerWords,
  approachFrame,
  bookIsComplete,
  canPay,
  canTrade,
  chapterAfterRoad,
  completedBookCount,
  payFor,
  roadIsOpen,
  shortPurse,
  tradeFor,
  type ApproachInput,
  type ApproachSpot,
} from "./engine";
import { CARRY_LIMIT, HOUR_EVENING, HOUR_MORNING, NEAR_REACH, QUIET_SECONDS, WITNESS_REACH } from "./rules";
import { verseQuiz } from "./words";
import { GENESIS_CHAPTERS } from "../data/canon";
import { chapterSpec } from "../data/chapters";
import { PLACE_EAST_OF_EDEN, PLACE_EDEN, PLACE_GENERATIONS, PLACE_SOUTH_ROAD } from "../data/era";
import { BOOK_GENESIS, PLACE_JORDAN_HILLS } from "../data/identity";
import { PLACEMENTS } from "../data/layout";
import { SOUTH_ROAD_LECTERN } from "../data/play";
import { chapterPlacements, chapterTexts } from "../data/reading";

function assert(cond: boolean, message: string): void {
  if (!cond) throw new Error(`Rule check failed: ${message}`);
}

function spot(partial: Partial<ApproachSpot> & Pick<ApproachSpot, "verse" | "distance">): ApproachSpot {
  return {
    witness: 0,
    owned: false,
    collected: false,
    carried: false,
    ...partial,
  };
}

function frame(partial: Partial<ApproachInput> & Pick<ApproachInput, "rules" | "spots">) {
  return approachFrame({
    day: 0.4,
    has: () => true,
    arms: 0,
    quiet: false,
    ...partial,
  });
}

/** Locks the take order, the chapter records, and the scenes that already exist. Runs at startup. */
export function checkRuleEngine(): void {
  assert(NEAR_REACH === 1.8 && WITNESS_REACH === 1.52 && CARRY_LIMIT === 3 && QUIET_SECONDS === 2.5, "shared reaches");

  const open = frame({ rules: ["near"], spots: [spot({ verse: 1, distance: NEAR_REACH })] });
  assert(open.takes[0]?.action === "collect" && open.prompt == null, "within 1.8 collects");
  const far = frame({ rules: ["near"], spots: [spot({ verse: 1, distance: NEAR_REACH + 0.01 })] });
  assert(far.takes.length === 0 && far.prompt == null, "near refuses without a prompt");

  const early = frame({
    rules: ["near", "order"],
    has: () => false,
    spots: [spot({ verse: 2, distance: 1 })],
  });
  assert(early.prompt === "Verse 1 comes first." && early.takes.length === 0, "order shuts the next verse");
  const prompted = frame({
    rules: ["near", "order"],
    has: () => false,
    spots: [spot({ verse: 2, distance: 7.9 })],
  });
  assert(prompted.prompt === "Verse 1 comes first.", "shut prompt inside 8 metres");
  const distant = frame({
    rules: ["near", "order"],
    has: () => false,
    spots: [spot({ verse: 2, distance: 8 })],
  });
  assert(distant.prompt == null, "shut prompt stops at 8 metres");
  const carriedOnly = frame({
    rules: ["near", "order"],
    has: (verse) => verse !== 1,
    spots: [spot({ verse: 2, distance: 1 })],
  });
  assert(carriedOnly.prompt === "Verse 1 comes first.", "arms do not satisfy order");

  const eveningShut = frame({
    rules: ["near", "hour"],
    hour: HOUR_EVENING,
    day: 0.5,
    spots: [spot({ verse: 1, distance: 1 })],
  });
  assert(eveningShut.prompt === "This verse opens in the evening.", "noon is outside evening");
  for (const day of [0.65, 0.9, 0.1]) {
    const openHour = frame({
      rules: ["near", "hour"],
      hour: HOUR_EVENING,
      day,
      spots: [spot({ verse: 1, distance: 1 })],
    });
    assert(openHour.takes[0]?.action === "collect", `evening is open at ${day}`);
  }
  const morning = frame({
    rules: ["near", "hour"],
    hour: HOUR_MORNING,
    day: 0.32,
    spots: [spot({ verse: 1, distance: 1 })],
  });
  assert(morning.takes[0]?.action === "collect", "road-arrival dawn is morning");
  const dawnEvening = frame({
    rules: ["near", "hour"],
    hour: HOUR_EVENING,
    day: 0.32,
    spots: [spot({ verse: 1, distance: 1 })],
  });
  assert(dawnEvening.prompt === "This verse opens in the evening.", "arriving at dawn keeps the evening window shut");

  const alone = frame({
    rules: ["near", "witness"],
    spots: [spot({ verse: 1, distance: 1, witness: WITNESS_REACH + 0.1 })],
  });
  assert(alone.prompt === "Someone must stand here with you.", "witness reach");
  const together = frame({
    rules: ["near", "witness"],
    spots: [spot({ verse: 1, distance: 1, witness: WITNESS_REACH })],
  });
  assert(together.takes[0]?.action === "collect", "a person at the tablet agrees");

  const quiz = frame({ rules: ["near", "words"], spots: [spot({ verse: 4, distance: 1 })] });
  assert(quiz.takes.length === 1 && quiz.takes[0]?.action === "quiz", "words opens the line");
  const both = frame({ rules: ["near", "words", "carry"], spots: [spot({ verse: 4, distance: 1 })] });
  assert(both.takes[0]?.action === "quiz", "words and carry asks before it lifts");
  assert(answerWords(["near", "words"], { verse: 4, distance: 0, has: () => true, day: 0.4, witness: 0 }, false, 0).action === "wrong", "wrong ending");
  assert(answerWords(["near", "words", "carry"], { verse: 4, distance: 0, has: () => true, day: 0.4, witness: 0 }, true, 0).action === "lift", "a right ending is carried");
  assert(
    answerWords(["near", "words", "carry"], { verse: 4, distance: 0, has: () => true, day: 0.4, witness: 0 }, true, CARRY_LIMIT).action === "arms-full",
    "full arms after a right ending",
  );
  assert(
    answerWords(["near", "hour", "words"], { verse: 4, distance: 0, has: () => true, day: 0.5, witness: 0, hour: HOUR_EVENING }, true, 0).action === "shut",
    "a window can close on an open dialog",
  );

  const carried = frame({
    rules: ["near", "carry"],
    arms: CARRY_LIMIT - 1,
    spots: [
      spot({ verse: 1, distance: 1 }),
      spot({ verse: 2, distance: 1 }),
      spot({ verse: 3, distance: 1 }),
    ],
  });
  assert(
    carried.takes.map((take) => take.action).join(",") === "lift,arms-full",
    "three is the armful, and the next tablet stays down",
  );
  const quiet = frame({ rules: ["near"], quiet: true, spots: [spot({ verse: 1, distance: 1 })] });
  assert(quiet.takes.length === 0, "quiet tablets are not retaken");

  const owned = frame({
    rules: ["near"],
    spots: [spot({ verse: 31, distance: 1, owned: true })],
  });
  assert(owned.owned === 31 && owned.takes.length === 0, "an owned verse is not a proximity take");

  const genesis1 = chapterSpec(BOOK_GENESIS, 1);
  const tablet = PLACEMENTS.find((p) => p.verse === 31);
  assert(genesis1.place === PLACE_JORDAN_HILLS && genesis1.rules.join(",") === "near", "Genesis 1 is reach, in the valley");
  const ownedVerse = genesis1.owned?.[0];
  assert(ownedVerse?.verse === 31 && ownedVerse.price === 30 && ownedVerse.tradeItem === "jar", "verse 31 is bought or traded");
  assert(tablet?.owner === ownedVerse?.owner, "the valley tablet and the owned record name one person");
  assert(genesis1.seal?.includes("south road") === true, "sealing Genesis 1 opens the road");

  const genesis2 = chapterSpec(BOOK_GENESIS, 2);
  assert(genesis2.place === PLACE_EDEN && genesis2.rules.join(",") === "near,order", "Genesis 2 opens in order in Eden");
  const genesis3 = chapterSpec(BOOK_GENESIS, 3);
  const seal2 = sealCopy(genesis2, genesis3, PLACE_EDEN);
  assert(seal2.offerNext === false && seal2.body.includes("east side"), "Eden sends the Seeker on toward Genesis 3");
  assert(
    genesis3.place === PLACE_EAST_OF_EDEN && genesis3.rules.join(",") === "near,hour",
    "Genesis 3 is walked east of Eden",
  );
  assert(
    genesis3.hour?.from === HOUR_EVENING.from && genesis3.hour.to === HOUR_EVENING.to && genesis3.hour.label === "evening",
    "Genesis 3 uses the evening window",
  );
  assert(chapterPlacements(3).length === chapterTexts(3).length, "Genesis 3 places every verse east of Eden");
  const seal3 = sealCopy(genesis3, chapterSpec(BOOK_GENESIS, 4), PLACE_EAST_OF_EDEN);
  assert(seal3.offerNext === false && seal3.body.includes("path west"), "East of Eden sends the Seeker back toward camp");

  const genesis4 = chapterSpec(BOOK_GENESIS, 4);
  assert(genesis4.rules.includes("witness") && genesis4.companion === "joel", "the camp witness is Joel");
  const genesis5 = chapterSpec(BOOK_GENESIS, 5);
  assert(genesis5.place === PLACE_GENERATIONS && genesis5.rules.join(",") === "near,words", "Genesis 5 is read in the generations");
  assert(chapterPlacements(5).length === chapterTexts(5).length, "Genesis 5 places every verse");
  const seal4 = sealCopy(genesis4, genesis5, PLACE_SOUTH_ROAD);
  assert(seal4.offerNext === false && seal4.body.includes("west side"), "camp sends the Seeker west to Genesis 5");
  const seal5 = sealCopy(genesis5, chapterSpec(BOOK_GENESIS, 6), PLACE_GENERATIONS);
  assert(seal5.offerNext === false && seal5.body.includes("camp"), "the generations send the Seeker back toward camp");
  const genesis6 = chapterSpec(BOOK_GENESIS, 6);
  assert(genesis6.rules.includes("carry") && genesis6.lectern?.x === SOUTH_ROAD_LECTERN.x && genesis6.lectern.z === SOUTH_ROAD_LECTERN.z, "carry files at the camp lectern");
  const twelve = chapterSpec(BOOK_GENESIS, 12);
  assert(twelve.rules.join(",") === "near,words,carry" && twelve.lectern != null, "Genesis 12 finishes the line and then carries it");

  for (let n = 1; n <= GENESIS_CHAPTERS; n++) {
    const spec = chapterSpec(BOOK_GENESIS, n);
    assert(spec.rules[0] === "near", `Genesis ${n} does not start with near`);
    if (spec.rules.includes("hour")) assert(spec.hour != null, `Genesis ${n} has no hour window`);
    if (spec.rules.includes("carry")) assert(spec.lectern != null, `Genesis ${n} has nowhere to set a verse down`);
    if (spec.rules.includes("witness") && spec.place === PLACE_SOUTH_ROAD) assert(spec.companion === "joel", `Genesis ${n} has no companion`);
  }

  const purse = { coin: 10, hasJar: false };
  const deal = ownedVerse;
  if (!deal) throw new Error("Rule check failed: missing owned verse");
  assert(shortPurse(deal, purse) && !canPay(deal, purse) && !canTrade(deal, purse), "the opening purse cannot buy verse 31");
  assert(payFor(deal, { coin: 30, hasJar: false })?.coin === 0, "thirty coin pays");
  assert(tradeFor(deal, { coin: 0, hasJar: true })?.hasJar === false, "the jar is spent");

  const sample = [
    "In the beginning God created the heaven and the earth.",
    "And the earth was without form, and void; and darkness was upon the face of the deep.",
  ];
  const line = verseQuiz(sample[0], 1, sample);
  assert(line.choices.filter((choice) => choice.right).length === 1, "one right ending");
  assert(line.choices.some((choice) => choice.text.includes("deep")), "the other ending comes from this chapter");
  assert(!line.choices.some((choice) => choice.text.includes("first day")), "a fixed Genesis 1 decoy is not used when the chapter has another line");
  const genealogy = chapterTexts(5);
  const generated = verseQuiz(genealogy[0] ?? "", 1, genealogy);
  assert(new Set(generated.choices.map((choice) => choice.text)).size === 3, "the three endings differ");

  const sealed = Array.from({ length: GENESIS_CHAPTERS }, (_, i) => `${BOOK_GENESIS}.${i + 1}`);
  assert(bookIsComplete(sealed, BOOK_GENESIS, GENESIS_CHAPTERS), "Genesis is complete when all 50 keys are sealed");
  assert(!bookIsComplete(sealed.slice(0, 49), BOOK_GENESIS, GENESIS_CHAPTERS), "a missing last chapter leaves the book open");
  assert(completedBookCount(sealed, [{ id: BOOK_GENESIS, chapters: GENESIS_CHAPTERS }]) === 1, "one finished book");
  assert(!roadIsOpen(PLACE_JORDAN_HILLS, []) && roadIsOpen(PLACE_JORDAN_HILLS, ["genesis.1"]), "the south road watches Genesis 1");
  assert(roadIsOpen(PLACE_SOUTH_ROAD, []), "camp roads are not gated");
  assert(chapterAfterRoad(PLACE_JORDAN_HILLS, PLACE_SOUTH_ROAD, 1, ["genesis.1"]) === 2, "the road begins Genesis 2");
  assert(chapterAfterRoad(PLACE_JORDAN_HILLS, PLACE_SOUTH_ROAD, 1, []) === 1, "an unsealed valley does not skip ahead");
  assert(chapterAfterRoad(PLACE_EDEN, PLACE_EAST_OF_EDEN, 2, ["genesis.2"]) === 3, "the east path begins Genesis 3");
  assert(chapterAfterRoad(PLACE_SOUTH_ROAD, PLACE_EAST_OF_EDEN, 2, ["genesis.2"]) === 3, "the camp path begins Genesis 3");
  assert(chapterAfterRoad(PLACE_EDEN, PLACE_EAST_OF_EDEN, 2, []) === 2, "an unsealed garden does not skip ahead");
  assert(chapterAfterRoad(PLACE_EAST_OF_EDEN, PLACE_EDEN, 3, ["genesis.2"]) === 3, "walking back does not change the chapter");
  assert(chapterAfterRoad(PLACE_SOUTH_ROAD, PLACE_GENERATIONS, 4, ["genesis.4"]) === 5, "the west path begins Genesis 5");
  assert(chapterAfterRoad(PLACE_SOUTH_ROAD, PLACE_GENERATIONS, 4, []) === 4, "an unsealed camp does not skip to Genesis 5");
  assert(chapterAfterRoad(PLACE_GENERATIONS, PLACE_SOUTH_ROAD, 5, ["genesis.4"]) === 5, "walking back from the generations does not change the chapter");
}

checkRuleEngine();
