/** Browser controls and server validation share choices, not trust. */
export const MAX_FILTER_IDS = 20;
export const GENRE_MODES = ["any", "all"] as const;
export const RUNTIME_OPTIONS = [
  ["", "Any length"],
  ["short", "90 minutes or less"],
  ["medium", "91–120 minutes"],
  ["long", "121–180 minutes"],
  ["epic", "Over 3 hours"],
] as const;
export const RUNTIME_RANGES: Record<string, readonly [number, number?]> = {
  short: [1, 90],
  medium: [91, 120],
  long: [121, 180],
  epic: [181],
};
export const YEAR_OPTIONS = [
  ["", "Any decade"],
  ["2020", "2020s"],
  ["2010", "2010s"],
  ["2000", "2000s"],
  ["1990", "1990s"],
  ["classic", "Before 1990"],
] as const;
export const RATING_OPTIONS = [
  ["", "Any rating"],
  ["6", "6+ / 10"],
  ["7", "7+ / 10"],
  ["8", "8+ / 10"],
] as const;
export const RUNTIME_VALUES = RUNTIME_OPTIONS.map(([value]) => value);
export const YEAR_VALUES = YEAR_OPTIONS.map(([value]) => value);
export const RATING_VALUES = RATING_OPTIONS.map(([value]) => value);
