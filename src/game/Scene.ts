import { Application, Container, Graphics, Sprite, Text } from "pixi.js";
import type { Grid } from "../api/types";
import { CELL, COLS, GAME_NAME, REEL_GAP, ROWS } from "../config/game";
import { ReelSet } from "./ReelSet";
import { buildSymbolTextures, createBackdropTexture, type TextureMap } from "./textures";

export class GameScene {
  readonly app: Application;
  readonly stage: Container;
  readonly reels: ReelSet;
  readonly textures: TextureMap;
  private readonly drift: DriftField;

  private constructor(app: Application, textures: TextureMap, initial: Grid) {
    this.app = app;
    this.textures = textures;
    this.stage = new Container();
    app.stage.addChild(this.stage);

    const bg = new Sprite(createBackdropTexture());
    bg.anchor.set(0.5);
    bg.label = "backdrop";
    this.stage.addChild(bg);

    this.drawLanterns();

    this.drift = new DriftField();
    this.stage.addChild(this.drift);
    app.ticker.add((ticker) => this.drift.tick(ticker.deltaTime));

    const title = new Text({
      text: GAME_NAME.toUpperCase(),
      style: {
        fontFamily: "Cinzel, Georgia, serif",
        fontSize: 54,
        fontWeight: "700",
        fill: "#e8c36a",
        letterSpacing: 8,
        dropShadow: { color: "#7f1d1d", blur: 8, distance: 0 },
      },
    });
    title.anchor.set(0.5, 1);
    title.y = -(ROWS * CELL) / 2 - 40;
    this.stage.addChild(title);

    const subtitle = new Text({
      text: "ДЕМО  ·  18+  ·  НЕ АЗАРТ",
      style: {
        fontFamily: "Nunito, sans-serif",
        fontSize: 14,
        fontWeight: "700",
        fill: "#9f8aa8",
        letterSpacing: 4,
      },
    });
    subtitle.anchor.set(0.5, 1);
    subtitle.y = title.y - 58;
    this.stage.addChild(subtitle);

    this.reels = new ReelSet(textures, initial);
    const width = COLS * CELL + (COLS - 1) * REEL_GAP;
    const height = ROWS * CELL;
    this.reels.position.set(-width / 2, -height / 2);
    this.stage.addChild(this.reels);

    this.layout();
    app.renderer.on("resize", () => this.layout());
  }

  static async create(root: HTMLElement, initial: Grid): Promise<GameScene> {
    const app = new Application();
    await app.init({
      background: "#050208",
      resizeTo: root,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
    });
    app.canvas.id = "stage";
    root.appendChild(app.canvas);
    const textures = await buildSymbolTextures();
    return new GameScene(app, textures, initial);
  }

  private drawLanterns(): void {
    const glow = new Graphics();
    const spots = [
      [-520, -220, 0xff7a18],
      [520, -200, 0xff3b5c],
      [-480, 260, 0xc084fc],
      [500, 280, 0xe8c36a],
    ] as const;
    for (const [x, y, color] of spots) {
      glow.circle(x, y, 90).fill({ color, alpha: 0.07 });
      glow.circle(x, y, 28).fill({ color, alpha: 0.18 });
      glow.circle(x, y, 8).fill({ color: 0xffe7a3, alpha: 0.7 });
    }
    this.stage.addChild(glow);
  }

  layout(): void {
    const w = this.app.renderer.width;
    const h = this.app.renderer.height;
    const designW = 1280;
    const designH = 720;
    const scale = Math.min(w / designW, h / designH) * 0.92;
    this.stage.scale.set(scale);
    this.stage.position.set(w / 2, h / 2 - Math.min(48, h * 0.06));
    const bg = this.stage.getChildByLabel("backdrop") as Sprite | null;
    if (bg) {
      bg.width = designW * 1.4;
      bg.height = designH * 1.4;
    }
  }
}

class DriftField extends Container {
  private readonly bits: Array<{ g: Graphics; vx: number; vy: number }> = [];

  constructor() {
    super();
    for (let i = 0; i < 30; i++) {
      const g = new Graphics();
      const gold = i % 2 === 0;
      const r = 1.6 + (i % 5) * 0.7;
      g.circle(0, 0, r).fill({
        color: gold ? 0xe8c36a : 0xc084fc,
        alpha: 0.22 + (i % 4) * 0.08,
      });
      g.x = ((i * 137) % 1100) - 550;
      g.y = ((i * 89) % 720) - 360;
      this.addChild(g);
      this.bits.push({
        g,
        vx: ((i % 7) - 3) * 0.08,
        vy: -0.12 - (i % 5) * 0.04,
      });
    }
  }

  tick(delta: number): void {
    for (const b of this.bits) {
      b.g.x += b.vx * delta;
      b.g.y += b.vy * delta;
      if (b.g.y < -380) b.g.y = 380;
      if (b.g.x < -580) b.g.x = 580;
      if (b.g.x > 580) b.g.x = -580;
    }
  }
}
