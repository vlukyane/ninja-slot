import type { CellPos, Grid, LineWin } from "../api/types";
import { COLS, MAX_LINE_MULT, ROWS, type SymbolId } from "../config/game";
import { PAYLINES } from "./paylines";
import { payoutFor, roundMoney } from "./paytable";

export function cloneGrid(grid: Grid): Grid {
  return grid.map((col) => col.slice());
}

export function emptyMults(): number[][] {
  return Array.from({ length: COLS }, () => Array.from({ length: ROWS }, () => 1));
}

export function cloneMults(m: number[][]): number[][] {
  return m.map((col) => col.slice());
}

export function countSymbol(grid: Grid, id: SymbolId): number {
  let n = 0;
  for (let r = 0; r < COLS; r++) {
    for (let row = 0; row < ROWS; row++) {
      if (grid[r]![row] === id) n++;
    }
  }
  return n;
}

export function findSymbol(grid: Grid, id: SymbolId): CellPos[] {
  const out: CellPos[] = [];
  for (let reel = 0; reel < COLS; reel++) {
    for (let row = 0; row < ROWS; row++) {
      if (grid[reel]![row] === id) out.push({ reel, row });
    }
  }
  return out;
}

export function evaluateLines(grid: Grid, multipliers: number[][], bet: number): LineWin[] {
  const wins: LineWin[] = [];
  for (let lineIndex = 0; lineIndex < PAYLINES.length; lineIndex++) {
    const win = evalLine(grid, multipliers, PAYLINES[lineIndex]!, lineIndex, bet);
    if (win) wins.push(win);
  }
  return wins;
}

function evalLine(
  grid: Grid,
  multipliers: number[][],
  line: number[],
  lineIndex: number,
  bet: number,
): LineWin | null {
  const cells: Array<CellPos & { sym: SymbolId; mult: number }> = line.map((row, reel) => ({
    reel,
    row,
    sym: grid[reel]![row]!,
    mult: multipliers[reel]![row] ?? 1,
  }));

  if (cells[0]!.sym === "scatter" || cells[0]!.sym === "mystery") return null;

  let paySym: SymbolId | null = cells[0]!.sym === "wild" ? null : cells[0]!.sym;
  let count = 0;
  let lineMult = 1;
  const positions: CellPos[] = [];

  for (const c of cells) {
    if (c.sym === "scatter" || c.sym === "mystery") break;
    if (c.sym === "wild") {
      count++;
      positions.push({ reel: c.reel, row: c.row });
      if (c.mult > 1) lineMult *= c.mult;
      continue;
    }
    if (paySym === null) {
      paySym = c.sym;
      count++;
      positions.push({ reel: c.reel, row: c.row });
      continue;
    }
    if (c.sym === paySym) {
      count++;
      positions.push({ reel: c.reel, row: c.row });
      continue;
    }
    break;
  }

  if (count < 3) return null;
  const symbol = paySym ?? "wild";
  const multiplier = Math.min(lineMult, MAX_LINE_MULT);
  const payout = payoutFor(symbol, count, bet, multiplier);
  if (payout <= 0) return null;
  return {
    lineIndex,
    symbol,
    count,
    positions,
    payout,
    multiplier,
  };
}

export function sumWins(wins: LineWin[]): number {
  return roundMoney(wins.reduce((s, w) => s + w.payout, 0));
}
