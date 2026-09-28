import { MAX_WIN_X } from "../config/game";
import { SlotEngine } from "./engine";
import { createRng } from "./rng";

export type RtpStats = {
  rounds: number;
  seed: number;
  bet: number;
  wagered: number;
  paid: number;
  basePaid: number;
  fsPaid: number;
  hits: number;
  fsTriggers: number;
  expands: number;
  mysteries: number;
  capHits: number;
  elapsedMs: number;
  maxWin: number;
};

export function simulateRtp(rounds: number, seed = 1, bet = 1, onProgress?: (done: number, stats: RtpStats) => void): RtpStats {
  const engine = new SlotEngine(1e15, createRng(seed));
  const t0 = Date.now();
  const stats: RtpStats = {
    rounds,
    seed,
    bet,
    wagered: 0,
    paid: 0,
    basePaid: 0,
    fsPaid: 0,
    hits: 0,
    fsTriggers: 0,
    expands: 0,
    mysteries: 0,
    capHits: 0,
    elapsedMs: 0,
    maxWin: 0,
  };

  const cap = bet * MAX_WIN_X;

  for (let i = 0; i < rounds; i++) {
    const res = engine.play({ bet });
    stats.wagered += bet;
    stats.basePaid += res.totalWin;
    stats.paid += res.totalWin;
    if (res.totalWin > 0) stats.hits += 1;
    if (res.totalWin > stats.maxWin) stats.maxWin = res.totalWin;
    if (res.totalWin + 1e-9 >= cap) stats.capHits += 1;
    if (res.events.some((e) => e.type === "expand")) stats.expands += 1;
    if (res.events.some((e) => e.type === "mysteryReveal")) stats.mysteries += 1;

    const triggered = res.events.some((e) => e.type === "fsTrigger");
    if (triggered) stats.fsTriggers += 1;

    let session = res.totalWin;
    while (engine.freeSpins && engine.freeSpins.remaining > 0) {
      const fs = engine.play({ bet });
      stats.fsPaid += fs.totalWin;
      stats.paid += fs.totalWin;
      session += fs.totalWin;
      if (fs.totalWin > stats.maxWin) stats.maxWin = fs.totalWin;
      if (fs.totalWin + 1e-9 >= cap) stats.capHits += 1;
    }
    if (triggered) {
      if (session > stats.maxWin) stats.maxWin = session;
    }

    if (onProgress && (i + 1) % 50_000 === 0) {
      stats.elapsedMs = Date.now() - t0;
      onProgress(i + 1, stats);
    }
  }

  stats.elapsedMs = Date.now() - t0;
  return stats;
}

export function formatRtpReport(stats: RtpStats): string {
  const rtp = stats.paid / stats.wagered;
  const base = stats.basePaid / stats.wagered;
  const bonus = stats.fsPaid / stats.wagered;
  const hit = stats.hits / stats.rounds;
  const fs = stats.fsTriggers === 0 ? Infinity : stats.rounds / stats.fsTriggers;
  const lines = [
    `rounds ${stats.rounds.toLocaleString("en-US")}  seed ${stats.seed}  bet ${stats.bet}`,
    `RTP ${(rtp * 100).toFixed(3)}%  (base ${(base * 100).toFixed(2)}% + FS ${(bonus * 100).toFixed(2)}%)`,
    `hit rate ${(hit * 100).toFixed(2)}%  FS 1/${fs === Infinity ? "∞" : fs.toFixed(1)}`,
    `expand ${(100 * stats.expands / stats.rounds).toFixed(2)}%  mystery ${(100 * stats.mysteries / stats.rounds).toFixed(2)}%`,
    `max win ${stats.maxWin.toFixed(2)} (${(stats.maxWin / stats.bet).toFixed(1)}x)  cap hits ${stats.capHits}`,
    `avg FS session ${stats.fsTriggers ? (stats.fsPaid / stats.fsTriggers).toFixed(1) : "0"}x`,
    `elapsed ${(stats.elapsedMs / 1000).toFixed(2)}s`,
  ];
  return lines.join("\n");
}
