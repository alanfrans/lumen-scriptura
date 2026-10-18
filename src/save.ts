import { BOOK_GENESIS, GENESIS_1_CHAPTER, PLACE_JORDAN_HILLS, verseId } from "./data/identity";

const KEY = "lumen-scriptura-save-v2";
const KEY_V1 = "lumen-scriptura-save-v1";

export interface SaveState {
  book: string;
  chapter: number;
  place: string;
  collected: string[];
  rumored: string[];
  hintRungs: Record<string, number>;
  doorHintRung: number;
  coin: number;
  stipendTimer: number;
  px: number;
  pz: number;
  horseX: number;
  horseZ: number;
  hasHorse: boolean;
  hasKey: boolean;
  keyTaken: boolean;
  hasJar: boolean;
  jarTaken: boolean;
  doorOpen: boolean;
  triedDoor: boolean;
  metMiriam: boolean;
  eliTalks: number;
  sealed: boolean;
  /** `genesis.1` once that chapter is in the codex. */
  sealedChapters: string[];
  /** Verse ids picked up but not yet set on the lectern. */
  carried: string[];
  /** Joel walks with the player. */
  guideFollows: boolean;
  /** Positions remembered when you leave a place. */
  placeAt: Record<string, { x: number; z: number }>;
  /** Whole days spent on the roads. */
  elapsedDays: number;
}

export const STIPEND_PERIOD = 180;

export function freshState(): SaveState {
  return {
    book: BOOK_GENESIS,
    chapter: GENESIS_1_CHAPTER,
    place: PLACE_JORDAN_HILLS,
    collected: [],
    rumored: [],
    hintRungs: {},
    doorHintRung: 0,
    coin: 10,
    stipendTimer: STIPEND_PERIOD,
    px: 0,
    pz: -64,
    horseX: 14,
    horseZ: 64,
    hasHorse: false,
    hasKey: false,
    keyTaken: false,
    hasJar: false,
    jarTaken: false,
    doorOpen: false,
    triedDoor: false,
    metMiriam: false,
    eliTalks: 0,
    sealed: false,
    sealedChapters: [],
    carried: [],
    guideFollows: false,
    placeAt: {},
    elapsedDays: 0,
  };
}

/** A verse number from a Genesis 1 save, or an id already in the new form. */
function asVerseId(value: unknown): string | null {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return verseId(BOOK_GENESIS, GENESIS_1_CHAPTER, value);
  }
  if (typeof value === "string" && /^[a-z][a-z0-9-]*\.\d+\.\d+$/.test(value)) return value;
  return null;
}

function asVerseIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const ids: string[] = [];
  for (const entry of value) {
    const id = asVerseId(entry);
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

function asHintRungs(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object") return {};
  const rungs: Record<string, number> = {};
  for (const [key, rung] of Object.entries(value as Record<string, unknown>)) {
    const id = asVerseId(/^\d+$/.test(key) ? Number(key) : key);
    if (id && typeof rung === "number" && Number.isFinite(rung)) rungs[id] = rung;
  }
  return rungs;
}

function asChapterKeys(value: unknown, sealed: unknown): string[] {
  const keys: string[] = [];
  if (Array.isArray(value)) {
    for (const entry of value) {
      if (typeof entry === "string" && /^[a-z][a-z0-9-]*\.\d+$/.test(entry) && !keys.includes(entry)) keys.push(entry);
    }
  }
  if (sealed === true && !keys.includes("genesis.1")) keys.unshift("genesis.1");
  return keys;
}

function asPlaceAt(value: unknown): Record<string, { x: number; z: number }> {
  if (!value || typeof value !== "object") return {};
  const at: Record<string, { x: number; z: number }> = {};
  for (const [id, spot] of Object.entries(value as Record<string, unknown>)) {
    if (!spot || typeof spot !== "object") continue;
    const point = spot as { x?: unknown; z?: unknown };
    if (typeof point.x === "number" && typeof point.z === "number") at[id] = { x: point.x, z: point.z };
  }
  return at;
}

function withProgress(base: SaveState, raw: Record<string, unknown>): SaveState {
  return {
    ...base,
    ...raw,
    book: typeof raw.book === "string" && raw.book ? raw.book : base.book,
    chapter: typeof raw.chapter === "number" && raw.chapter > 0 ? raw.chapter : base.chapter,
    place: typeof raw.place === "string" && raw.place ? raw.place : base.place,
    collected: asVerseIds(raw.collected),
    rumored: asVerseIds(raw.rumored),
    hintRungs: asHintRungs(raw.hintRungs),
    placeAt: asPlaceAt(raw.placeAt),
    elapsedDays: typeof raw.elapsedDays === "number" && raw.elapsedDays >= 0 ? raw.elapsedDays : 0,
    sealedChapters: asChapterKeys(raw.sealedChapters, raw.sealed),
    carried: asVerseIds(raw.carried),
    guideFollows: raw.guideFollows === true,
  };
}

export function loadState(): SaveState {
  try {
    const current = localStorage.getItem(KEY);
    if (current) return withProgress(freshState(), JSON.parse(current) as Record<string, unknown>);
    const previous = localStorage.getItem(KEY_V1);
    if (previous) {
      const migrated = withProgress(freshState(), JSON.parse(previous) as Record<string, unknown>);
      saveState(migrated);
      return migrated;
    }
  } catch {
    // Corrupt or unavailable storage falls back to a new game.
  }
  return freshState();
}

export function saveState(state: SaveState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Private mode or full storage: progress stays in memory for this session.
  }
}

export function clearState(): void {
  localStorage.removeItem(KEY);
  localStorage.removeItem(KEY_V1);
}
