import type { DebugForce, FreeSpinsState } from "../api/types";
import { DEFAULT_BET } from "../config/game";

export type Phase = "idle" | "requesting" | "spinning" | "features" | "winShow";

export class GameStore {
  phase: Phase = "idle";
  balance = 0;
  bet = DEFAULT_BET;
  betSteps: number[] = [];
  turbo = false;
  autoLeft = 0;
  lastWin = 0;
  fsSessionWin = 0;
  freeSpins: FreeSpinsState | null = null;
  muted = false;
  debugForce: DebugForce | undefined;
  error: string | null = null;
  skipRequested = false;
  sessionId = "";
  lossStreak = 0;
  lastWinX = 0;
  lastWildMax = 1;
  lowBalanceWarned = false;

  private listeners = new Set<() => void>();

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  notify(): void {
    for (const fn of this.listeners) fn();
  }

  get busy(): boolean {
    return this.phase !== "idle";
  }

  get inFreeSpins(): boolean {
    return this.freeSpins !== null && this.freeSpins.remaining > 0;
  }

  get buyCost(): number {
    return this.bet * 100;
  }

  canAfford(cost: number): boolean {
    return this.balance + 1e-9 >= cost;
  }
}
