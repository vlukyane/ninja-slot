import { describe, expect, it } from "vitest";
import { COLS, FS_AWARD, MAX_LINE_MULT, MAX_WIN_X, ROWS, STARTING_BALANCE } from "../config/game";
import { SlotEngine } from "./engine";
import { cloneGrid, countSymbol, evaluateLines, emptyMults, sumWins } from "./evaluate";
import { PAYLINES } from "./paylines";
import { payoutFor } from "./paytable";
import { createRng } from "./rng";
import { simulateRtp } from "./rtp";
import { STRIPS } from "./strips";

describe("paylines", () => {
  it("has 20 lines of 5 rows", () => {
    expect(PAYLINES).toHaveLength(20);
    for (const line of PAYLINES) {
      expect(line).toHaveLength(5);
      for (const row of line) expect(row).toBeGreaterThanOrEqual(0);
      for (const row of line) expect(row).toBeLessThan(ROWS);
    }
  });
});

describe("strips", () => {
  it("covers all 5 reels", () => {
    expect(STRIPS).toHaveLength(COLS);
    for (const s of STRIPS) expect(s.length).toBeGreaterThan(20);
  });
});

describe("evaluateLines", () => {
  it("pays 5 foxes on the middle line", () => {
    const grid = [
      ["ten", "fox", "ace"],
      ["jack", "fox", "king"],
      ["queen", "fox", "mask"],
      ["katana", "fox", "scroll"],
      ["shuriken", "fox", "lantern"],
    ] as const;
    const wins = evaluateLines(grid.map((c) => c.slice()), emptyMults(), 1);
    const mid = wins.find((w) => w.lineIndex === 0);
    expect(mid?.symbol).toBe("fox");
    expect(mid?.count).toBe(5);
    expect(mid?.payout).toBe(payoutFor("fox", 5, 1, 1));
  });

  it("lets wild substitute and multiplies line win", () => {
    const grid = [
      ["fox", "ten", "ace"],
      ["wild", "jack", "king"],
      ["fox", "queen", "mask"],
      ["katana", "scroll", "lantern"],
      ["shuriken", "fox", "ten"],
    ] as const;
    const mults = emptyMults();
    mults[1]![0] = 3;
    const wins = evaluateLines(
      grid.map((c) => c.slice()),
      mults,
      2,
    );
    const top = wins.find((w) => w.lineIndex === 1);
    expect(top?.symbol).toBe("fox");
    expect(top?.count).toBe(3);
    expect(top?.multiplier).toBe(3);
    expect(top?.payout).toBe(payoutFor("fox", 3, 2, 3));
  });

  it("does not pay scatter as a line symbol", () => {
    const grid = [
      ["scatter", "fox", "fox"],
      ["scatter", "fox", "fox"],
      ["scatter", "fox", "fox"],
      ["fox", "fox", "fox"],
      ["fox", "fox", "fox"],
    ] as const;
    const wins = evaluateLines(grid.map((c) => c.slice()), emptyMults(), 1);
    expect(wins.every((w) => w.symbol !== "scatter")).toBe(true);
  });

  it("products two wild multipliers on the same line", () => {
    const grid = [
      ["wild", "ten", "ace"],
      ["wild", "jack", "king"],
      ["fox", "queen", "mask"],
      ["katana", "scroll", "lantern"],
      ["shuriken", "fox", "ten"],
    ] as const;
    const mults = emptyMults();
    mults[0]![0] = 2;
    mults[1]![0] = 5;
    const wins = evaluateLines(
      grid.map((c) => c.slice()),
      mults,
      1,
    );
    const top = wins.find((w) => w.lineIndex === 1);
    expect(top?.multiplier).toBe(10);
    expect(top?.payout).toBe(payoutFor("fox", 3, 1, 10));
  });

  it("caps the product of wild multipliers", () => {
    const grid = [
      ["wild", "ten", "ace"],
      ["wild", "jack", "king"],
      ["wild", "queen", "mask"],
      ["fox", "scroll", "lantern"],
      ["shuriken", "fox", "ten"],
    ] as const;
    const mults = emptyMults();
    mults[0]![0] = 10;
    mults[1]![0] = 10;
    mults[2]![0] = 10;
    const wins = evaluateLines(
      grid.map((c) => c.slice()),
      mults,
      1,
    );
    const top = wins.find((w) => w.lineIndex === 1);
    expect(top?.multiplier).toBe(20);
    expect(top?.payout).toBe(payoutFor("fox", 4, 1, 20));
  });
});

describe("SlotEngine", () => {
  it("deducts bet and credits win on a forced line", () => {
    const engine = new SlotEngine(100, createRng(1));
    const res = engine.play({ bet: 1, debugForce: "win" });
    expect(res.totalWin).toBeGreaterThan(0);
    expect(res.balance).toBe(round2(100 - 1 + res.totalWin));
    expect(res.landGrid[0]![0]).toBe("fox");
  });

  it("reveals all mystery cells to the same paying symbol", () => {
    const engine = new SlotEngine(100, createRng(7));
    const res = engine.play({ bet: 1, debugForce: "mystery" });
    const ev = res.events.find((e) => e.type === "mysteryReveal");
    expect(ev?.type).toBe("mysteryReveal");
    if (ev?.type !== "mysteryReveal") return;
    expect(ev.positions.length).toBeGreaterThanOrEqual(3);
    for (const p of ev.positions) {
      expect(res.grid[p.reel]![p.row]).toBe(ev.revealed);
      expect(res.landGrid[p.reel]![p.row]).toBe("mystery");
    }
    expect(res.landMultipliers).toHaveLength(5);
  });

  it("expands a wild to the full reel except scatter", () => {
    const engine = new SlotEngine(100, createRng(3));
    const res = engine.play({ bet: 1, debugForce: "expand" });
    const ev = res.events.find((e) => e.type === "expand");
    expect(ev?.type).toBe("expand");
    if (ev?.type !== "expand") return;
    expect(ev.reel).toBe(2);
    for (let row = 0; row < ROWS; row++) {
      if (res.grid[2]![row] !== "scatter") expect(res.grid[2]![row]).toBe("wild");
    }
    expect(res.landGrid[2]![1]).toBe("wild");
  });

  it("triggers free spins from 3 scatters and does not deduct during FS", () => {
    const engine = new SlotEngine(500, createRng(9));
    const trigger = engine.play({ bet: 2, debugForce: "scatter" });
    const fsEv = trigger.events.find((e) => e.type === "fsTrigger");
    expect(fsEv?.type).toBe("fsTrigger");
    if (fsEv?.type !== "fsTrigger") return;
    expect(fsEv.spins).toBe(FS_AWARD[Math.min(5, Math.max(3, fsEv.scatters)) as 3 | 4 | 5]);
    expect(trigger.freeSpins?.remaining).toBe(fsEv.spins);
    const after = trigger.balance;
    const fsSpin = engine.play({ bet: 2 });
    expect(engine.balance).toBe(round2(after + fsSpin.totalWin));
    expect(fsSpin.freeSpins === null || fsSpin.freeSpins.remaining < fsEv.spins).toBe(true);
  });

  it("buy bonus costs 100x and starts free spins", () => {
    const engine = new SlotEngine(STARTING_BALANCE, createRng(2));
    const res = engine.play({ bet: 1, buyBonus: true });
    expect(res.buyBonus).toBe(true);
    expect(res.events.some((e) => e.type === "fsTrigger")).toBe(true);
    expect(res.balance).toBe(round2(STARTING_BALANCE - 100 + res.totalWin));
    expect(countSymbol(res.landGrid, "scatter")).toBeGreaterThanOrEqual(3);
  });

  it("keeps a full-screen wild board at the line-mult cap and under max win", () => {
    const wins = evaluateLines(
      [
        ["wild", "wild", "wild"],
        ["wild", "wild", "wild"],
        ["wild", "wild", "wild"],
        ["wild", "wild", "wild"],
        ["wild", "wild", "wild"],
      ],
      [
        [10, 10, 10],
        [10, 10, 10],
        [10, 10, 10],
        [10, 10, 10],
        [10, 10, 10],
      ],
      1,
    );
    expect(sumWins(wins)).toBe(round2(payoutFor("wild", 5, 1, MAX_LINE_MULT) * 20));
    expect(sumWins(wins)).toBeLessThanOrEqual(MAX_WIN_X);
    const engine = new SlotEngine(1_000_000, () => 0);
    const res = engine.play({ bet: 1, debugForce: "win" });
    expect(res.totalWin).toBeLessThanOrEqual(MAX_WIN_X);
  });

  it("sticky wilds persist onto the next free-spin land grid", () => {
    const engine = new SlotEngine(1000, createRng(11));
    engine.play({ bet: 1, debugForce: "scatter" });
    engine.freeSpins = {
      remaining: 5,
      totalAwarded: 8,
      stickyWilds: [{ reel: 0, row: 0, multiplier: 2 }],
    };
    const res = engine.play({ bet: 1 });
    expect(res.landGrid[0]![0]).toBe("wild");
    expect(res.events.some((e) => e.type === "sticky")).toBe(true);
  });

  it("cloneGrid is a deep copy", () => {
    const g = [
      ["ace", "ten", "jack"],
      ["ace", "ten", "jack"],
      ["ace", "ten", "jack"],
      ["ace", "ten", "jack"],
      ["ace", "ten", "jack"],
    ] as const;
    const c = cloneGrid(g.map((x) => x.slice()));
    c[0]![0] = "fox";
    expect(g[0][0]).toBe("ace");
  });

  it("throws on insufficient balance", () => {
    const engine = new SlotEngine(10, createRng(1));
    expect(() => engine.play({ bet: 1, buyBonus: true })).toThrow("INSUFFICIENT_BALANCE");
  });

  it("smoke RTP on 20k natural rounds stays in a wide band", () => {
    const stats = simulateRtp(20_000, 7);
    const rtp = stats.paid / stats.wagered;
    expect(rtp).toBeGreaterThan(0.7);
    expect(rtp).toBeLessThan(1.4);
    expect(stats.hits).toBeGreaterThan(0);
  });
});

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
