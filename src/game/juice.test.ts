import { describe, expect, it } from "vitest";
import { maxWildMult, scatterAnticipation, tierHoldMs, winTier } from "./juice";
import type { Grid } from "../api/types";

const empty = (): Grid => [
  ["ten", "jack", "queen"],
  ["king", "ace", "mask"],
  ["fox", "katana", "lantern"],
  ["scroll", "shuriken", "ten"],
  ["jack", "queen", "king"],
];

describe("scatterAnticipation", () => {
  it("triggers when scatters land on the first two reels", () => {
    const grid = empty();
    grid[0]![1] = "scatter";
    grid[1]![0] = "scatter";
    expect(scatterAnticipation(grid)).toBe(true);
  });

  it("triggers when two of the first three reels have scatter", () => {
    const grid = empty();
    grid[0]![2] = "scatter";
    grid[2]![1] = "scatter";
    expect(scatterAnticipation(grid)).toBe(true);
  });

  it("stays quiet on a single early scatter", () => {
    const grid = empty();
    grid[0]![0] = "scatter";
    expect(scatterAnticipation(grid)).toBe(false);
  });
});

describe("winTier", () => {
  it("splits win / nice / mega at 5x and 20x", () => {
    expect(winTier(0)).toBe("none");
    expect(winTier(4.9)).toBe("win");
    expect(winTier(5)).toBe("nice");
    expect(winTier(19.9)).toBe("nice");
    expect(winTier(20)).toBe("mega");
  });
});

describe("tierHoldMs", () => {
  it("holds mega longest and turbo shortest", () => {
    expect(tierHoldMs("mega", false)).toBeGreaterThan(tierHoldMs("nice", false));
    expect(tierHoldMs("win", true)).toBeLessThan(tierHoldMs("win", false));
  });
});

describe("maxWildMult", () => {
  it("reads the peak cell multiplier", () => {
    expect(
      maxWildMult([
        [1, 2, 1],
        [1, 1, 10],
        [3, 1, 1],
      ]),
    ).toBe(10);
  });
});
