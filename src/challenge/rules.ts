/** How close the player must be to take a verse. Same reach the valley already uses. */
export const NEAR_REACH = 1.8;
/** A person other than the player must be this close for a witness verse. */
export const WITNESS_REACH = 1.52;
/** Inside this distance, the nearest shut rule is the prompt. */
export const PROMPT_REACH = 8;
/** Standing on a verse someone else owns. Farther than a take, so the tent reads as theirs. */
export const OWNED_NOTICE_REACH = 3;
export const CARRY_LIMIT = 3;
/** Wrong ending, or arms already full: every tablet stays quiet this long. */
export const QUIET_SECONDS = 2.5;
/** How fast a companion catches up, and how far short of the Seeker they stop. */
export const COMPANION_SPEED = 3.2;
export const COMPANION_STAND = 1.05;

export const RULES = ["near", "order", "hour", "witness", "words", "carry"] as const;
export type RuleId = (typeof RULES)[number];

export function isRule(id: string): id is RuleId {
  return (RULES as readonly string[]).includes(id);
}

export interface HourWindow {
  /** Day clock, 0 and 1 at midnight. If `from` is later than `to`, the window wraps past midnight. */
  from: number;
  to: number;
  label: string;
}

/** The windows the compiler and the hand-authored chapters share. */
export const HOUR_MORNING: HourWindow = { from: 0.25, to: 0.55, label: "morning" };
export const HOUR_EVENING: HourWindow = { from: 0.65, to: 0.2, label: "evening" };
export const HOUR_NIGHT: HourWindow = { from: 0.75, to: 0.28, label: "night" };

export interface RuleQuery {
  verse: number;
  distance: number;
  has: (verse: number) => boolean;
  /** 0–1, noon at 0.5. */
  day: number;
  /** Distance to the nearest person who is not the player. */
  witness: number;
  hour?: HourWindow;
}

function hourOpen(day: number, hour: HourWindow): boolean {
  if (hour.from <= hour.to) return day >= hour.from && day < hour.to;
  return day >= hour.from || day < hour.to;
}

function blocked(rule: RuleId, query: RuleQuery): string | null {
  if (rule === "near") return query.distance <= NEAR_REACH ? null : "Step closer.";
  if (rule === "order") {
    if (query.verse <= 1 || query.has(query.verse - 1)) return null;
    return `Verse ${query.verse - 1} comes first.`;
  }
  if (rule === "hour") {
    if (!query.hour || hourOpen(query.day, query.hour)) return null;
    return `This verse opens in the ${query.hour.label}.`;
  }
  if (rule === "witness") {
    return query.witness <= WITNESS_REACH ? null : "Someone must stand here with you.";
  }
  // `words` and `carry` are actions in the engine, not refusals. A listed one agrees here.
  return null;
}

/** The first rule that refuses this verse, or null when every rule agrees. */
export function blockReason(rules: readonly RuleId[], query: RuleQuery): string | null {
  for (const rule of rules) {
    const reason = blocked(rule, query);
    if (reason) return reason;
  }
  return null;
}

/**
 * A reason to keep the column shut even if someone is standing on the verse.
 * Walking closer, finishing the line, and carrying it home are not these:
 * the light still answers those.
 */
export function holdsShut(rules: readonly RuleId[], query: RuleQuery): string | null {
  return blockReason(
    rules.filter((rule) => rule !== "near" && rule !== "words" && rule !== "carry"),
    query,
  );
}
