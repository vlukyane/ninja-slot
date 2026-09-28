import { Texture } from "pixi.js";
import { ALL_SYMBOLS, type SymbolId } from "../config/game";

const TILE = 256;

const PALETTE: Record<
  SymbolId,
  { bg: [string, string]; ink: string; rim: string }
> = {
  ten: { bg: ["#2a3344", "#151b26"], ink: "#cbd5e1", rim: "#64748b" },
  jack: { bg: ["#2e3a2e", "#141a14"], ink: "#bbf7d0", rim: "#4ade80" },
  queen: { bg: ["#3b2a55", "#1a1028"], ink: "#e9d5ff", rim: "#c084fc" },
  king: { bg: ["#4a3514", "#1f1508"], ink: "#fde68a", rim: "#fbbf24" },
  ace: { bg: ["#4a1c24", "#1f0b10"], ink: "#fecaca", rim: "#f87171" },
  shuriken: { bg: ["#1e293b", "#0b1220"], ink: "#e2e8f0", rim: "#94a3b8" },
  scroll: { bg: ["#3f2e1c", "#1c140c"], ink: "#f5d0a9", rim: "#d4a574" },
  lantern: { bg: ["#4a2a10", "#1c0f06"], ink: "#fdba74", rim: "#f97316" },
  mask: { bg: ["#4a1020", "#1a060c"], ink: "#fb7185", rim: "#e11d48" },
  katana: { bg: ["#0f2f3a", "#061418"], ink: "#67e8f9", rim: "#22d3ee" },
  fox: { bg: ["#4a2a12", "#1a0e06"], ink: "#fdba74", rim: "#fb923c" },
  wild: { bg: ["#5a3a08", "#221606"], ink: "#fef08a", rim: "#facc15" },
  scatter: { bg: ["#3b1a4a", "#14081c"], ink: "#e9d5ff", rim: "#c084fc" },
  mystery: { bg: ["#12101c", "#07060c"], ink: "#a5b4fc", rim: "#6366f1" },
};

const ICON_FILE: Partial<Record<SymbolId, string>> = {
  fox: "fox-head.svg",
  katana: "katana.svg",
  mask: "ninja-mask.svg",
  lantern: "asian-lantern.svg",
  scroll: "scroll-unfurled.svg",
  shuriken: "shuriken.svg",
  wild: "fire.svg",
  scatter: "fox.svg",
  mystery: "perspective-dice-six-faces-random.svg",
};

const LETTER: Partial<Record<SymbolId, string>> = {
  ten: "10",
  jack: "J",
  queen: "Q",
  king: "K",
  ace: "A",
};

export type TextureMap = Record<SymbolId, Texture>;

export async function buildSymbolTextures(): Promise<TextureMap> {
  const icons = await loadIcons();
  const map = {} as TextureMap;
  await Promise.all(
    ALL_SYMBOLS.map(async (id) => {
      map[id] = Texture.from(drawTile(id, icons[id] ?? null));
    }),
  );
  return map;
}

async function loadIcons(): Promise<Partial<Record<SymbolId, HTMLImageElement>>> {
  const out: Partial<Record<SymbolId, HTMLImageElement>> = {};
  await Promise.all(
    (Object.keys(ICON_FILE) as SymbolId[]).map(async (id) => {
      const file = ICON_FILE[id];
      if (!file) return;
      try {
        const res = await fetch(`/assets/icons/${file}`);
        if (!res.ok) return;
        let svg = await res.text();
        const ink = PALETTE[id].ink;
        if (!/fill=/i.test(svg)) {
          svg = svg.replace("<svg", `<svg fill="${ink}"`);
        }
        svg = svg.replace(/fill="(?!none)[^"]*"/gi, `fill="${ink}"`);
        const blob = new Blob([svg], { type: "image/svg+xml" });
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.src = url;
        await img.decode();
        URL.revokeObjectURL(url);
        out[id] = img;
      } catch {
        /* fallback tile */
      }
    }),
  );
  return out;
}

function drawTile(id: SymbolId, icon: HTMLImageElement | null): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = TILE;
  canvas.height = TILE;
  const ctx = canvas.getContext("2d")!;
  const { bg, ink, rim } = PALETTE[id];
  const r = 36;

  roundRect(ctx, 8, 8, TILE - 16, TILE - 16, r);
  const g = ctx.createLinearGradient(0, 0, TILE, TILE);
  g.addColorStop(0, bg[0]);
  g.addColorStop(1, bg[1]);
  ctx.fillStyle = g;
  ctx.fill();

  ctx.strokeStyle = rim;
  ctx.lineWidth = 8;
  ctx.stroke();

  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 3;
  roundRect(ctx, 20, 20, TILE - 40, TILE - 40, r - 8);
  ctx.stroke();

  const shine = ctx.createLinearGradient(0, 0, 0, TILE);
  shine.addColorStop(0, "rgba(255,255,255,0.16)");
  shine.addColorStop(0.45, "rgba(255,255,255,0)");
  roundRect(ctx, 8, 8, TILE - 16, TILE - 16, r);
  ctx.fillStyle = shine;
  ctx.fill();

  if (icon) {
    const size = id === "wild" || id === "scatter" ? 168 : 150;
    ctx.drawImage(icon, (TILE - size) / 2, (TILE - size) / 2 - 6, size, size);
  } else if (LETTER[id]) {
    ctx.fillStyle = ink;
    ctx.font = `800 ${id === "ten" ? 96 : 120}px Cinzel, Georgia, serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(LETTER[id]!, TILE / 2, TILE / 2 + 4);
  } else {
    ctx.fillStyle = ink;
    ctx.font = "800 72px Cinzel, Georgia, serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(id === "mystery" ? "?" : id.slice(0, 2).toUpperCase(), TILE / 2, TILE / 2);
  }

  if (id === "wild" || id === "scatter") {
    ctx.fillStyle = ink;
    ctx.font = "800 22px Nunito, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(id === "wild" ? "WILD" : "SCATTER", TILE / 2, TILE - 28);
  }

  return canvas;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function createBackdropTexture(w = 1920, h = 1080): Texture {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(w * 0.5, h * 0.42, 40, w * 0.5, h * 0.5, w * 0.7);
  g.addColorStop(0, "#2a1030");
  g.addColorStop(0.45, "#12081a");
  g.addColorStop(1, "#050208");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  for (let i = 0; i < 40; i++) {
    const x = (Math.sin(i * 12.1) * 0.5 + 0.5) * w;
    const y = (Math.cos(i * 7.7) * 0.5 + 0.5) * h * 0.7;
    ctx.fillStyle = `rgba(255, 210, 120, ${0.04 + (i % 5) * 0.02})`;
    ctx.beginPath();
    ctx.arc(x, y, 2 + (i % 3), 0, Math.PI * 2);
    ctx.fill();
  }
  return Texture.from(canvas);
}
