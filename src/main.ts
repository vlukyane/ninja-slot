import "./styles.css";
import { MockGameClient } from "./api/MockGameClient";
import type { Grid } from "./api/types";
import { AudioManager } from "./audio/audio";
import { GameController } from "./game/controller";
import { GameScene } from "./game/Scene";
import { GameStore } from "./game/store";
import { Hud, mountDebug } from "./hud/hud";

const IDLE_GRID: Grid = [
  ["fox", "katana", "mask"],
  ["lantern", "scroll", "shuriken"],
  ["ace", "king", "queen"],
  ["jack", "ten", "fox"],
  ["wild", "scatter", "mystery"],
];

async function boot(): Promise<void> {
  const root = document.getElementById("game-root");
  if (!root) throw new Error("missing #game-root");

  await document.fonts.ready.catch(() => undefined);

  const store = new GameStore();
  const client = new MockGameClient();
  const init = await client.init();
  store.balance = init.balance;
  store.betSteps = init.betSteps;
  store.bet = init.defaultBet;
  store.sessionId = init.sessionId;

  const scene = await GameScene.create(root, IDLE_GRID);
  const audio = new AudioManager();
  await audio.init();

  let controller!: GameController;
  const hud = new Hud(root, store, {
    onSpin: () => controller.spin(),
    onBuy: () => controller.buyBonus(),
  });
  controller = new GameController(store, client, scene.reels, hud, audio);

  store.subscribe(() => audio.setMuted(store.muted));
  mountDebug(root, store, () => controller.spin(), () => controller.buyBonus());

  window.addEventListener("keydown", (e) => {
    if (e.code === "Space") {
      e.preventDefault();
      controller.spin();
    }
  });

  store.notify();
}

void boot();
