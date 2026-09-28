# Kitsune Blade

A small fox-and-steel slot you can run in the browser. Five reels, three rows, twenty paylines, and a free-spin bonus that actually feels like a bonus. There is no casino behind it: the “server” is a mock that lives in the same tab, and nothing you win can be paid out.

It borrows the *shape* of a modern ninja slot (wilds, scatters, expanding reels, sticky wilds, mystery symbols) and then goes its own way on name, art, sound, and math.

## How a spin feels

Press **SPIN** (or the space bar). The reels blur and travel as a real strip, then land one column at a time with a soft settle. Each stop has its own pitch. If scatters show up early, the last reels hesitate and a riser kicks in.

Wins draw a gold line through the payline and pulse the symbols that paid. Small hits say **WIN**, five times the bet says **BIG WIN**, twenty times says **MEGA**, and the number counts up instead of snapping into place. **TURBO** shortens all of that. Hitting spin again mid-animation skips straight to the result.

The panel underneath is the whole HUD: balance, bet chips, autoplay, a buy button that glows when you can afford it, and a wild-multiplier legend (`x2 x3 x5 x10`) that lights up whatever just landed. On a phone it folds into a three-column bar. `?debug=1` adds buttons that force a line win, scatters, an expand, a mystery reveal, or a bonus buy.

## What can actually pay

Wins read left to right on 20 fixed lines. The board is 10–A, then shuriken, scroll, lantern, mask, katana, and fox. Three specials sit on top of that:

- **Wild** stands in for any paying symbol and carries **x2, x3, x5, or x10**. Several wilds on one line multiply together, up to **x20**. About a third of the time a wild stretches to fill its reel (scatters stay put).
- **Mystery** symbols on a spin all flip into the *same* paying symbol. The reveal leans toward the cheap cards, so it is a tease more often than a fox.
- **Scatter** does not pay on a line. Three, four, or five of them award **8, 10, or 12 free spins**. Inside the bonus, the wild *cells* that landed stick for the rest of the feature. Three more scatters add **4** spins. The biggest single result is capped at **25,000×** the bet.

**Buy bonus** spends **100×** the bet and forces the feature. That price is a demo shortcut, not a calibrated offer.

The browser never decides the payout. It asks `MockGameClient`, waits a beat (150–400 ms, like a real round-trip), and plays whatever comes back. Your balance starts at 10,000 and is remembered in `localStorage`.

## Picture and sound

The reels are PixiJS: lantern glow, a slow drift of gold and purple dust, a vignette on each column, and a thin hairline through the middle of the window. Symbols are recolored [game-icons.net](https://game-icons.net) marks (Lorc, Delapouite, Caro Asercion — CC BY 3.0): a fox head, a katana, a mask, a lantern, a scroll, a shuriken. The HUD is plain HTML in a Kenney-like pressable style, not a sprite sheet. Sound is synthesized — spin, stops, a win arpeggio, a bonus fanfare, and a quiet ambient loop that ducks when something big hits.

Swap the files in `public/assets` if you want sharper art. The game does not care what the textures look like.

## The 96%

The interesting part is the math, because the first version paid far too much. Expanding wilds always fired, then those whole reels stuck through free spins, and x10 wilds stacked without a ceiling. A natural spin was worth thousands of percent.

`npm run rtp` plays the same `SlotEngine` the game uses. One round is one bet. If free spins trigger, every bonus win is counted and no extra bet is added. On **5,000,000** rounds with seed `1`:

| | |
|---|---|
| RTP | **96.35%** |
| from the base game | 70.08% |
| from free spins | 26.28% |
| spins that win anything | 23.8% |
| free spins | about 1 in 272 |
| biggest session in that run | 6,233× |

The unit tests include a short 20,000-spin smoke check so a broken strip cannot silently drift outside a wide band. The long number lives in [`src/mock/RTP.md`](src/mock/RTP.md), including the knobs we actually turned: strip weights, wild-multiplier odds, expand chance, mystery bias, the paytable, the x20 line cap, and sticky cells that do not keep the expanded copies.

Buy-bonus RTP is still unmeasured. Treat 100× as a button, not a price.

## Run it

Node 22 (see `.nvmrc`). Node 14 will fail `npm install` in a confusing way.

```bash
nvm use
npm install
npm run assets
npm test
npm run dev
```

Then open `http://localhost:5173`.

```bash
npm run rtp -- --spins 1000000 --seed 1
```

PixiJS, TypeScript, Vite, GSAP, Howler, Vitest. Demo only. 18+. Not gambling.
