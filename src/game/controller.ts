import type { GameClient, PlayResponse } from "../api/types";
import { AudioManager } from "../audio/audio";
import { sleep } from "./format";
import { Hud } from "../hud/hud";
import { maxWildMult, tierHoldMs, winTier, type WinTier } from "./juice";
import type { ReelSet } from "./ReelSet";
import type { GameStore } from "./store";

export class GameController {
  constructor(
    private readonly store: GameStore,
    private readonly client: GameClient,
    private readonly reels: ReelSet,
    private readonly hud: Hud,
    private readonly audio: AudioManager,
  ) {
    this.reels.setAudioHooks({
      onReelStop: (col) => this.audio.stopReel(col),
      onAnticipation: () => this.audio.anticipation(),
    });
  }

  spin(): void {
    void this.runRound(false);
  }

  buyBonus(): void {
    void this.runRound(true);
  }

  private async runRound(buyBonus: boolean): Promise<void> {
    const st = this.store;
    if (st.phase === "spinning" || st.phase === "features" || st.phase === "winShow") {
      st.skipRequested = true;
      this.reels.slam();
      return;
    }
    if (st.phase !== "idle") return;

    const inFs = st.inFreeSpins;
    const cost = buyBonus ? st.buyCost : st.bet;
    if (!inFs && !st.canAfford(cost)) {
      st.error = "Недостаточно средств";
      st.notify();
      return;
    }

    st.phase = "requesting";
    st.skipRequested = false;
    st.lastWin = 0;
    st.lastWinX = 0;
    st.error = null;
    st.notify();
    this.hud.hideWin();
    this.audio.unlock();
    this.audio.spin();
    this.reels.startSpin(st.turbo);

    let res: PlayResponse;
    try {
      res = await this.client.play({
        bet: st.bet,
        buyBonus,
        debugForce: st.debugForce,
      });
    } catch (err) {
      this.reels.slam();
      st.phase = "idle";
      st.error = err instanceof Error && err.message === "INSUFFICIENT_BALANCE" ? "Недостаточно средств" : "Ошибка мока";
      st.notify();
      return;
    }

    st.phase = "spinning";
    st.notify();
    await this.reels.land(res.landGrid, res.landMultipliers, {
      turbo: st.turbo,
      getSkip: () => st.skipRequested,
    });

    st.phase = "features";
    st.notify();
    for (const ev of res.events) {
      if (st.skipRequested) break;
      if (ev.type === "mysteryReveal") {
        await this.reels.revealMystery(ev.positions, ev.revealed, st.turbo);
      }
      if (ev.type === "expand") {
        await this.reels.expandReel(ev.reel, ev.multiplier, st.turbo);
      }
    }
    this.reels.applyGrid(res.grid, res.multipliers);

    const wasInFs = inFs;
    const triggered = res.events.find((e) => e.type === "fsTrigger");
    const retrigger = res.events.find((e) => e.type === "fsRetrigger");

    st.phase = "winShow";
    st.lastWin = res.totalWin;
    st.lastWinX = res.bet > 0 ? res.totalWin / res.bet : 0;
    st.lastWildMax = maxWildMult(res.multipliers);
    st.balance = res.balance;
    st.freeSpins = res.freeSpins;
    if (triggered && triggered.type === "fsTrigger") st.fsSessionWin = res.totalWin;
    else if (wasInFs) st.fsSessionWin += res.totalWin;

    if (res.totalWin > 0 || triggered) {
      st.lossStreak = 0;
    } else {
      st.lossStreak += 1;
      if (!wasInFs && st.lossStreak >= 4 && Math.random() < 0.3) this.audio.stinger();
    }

    if (st.balance >= 5 * st.bet) st.lowBalanceWarned = false;
    else if (!st.inFreeSpins && !st.lowBalanceWarned) {
      st.lowBalanceWarned = true;
      this.audio.lowBalance();
    }

    const xBet = st.lastWinX;
    const moneyTier = winTier(xBet);
    const tier: WinTier = triggered && moneyTier !== "none" && moneyTier !== "mega" ? "mega" : moneyTier;
    if (res.totalWin > 0) this.hud.prepareWin();
    st.notify();

    if (res.totalWin > 0) {
      this.audio.celebrate(tier);
      this.audio.win(xBet);
    }

    const holdMs = tierHoldMs(tier, st.turbo);
    await Promise.all([
      res.totalWin > 0
        ? this.reels.showWins(res.lineWins, {
            turbo: st.turbo,
            getSkip: () => st.skipRequested,
            holdMs,
          })
        : Promise.resolve(),
      tier !== "none"
        ? this.hud.presentWin({
            amount: res.totalWin,
            tier,
            turbo: st.turbo,
            getSkip: () => st.skipRequested,
          })
        : Promise.resolve(),
    ]);

    if (triggered && triggered.type === "fsTrigger") {
      this.audio.bonus();
      await this.hud.flashBonus(triggered);
    }
    if (retrigger && retrigger.type === "fsRetrigger") {
      await this.hud.flashRetrigger(retrigger.extra);
    }

    this.reels.clearHighlights();
    this.hud.hideWin();
    st.phase = "idle";
    st.skipRequested = false;
    st.notify();

    if (wasInFs && !res.freeSpins) {
      await this.hud.flashFsSummary(st.fsSessionWin);
      st.fsSessionWin = 0;
      st.notify();
    }

    if (st.freeSpins && st.freeSpins.remaining > 0) {
      await sleep(st.turbo ? 180 : 480);
      if (st.phase === "idle") this.spin();
      return;
    }

    if (st.autoLeft > 0 && !buyBonus) {
      st.autoLeft -= 1;
      st.notify();
      if (st.autoLeft > 0) {
        await sleep(st.turbo ? 140 : 360);
        if (st.phase === "idle") this.spin();
      }
    }
  }
}
