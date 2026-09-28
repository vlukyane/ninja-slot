import { formatRtpReport, simulateRtp } from "../src/mock/rtp.ts";

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1]!;
  return fallback;
}

const spins = Number(arg("spins", "200000"));
const seed = Number(arg("seed", "1"));
const bet = Number(arg("bet", "1"));

if (!Number.isFinite(spins) || spins < 1) {
  console.error("usage: npm run rtp -- --spins 1000000 --seed 1");
  process.exit(1);
}

const stats = simulateRtp(spins, seed, bet, (done, s) => {
  const rtp = s.paid / s.wagered;
  process.stdout.write(`  ${done.toLocaleString("en-US")}  RTP ${(rtp * 100).toFixed(2)}%\n`);
});

console.log(formatRtpReport(stats));
