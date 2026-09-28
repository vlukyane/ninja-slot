import type { DebugForce, FreeSpinsState, GameEvent, Grid, PlayRequest, PlayResponse, StickyWild } from "../api/types";
import {
  BUY_BONUS_X,
  COLS,
  FS_AWARD,
  FS_RETRIGGER,
  MAX_WIN_X,
  PAYING_SYMBOLS,
  ROWS,
  type SymbolId,
} from "../config/game";
import { cloneGrid, cloneMults, countSymbol, emptyMults, evaluateLines, findSymbol, sumWins } from "./evaluate";
import { roundMoney } from "./paytable";
import { createRng, pickIndex, type Rng } from "./rng";
import { STRIPS, symbolAt } from "./strips";

export const WILD_MULTS = [2, 3, 5, 10] as const;
export const WILD_MULT_WEIGHTS = [70, 22, 7, 1];
/** Chance a landing wild expands to the full reel (except scatter). */
export const EXPAND_CHANCE = 0.37;
const MYSTERY_WEIGHTS = [20, 18, 15, 12, 10, 8, 6, 5, 4, 3, 2];

export class SlotEngine {
  balance: number;
  freeSpins: FreeSpinsState | null = null;
  rng: Rng;

  constructor(balance: number, rng: Rng = createRng()) {
    this.balance = balance;
    this.rng = rng;
  }

  play(req: PlayRequest): PlayResponse {
    const buyBonus = Boolean(req.buyBonus) || req.debugForce === "buy";
    const inFs = this.freeSpins !== null && this.freeSpins.remaining > 0;
    const cost = inFs ? 0 : buyBonus ? roundMoney(req.bet * BUY_BONUS_X) : req.bet;

    if (!inFs && this.balance + 1e-9 < cost) {
      throw new Error("INSUFFICIENT_BALANCE");
    }

    if (!inFs) this.balance = roundMoney(this.balance - cost);

    const landGrid = this.buildLandGrid(req.debugForce, buyBonus);
    const multipliers = emptyMults();

    if (inFs && this.freeSpins) {
      for (const s of this.freeSpins.stickyWilds) {
        landGrid[s.reel]![s.row] = "wild";
        multipliers[s.reel]![s.row] = s.multiplier;
      }
    }

    this.assignLandingWildMults(landGrid, multipliers);
    const landMultipliers = cloneMults(multipliers);

    const events: GameEvent[] = [];
    const grid = cloneGrid(landGrid);
    const workMults = cloneMults(multipliers);

    this.applyMystery(grid, events);
    const seedWilds = collectWilds(grid, workMults);
    this.applyExpand(grid, workMults, events, req.debugForce);

    const scatterCount = countSymbol(grid, "scatter");
    let lineWins = evaluateLines(grid, workMults, req.bet);
    let totalWin = sumWins(lineWins);
    const cap = roundMoney(req.bet * MAX_WIN_X);
    if (totalWin > cap) {
      const scale = cap / totalWin;
      totalWin = cap;
      lineWins = lineWins.map((w) => ({ ...w, payout: roundMoney(w.payout * scale) }));
    }

    this.balance = roundMoney(this.balance + totalWin);

    let freeSpins = this.freeSpins;

    if (!inFs && scatterCount >= 3) {
      const n = Math.min(5, Math.max(3, scatterCount)) as 3 | 4 | 5;
      const spins = FS_AWARD[n];
      const stickyWilds = seedWilds;
      freeSpins = { remaining: spins, totalAwarded: spins, stickyWilds };
      events.push({ type: "fsTrigger", spins, scatters: scatterCount });
      if (stickyWilds.length) events.push({ type: "sticky", positions: stickyWilds });
    } else if (inFs && freeSpins) {
      if (scatterCount >= 3) {
        freeSpins.remaining += FS_RETRIGGER;
        freeSpins.totalAwarded += FS_RETRIGGER;
        events.push({ type: "fsRetrigger", extra: FS_RETRIGGER });
      }
      const stickyWilds = seedWilds;
      freeSpins.stickyWilds = stickyWilds;
      freeSpins.remaining -= 1;
      events.push({ type: "sticky", positions: stickyWilds });
      if (freeSpins.remaining <= 0) freeSpins = null;
    }

    this.freeSpins = freeSpins;

    return {
      landGrid,
      grid,
      landMultipliers,
      multipliers: workMults,
      events,
      lineWins,
      totalWin,
      balance: this.balance,
      bet: req.bet,
      freeSpins,
      buyBonus,
    };
  }

  private buildLandGrid(force?: DebugForce, buyBonus = false): Grid {
    if (force === "win") return forceWinGrid();
    if (force === "mystery") return forceMysteryGrid();
    if (force === "expand") return forceExpandGrid();
    if (force === "scatter" || force === "buy" || buyBonus) return forceScatterGrid(this.rng);

    const grid: Grid = [];
    for (let reel = 0; reel < COLS; reel++) {
      const stop = Math.floor(this.rng() * STRIPS[reel]!.length);
      const col: SymbolId[] = [];
      for (let row = 0; row < ROWS; row++) col.push(symbolAt(reel, stop, row));
      grid.push(col);
    }
    return grid;
  }

  private assignLandingWildMults(grid: Grid, multipliers: number[][]): void {
    for (let reel = 0; reel < COLS; reel++) {
      for (let row = 0; row < ROWS; row++) {
        if (grid[reel]![row] === "wild" && (multipliers[reel]![row] ?? 1) <= 1) {
          multipliers[reel]![row] = WILD_MULTS[pickIndex(this.rng, WILD_MULT_WEIGHTS)]!;
        }
      }
    }
  }

  private applyMystery(grid: Grid, events: GameEvent[]): void {
    const positions = findSymbol(grid, "mystery");
    if (!positions.length) return;
    const revealed = PAYING_SYMBOLS[pickIndex(this.rng, MYSTERY_WEIGHTS)]!;
    for (const p of positions) grid[p.reel]![p.row] = revealed;
    events.push({ type: "mysteryReveal", positions, revealed });
  }

  private applyExpand(grid: Grid, multipliers: number[][], events: GameEvent[], force?: DebugForce): void {
    for (let reel = 0; reel < COLS; reel++) {
      let hasWild = false;
      let mult = 1;
      for (let row = 0; row < ROWS; row++) {
        if (grid[reel]![row] === "wild") {
          hasWild = true;
          mult = Math.max(mult, multipliers[reel]![row] ?? 1);
        }
      }
      if (!hasWild) continue;
      if (force !== "expand" && this.rng() >= EXPAND_CHANCE) continue;
      let changed = false;
      for (let row = 0; row < ROWS; row++) {
        if (grid[reel]![row] === "scatter") continue;
        if (grid[reel]![row] !== "wild") changed = true;
        grid[reel]![row] = "wild";
        multipliers[reel]![row] = mult;
      }
      if (changed) events.push({ type: "expand", reel, multiplier: mult });
    }
  }
}

function collectWilds(grid: Grid, multipliers: number[][]): StickyWild[] {
  const out: StickyWild[] = [];
  for (let reel = 0; reel < COLS; reel++) {
    for (let row = 0; row < ROWS; row++) {
      if (grid[reel]![row] === "wild") {
        out.push({ reel, row, multiplier: multipliers[reel]![row] ?? 2 });
      }
    }
  }
  return out;
}

function forceWinGrid(): Grid {
  return [
    ["fox", "ten", "jack"],
    ["fox", "ace", "queen"],
    ["fox", "mask", "king"],
    ["fox", "scroll", "lantern"],
    ["fox", "katana", "shuriken"],
  ];
}

function forceMysteryGrid(): Grid {
  return [
    ["mystery", "ace", "ten"],
    ["jack", "mystery", "queen"],
    ["king", "mask", "mystery"],
    ["scroll", "lantern", "katana"],
    ["shuriken", "fox", "ten"],
  ];
}

function forceExpandGrid(): Grid {
  return [
    ["ace", "ten", "jack"],
    ["queen", "king", "mask"],
    ["scroll", "wild", "lantern"],
    ["katana", "fox", "shuriken"],
    ["ten", "ace", "queen"],
  ];
}

function forceScatterGrid(rng: Rng): Grid {
  const grid: Grid = [
    ["scatter", "ace", "ten"],
    ["jack", "queen", "king"],
    ["scatter", "mask", "scroll"],
    ["lantern", "katana", "fox"],
    ["shuriken", "ten", "ace"],
  ];
  if (rng() < 0.35) grid[3]![1] = "scatter";
  if (rng() < 0.15) grid[1]![0] = "scatter";
  return grid;
}
