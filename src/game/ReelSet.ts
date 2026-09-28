import gsap from "gsap";
import { CustomEase } from "gsap/CustomEase";
import { BlurFilter, Container, Graphics } from "pixi.js";
import type { CellPos, Grid, LineWin } from "../api/types";
import { ALL_SYMBOLS, CELL, COLS, REEL_GAP, ROWS, SPEED, type SymbolId } from "../config/game";
import { sleep } from "./format";
import { scatterAnticipation } from "./juice";
import { SymbolView } from "./SymbolView";
import type { TextureMap } from "./textures";

gsap.registerPlugin(CustomEase);
const LAND_EASE = (() => {
  try {
    return CustomEase.create("reelLand", "M0,0 C0.18,0.85 0.32,1 1,1");
  } catch {
    return "power3.out";
  }
})();

const VIEW_COUNT = 24;
const SPIN_ALPHA = 0.55;
const SPIN_PX = 52;
const SPIN_BLUR = 5;

export class ReelSet extends Container {
  private reels: Reel[] = [];
  private textures: TextureMap;
  private landGrid: Grid | null = null;
  private landMults: number[][] | null = null;
  private highlightGfx: Graphics;
  private lineGfx: Graphics;
  private dim: Graphics;
  private pulseTweens: gsap.core.Tween[] = [];
  private onReelStop: ((col: number) => void) | null = null;
  private onAnticipation: (() => void) | null = null;

  constructor(textures: TextureMap, initial: Grid) {
    super();
    this.textures = textures;

    const width = COLS * CELL + (COLS - 1) * REEL_GAP;
    const height = ROWS * CELL;

    const frame = new Graphics();
    frame.roundRect(-18, -18, width + 36, height + 36, 22).fill({ color: 0x1a0c14, alpha: 0.92 });
    frame.roundRect(-18, -18, width + 36, height + 36, 22).stroke({ width: 4, color: 0xe8c36a, alpha: 0.95 });
    frame.roundRect(-10, -10, width + 20, height + 20, 16).stroke({ width: 1, color: 0x7f1d1d, alpha: 0.8 });
    this.addChild(frame);

    const well = new Graphics();
    well.roundRect(0, 0, width, height, 8).fill({ color: 0x07040c, alpha: 0.88 });
    this.addChild(well);

    for (let i = 0; i < COLS; i++) {
      const reel = new Reel(textures, initial[i]!);
      reel.x = i * (CELL + REEL_GAP) + CELL / 2;
      this.addChild(reel);
      this.reels.push(reel);
    }

    this.addChild(drawVignettes(width, height));

    this.dim = new Graphics();
    this.dim.roundRect(0, 0, width, height, 8).fill({ color: 0x000000, alpha: 0.45 });
    this.dim.visible = false;
    this.addChild(this.dim);

    this.lineGfx = new Graphics();
    this.addChild(this.lineGfx);
    this.highlightGfx = new Graphics();
    this.addChild(this.highlightGfx);
  }

  setAudioHooks(hooks: { onReelStop?: (col: number) => void; onAnticipation?: () => void }): void {
    this.onReelStop = hooks.onReelStop ?? null;
    this.onAnticipation = hooks.onAnticipation ?? null;
  }

  startSpin(turbo = false): void {
    this.clearHighlights();
    this.landGrid = null;
    this.landMults = null;
    for (const reel of this.reels) reel.start(turbo);
  }

  async land(
    grid: Grid,
    multipliers: number[][],
    opts: { turbo: boolean; getSkip: () => boolean },
  ): Promise<void> {
    this.landGrid = grid;
    this.landMults = multipliers;
    const spec = opts.turbo ? SPEED.turbo : SPEED.normal;
    const near = !opts.turbo && scatterAnticipation(grid);
    if (near) this.onAnticipation?.();

    const t0 = performance.now();
    while (performance.now() - t0 < spec.minSpinMs) {
      if (opts.getSkip()) break;
      await sleep(16);
    }
    for (let i = 0; i < COLS; i++) {
      if (opts.getSkip()) {
        for (let j = i; j < COLS; j++) {
          this.reels[j]!.stopImmediate(grid[j]!, multipliers[j]!);
          this.onReelStop?.(j);
        }
        break;
      }
      const extra = (near && i >= 3 ? 180 : 0) + i * 18;
      await this.reels[i]!.stop(grid[i]!, multipliers[i]!, spec.landMs + extra);
      this.onReelStop?.(i);
      if (opts.getSkip()) {
        for (let j = i + 1; j < COLS; j++) {
          this.reels[j]!.stopImmediate(grid[j]!, multipliers[j]!);
          this.onReelStop?.(j);
        }
        break;
      }
      if (i < COLS - 1) {
        const gap = near && i >= 2 ? spec.staggerMs * 2.4 : spec.staggerMs;
        await sleep(gap);
      }
    }
  }

  slam(): void {
    if (this.landGrid && this.landMults) {
      for (let i = 0; i < COLS; i++) {
        this.reels[i]!.stopImmediate(this.landGrid[i]!, this.landMults[i]!);
      }
    } else {
      this.halt();
    }
  }

  halt(): void {
    for (const reel of this.reels) reel.halt();
  }

  applyGrid(grid: Grid, multipliers: number[][]): void {
    for (let i = 0; i < COLS; i++) this.reels[i]!.setColumn(grid[i]!, multipliers[i]!);
  }

  async revealMystery(positions: CellPos[], revealed: SymbolId, turbo: boolean): Promise<void> {
    const d = turbo ? 0.12 : 0.22;
    await Promise.all(
      positions.map(async (p) => {
        const view = this.reels[p.reel]!.cell(p.row);
        await gsap.to(view.scale, { x: 0, duration: d, ease: "power2.in" });
        view.setSymbol(revealed, this.textures);
        await gsap.to(view.scale, { x: 1, duration: d, ease: "back.out(2)" });
      }),
    );
  }

  async expandReel(reelIndex: number, multiplier: number, turbo: boolean): Promise<void> {
    const reel = this.reels[reelIndex]!;
    const mid = reel.cell(1);
    await gsap.to(mid.scale, { y: 2.7, duration: turbo ? 0.18 : 0.32, ease: "back.out(1.8)" });
    reel.setColumn(["wild", "wild", "wild"], [multiplier, multiplier, multiplier]);
    mid.scale.set(1);
    await gsap.fromTo(
      reel.scale,
      { x: 1.06, y: 1.06 },
      { x: 1, y: 1, duration: 0.2, ease: "power2.out" },
    );
  }

  async showWins(
    wins: LineWin[],
    opts: { turbo: boolean; getSkip: () => boolean; holdMs?: number },
  ): Promise<void> {
    if (!wins.length) return;
    const all = new Map<string, CellPos>();
    for (const w of wins) for (const p of w.positions) all.set(`${p.reel}:${p.row}`, p);
    this.paintHighlights([...all.values()], wins);
    const hold = opts.holdMs ?? (opts.turbo ? 420 : 1100);
    const t0 = performance.now();
    while (performance.now() - t0 < hold) {
      if (opts.getSkip()) break;
      await sleep(16);
    }
    if (opts.turbo || opts.getSkip() || wins.length < 2) return;

    for (const w of wins) {
      if (opts.getSkip()) break;
      this.paintHighlights(w.positions, [w]);
      await sleep(Math.min(650, hold / wins.length));
    }
    this.paintHighlights([...all.values()], wins);
  }

  clearHighlights(): void {
    this.stopPulse();
    this.highlightGfx.clear();
    this.lineGfx.clear();
    this.dim.visible = false;
    for (const reel of this.reels) {
      for (let row = 0; row < ROWS; row++) {
        const cell = reel.cell(row);
        cell.alpha = 1;
        cell.scale.set(1);
      }
    }
  }

  private paintHighlights(positions: CellPos[], lines: LineWin[] = []): void {
    this.dim.visible = true;
    const set = new Set(positions.map((p) => `${p.reel}:${p.row}`));
    this.highlightGfx.clear();
    this.lineGfx.clear();
    this.stopPulse();

    for (const line of lines) {
      if (line.positions.length < 2) continue;
      const draw = (): void => {
        const first = line.positions[0]!;
        this.lineGfx.moveTo(cellCx(first.reel), cellCy(first.row));
        for (let i = 1; i < line.positions.length; i++) {
          const p = line.positions[i]!;
          this.lineGfx.lineTo(cellCx(p.reel), cellCy(p.row));
        }
      };
      draw();
      this.lineGfx.stroke({ width: 12, color: 0xfacc15, alpha: 0.28 });
      draw();
      this.lineGfx.stroke({ width: 3, color: 0xfff7d6, alpha: 0.95 });
    }

    for (let reel = 0; reel < COLS; reel++) {
      for (let row = 0; row < ROWS; row++) {
        const on = set.has(`${reel}:${row}`);
        const view = this.reels[reel]!.cell(row);
        view.alpha = on ? 1 : 0.35;
        if (!on) continue;
        const x = reel * (CELL + REEL_GAP);
        const y = row * CELL;
        this.highlightGfx.roundRect(x + 4, y + 4, CELL - 8, CELL - 8, 14).stroke({
          width: 3,
          color: 0xfacc15,
          alpha: 0.95,
        });
        view.scale.set(1);
        this.pulseTweens.push(
          gsap.to(view.scale, {
            x: 1.12,
            y: 1.12,
            duration: 0.4,
            yoyo: true,
            repeat: -1,
            ease: "sine.inOut",
          }),
        );
      }
    }
  }

  private stopPulse(): void {
    for (const tw of this.pulseTweens) tw.kill();
    this.pulseTweens = [];
  }
}

function cellCx(reel: number): number {
  return reel * (CELL + REEL_GAP) + CELL / 2;
}

function cellCy(row: number): number {
  return row * CELL + CELL / 2;
}

function drawVignettes(width: number, height: number): Graphics {
  const g = new Graphics();
  for (let r = 0; r < COLS; r++) {
    const x = r * (CELL + REEL_GAP);
    for (let i = 0; i < 10; i++) {
      g.rect(x, i * 7, CELL, 7).fill({ color: 0x000000, alpha: 0.42 - i * 0.038 });
      g.rect(x, height - (i + 1) * 7, CELL, 7).fill({ color: 0x000000, alpha: 0.42 - i * 0.038 });
    }
    g.rect(x, height / 2, CELL, 1).fill({ color: 0xe8c36a, alpha: 0.18 });
  }
  for (let i = 0; i < 8; i++) {
    g.rect(i * 5, 0, 5, height).fill({ color: 0x000000, alpha: 0.28 - i * 0.03 });
    g.rect(width - (i + 1) * 5, 0, 5, height).fill({ color: 0x000000, alpha: 0.28 - i * 0.03 });
  }
  return g;
}

class Reel extends Container {
  private strip = new Container();
  private views: SymbolView[] = [];
  private textures: TextureMap;
  private blur: BlurFilter;
  private running = false;
  private spinPx = SPIN_PX;
  private readonly onTick = (): void => {
    if (!this.running) return;
    this.strip.y += this.spinPx * gsap.ticker.deltaRatio();
    this.wrapSpin();
  };

  constructor(textures: TextureMap, initial: SymbolId[]) {
    super();
    this.textures = textures;
    this.blur = new BlurFilter({ strength: 0, quality: 2 });
    this.filters = [this.blur];

    const mask = new Graphics().rect(-CELL / 2, 0, CELL, ROWS * CELL).fill(0xffffff);
    this.addChild(mask);
    this.mask = mask;
    this.addChild(this.strip);

    for (let i = 0; i < VIEW_COUNT; i++) {
      const view = new SymbolView(textures);
      this.strip.addChild(view);
      this.views.push(view);
    }
    this.setColumn(initial, [1, 1, 1]);
  }

  cell(row: number): SymbolView {
    const target = row * CELL + CELL / 2;
    let best = this.views[1]!;
    let bestD = Infinity;
    for (const v of this.views) {
      const d = Math.abs(this.strip.y + v.y - target);
      if (d < bestD) {
        bestD = d;
        best = v;
      }
    }
    return best;
  }

  start(turbo = false): void {
    this.stopCycle();
    this.running = true;
    this.spinPx = turbo ? SPIN_PX * 1.55 : SPIN_PX;
    this.blur.strength = SPIN_BLUR;
    this.y = 0;
    for (const v of this.views) v.alpha = SPIN_ALPHA;
    gsap.ticker.add(this.onTick);
  }

  private wrapSpin(): void {
    while (this.strip.y >= CELL) {
      this.strip.y -= CELL;
      const bottom = this.views.pop()!;
      bottom.setSymbol(this.pick(), this.textures);
      bottom.alpha = SPIN_ALPHA;
      bottom.scale.set(1);
      this.views.unshift(bottom);
      this.layoutYs(1);
    }
  }

  private layoutYs(aboveCount: number): void {
    for (let i = 0; i < this.views.length; i++) {
      this.views[i]!.y = (i - aboveCount) * CELL + CELL / 2;
    }
  }

  async stop(col: SymbolId[], mults: number[], landMs: number): Promise<void> {
    this.stopCycle();
    const frac = this.strip.y;
    const prev = this.views.map((v) => ({ id: v.symbolId, mult: v.multiplier }));
    const fill = Math.min(12, Math.max(6, Math.round(landMs / 36)));
    const aboveCount = fill + 3;

    const order: Array<{ id: SymbolId; mult: number }> = [
      { id: col[0]!, mult: mults[0] ?? 1 },
      { id: col[1]!, mult: mults[1] ?? 1 },
      { id: col[2]!, mult: mults[2] ?? 1 },
    ];
    for (let i = 0; i < fill - 1; i++) order.push({ id: this.pick(), mult: 1 });
    for (const src of prev) {
      if (order.length >= VIEW_COUNT) break;
      order.push(src);
    }
    while (order.length < VIEW_COUNT) order.push({ id: this.pick(), mult: 1 });

    for (let i = 0; i < VIEW_COUNT; i++) {
      const item = order[i]!;
      const view = this.views[i]!;
      view.setSymbol(item.id, this.textures, item.mult);
      view.alpha = i < aboveCount ? SPIN_ALPHA : 1;
      view.scale.set(1);
    }
    this.layoutYs(aboveCount);
    this.strip.y = frac;

    gsap.to(this.blur, { strength: 0, duration: landMs / 1000, ease: "power1.out", overwrite: true });
    for (const v of this.views) {
      gsap.to(v, { alpha: 1, duration: Math.min(0.28, landMs / 1000), ease: "power1.out", overwrite: true });
    }

    await new Promise<void>((resolve) => {
      gsap.to(this.strip, {
        y: frac + aboveCount * CELL,
        duration: landMs / 1000,
        ease: LAND_EASE,
        overwrite: true,
        onComplete: resolve,
        onInterrupt: resolve,
      });
    });
    this.setColumn(col, mults);
  }

  stopImmediate(col: SymbolId[], mults: number[]): void {
    this.stopCycle();
    this.blur.strength = 0;
    gsap.killTweensOf(this);
    gsap.killTweensOf(this.strip);
    gsap.killTweensOf(this.blur);
    for (const v of this.views) gsap.killTweensOf(v);
    this.y = 0;
    this.setColumn(col, mults);
  }

  halt(): void {
    const col: SymbolId[] = [this.cell(0).symbolId, this.cell(1).symbolId, this.cell(2).symbolId];
    const mults = [this.cell(0).multiplier, this.cell(1).multiplier, this.cell(2).multiplier];
    this.stopImmediate(col, mults);
  }

  setColumn(col: SymbolId[], mults: number[]): void {
    gsap.killTweensOf(this.strip);
    this.strip.y = 0;
    this.y = 0;
    this.layoutYs(1);
    for (let i = 0; i < VIEW_COUNT; i++) {
      const view = this.views[i]!;
      view.scale.set(1);
      view.alpha = 1;
      if (i >= 1 && i <= 3) view.setSymbol(col[i - 1]!, this.textures, mults[i - 1] ?? 1);
      else view.setSymbol(this.pick(), this.textures);
    }
  }

  private stopCycle(): void {
    this.running = false;
    gsap.ticker.remove(this.onTick);
  }

  private pick(): SymbolId {
    return ALL_SYMBOLS[Math.floor(Math.random() * ALL_SYMBOLS.length)]!;
  }
}
