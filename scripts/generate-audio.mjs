import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public/audio");
await mkdir(outDir, { recursive: true });

function writeWav(samples, sampleRate = 22050) {
  const dataSize = samples.length * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(s * 32767), 44 + i * 2);
  }
  return buf;
}

function env(i, n, a, d, r) {
  const at = a * n;
  const dt = d * n;
  const rt = r * n;
  if (i < at) return i / at;
  if (i < at + dt) return 1 - 0.4 * ((i - at) / dt);
  if (i > n - rt) return Math.max(0, (n - i) / rt) * 0.6;
  return 0.6;
}

function tone(freq, dur, type = "sin") {
  const sr = 22050;
  const n = Math.floor(sr * dur);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const ph = 2 * Math.PI * freq * t;
    let v = Math.sin(ph);
    if (type === "sq") v = Math.sign(Math.sin(ph));
    if (type === "saw") v = ((t * freq) % 1) * 2 - 1;
    if (type === "n") v = Math.random() * 2 - 1;
    out[i] = v * env(i, n, 0.05, 0.15, 0.35) * 0.35;
  }
  return out;
}

function concat(parts) {
  const n = parts.reduce((s, p) => s + p.length, 0);
  const out = new Float64Array(n);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

function mix(a, b, k = 0.5) {
  const n = Math.max(a.length, b.length);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) out[i] = (a[i] ?? 0) * (1 - k) + (b[i] ?? 0) * k;
  return out;
}

const spin = mix(tone(140, 0.45, "saw"), tone(90, 0.45, "n"), 0.35);
const stop = tone(520, 0.09, "sq");
const win = concat([tone(392, 0.12), tone(523, 0.12), tone(659, 0.18)]);
const bonus = concat([tone(392, 0.1), tone(523, 0.1), tone(659, 0.1), tone(784, 0.22)]);

const ambientN = Math.floor(22050 * 4);
const ambient = new Float64Array(ambientN);
for (let i = 0; i < ambientN; i++) {
  const t = i / 22050;
  ambient[i] =
    0.08 * Math.sin(2 * Math.PI * 196 * t) * (0.6 + 0.4 * Math.sin(t * 0.7)) +
    0.05 * Math.sin(2 * Math.PI * 247 * t + 0.4) +
    0.04 * Math.sin(2 * Math.PI * 294 * t);
}

await writeFile(join(outDir, "spin.wav"), writeWav(spin));
await writeFile(join(outDir, "stop.wav"), writeWav(stop));
await writeFile(join(outDir, "win.wav"), writeWav(win));
await writeFile(join(outDir, "bonus.wav"), writeWav(bonus));
await writeFile(join(outDir, "ambient.wav"), writeWav(ambient));
console.log("audio written to", outDir);
