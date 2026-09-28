# RTP (base + free spins)

Natural spin only: one paid `bet`, then the whole free-spin sequence if it triggered. Buy bonus (100×) is **not** calibrated.

```bash
nvm use
npm run rtp -- --spins 1000000 --seed 1
```

## Claimed numbers

| | |
|---|---|
| Simulator | `SlotEngine` via `src/mock/rtp.ts` |
| Rounds | 5,000,000 |
| Seed | 1 |
| Bet | 1 |
| **RTP** | **96.35%** |
| Base | 70.08% |
| Free spins | 26.28% |
| Hit rate (paid spin, win > 0) | 23.79% |
| FS frequency | 1 / 272 |
| Expand (paid spin) | 6.24% |
| Mystery (paid spin) | 13.63% |
| Max session in this run | 6 233× |
| Cap hits (25 000×) | 0 |

Smoke test: 20k rounds, RTP must stay in 0.70–1.40 (`src/mock/engine.test.ts`).

## Knobs used

1. **Strips** — fewer wild / mystery / premium; extra wild + scatter on the center reel.
2. **Wild multipliers** — weights `70 / 22 / 7 / 1` for ×2 / ×3 / ×5 / ×10.
3. **Expand** — `EXPAND_CHANCE = 0.37` (debug `expand` still always expands).
4. **Mystery** — weighted toward 10–A, not fox.
5. **Paytable** — 3oak carries most of the base RTP; 5oak left punchy.
6. **FS length** — still 8 / 10 / 12. Longer bonuses snowball sticky wilds faster than linearly.
7. **Line multiplier cap** — product of wild multipliers on a line is limited to `MAX_LINE_MULT` (20).
8. **Sticky in FS** — only the wild **cells** that landed (after mystery, before expand) persist. Expanded copies pay on that spin, then drop.

Baseline before this pass was thousands of percent RTP: expand always fired, expanded reels stuck in FS, and 10× stacked without a cap.
