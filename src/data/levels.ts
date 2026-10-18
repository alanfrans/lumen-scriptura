/** A playable stretch of the world, and where it sits on the ancient Near East map. */
export interface LevelPlace {
  id: string;
  /** Shown on the opening map. */
  name: string;
  /** A short geographic name, in the language of the map. */
  place: string;
  /**
   * Pin position as fractions of the map image.
   * Origin is the top-left corner.
   */
  mapX: number;
  mapY: number;
}

/**
 * Genesis 1 opens in the hill country just west of the Jordan,
 * the valley this first level is built in.
 */
export const LEVELS: readonly LevelPlace[] = [
  {
    id: "genesis-1",
    name: "Genesis 1",
    place: "West of the Jordan",
    mapX: 0.318,
    mapY: 0.58,
  },
];

export const CURRENT_LEVEL: LevelPlace = LEVELS[0];
