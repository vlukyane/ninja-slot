import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public/assets/icons");

const ICONS = [
  ["lorc", "fox-head"],
  ["caro-asercion", "fox"],
  ["lorc", "ninja-mask"],
  ["delapouite", "katana"],
  ["lorc", "shuriken"],
  ["lorc", "scroll-unfurled"],
  ["delapouite", "asian-lantern"],
  ["sbed", "fire"],
  ["delapouite", "perspective-dice-six-faces-random"],
];

async function fetchIcon(author, name) {
  const url = `https://game-icons.net/icons/ffffff/transparent/1x1/${author}/${name}.svg`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

await mkdir(outDir, { recursive: true });
for (const [author, name] of ICONS) {
  const svg = await fetchIcon(author, name);
  const dest = join(outDir, `${name}.svg`);
  await writeFile(dest, svg);
  console.log("saved", dest);
}
