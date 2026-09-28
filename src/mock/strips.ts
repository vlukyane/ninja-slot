import type { SymbolId } from "../config/game";

const W: Record<SymbolId, number> = {
  ten: 16,
  jack: 15,
  queen: 14,
  king: 13,
  ace: 11,
  shuriken: 8,
  scroll: 7,
  lantern: 6,
  mask: 4,
  katana: 3,
  fox: 2,
  wild: 1,
  scatter: 2,
  mystery: 1,
};

function buildStrip(extraWild = 0, extraScatter = 0): SymbolId[] {
  const strip: SymbolId[] = [];
  (Object.keys(W) as SymbolId[]).forEach((id) => {
    let n = W[id];
    if (id === "wild") n += extraWild;
    if (id === "scatter") n += extraScatter;
    for (let i = 0; i < n; i++) strip.push(id);
  });
  return shuffleDeterministic(strip, extraWild * 17 + extraScatter * 31 + strip.length);
}

function shuffleDeterministic(arr: SymbolId[], seed: number): SymbolId[] {
  const out = arr.slice();
  let s = seed >>> 0 || 1;
  for (let i = out.length - 1; i > 0; i--) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const j = s % (i + 1);
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return out;
}

export const STRIPS: SymbolId[][] = [
  buildStrip(0, 1),
  buildStrip(0, 0),
  buildStrip(1, 1),
  buildStrip(0, 0),
  buildStrip(0, 1),
];

export function symbolAt(reel: number, stop: number, row: number): SymbolId {
  const strip = STRIPS[reel]!;
  return strip[(stop + row + strip.length) % strip.length]!;
}
