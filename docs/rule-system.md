# Rule system

How a chapter's rules become play. What each chapter asks for is in [game-rules.md](game-rules.md). This file is the machinery.

The Seeker collects every verse of the active chapter. The chapter seals when the Codex count matches the verse count. Nothing here removes a verse, ends the run, or resets the day except taking a road.

## Where a chapter plugs in

`ChapterSpec` in `src/data/chapters.ts` is the record. A row in `CHAPTERS` is used as written. Any other Genesis chapter is `compileChapter` (`src/data/compile.ts`) from its text and its number, then the same checks.

| Field | Meaning |
| --- | --- |
| `rules` | Ordered gates. Every one must agree. `near` is required and stays first. |
| `hour` | The window, when `hour` is listed. One window for the whole chapter. |
| `owned` | Verses that are not walked up to. Price and trade live here. The placement's `owner` names the same person. |
| `lectern` | Where `carry` is set down. If the chapter omits it, the place's point in `PLACE_LECTERN` is used. `carry` with no point throws when the chapter is loaded. |
| `companion` | Rig asked to walk with the Seeker when `witness` is listed. If the chapter omits it, `PLACE_COMPANION` supplies one. Any person already standing at the tablet still counts. |
| `seal` | Replaces the seal paragraph. The default names the next chapter. |

`src/data/play.ts` holds the place fixtures (the camp lectern, Joel) and Genesis 1's owned verse and seal paragraph. A new scene adds a lectern or a companion there, or sets them on its own `CHAPTERS` row.

## Who decides, and who applies it

`src/challenge/rules.ts` is the six ids, the reaches, and the refusal strings. `order`, `hour`, and `witness` keep a column shut. `near`, `words`, and `carry` do not: the light still answers those.

`src/challenge/engine.ts` is the only place that decides a frame:

1. A shut rule refuses. Within 8 metres the nearest refusal is the prompt.
2. An owned verse never opens by proximity. The owner is the only way, and the shut rules are read again at the purchase. A refusal gives the coin or the jar back.
3. `near` must pass (within 1.8). That refusal is not a prompt.
4. `words` opens the line. A wrong ending leaves the verse down and quiets every tablet for 2.5 seconds. A window that closes while the dialog is open refuses a correct line.
5. `carry`, including after a correct line, lifts the verse into the arms, up to 3. The lectern files it and does not re-check hour, witness, or order. Full arms quiet the tablets for 2.5 seconds.
6. Otherwise the verse is collected where it stands.

`src/game.ts` applies the result: dialog, toast, lights, save. It does not re-decide the order. `src/challenge/selfcheck.ts` locks that order and runs when the game starts.

`order` reads the Codex only. A verse in the arms does not open the next one.

The third quiz ending is the tail of another verse in the same chapter (`src/challenge/words.ts`). The swapped-word ending stays. The old fixed Genesis 1 sentence is used only when every other tail in the chapter collides with the right one.

## Win, collection, roads

A chapter wins when `chapterHave === chapterTotal`. The key `book.chapter` is stored in `sealedChapters`. Genesis 1 still sets `sealed` as well, so an old save keeps meaning the same thing. The south road reads the key, not that flag. Arriving by that road, with the key sealed, begins Genesis 2 and sets the clock to dawn. Arriving east of Eden, with Genesis 2 sealed and still the active chapter, begins Genesis 3 and sets the clock to dawn. Dawn is outside the evening window, so those columns stay shut until evening. Arriving in the land of Nod, with Genesis 3 sealed and still the active chapter, begins Genesis 4 and sets the clock to dawn. Arriving at the generations, with Genesis 4 sealed and still the active chapter, begins Genesis 5 and sets the clock to dawn. The words rule does not care about the hour. Arriving at the ark, with Genesis 5 sealed and still the active chapter, begins Genesis 6 and sets the clock to dawn. Carry does not read the clock, so the ark's verses can be lifted as soon as you arrive.

The Codex book count is how many listed books have every chapter key sealed. Genesis is the only book, and it is in every canon level, so sealing chapter 50 shows 1 on each book bar. No new save field.

Hope on the sky is this chapter's fraction. It starts again when the next chapter begins.

## What plays today

| Chapter | Place | What the Seeker does | Wins | Collects |
| --- | --- | --- | --- | --- |
| Genesis 1 | Valley | Walk up to a column. Verse 31 is Tobias: 30 coin, or the clay jar. | 31/31. Beacon over the arch. South road opens (M). | The 31 verses. Key, jar, coin, and Dinah are world props, not required. |
| Genesis 2 | Eden | Take the verses in written order. Adam points at the next one. | 25/25. A path leaves the east side of the garden. | The 25 verses. |
| Genesis 3 | East of Eden | Walk up to a column while the clock is in the evening. Any order. Adam points at the nearest one once that window is open. | 24/24. A path east of the gate begins Genesis 4. The path west returns to the garden. | The 24 verses. |
| Genesis 4 | Land of Nod | Ask Abel to walk with you, then stand at each tablet until he arrives. Cain will not. | 26/26. Beacon over the city of Enoch. The path west returns toward the garden. Genesis 5 is west of the camp, past the stone steps. | The 26 verses. |
| Genesis 5 | The generations | Walk up and finish the ending of each line. Any order. Seth points at the nearest one. | 32/32. The stone-step path returns to the camp. Joel points to the north-west path, which begins Genesis 6. | The 32 verses. |
| Genesis 6 | The ark | Walk up, and carry up to three verses to the lectern at the door. Noah points at the nearest one still on the ground. | 22/22, each one set on the lectern. The path east returns to the camp, and Joel offers Genesis 7 there. | The 22 verses. |
| Genesis 7–50 | Camp, until a scene replaces it | The compiled rule list. `words` together with `carry` (12, 27, 42) finishes the line and then lifts. | The verse count. Chapter 50 has no next chapter. | Those verses. |

## A later scene

1. Build the place and its placements.
2. Leave the chapter out of `CHAPTERS` to keep the compiled rules, or add a row to override them.
3. If the rules include `carry`, add the place to `PLACE_LECTERN` and build the lectern mesh on that point.
4. If the rules include `witness` and nobody already stands on the tablets, add a rig and a `PLACE_COMPANION` entry. The rig's talk handler offers "Walk with me". Joel already does. Another companion is picked up by name.
5. An owned verse needs an `owned` entry and the same `owner` on its placement.

## Left as written

Hour stays on the whole chapter. The compiler still treats "even" as a time word. No one skips the clock forward. A new scene keeps the compiled rules unless it adds a `CHAPTERS` row. Any person within witness reach counts. A sealed chapter is reread in the Codex; its tablets are not rebuilt. `order` remains the compiler's fallback, not a rule it spends on purpose.
