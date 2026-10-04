const KEY = "lumen-scriptura-save-v1";

export interface SaveState {
  collected: number[];
  rumored: number[];
  hintRungs: Record<number, number>;
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
}

export const STIPEND_PERIOD = 180;

export function freshState(): SaveState {
  return {
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
  };
}

export function loadState(): SaveState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...freshState(), ...(JSON.parse(raw) as Partial<SaveState>) };
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
}
