export const GAME_NAME = "Kitsune Blade";
export const COLS = 5;
export const ROWS = 3;
export const MAX_WIN_X = 25_000;
export const BUY_BONUS_X = 100;
export const STARTING_BALANCE = 10_000;
export const STORAGE_KEY = "kitsune-blade-balance";

export const BET_STEPS = [0.2, 0.4, 0.6, 0.8, 1, 1.2, 1.6, 2, 4, 8, 10, 20, 50, 100];
export const DEFAULT_BET = 1;

export const FS_AWARD: Record<3 | 4 | 5, number> = { 3: 8, 4: 10, 5: 12 };
export const FS_RETRIGGER = 4;
/** Product of wild multipliers on a line cannot exceed this. */
export const MAX_LINE_MULT = 20;

export const CELL = 156;
export const REEL_GAP = 12;
export const SYMBOL_PAD = 6;

export const PAYING_SYMBOLS = [
  "ten",
  "jack",
  "queen",
  "king",
  "ace",
  "shuriken",
  "scroll",
  "lantern",
  "mask",
  "katana",
  "fox",
] as const;

export const ALL_SYMBOLS = [...PAYING_SYMBOLS, "wild", "scatter", "mystery"] as const;

export type PayingSymbol = (typeof PAYING_SYMBOLS)[number];
export type SymbolId = (typeof ALL_SYMBOLS)[number];

export const SYMBOL_LABELS: Record<SymbolId, string> = {
  ten: "10",
  jack: "J",
  queen: "Q",
  king: "K",
  ace: "A",
  shuriken: "сюрикен",
  scroll: "свиток",
  lantern: "фонарь",
  mask: "маска",
  katana: "катана",
  fox: "лиса",
  wild: "WILD",
  scatter: "SCATTER",
  mystery: "?",
};

export const SPEED = {
  normal: { minSpinMs: 920, staggerMs: 170, landMs: 420 },
  turbo: { minSpinMs: 200, staggerMs: 50, landMs: 160 },
};

export const MOCK_DELAY_MS = [150, 400] as const;
