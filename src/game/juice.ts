import type { Grid } from "../api/types";

export type WinTier = "none" | "win" | "nice" | "mega";

export function scatterAnticipation(grid: Grid): boolean {
  const has = (reel: number): boolean => (grid[reel] ?? []).includes("scatter");
  if (has(0) && has(1)) return true;
  const early = [0, 1, 2].filter((r) => has(r)).length;
  return early >= 2;
}

export function winTier(xBet: number): WinTier {
  if (xBet <= 0) return "none";
  if (xBet >= 20) return "mega";
  if (xBet >= 5) return "nice";
  return "win";
}

export function tierHoldMs(tier: WinTier, turbo: boolean): number {
  if (tier === "none") return 0;
  if (turbo) return tier === "mega" ? 900 : 420;
  if (tier === "mega") return 4800;
  if (tier === "nice") return 2400;
  return 1500;
}

export function maxWildMult(multipliers: number[][]): number {
  let m = 1;
  for (const col of multipliers) for (const v of col) if (v > m) m = v;
  return m;
}

export function animateCountUp(
  el: HTMLElement,
  target: number,
  durationMs: number,
  format: (n: number) => string,
  shouldAbort?: () => boolean,
): Promise<void> {
  if (durationMs <= 0 || shouldAbort?.()) {
    el.textContent = format(target);
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const start = performance.now();
    const tick = (now: number): void => {
      if (shouldAbort?.()) {
        el.textContent = format(target);
        resolve();
        return;
      }
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - (1 - t) ** 3;
      el.textContent = format(target * eased);
      if (t < 1) requestAnimationFrame(tick);
      else {
        el.textContent = format(target);
        resolve();
      }
    };
    requestAnimationFrame(tick);
  });
}
