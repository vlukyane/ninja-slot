import type { SymbolId } from "../config/game";

export type Grid = SymbolId[][];

export type CellPos = { reel: number; row: number };

export type PlayRequest = {
  bet: number;
  buyBonus?: boolean;
  debugForce?: DebugForce;
};

export type DebugForce = "win" | "scatter" | "expand" | "mystery" | "buy";

export type LineWin = {
  lineIndex: number;
  symbol: SymbolId;
  count: number;
  positions: CellPos[];
  payout: number;
  multiplier: number;
};

export type MysteryRevealEvent = {
  type: "mysteryReveal";
  positions: CellPos[];
  revealed: SymbolId;
};

export type ExpandEvent = {
  type: "expand";
  reel: number;
  multiplier: number;
};

export type StickyEvent = {
  type: "sticky";
  positions: Array<CellPos & { multiplier: number }>;
};

export type FsTriggerEvent = {
  type: "fsTrigger";
  spins: number;
  scatters: number;
};

export type FsRetriggerEvent = {
  type: "fsRetrigger";
  extra: number;
};

export type GameEvent =
  | MysteryRevealEvent
  | ExpandEvent
  | StickyEvent
  | FsTriggerEvent
  | FsRetriggerEvent;

export type StickyWild = CellPos & { multiplier: number };

export type FreeSpinsState = {
  remaining: number;
  totalAwarded: number;
  stickyWilds: StickyWild[];
};

export type PlayResponse = {
  landGrid: Grid;
  grid: Grid;
  landMultipliers: number[][];
  multipliers: number[][];
  events: GameEvent[];
  lineWins: LineWin[];
  totalWin: number;
  balance: number;
  bet: number;
  freeSpins: FreeSpinsState | null;
  buyBonus: boolean;
};

export type Paytable = Record<SymbolId, Partial<Record<3 | 4 | 5, number>>>;

export type InitResponse = {
  balance: number;
  betSteps: number[];
  defaultBet: number;
  paytable: Paytable;
  sessionId: string;
  gameName: string;
};

export interface GameClient {
  init(): Promise<InitResponse>;
  play(req: PlayRequest): Promise<PlayResponse>;
}
