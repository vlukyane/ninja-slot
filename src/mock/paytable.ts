import type { Paytable } from "../api/types";
import type { SymbolId } from "../config/game";

/** Multipliers of total bet for 3 / 4 / 5 of a kind. */
export const PAYTABLE: Paytable = {
  ten: { 3: 0.42, 4: 0.75, 5: 1.2 },
  jack: { 3: 0.48, 4: 0.95, 5: 1.6 },
  queen: { 3: 0.56, 4: 1.15, 5: 2 },
  king: { 3: 0.66, 4: 1.45, 5: 2.5 },
  ace: { 3: 0.85, 4: 1.9, 5: 3.5 },
  shuriken: { 3: 1.15, 4: 2.35, 5: 5 },
  scroll: { 3: 1.34, 4: 2.9, 5: 6 },
  lantern: { 3: 1.7, 4: 3.7, 5: 8 },
  mask: { 3: 2.08, 4: 4.7, 5: 10 },
  katana: { 3: 2.88, 4: 7.5, 5: 18 },
  fox: { 3: 3.38, 4: 9.5, 5: 25 },
  wild: { 3: 5.75, 4: 15.5, 5: 50 },
  scatter: {},
  mystery: {},
};

export function payoutFor(symbol: SymbolId, count: number, bet: number, multiplier: number): number {
  if (count < 3 || count > 5) return 0;
  const row = PAYTABLE[symbol];
  const x = row[count as 3 | 4 | 5] ?? 0;
  return roundMoney(x * bet * multiplier);
}

export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}
