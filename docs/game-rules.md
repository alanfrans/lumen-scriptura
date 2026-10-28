# Game rules

Design for what the player does, finishes, and collects in each chapter that exists in `src/data`. This is the document the follow-up todo ("Work out how to implement the chapter rules in code") should implement. It does not add a rule system.

The playable book is Genesis, 50 chapters, 1,533 verses (`GENESIS_CHAPTERS`, `GENESIS_VERSES`). Two places exist (`src/data/era.ts`):

| Place id | Name | Who walks it |
| --- | --- | --- |
| `jordan-hills` | The valley | Genesis 1 only |
| `south-road` | South road camp | Genesis 2–50, until a later scene todo gives a chapter its own place |

Genesis 1–6 are written by hand in `CHAPTERS` (`src/data/chapters.ts`). Every other Genesis chapter is produced by `compileChapter` (`src/data/compile.ts`) from the chapter text and the chapter number. A hand entry always wins over the compiler.

## How Alan can review this

1. Read [Shared rules](#shared-rules) and confirm the win condition and the six rule ids.
2. Read [Genesis 1–6](#authored-chapters-genesis-16) verse by verse against the valley and the camp. These six are the teaching sequence.
3. Scan the [Genesis 7–50 table](#compiled-chapters-genesis-750). It is a snapshot of `compileChapter` on the current King James text. Regenerating it after a text edit is the check that the snapshot is still true.
4. Use the [template](#template-for-a-future-chapter) when a scene todo adds a place.
5. Answer the [open questions](#open-questions) before the implementation todo, or mark any you want left as they are.

## Shared rules

The player is the Seeker. The goal of a chapter is to get every verse of that chapter into the Codex and seal the chapter. There is no game-over, no life count, and no verse that leaves the Codex once it is in.

### One chapter at a time

`SaveState.chapter` is the chapter being walked. Tablets are laid only when `state.place` equals that chapter's `place` (`Game.layVerses`). A sealed chapter stays in `sealedChapters` and its verses stay in `collected`. Its tablets are not rebuilt while a later chapter is active.

Chapters are sequential. Joel offers chapter N+1 only when chapter N is already sealed and N+1's place is the place you are standing in. Genesis 1 is the exception: sealing it opens the south road, and taking that road is what sets the active chapter to 2 (`Game.takeRoad`).

The day clock does not reset when the next chapter begins. It resets to dawn only when a road is taken (`day = 0.32`).

### What a verse is

A verse id is `book.chapter.verse`, for example `genesis.1.3` (`verseId`). The Codex stores three states for a verse:

| State | Save field | Meaning |
| --- | --- | --- |
| Collected | `collected` | In the Codex. Counts toward the chapter, the book, and the canon bars. |
| Carried | `carried` | In the Seeker's arms, on the way to a lectern. Not collected. The tablet is gone until it is set down or the chapter is reloaded while it is still carried. |
| Rumored | `rumored` | Miriam has spoken of it. The Codex shows the area name and hides the words. |

Anything else is unknown: the Codex shows the number only.

### The six rules

Every rule on a chapter must agree before the verse is collected. The list is ordered. The first refusal is the hint (`ChapterSpec.rules`, `blockReason`).

| Id | Constant | Agrees when | Refusal the player sees |
| --- | --- | --- | --- |
| `near` | `NEAR_REACH = 1.8` | The Seeker is within 1.8 of the tablet. | `Step closer.` |
| `order` | — | The verse is 1, or the previous verse of this chapter is in the Codex. | `Verse N comes first.` |
| `hour` | `HourWindow` on the chapter | The day clock sits inside the window. | `This verse opens in the {label}.` |
| `witness` | `WITNESS_REACH = 1.52` | Some person who is not the Seeker, and not a beast, is within 1.52 of the tablet. | `Someone must stand here with you.` |
| `words` | — | The Seeker chooses the true ending of the verse. | `That is not how the line ends.` |
| `carry` | `CARRY_LIMIT = 3` | The verse has been set on the place's lectern. | `Your arms are full. Set these verses on the lectern.` or `Carry a verse here, then set it down.` |

`order` reads `collected`. A previous verse that is only in the arms does not unlock the next one.

`hour`, `order`, and `witness` keep the column shut even if someone is standing on the tablet (`holdsShut`). `near`, `words`, and `carry` do not: the light still answers those, and the extra gate happens at the moment of taking.

Take order, which the implementation must honor when more than one gate is listed:

1. If `order`, `hour`, or `witness` fails, the verse stays where it is. Within 8 metres the nearest refusal is the prompt.
2. `near` must pass (distance under 1.8). An owned verse never reaches this step; its owner is the only way to take it.
3. If `words` is listed, the Seeker finishes the line. A wrong choice leaves the verse in place and quiets it for 2.5 seconds (`wordsQuiet`). The shut rules are checked again at the moment of the answer (`commitVerse`). A window that closes while the dialog is open refuses a correct answer.
4. If `carry` is listed, the verse goes into the arms, up to 3. It enters the Codex at the lectern. Full arms quiet the tablet for 2.5 seconds. The lectern does not re-check hour, witness, or order: those already agreed at the tablet.
5. If `carry` is not listed, a passed check commits the verse immediately.

Chapters that list both `words` and `carry` are Genesis 12, 27, and 42. The code today returns from `takeVerse` on `words` and never lifts the verse, so a correct answer collects it at once. The rule above is the one to implement: finish the line, then carry it. `blocked()` also ignores `words` and `carry`; the gates live in `takeVerse`, `askWords`, and `liftVerse`.

### Clock

`day` runs from 0 to 1. Both ends are midnight. Noon is 0.5. One cycle is `DAY_LENGTH = 20 * 60` seconds (20 real minutes). The clock advances on the title screen and while a dialog is open. The stipend does not advance while a dialog, the Codex, or the travel map is open.

| Window | `from` → `to` | Clock time | Used by |
| --- | --- | --- | --- |
| morning | 0.25 → 0.55 | 06:00–13:12 | Compiler, when morning words outnumber the others |
| evening | 0.65 → 0.20 (wraps past midnight) | 15:36–04:48 | Genesis 3, and the compiler's usual choice |
| night | 0.75 → 0.28 (wraps) | 18:00–06:43 | Compiler, when night words outnumber evening |

A window with `from > to` is open through midnight (`hourOpen`). While the window is shut the verse is not failed. It waits.

Arriving by road sets the clock to 0.32 (about 07:40), which is inside morning and outside evening and night. A Seeker who rides straight from the valley into an evening chapter waits until 15:36, about six and a half real minutes, unless chapter 2 already burned the morning.

### Witnesses and Joel

Any person counts: Miriam, Eli, Tobias, the watchman, standing folk, pacing folk, and Joel. Beasts are skipped (`peopleNearVerses` ignores names that start with `beast`). The Seeker does not count as their own witness.

At the south-road camp the only person is Joel, posted at about (-3, 2) by the fire. Camp tablets start on a ring of radius 14, so he is not close enough while he stays by the fire. A witness chapter at camp is completable only if Joel is walking with you.

Talk to him and choose "Walk with me" (`guideFollows`). He follows at 3.2 units per second and stops about 1.05 short of the Seeker. Walk is 7 and sprint is 11, so he falls behind. Stand on the tablet and let him arrive: witness reach is 1.52 from the tablet, while take reach is 1.8, and a Seeker who stops at the outer edge can be in range while Joel is still too far from the light.

`beginChapter` clears `guideFollows` and rebuilds the place. Joel returns to the fire. Each witness chapter asks again.

### Carry and the lectern

The camp lectern is `LECTERN` at (-8, -6), west of the fire. The prompt is "Set the verses on the lectern" when the arms hold anything, and "The lectern" when they do not. Setting down files every carried id of the active chapter (`fileCarried`) and shows the last verse's card.

The valley has no lectern. Genesis 1 does not use `carry`. A future place that hosts a `carry` chapter needs its own lectern point or the rule cannot be finished.

### Sealing a chapter

When `chapterHave() === chapterTotal()` and the chapter key is not yet in `sealedChapters`, the chapter seals (`sealChapter`).

- The key `genesis.N` is stored.
- Genesis 1 also sets `sealed`, which is the south-road gate.
- A Hope Beacon rises over the place (`raiseBeacon`): the valley beacon stands over the arch (z = -25); any other place's beacon stands at z = -2. Leaving the place disposes it. Coming back raises it again while `beaconHere` is true.
- The seal dialog names the chapter. In the valley it tells the Seeker the south road is open (press M) and that the chapter counts toward Genesis, the Torah, and all three canon levels. At camp, if the next chapter's place is this camp, Joel's line offers "Begin Genesis N+1" or "Not yet".
- Choosing to begin sets `book` and `chapter`, clears the guide, and reloads the camp so the new ring of tablets appears.
- Genesis 50 has no next chapter (`nextChapter` returns null). The seal dialog records the chapter and offers no begin button.

Hope on the sky and the status line is this chapter's fraction, `chapterHave / chapterTotal`. Beginning the next chapter starts Hope again at 0. Lifetime progress is the Codex, not the sky.

The last tablet still in the world (not carried, not collected) becomes a wider, brighter pillar (`emphasize`). That is a finding aid shared by every chapter.

A dim disc stays on the ground where a verse was collected (`addResidue`).

### Codex and canons

Press C. The same collected count `n` is shown against each bar. Sealing a chapter adds one to the chapter count on every bar. Nothing in the rules multiplies a verse by the number of canons.

| Bar | Denominator | Source |
| --- | --- | --- |
| Level I, Hebrew Bible | 23,145 verses, 929 chapters, 24 books | `CANON_LEVELS` |
| Level II, Protestant Bible | 31,103 verses, 1,189 chapters, 66 books | `CANON_LEVELS` |
| Level III, Catholic Bible | 35,489 verses, 1,334 chapters, 73 books | `CANON_LEVELS` |
| Torah | 5,852 verses | `TORAH_VERSES` |
| Genesis (Bereshit) | 1,533 verses, 50 chapters | `GENESIS_VERSES`, `GENESIS_CHAPTERS` |

The book numerator is hardcoded to 0 in `openCodex`. Completing a book is not yet a rule. See [open questions](#open-questions).

Miriam's line after Genesis 1, "1,188 more chapters," is the Protestant total minus this chapter (1,189 − 1).

### Coin

Shared across chapters, spent only in Genesis 1 today.

- A new game starts with 10 coin.
- Every 180 seconds of unpaused play the stipend pays 20 (`STIPEND_PERIOD`, `STIPEND_AMOUNT`). The toast calls it a week.
- The watchman can take up to 5 coin. He cannot take a verse.
- Verse 31 costs 30 (`VERSE_PRICE`). The opening purse cannot pay it. One stipend can, and the clay jar can, without waiting.

### Failure and retry

Nothing ends the run except "Start over" in the Codex, which clears both save keys and reloads.

| Situation | What is kept | How play continues |
| --- | --- | --- |
| Wrong ending | The verse stays down | Quiet for 2.5 seconds, then the line can be tried again. The three choices do not change. |
| Arms full | The verse stays down | Set the armful on the lectern. Quiet for 2.5 seconds. |
| Hour shut | The verse stays down | Wait for the window. No coin loss. |
| Out of order | The verse stays shut | Collect the previous verse first. |
| No witness | The verse stays shut | Bring a person to the tablet. At camp, ask Joel to walk with you. |
| Watchman catches the Seeker | Verses and the key stay | He shoves the Seeker about 9 units, takes up to 5 coin, and waits 5 seconds. The scriptorium interior is sanctuary. |
| Scriptorium door locked | Nothing is spent | Try the door (this arms Miriam's hint), bring the sexton's key, or use the gap in the north wall. |
| Short of Tobias's price | The verse stays his | Wait for the stipend, or bring the jar from the oasis well. |
| Road refused | Chapter 1 stays the active chapter | Seal Genesis 1 first. |

Saves are written at each collect and about every 5 seconds (`lumen-scriptura-save-v2`).

### Camp layout used by every chapter that has no scene of its own

`chapterPlacements` puts Genesis 1 on the hand-authored valley sites. Every later chapter uses one ring formula around the camp:

- 10 verses to a ring
- verse index `i` from 0: `ring = floor(i / 10)`, `slot = i % 10`
- `angle = (slot / 10) * 2π + chapter * 0.35`
- `radius = 14 + ring * 7`
- `x = cos(angle) * radius`, `z = sin(angle) * radius - 2`
- site `tent`, area "South road camp", landmark "in the camp beside the south road"

Genesis 24 (67 verses) reaches ring 6, radius 56, out on sand the camp dressing does not cover. The rules still apply there. Scene todos replace the ring; they should keep the chapter's rule list unless a hand entry is added to `CHAPTERS`.

The player arrives at the camp spawn (0, 36), on the road north of the fire, at dawn.

## Authored chapters (Genesis 1–6)

The hand list teaches one idea at a time. Chapter 1 is reach. Each next chapter adds a single extra rule, at the camp: order, then evening, then a witness, then the words, then carrying the verse to the lectern. The compiler's "two rules when the chapter number is divisible by 3" does not apply to these six, including 3 and 6.

### Genesis 1 — The first day, and the six days

- **Passage.** Genesis 1. God creates the heaven and the earth in six days, and sees that it is very good. 31 verses, `genesis.1.1`–`genesis.1.31`.
- **Place.** `jordan-hills`, the valley west of the Jordan. This is the only bespoke scene. Sites and coordinates live in `PLACEMENTS` (`src/data/layout.ts`).
- **Rules.** `["near"]`. No hour, no order, no witness, no quiz, no lectern. Walk within 1.8 of a free tablet and it is collected.
- **What the player does.** Find 31 columns of light. Most sit in the open. A few are behind a locked door, a watchman, or a collector. People at the campfire and in the pasture will talk. Press E.
- **Completed when.** All 31 ids are in `collected`. The seal dialog raises the Hope Beacon over the Ruined Arch and opens the south road (M). The active chapter stays 1 until that road is taken.
- **Collected.** The 31 verses. Also, along the way, any of the following. None of them is required to be held at the end:
  - Sexton's key, from his grave in the old cemetery (`KEY_POS`). Opens the scriptorium. Optional, because the north wall is already broken (`REAR_GAP`).
  - Clay jar, by the well at the far north-west of the oasis (`JAR_POS`). Traded to Tobias for verse 31. Optional, because coin can pay instead. The trade consumes the jar.
  - Coin, from the stipend. 30 of it can buy verse 31.
  - The use of Dinah, Eli's mare. First conversation with Eli sets `hasHorse`. H mounts within 3.5, H dismounts. She will not pass a doorway. She is never required.
  - Rumors, as Miriam is asked. They do not count as verses.
- **Failure and retry.** The watchman, the locked door, and Tobias's price, as in the shared table. A free tablet has no failure state. Standing on an owned tablet (verse 31, `owner: "tobias"`) only toasts "This verse belongs to Tobias. Talk to him about it." and does not collect it.
- **Passage tie.** The valley is grouped by the days of the text. The obstacles show up as the chapter turns from light lying on the sand to what is guarded, locked, or sold.

| Verses | Day in the text | Where it rests | How it is taken |
| --- | --- | --- | --- |
| 1–5 | Day 1: light divided from darkness | Ruined Arch of the First Light | Walk up. Verse 3 is under the arch. |
| 6–8 | Day 2: the firmament | Standing Stones of the Firmament | Walk up. Three pairs of stones. |
| 9–13 | Day 3: seas, dry land, plants | Oasis of the Gathered Waters | Walk up. The jar is a prop at the north-west well, not a verse. |
| 14–19 | Day 4: the greater light, the lesser light, the stars | Ring of the Great Lights | Walk up. Six tablets inside the ring of pillars. |
| 20–23 | Day 5: creatures of the water and the air | Old Cemetery | Walk up. The watchman paces the lantern path on the west side of the graves. He sees the Seeker inside 8 units, inside 26 of his post, outside the scriptorium, and after his 5-second cooldown. He gives up in the chapel, past 26 from home, or past 14 from himself. The east wall has a gap he does not watch. His shove is the only way to lose coin in this chapter besides paying Tobias. |
| 24–25 | Day 6: beasts of the earth | Eli's Pasture | Walk up. Eli stands here and lends Dinah. |
| 26–30 | Day 6: humankind, in the image of God | Ruined Scriptorium | The door starts locked (`triedDoor`, `hasKey`, `doorOpen`). The sexton's key turns it. The gap in the north wall, toward the east corner, does not need a key. Miriam says so on the second door hint, and points the compass on the third. |
| 31 | "Behold, it was very good," and the sixth day | Table in Tobias's tent | Not a proximity take. Pay 30 coin or trade the clay jar. After either payment, `collect(31)` runs. |

Miriam, keeper of the camp, is the hint ladder for this chapter only. The first meeting is the briefing: thirty-one verses, light into the sky, most of them free, some locked, one sold. Later meetings:

- If the scriptorium door has been tried, the key is still missing, and a scriptorium verse remains, she gives the door ladder (grave and watchman, then the broken wall, then a compass to the gap). `doorHintRung` stops at 2.
- Otherwise she talks about the nearest uncollected verse. Rung 0 is a compass word and the area name. Rung 1 is the landmark sentence from `Placement.landmark` (and, if the door has never been tried, a note that the scriptorium is locked). Rung 2 sets the compass on that tablet for 75 seconds. Verse 31 has its own three lines: Tobias's purple tent, the jar at the oasis well, then a compass to Tobias.
- Each hinted verse is pushed into `rumored`.

Eli's later lines cover the watchman's route, how many pasture verses remain (24 and 25), Tobias's bargain, and Miriam herself. They do not gate the chapter.

When the 31st verse lands, Hope is full, the beacon rises, and the map road can be taken: two days, the telling "The brick road runs off the map. Two days south is a camp for travelers." Travel is refused before the seal, with the toast "The south road opens when Genesis 1 is in the codex."

### Genesis 2 — In order

- **Passage.** Genesis 2. The seventh day, then the garden planted eastward in Eden, the four rivers, the command about the tree, and the woman made from the rib. 25 verses, `genesis.2.1`–`genesis.2.25`.
- **Place.** `south-road`. Ring layout. No valley obstacles travel with this chapter.
- **Rules.** `["near", "order"]`.
- **What the player does.** Find verse 1 (the only column that will open) and take the rest in written order. The ring is not laid out as 1, 2, 3 along a path, so the walk criss-crosses the camp. Within 8 metres of a shut tablet the prompt names the verse that has to come first. Joel states the rule if asked: "Take them in order. The first verse of the chapter opens the next."
- **Completed when.** 25/25 are in the Codex, which means each verse was collected while the one before it was already there. Joel then offers Genesis 3.
- **Collected.** The 25 verses. No key, jar, or purchase. The stipend still ticks if the Seeker lingers.
- **Failure and retry.** Taking a later verse while the previous one is missing does nothing and keeps the column shut. There is no penalty. Carrying does not apply, so there is no armful to disorder.
- **Passage tie.** The chapter is itself a sequence: the work finished, the day blessed, the garden planted, the man put there to keep it, the woman brought to him. The rule is that sequence. The Seeker cannot skip to the woman, or to the rivers, ahead of the verse that introduces them.

### Genesis 3 — In the evening

- **Passage.** Genesis 3. The serpent, the fruit, and the expulsion from the garden. Verse 8: they hear the LORD God walking in the garden in the cool of the day. 24 verses, `genesis.3.1`–`genesis.3.24`.
- **Place.** `south-road`.
- **Rules.** `["near", "hour"]` with the evening window (15:36 through midnight to 04:48). The whole chapter uses one window. Verse 8 is not gated on its own.
- **What the player does.** Be at a tablet while the clock is in the evening. At dawn, which is how the road delivers the Seeker, every column stays shut. Joel says "These verses open in the evening." The Seeker can walk the ring and learn the ground while waiting. When the window opens, any tablet can be taken in any order, by walking up.
- **Completed when.** 24/24 collected during open windows. A verse already collected stays collected after the window shuts. Joel then offers Genesis 4.
- **Collected.** The 24 verses.
- **Failure and retry.** Outside the window the refusal is "This verse opens in the evening." No verse is lost if the window closes after it was collected. A quiz is not involved, so the dialog-versus-clock edge case does not come up. The wait is the whole of the retry.
- **Passage tie.** The authored window matches the cool of the day, when the voice walks the garden, rather than the morning the road arrives in. Morning is the time these verses stay shut.

### Genesis 4 — A witness

- **Passage.** Genesis 4. Cain and Abel, "Am I my brother's keeper?", the mark, and Seth. 26 verses, `genesis.4.1`–`genesis.4.26`.
- **Place.** `south-road`. Joel is the only witness on this ground.
- **Rules.** `["near", "witness"]`.
- **What the player does.** Talk to Joel and choose "Walk with me." Stand on each tablet until he is within 1.52 of it. The column stays dark until he is. Order does not matter. He hangs back about a step, so sprinting off leaves the next tablet shut until he catches up.
- **Completed when.** 26/26 collected with a person beside the tablet at the moment of the take. Joel then offers Genesis 5. Starting that chapter sends him back to the fire.
- **Collected.** The 26 verses. Joel is not collected. `guideFollows` is a condition, not a prize.
- **Failure and retry.** Alone, the prompt says "Someone must stand here with you." No coin, no quiet timer. Walk back toward Joel or wait for him.
- **Passage tie.** The chapter turns on a brother who will not stand with his brother. The rule asks for the opposite: the verse will not open for a Seeker who is standing alone.

### Genesis 5 — The words

- **Passage.** Genesis 5. The book of the generations of Adam, each life ending in "and he died," through Noah's sons. 32 verses, `genesis.5.1`–`genesis.5.32`.
- **Place.** `south-road`.
- **Rules.** `["near", "words"]`.
- **What the player does.** Walk up to a tablet. The world pauses on a dialog titled `Genesis 5:N`. The stem is the verse with its tail cut off. The tail length is `clamp(floor(wordCount / 3), 3, 7)`. Three choices appear:
  - the true tail
  - one corrupted tail: the first match among God→man, LORD→serpent, earth→sea, day→night, man→beast, or else the line "and it was not so."
  - a fixed third line, "and the morning and the evening were the first day." on even verses and "and he called the darkness Day." on odd verses
  - The three are rotated by `verse % 3`, so the true line is not always the first button.
  Press 1, 2, or 3. The right choice collects the verse and shows the verse card. Joel's summary: "Read the ending carefully. Only one of the three lines is the verse."
- **Completed when.** 32/32 correct endings have been committed. Joel then offers Genesis 6.
- **Collected.** The 32 verses, each only after a correct ending.
- **Failure and retry.** A wrong button toasts "That is not how the line ends." and quiets every tablet for 2.5 seconds (`wordsQuiet` is one clock for the whole chapter). The verse stays down. The same three lines are offered on the next try. There is no lockout and no hint that reveals the tail.
- **Passage tie.** The chapter calls itself a book of generations. Play is reading the end of each entry, which in this chapter is usually the years or the death. The two fixed decoys are still sentences from Genesis 1. That is a real mismatch for a genealogy; see [open questions](#open-questions).

### Genesis 6 — Carry it to the lectern

- **Passage.** Genesis 6. Violence fills the earth. Noah finds grace. God commands the ark, and the living things that must be brought into it. 22 verses, `genesis.6.1`–`genesis.6.22`.
- **Place.** `south-road`. The lectern west of the fire is the drop-off.
- **Rules.** `["near", "carry"]`.
- **What the player does.** Walk up to any tablet. It leaves the ground and enters the arms (the status line counts them). Up to three can be held. Press E at the lectern to set that armful into the Codex. Joel says: "The lectern is west of the fire. Carry a verse there. Three at a time." Order is not required, so the three in hand need not be consecutive. 22 verses take at least eight trips if every trip is full.
- **Completed when.** All 22 are in `collected`, which means each one has been set on the lectern. An armful still in hand does not seal the chapter. Joel then offers Genesis 7.
- **Collected.** The 22 verses, at the lectern rather than at the tablet. The arms are empty again after a full seal.
- **Failure and retry.** A fourth verse refuses with "Your arms are full. Set these verses on the lectern." and quiets for 2.5 seconds. Nothing already in the arms is dropped. Talking to the lectern empty-handed toasts "Carry a verse here, then set it down."
- **Passage tie.** The command is to make the ark and bring the creatures and the food into it. The Seeker likewise picks the verses up and brings them to one piece of furniture, three at a time, rather than reading them in at the spot where they lie.

## Compiled chapters (Genesis 7–50)

These chapters have full verse text (`GENESIS_REST` and the tail of the book) and a rule list from `compileChapter`. They do not have their own scene. They are walked on the camp ring, with Joel, the fire, and the lectern.

### How the compiler chooses

This is the rule for a chapter that is not in `CHAPTERS`. The implementation should keep calling `compileChapter` rather than copying the table below into data.

1. Lowercase the chapter and look for signals:
   - `hour` if the text matches `\b(night|evening|even|darkness|midnight|morning|dawn)\b`
   - `words` if it matches `\b(said|say|speak|spake|called|told|answered)\b`
   - `carry` if it matches `\b(went|go|departed|journeyed|arose|come|brought|carried)\b`
   - `witness` if it matches `\b(man|woman|wife|brother|son|daughter|servant|people|brethren)\b`
2. `order` is never a signal. It is only used to fill an empty slot.
3. The chapter wants 2 extra rules when `chapter % 3 === 0`, and 1 otherwise. `near` is always added in front.
4. Signals are sorted by `(index in [order, hour, witness, words, carry] + chapter) % 5`. The first `want` of them are kept.
5. If the text signaled too little, the same rotation fills the rest, starting at index `chapter % 5`, skipping rules already kept.
6. If `hour` was kept, the window is morning when morning/dawn counts beat evening and tie-or-beat night; otherwise night when night beats evening; otherwise evening.

On the current text every chapter from 7 to 50 signals at least as many rules as it wants, so `order` is never selected. Neighbors differ because of the sort and because every third chapter keeps two extras.

For every row below:

- **Done when** the verse count is in the Codex under that row's rules, using the shared take order. The chapter key `genesis.N` is sealed, the camp beacon rises, and Joel offers N+1 (except after 50).
- **Collected:** those verses only.
- **Retry:** the shared table. No watchman, no lock, no purchase.
- **Place:** `south-road`, ring formula, until a scene replaces it.

"Play" is the player-facing shape of that row. "Tie" is the passage the rules are reading. Where the fit is only the compiler's word lists, the tie says so.

| Ch | Verses | Rules | Passage | Play | Tie |
| --- | --- | --- | --- | --- | --- |
| 7 | 24 | near, words | Noah's household enters the ark. The flood begins. | Finish the ending of each of the 24 lines, in any order. | The chapter is speech: the LORD commands who and what comes aboard. |
| 8 | 22 | near, witness | The waters recede. The dove. They leave the ark. | Joel must stand at each tablet. | Compiler: the text names people and living things. The play is simply "not alone." |
| 9 | 29 | near, hour (evening), witness | The covenant and the rainbow. Noah's vineyard. | Evening only, and Joel at the tablet. Both must be true together. | Compiler kept two signals. The vineyard scene is a human scene; the clock word is in the text, not a separate sunset verse. |
| 10 | 32 | near, hour (evening) | The table of the nations, the sons of Noah. | All 32 open only in the evening, then a walk-up take. | Compiler: a time word fired, and this chapter wants only one extra rule. |
| 11 | 32 | near, carry | Babel, then the line from Shem down to Abram. | Carry up to three verses to the lectern. A full arm every trip is eleven trips (30 plus the last 2). | Compiler: the chapter is full of going and journeying, from the migration to Shinar through the generations. |
| 12 | 20 | near, words, carry | The call of Abram. The sojourn in Egypt. | Finish the line, then carry that verse to the lectern. Both gates. | God speaks the call ("Get thee out") and Abram goes. Speech plus travel is why both rules fire. Today the code skips the carry; the design does not. |
| 13 | 18 | near, witness | Abram and Lot separate. | Joel at each of the 18 tablets. | Two households part. The rule asks for a second person anyway. Compiler signal, not a scripted Lot. |
| 14 | 24 | near, hour (evening) | Abram rescues Lot. Melchizedek brings bread and wine. | Evening, then walk up. | Compiler: one time-of-day signal kept. |
| 15 | 21 | near, hour (night), words | The covenant between the pieces. | Night only, and the ending must be finished. A correct answer after dawn is refused. | Strong tie. The vision comes with a deep sleep and a horror of great darkness. Night outranks evening in the word count, so the window is night. |
| 16 | 16 | near, carry | Hagar flees. Ishmael is born. | Carry all 16 to the lectern. | Compiler: going and bringing, a short chapter. |
| 17 | 27 | near, words | Circumcision. Abram and Sarai are renamed. | Finish each of the 27 endings. | The chapter is the LORD speaking the covenant and the names. |
| 18 | 33 | near, witness, words | Three visitors at Mamre. A son is promised. Sodom's doom is told. | Joel must be at the tablet, and the ending must be true. | Visitors who stand with Abraham, and a chapter that is almost entirely dialogue. Both rules wanted because 18 is divisible by 3. |
| 19 | 38 | near, hour (night) | Two angels come to Sodom. The city falls. Lot escapes. | Night only. 38 walk-up takes. | The angels arrive at even, and the destruction is before morning. Night wins the word count. |
| 20 | 18 | near, hour (evening) | Abraham, Sarah, and Abimelech. | Evening, then walk up. | Compiler kept a single time signal. |
| 21 | 34 | near, carry, hour (evening) | Isaac is born. Hagar and Ishmael are sent away. | Evening only. What you take must be carried to the lectern. | A birth and a sending-away. The compiler kept travel and the clock, two rules because 21 is divisible by 3. |
| 22 | 24 | near, words | The binding of Isaac. | Finish each ending. Any order, any hour. | God speaks the command and Abraham answers. The compiler kept `words` and dropped the other signals. |
| 23 | 20 | near, witness | Sarah dies. Abraham buys the cave of Machpelah. | Joel at each tablet. | A burial bargained in front of the people of the land. Compiler signal. |
| 24 | 67 | near, hour (evening), witness | Abraham's servant finds Rebekah. | The long chapter: 67 verses, seven rings, radius out to 56. Evening, with Joel. | The servant will not eat until he has spoken his errand, and Rebekah's family stands around the choice. Compiler kept hour and witness. |
| 25 | 34 | near, witness | Abraham dies. Jacob and Esau. The birthright. | Joel at each tablet. | Brothers and sons fill the text. Compiler kept witness alone. |
| 26 | 35 | near, carry | Isaac, the famine, Abimelech, and the wells. | Carry to the lectern, any hour, alone. | Isaac journeys and digs again the wells of his father. Compiler kept carry. |
| 27 | 46 | near, words, carry | Jacob takes Esau's blessing. | Finish the line, then carry it. 46 verses. | Isaac speaks the blessing, and Jacob comes in and goes out. Both rules, and the code today collects on the quiz alone. |
| 28 | 22 | near, witness | Jacob's ladder at Bethel. | Joel at each tablet. | Compiler: people-words, one rule. The dream itself is not an hour gate on this text. |
| 29 | 35 | near, hour (evening) | Jacob meets Rachel and is given Leah. | Evening, then walk up. | Compiler kept the time signal and dropped speech and travel. |
| 30 | 43 | near, hour (night), witness | The children of Jacob. The speckled flocks. | Night, with Joel. | Compiler: night words outrank evening, and a second rule is required. |
| 31 | 55 | near, carry | Jacob leaves Laban. | Carry 55 verses, three at a time. | A flight and a pursuit. Compiler kept carry. |
| 32 | 32 | near, words | Mahanaim, the gifts for Esau, the wrestling at Peniel. | Finish each ending. | The night wrestling is speech ("What is thy name?"). The compiler kept `words`, not `hour`, so the tablets are not night-locked. |
| 33 | 20 | near, witness, words | Jacob and Esau meet. | Joel at the tablet, and the ending finished. | The meeting is the witness. The speeches are the quiz. Two rules because 33 is divisible by 3. |
| 34 | 31 | near, hour (evening) | Dinah and Shechem. | Evening, then walk up. | Compiler kept a single time signal on a hard chapter. No extra fail state is added. |
| 35 | 29 | near, hour (evening) | Jacob returns to Bethel. Rachel dies. Isaac dies. | Evening, then walk up. | Compiler kept the time signal. |
| 36 | 43 | near, carry, witness | The generations of Esau, who is Edom. | Joel must be present to lift the verse, and the verse still has to reach the lectern. | A list of sons and chiefs, plus the going of the household. Few time words, so hour never signaled. Two rules because 36 is divisible by 3. |
| 37 | 36 | near, words | Joseph's dreams. His brothers sell him. | Finish each ending. | The chapter is told in speech: the dreams, the brothers' plot, the lie to Jacob. |
| 38 | 30 | near, witness | Judah and Tamar. | Joel at each tablet. | Compiler: man, wife, daughter, brother. One rule. |
| 39 | 23 | near, witness, words | Joseph in Potiphar's house. | A witness at the tablet, then the true ending. | Potiphar's house is a household, and the chapter turns on what is said. Two rules because 39 is divisible by 3. |
| 40 | 23 | near, hour (morning) | The butler and the baker dream, and the interpretations come due. | Morning only. This is the only morning chapter in Genesis. Road-arrival dawn (07:40) is already inside the window. | The text puts both restorations in the morning, and the morning count beats evening and night. |
| 41 | 57 | near, carry | Pharaoh's dreams. Joseph is set over Egypt. | Carry 57 verses to the lectern. This is the longest carry in Genesis. | Compiler kept carry (coming, bringing, going) and dropped speech, even though the dreams are spoken. |
| 42 | 38 | near, words, carry | The brothers' first journey to Egypt for grain. | Finish the line, then carry it. | Jacob speaks, the brothers go, Joseph speaks. Both rules. The code today skips the carry. |
| 43 | 34 | near, witness | The second journey, Benjamin with them. | Joel at each tablet. | A family sent together. Compiler kept witness. |
| 44 | 34 | near, hour (evening) | Joseph's cup is found in Benjamin's sack. | Evening, then walk up. | Compiler kept the time signal. |
| 45 | 28 | near, witness, words | Joseph makes himself known to his brothers. | Joel at the tablet, and the ending finished. | He sends the household out, then speaks. Witness plus words, because 45 is divisible by 3. |
| 46 | 34 | near, carry | Israel travels to Egypt and is numbered. | Carry to the lectern. | The chapter opens with the journey to Beer-sheba and on into Egypt. |
| 47 | 31 | near, words | Joseph presents his family. The famine is administered. | Finish each ending. | Audience with Pharaoh, mostly speech. Compiler kept words. |
| 48 | 22 | near, witness, words | Jacob blesses Ephraim and Manasseh. | A witness, then the true ending of the blessing. | Jacob speaks the blessing over the sons, with Joseph present. Two rules because 48 is divisible by 3. |
| 49 | 33 | near, hour (evening) | Jacob gathers his sons and blesses each. | Evening, then walk up. | Compiler kept the clock and dropped `words`, so the blessings are not a quiz. |
| 50 | 26 | near, witness | Jacob is buried in Machpelah. Joseph dies and is coffined. | Joel at each of the last 26 tablets. Sealing this chapter ends Genesis. There is no chapter 51. | A burial walked by a household. Compiler kept witness. The book counter in the Codex does not yet move; see open questions. |

## Template for a future chapter

Copy this when a chapter gains a scene, or when a compiled chapter should stop following the text signals. Add a row to `CHAPTERS` only for a hand override. Leaving it out keeps `compileChapter`.

```
### Genesis N — {short title}

- Passage. One or two sentences naming the episode. Verse count. Id range `genesis.N.1`–`genesis.N.{count}`.
- Place. Place id from the era map. Spawn. Whether the scene is built or still the camp ring.
- Rules. The ordered `RuleId` list. Every entry must agree. If `hour` is included, the window (from, to, label) and the clock times.
- What the player does. The verbs, in take order: wait for the hour, bring the witness, walk up, finish the line, carry to the lectern.
- Completed when. Collected count equals the verse count, then the seal dialog and what is offered next.
- Collected. The verses. Any other item, with whether it is required, optional, or consumed.
- Failure and retry. Which shared rows apply. Any new row (a guard, a price, a lock) and the other way through it.
- Passage tie. Which part of the text the rules are reading. If a single verse should be special, name it here and add the data field; do not special-case it only in prose.
- Data.
  - `ChapterSpec`: book, chapter, place, rules, hour?
  - Placements, or "camp ring".
  - Lectern point, if `carry` is listed and the place is not `south-road`.
  - Witness rig, if `witness` is listed and Joel is not in the scene.
  - Owned verses, if any: id, owner, price, trade item.
  - Hint copy, if anyone besides Joel's rule summary should speak.
```

A new book repeats the same shape with a new `book` id. `chapterSpec` today throws for any book other than Genesis. That guard is the point to widen, not something this design changes in code.

## Data the implementation will need

Already in the game, and enough for chapters 1–50 as played today:

| Field | Where | Role |
| --- | --- | --- |
| `ChapterSpec.book`, `.chapter`, `.place`, `.rules`, `.hour?` | `src/data/chapters.ts` | Which rules must agree, and where the tablets exist. |
| `RULES`, `NEAR_REACH`, `WITNESS_REACH`, `CARRY_LIMIT`, `HourWindow`, `RuleQuery` | `src/challenge/rules.ts` | The six ids and the refusal text. |
| `compileChapter` | `src/data/compile.ts` | Rules for any Genesis chapter not listed by hand. |
| `Placement` (`verse`, `x`, `z`, `y?`, `site`, `area`, `landmark`, `owner?`) | `src/data/layout.ts`, `chapterPlacements` | Where a tablet stands, what Miriam calls it, and who owns it. |
| Verse strings | `genesis1.ts`, `genesis-later.ts`, `genesis-rest.ts` via `chapterTexts` | The card, the quiz stem, and the compiler's input. |
| `collected`, `carried`, `sealedChapters`, `rumored`, `hintRungs`, `guideFollows` | `SaveState` | Codex, arms, seals, hints, Joel. |
| `LECTERN` | `src/world/south-road.ts` | The only drop-off. |
| `VERSE_PRICE`, stipend, key, jar, door, horse, watchman | `Game` and the valley world | Genesis 1's extra verbs. They are flags on the save, not chapter data. |

The follow-up will likely need these, which are not data yet. They are why Genesis 1's price, the decoy lines, and the seal sentences are hardcoded in `game.ts`.

| Needed | Why | Suggested shape |
| --- | --- | --- |
| Composition of `words` and `carry` | Chapters 12, 27, and 42 list both. `takeVerse` honors only `words`. | After a correct ending, call the lift path when `carry` is also listed. Do not commit at the dialog. |
| Lectern per place | `carry` outside `south-road` has nowhere to file. | `{ x, z }` on the place, or on the chapter. The camp value stays (-8, -6). |
| Witness companion per place | Camp assumes a rig named `joel`. A new scene may not have him. | A rig name, plus the existing `guideFollows` flag. Reset it in `beginChapter`, as now. |
| Owned-verse record | Verse 31's owner, the 30-coin price, and the jar trade are special cases in `talkTobias`. | `{ verseId, owner, price?, tradeItem? }`. `commitVerse` already re-checks shut rules, so a purchase during a shut hour stays refused. |
| Seal and offer copy | The valley seal paragraph is a special case. Camp uses one sentence. | A string per chapter key, with a default that names the next chapter when its place matches. |
| Hint ladders | Only Miriam has rungs, and only for valley placements. Camp chapters never set `rumored`. | Optional lines per chapter: area hint, landmark hint, compass hint. Joel's rule blurb can stay generated from `rules`. |
| Quiz decoys from the same chapter | The third choice, and often the second, is a Genesis 1 sentence. It is the wrong test for a genealogy or a blessing. | Tails drawn from other verses in `chapterTexts(chapter)`. Keep the rotation by `verse % 3`. |
| Book completion | The Codex book numerator is fixed at 0. Sealing `genesis.50` does not record a finished book. | Derive it: a book is complete when every chapter key from 1 to that book's chapter count is in `sealedChapters`. Genesis's count is 50. No new save field. |
| Road gate as a seal list | `sealed` duplicates "genesis.1 is sealed." | Open a road when `sealedChapters` contains a key. The valley's south road watches `genesis.1`. |

No save migration is required for the rules as written. `collected`, `carried`, and `sealedChapters` already store the progress the rules read. A new owned-verse record is content data, not a save field: paying still adds a verse id.

## Open questions

1. **Hour on the whole chapter.** Genesis 3 gates all 24 verses because verse 8 is the cool of the day. Should a later chapter be able to put `hour` on one verse only? That needs something like `Placement.hour` or a verse-rule override. Until it exists, the window is chapter-wide.
2. **The word "even".** The hour signal matches `\beven\b`. In this text "even" often means "also," not dusk. Should the pattern be `evening` only, plus `at even`? Changing it will move rows in the table above.
3. **`words` together with `carry`.** This design says a correct ending lifts the verse into the arms, and the lectern collects it. Confirm that before the implementation changes `takeVerse`. The chapters are 12, 27, and 42.
4. **Quiz decoys.** Should wrong endings be other lines from the same chapter? The current third choice is always a Genesis 1 sentence.
5. **Passing the time.** An evening or night chapter can ask the Seeker to wait most of a 20-minute day, and the campfire does not offer rest. Should Joel, or the fire, advance the clock? There is no such verb today.
6. **Scenes still to come.** The scene todos build real ground for later chapters. Should those chapters keep the compiled rules in this table, or should each new scene be a hand entry that may ignore the compiler?
7. **The end of Genesis.** Sealing chapter 50 fills 50/50 on the Genesis chapter bar and adds nothing to the book bar. What should the Seeker get: a finished-book mark, a road out of the patriarchal map, a quiet Codex entry, or only the seal dialog that already exists?
8. **Who counts as a witness.** Any person within 1.52 qualifies, including the watchman. At camp that is only Joel, and only after he agrees to follow. Should a witness have to be a willing companion everywhere, or is "anyone standing here" the rule even in a crowded scene?
9. **Revisiting a sealed chapter.** Returning to the valley while chapter 2 is active lays no Genesis 1 tablets. The words live in the Codex. Should a sealed chapter's lights ever come back, or is the Codex the only rereading?
10. **`order` as filler only.** With the current text, chapters 7–50 never roll `order`, because each one signals enough rules to fill its slots. Should order stay a fallback, or should the curriculum keep using it on purpose past chapter 2?
