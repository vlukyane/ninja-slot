import type { GameClient, InitResponse, PlayRequest, PlayResponse } from "./types";
import {
  BET_STEPS,
  DEFAULT_BET,
  GAME_NAME,
  MOCK_DELAY_MS,
  STARTING_BALANCE,
  STORAGE_KEY,
} from "../config/game";
import { SlotEngine } from "../mock/engine";
import { PAYTABLE } from "../mock/paytable";
import { createRng } from "../mock/rng";

function loadBalance(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw == null) return STARTING_BALANCE;
    const n = Number(raw);
    return Number.isFinite(n) ? n : STARTING_BALANCE;
  } catch {
    return STARTING_BALANCE;
  }
}

function saveBalance(balance: number): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(balance));
  } catch {
    /* ignore */
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export class MockGameClient implements GameClient {
  private engine: SlotEngine | null = null;

  async init(): Promise<InitResponse> {
    const balance = loadBalance();
    this.engine = new SlotEngine(balance, createRng());
    return {
      balance,
      betSteps: BET_STEPS,
      defaultBet: DEFAULT_BET,
      paytable: PAYTABLE,
      sessionId: `mock-${Date.now().toString(36)}`,
      gameName: GAME_NAME,
    };
  }

  async play(req: PlayRequest): Promise<PlayResponse> {
    if (!this.engine) throw new Error("NOT_INITIALIZED");
    const [min, max] = MOCK_DELAY_MS;
    await sleep(min + Math.random() * (max - min));
    const res = this.engine.play(req);
    saveBalance(res.balance);
    return res;
  }
}
