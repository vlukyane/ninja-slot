import type { FsTriggerEvent, Paytable } from "../api/types";
import { BUY_BONUS_X, FS_AWARD, GAME_NAME, PAYING_SYMBOLS, SYMBOL_LABELS, type SymbolId } from "../config/game";
import { formatBet, formatMoney, sleep } from "../game/format";
import { animateCountUp, tierHoldMs, type WinTier } from "../game/juice";
import type { GameStore } from "../game/store";
import { PAYTABLE } from "../mock/paytable";

const AUTO_CHOICES = [10, 25, 50, 100] as const;
const CHIP_BETS = [0.2, 1, 2, 10, 100] as const;
const FEATURE_COPY = "3 scatter — FS · wild x2–x10";
const WILD_STEPS = [2, 3, 5, 10] as const;

export class Hud {
  readonly root: HTMLElement;
  private store: GameStore;
  private onSpin: () => void;
  private onBuy: () => void;
  private infoOpen = false;
  private autoOpen = false;
  private winOpen = false;

  constructor(parent: HTMLElement, store: GameStore, handlers: { onSpin: () => void; onBuy: () => void }) {
    this.store = store;
    this.onSpin = handlers.onSpin;
    this.onBuy = handlers.onBuy;
    this.root = document.createElement("div");
    this.root.id = "hud";
    this.root.innerHTML = template();
    parent.appendChild(this.root);
    this.bind();
    this.render();
    store.subscribe(() => this.render());
  }

  private q<T extends HTMLElement>(sel: string): T {
    const el = this.root.querySelector(sel);
    if (!el) throw new Error(sel);
    return el as T;
  }

  private bind(): void {
    this.q("#btn-spin").addEventListener("click", () => this.onSpin());
    this.q("#bet-minus").addEventListener("click", () => this.nudgeBet(-1));
    this.q("#bet-plus").addEventListener("click", () => this.nudgeBet(1));
    this.q("#btn-turbo").addEventListener("click", () => {
      this.store.turbo = !this.store.turbo;
      this.store.notify();
    });
    this.q("#btn-mute").addEventListener("click", () => {
      this.store.muted = !this.store.muted;
      this.store.notify();
    });
    this.q("#btn-info").addEventListener("click", () => this.toggleInfo(true));
    this.q("#info-close").addEventListener("click", () => this.toggleInfo(false));
    this.q("#info-backdrop").addEventListener("click", () => this.toggleInfo(false));
    this.q("#btn-buy").addEventListener("click", () => this.onBuy());
    this.q("#btn-auto").addEventListener("click", () => {
      this.autoOpen = !this.autoOpen;
      this.render();
    });
    this.root.querySelectorAll<HTMLButtonElement>("[data-auto]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const n = Number(btn.dataset.auto);
        this.autoOpen = false;
        if (n === 0) this.store.autoLeft = 0;
        else this.store.autoLeft = n;
        this.store.notify();
        if (n > 0 && !this.store.busy) this.onSpin();
      });
    });
    this.root.querySelectorAll<HTMLButtonElement>("[data-bet]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (this.store.busy || this.store.inFreeSpins) return;
        const v = Number(btn.dataset.bet);
        if (!this.store.betSteps.includes(v)) return;
        this.store.bet = v;
        this.store.notify();
      });
    });
  }

  private nudgeBet(dir: number): void {
    if (this.store.busy || this.store.inFreeSpins) return;
    const steps = this.store.betSteps;
    const i = Math.max(0, steps.indexOf(this.store.bet));
    const next = steps[i + dir];
    if (next === undefined) return;
    this.store.bet = next;
    this.store.notify();
  }

  render(): void {
    const s = this.store;
    this.q("#balance").textContent = formatMoney(s.balance);
    this.q("#bet").textContent = formatBet(s.bet);
    this.q("#buy-cost").textContent = formatBet(s.buyCost);

    const winEl = this.q("#win-ticker");
    if (!this.winOpen) {
      if (s.lastWin > 0) {
        winEl.textContent = `ВЫИГРЫШ  ${formatMoney(s.lastWin)}`;
        winEl.classList.add("on");
      } else if (s.phase === "spinning" || s.phase === "requesting") {
        winEl.textContent = "УДАЧИ";
        winEl.classList.remove("on");
      } else {
        winEl.textContent = "";
        winEl.classList.remove("on");
      }
    }

    const fs = this.q("#fs-banner");
    fs.hidden = false;
    if (s.freeSpins && (s.freeSpins.remaining > 0 || s.phase !== "idle")) {
      fs.classList.add("hot");
      fs.textContent = `FREE SPINS  ${s.freeSpins.remaining}  ·  ${formatMoney(s.fsSessionWin)}`;
    } else {
      fs.classList.remove("hot");
      fs.textContent = FEATURE_COPY;
    }

    const err = this.q("#hud-error");
    err.hidden = !s.error;
    err.textContent = s.error ?? "";

    const low = s.balance < 5 * s.bet && !s.inFreeSpins && !s.error;
    const lowEl = this.q("#low-balance");
    lowEl.hidden = !low;

    this.q<HTMLButtonElement>("#btn-turbo").classList.toggle("active", s.turbo);
    this.q<HTMLButtonElement>("#btn-mute").classList.toggle("active", s.muted);
    this.q<HTMLButtonElement>("#btn-mute").textContent = s.muted ? "MUTE" : "SOUND";
    this.q<HTMLButtonElement>("#btn-auto").classList.toggle("active", s.autoLeft > 0);
    this.q<HTMLButtonElement>("#btn-auto").textContent = s.autoLeft > 0 ? `AUTO ${s.autoLeft}` : "AUTO";

    const spin = this.q<HTMLButtonElement>("#btn-spin");
    spin.textContent = s.busy ? "SKIP" : s.inFreeSpins ? "FS" : "SPIN";
    spin.classList.toggle("busy", s.busy);

    const blocked = s.busy || s.inFreeSpins;
    this.q<HTMLButtonElement>("#bet-minus").disabled = blocked;
    this.q<HTMLButtonElement>("#bet-plus").disabled = blocked;
    const buy = this.q<HTMLButtonElement>("#btn-buy");
    buy.disabled = blocked || !s.canAfford(s.buyCost);
    buy.classList.toggle("pulse", s.phase === "idle" && !s.inFreeSpins && s.canAfford(s.buyCost));

    this.root.querySelectorAll<HTMLButtonElement>("[data-bet]").forEach((btn) => {
      const v = Number(btn.dataset.bet);
      btn.hidden = !s.betSteps.includes(v);
      btn.disabled = blocked;
      btn.classList.toggle("active", s.bet === v);
    });

    this.root.querySelectorAll<HTMLElement>("[data-wild]").forEach((el) => {
      const m = Number(el.dataset.wild);
      el.classList.toggle("on", s.lastWildMax >= m);
      el.classList.toggle("peak", s.lastWildMax === m && m > 1);
    });

    this.q("#auto-menu").hidden = !this.autoOpen;
    this.q("#info-modal").hidden = !this.infoOpen;
    this.q("#info-backdrop").hidden = !this.infoOpen;

    if (s.phase === "requesting" || s.phase === "spinning") this.hideWin();
  }

  toggleInfo(open: boolean): void {
    this.infoOpen = open;
    this.render();
  }

  prepareWin(): void {
    this.winOpen = true;
  }

  hideWin(): void {
    this.winOpen = false;
    const popup = this.q("#win-popup");
    popup.hidden = true;
    popup.classList.remove("win", "nice", "mega");
    this.root.parentElement?.classList.remove("juice-nice", "juice-mega");
  }

  async presentWin(opts: {
    amount: number;
    tier: WinTier;
    turbo: boolean;
    getSkip: () => boolean;
  }): Promise<void> {
    if (opts.tier === "none") return;
    this.winOpen = true;
    const popup = this.q("#win-popup");
    const title = this.q("#win-popup-title");
    const amountEl = this.q("#win-popup-amount");
    const stars = this.q("#win-stars");
    title.textContent = opts.tier === "mega" ? "MEGA" : opts.tier === "nice" ? "BIG WIN" : "WIN";
    popup.classList.remove("win", "nice", "mega");
    popup.classList.add(opts.tier);
    popup.hidden = false;
    stars.innerHTML =
      opts.tier === "mega"
        ? Array.from({ length: 16 }, (_, i) => `<span style="animation-delay:${(i * 0.07).toFixed(2)}s;left:${8 + ((i * 37) % 84)}%"></span>`).join("")
        : opts.tier === "nice"
          ? Array.from({ length: 8 }, (_, i) => `<span style="animation-delay:${(i * 0.1).toFixed(2)}s;left:${12 + ((i * 41) % 76)}%"></span>`).join("")
          : "";

    const root = this.root.parentElement;
    root?.classList.remove("juice-nice", "juice-mega");
    if (opts.tier === "mega") root?.classList.add("juice-mega");
    else if (opts.tier === "nice") root?.classList.add("juice-nice");

    const ticker = this.q("#win-ticker");
    ticker.classList.add("on");
    const hold = tierHoldMs(opts.tier, opts.turbo);
    const countMs = Math.floor(hold * 0.45);
    const fmt = (n: number): string => formatMoney(n);
    await Promise.all([
      animateCountUp(amountEl, opts.amount, countMs, fmt, opts.getSkip),
      animateCountUp(ticker, opts.amount, countMs, (n) => `ВЫИГРЫШ  ${fmt(n)}`, opts.getSkip),
    ]);
    amountEl.textContent = fmt(opts.amount);
    ticker.textContent = `ВЫИГРЫШ  ${fmt(opts.amount)}`;

    const t0 = performance.now();
    while (performance.now() - t0 < hold) {
      if (opts.getSkip()) break;
      await sleep(16);
    }
    this.hideWin();
  }

  async flashBonus(ev: FsTriggerEvent): Promise<void> {
    await this.toast(`FREE SPINS`, `${ev.scatters} scatter · ${ev.spins} спинов`);
  }

  async flashRetrigger(extra: number): Promise<void> {
    await this.toast(`+${extra} SPINS`, "ретриггер");
  }

  async flashFsSummary(total: number): Promise<void> {
    await this.toast("BONUS WIN", formatMoney(total));
  }

  private toast(title: string, sub: string): Promise<void> {
    const el = this.q("#toast");
    el.hidden = false;
    el.innerHTML = `<div class="toast-stars" aria-hidden="true">${Array.from({ length: 12 }, (_, i) => `<span style="animation-delay:${(i * 0.08).toFixed(2)}s;left:${10 + ((i * 29) % 80)}%"></span>`).join("")}</div><strong>${title}</strong><span>${sub}</span>`;
    return new Promise((resolve) => {
      window.setTimeout(() => {
        el.hidden = true;
        resolve();
      }, 1400);
    });
  }
}

function template(): string {
  const payRows = renderPaytable(PAYTABLE);
  const autoBtns = [...AUTO_CHOICES.map((n) => `<button type="button" data-auto="${n}">${n}</button>`), `<button type="button" data-auto="0">стоп</button>`].join("");
  const chips = CHIP_BETS.map((n) => `<button type="button" class="chip" data-bet="${n}">${formatChip(n)}</button>`).join("");
  const legend = WILD_STEPS.map((m) => `<span data-wild="${m}">x${m}</span>`).join("");
  return `
    <div class="hud-top">
      <button type="button" id="btn-info" class="icon-btn">INFO</button>
      <div id="fs-banner" class="fs-banner">${FEATURE_COPY}</div>
      <button type="button" id="btn-mute" class="icon-btn">SOUND</button>
    </div>
    <div id="win-ticker" class="win-ticker"></div>
    <div id="hud-error" class="hud-error" hidden></div>
    <div id="low-balance" class="low-balance" hidden>низкий баланс</div>
    <div id="wild-legend" class="wild-legend" aria-label="множители wild">${legend}</div>
    <div class="hud-bar">
      <div class="stat stat-balance">
        <span class="lbl">БАЛАНС</span>
        <span id="balance">0</span>
      </div>
      <div class="bet-ctrl">
        <button type="button" id="bet-minus" class="round">−</button>
        <div class="stat">
          <span class="lbl">СТАВКА</span>
          <span id="bet">1</span>
        </div>
        <button type="button" id="bet-plus" class="round">+</button>
      </div>
      <button type="button" id="btn-spin" class="spin">SPIN</button>
      <div class="side-btns">
        <button type="button" id="btn-turbo">TURBO</button>
        <div class="auto-wrap">
          <button type="button" id="btn-auto">AUTO</button>
          <div id="auto-menu" class="auto-menu" hidden>${autoBtns}</div>
        </div>
        <button type="button" id="btn-buy" class="buy">КУПИТЬ <span id="buy-cost">100</span></button>
      </div>
      <div id="bet-chips" class="bet-chips">${chips}</div>
    </div>
    <div id="win-popup" class="win-popup" hidden>
      <div id="win-stars" class="win-stars" aria-hidden="true"></div>
      <strong id="win-popup-title">WIN</strong>
      <span id="win-popup-amount">0</span>
    </div>
    <div id="toast" class="toast" hidden></div>
    <div id="info-backdrop" class="backdrop" hidden></div>
    <div id="info-modal" class="modal" hidden>
      <button type="button" id="info-close" class="icon-btn close">закрыть</button>
      <h2>${GAME_NAME}</h2>
      <p class="lead">5 барабанов · 3 ряда · 20 линий · max win ${"25 000"}x</p>
      <h3>Таблица выплат (× ставка)</h3>
      <div class="paytable">${payRows}</div>
      <h3>Правила</h3>
      <ul>
        <li>Выигрыши слева направо по 20 фиксированным линиям.</li>
        <li>Wild заменяет все символы кроме Scatter и несёт множитель 2x–10x. Несколько Wild на линии перемножают множители.</li>
        <li>Wild на барабане может расшириться на весь барабан (кроме Scatter).</li>
        <li>Mystery раскрываются в один и тот же платящий символ.</li>
        <li>3 / 4 / 5 Scatter → ${FS_AWARD[3]} / ${FS_AWARD[4]} / ${FS_AWARD[5]} бесплатных спинов. В бонусе Wild липкие. Ретриггер: +4 спина.</li>
        <li>Покупка бонуса: ${BUY_BONUS_X}× ставки.</li>
      </ul>
      <p class="disc">Демо. Это не азартная игра, выигрыш не выплачивается. 18+</p>
      <h3>Авторы ассетов</h3>
      <p class="credits">Иконки: Lorc, Delapouite, Caro Asercion — <a href="https://game-icons.net" target="_blank" rel="noreferrer">game-icons.net</a> (CC BY 3.0). Кнопки HUD — собственная вёрстка в духе <a href="https://kenney.nl/assets/ui-pack" target="_blank" rel="noreferrer">Kenney UI Pack</a> (CC0).</p>
    </div>
  `;
}

function formatChip(n: number): string {
  return n < 1 ? n.toFixed(1) : String(n);
}

function renderPaytable(table: Paytable): string {
  const ids: SymbolId[] = [...PAYING_SYMBOLS, "wild"];
  return ids
    .map((id) => {
      const row = table[id];
      const cells = ([3, 4, 5] as const)
        .map((n) => `<span>${n} = ${row[n] ?? "—"}x</span>`)
        .join("");
      return `<div class="pay-row"><b>${SYMBOL_LABELS[id]}</b>${cells}</div>`;
    })
    .join("");
}

export function mountDebug(parent: HTMLElement, store: GameStore, onSpin: () => void, onBuy: () => void): void {
  if (!new URLSearchParams(location.search).has("debug")) return;
  const el = document.createElement("div");
  el.id = "debug-panel";
  el.innerHTML = `
    <span>debug</span>
    <button type="button" data-f="win">win</button>
    <button type="button" data-f="scatter">scatter</button>
    <button type="button" data-f="expand">expand</button>
    <button type="button" data-f="mystery">mystery</button>
    <button type="button" data-f="buy">buy</button>
    <button type="button" data-f="">clear</button>
  `;
  parent.appendChild(el);
  el.querySelectorAll<HTMLButtonElement>("button[data-f]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const f = btn.dataset.f;
      store.debugForce = f ? (f as GameStore["debugForce"]) : undefined;
      store.notify();
      if (f === "buy") onBuy();
      else if (f) onSpin();
    });
  });
}
