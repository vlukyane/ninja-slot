import { Howl, Howler } from "howler";
import type { WinTier } from "../game/juice";

type Bank = {
  spin?: Howl;
  stop?: Howl;
  win?: Howl;
  bonus?: Howl;
  ambient?: Howl;
};

export class AudioManager {
  private bank: Bank = {};
  private ctx: AudioContext | null = null;
  muted = false;
  private ambientBase = 0.22;
  private duckTimer: number | null = null;

  async init(): Promise<void> {
    const files: Array<keyof Bank> = ["spin", "stop", "win", "bonus", "ambient"];
    await Promise.all(
      files.map(
        (key) =>
          new Promise<void>((resolve) => {
            let settled = false;
            const finish = (): void => {
              if (settled) return;
              settled = true;
              resolve();
            };
            const howl = new Howl({
              src: [`/audio/${key}.wav`],
              volume: key === "ambient" ? this.ambientBase : 0.45,
              loop: key === "ambient",
              onload: () => {
                this.bank[key] = howl;
                finish();
              },
              onloaderror: () => finish(),
            });
            window.setTimeout(finish, 2000);
          }),
      ),
    );
  }

  unlock(): void {
    if (!this.ctx) {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (Ctx) this.ctx = new Ctx();
    }
    void this.ctx?.resume();
    if (this.bank.ambient && !this.bank.ambient.playing()) this.bank.ambient.play();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    Howler.mute(muted);
  }

  spin(): void {
    if (this.muted) return;
    this.unlock();
    if (this.bank.spin) this.bank.spin.play();
    else this.beep(180, 0.08, "sawtooth");
  }

  stop(): void {
    if (this.muted) return;
    if (this.bank.stop) this.bank.stop.play();
    else this.beep(420, 0.05, "square");
  }

  stopReel(col: number): void {
    if (this.muted) return;
    this.noise(0.05, 0.1, 1500 + col * 180);
    this.beep(160 + col * 14, 0.07, "square");
  }

  anticipation(): void {
    if (this.muted || !this.ctx) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(180, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(720, ctx.currentTime + 0.9);
    gain.gain.setValueAtTime(0.04, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 1);
  }

  win(xBet: number): void {
    if (this.muted) return;
    if (xBet >= 20) this.fanfare();
    else if (xBet >= 5) this.niceWin();
    else if (this.bank.win) this.bank.win.play();
    else this.arpeggio([392, 523, 659]);
  }

  bonus(): void {
    if (this.muted) return;
    this.duck(2200, 0.06);
    if (this.bank.bonus) this.bank.bonus.play();
    else this.arpeggio([392, 523, 659, 784, 1046]);
  }

  celebrate(tier: WinTier): void {
    if (tier === "mega") this.duck(4200, 0.05);
    else if (tier === "nice") this.duck(2100, 0.08);
    else if (tier === "win") this.duck(800, 0.12);
  }

  stinger(): void {
    if (this.muted || !this.ctx) return;
    this.beep(110, 0.18, "sawtooth");
    this.noise(0.22, 0.08, 900);
  }

  lowBalance(): void {
    if (this.muted) return;
    this.beep(196, 0.12, "triangle");
    this.beep(165, 0.18, "triangle");
  }

  duck(ms: number, level = 0.08): void {
    const amb = this.bank.ambient;
    if (!amb || this.muted) return;
    if (this.duckTimer !== null) window.clearTimeout(this.duckTimer);
    amb.fade(amb.volume(), level, 140);
    this.duckTimer = window.setTimeout(() => {
      amb.fade(amb.volume(), this.ambientBase, 450);
      this.duckTimer = null;
    }, ms);
  }

  private niceWin(): void {
    this.duck(2100, 0.08);
    if (this.bank.win) this.bank.win.play();
    this.arpeggio([523, 659, 784, 988, 1175]);
  }

  private fanfare(): void {
    this.duck(4200, 0.05);
    if (this.bank.bonus) this.bank.bonus.play();
    this.arpeggio([523, 659, 784, 1046, 1319]);
  }

  private noise(dur: number, vol: number, freq: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const n = ctx.sampleRate * dur;
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = freq;
    filter.Q.value = 6;
    const gain = ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start();
  }

  private beep(freq: number, dur: number, type: OscillatorType): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = 0.06;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.stop(ctx.currentTime + dur);
  }

  private arpeggio(notes: number[]): void {
    const ctx = this.ctx;
    if (!ctx) return;
    notes.forEach((f, i) => {
      const t = ctx.currentTime + i * 0.09;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = f;
      gain.gain.setValueAtTime(0.07, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.22);
    });
  }
}
