import { Container, Sprite, Text } from "pixi.js";
import { CELL, SYMBOL_PAD, type SymbolId } from "../config/game";
import type { TextureMap } from "./textures";

export class SymbolView extends Container {
  readonly sprite: Sprite;
  readonly badge: Text;
  symbolId: SymbolId = "ten";
  multiplier = 1;

  constructor(textures: TextureMap) {
    super();
    this.sprite = new Sprite(textures.ten);
    this.sprite.width = CELL - SYMBOL_PAD;
    this.sprite.height = CELL - SYMBOL_PAD;
    this.sprite.anchor.set(0.5);
    this.addChild(this.sprite);

    this.badge = new Text({
      text: "",
      style: {
        fontFamily: "Nunito, sans-serif",
        fontSize: 18,
        fontWeight: "800",
        fill: "#fef08a",
        stroke: { color: "#111", width: 4 },
      },
    });
    this.badge.anchor.set(1, 0);
    this.badge.position.set((CELL - SYMBOL_PAD) / 2 - 8, -(CELL - SYMBOL_PAD) / 2 + 8);
    this.badge.visible = false;
    this.addChild(this.badge);
  }

  setSymbol(id: SymbolId, textures: TextureMap, multiplier = 1): void {
    this.symbolId = id;
    this.multiplier = multiplier;
    this.sprite.texture = textures[id];
    if (id === "wild" && multiplier > 1) {
      this.badge.text = `x${multiplier}`;
      this.badge.visible = true;
    } else {
      this.badge.visible = false;
    }
  }
}
