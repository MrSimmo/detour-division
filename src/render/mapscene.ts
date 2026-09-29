// World map backdrop: the painted overworld, baked as a 4×2 grid of tiles
// (map.world.<col>.<row>, each 8×9 cells) so no page exceeds 2048².
import { Container, Graphics, Sprite } from 'pixi.js';
import { P } from '../art/palette.ts';
import type { Art } from './assets.ts';
import { CELL } from './fx.ts';

const COLS = 4;
const ROWS = 2;
const TILE_W = 8 * CELL;
const TILE_H = 9 * CELL;
export const MAP_W = COLS * TILE_W;
export const MAP_H = ROWS * TILE_H;

export class MapScene {
  readonly root = new Container();
  private bg = new Graphics();
  private map = new Container();

  constructor(art: Art) {
    this.root.addChild(this.bg, this.map);
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const key = `map.world.${c}.${r}`;
        if (!art.has(key)) continue;
        const s = new Sprite(art.tex(key));
        s.anchor.set(0, 0);
        s.position.set(c * TILE_W, r * TILE_H);
        this.map.addChild(s);
      }
    }
  }

  /**
   * Fits the map inside the rectangle, or — when that would crowd the 40 medallions —
   * draws it at `minW` wide and offsets it by `pan` (clamped). Returns where it landed (CSS px).
   */
  layout(x: number, y: number, w: number, h: number, screenW: number, screenH: number, minW = 0, pan = { x: 0, y: 0 }): { x: number; y: number; w: number; h: number } {
    const k = Math.max(Math.min(w / MAP_W, h / MAP_H), minW / MAP_W);
    const mw = MAP_W * k;
    const mh = MAP_H * k;
    const mx = mw <= w ? x + (w - mw) / 2 : Math.min(x, Math.max(x + w - mw, x + pan.x));
    const my = mh <= h ? y + (h - mh) / 2 : Math.min(y, Math.max(y + h - mh, y + pan.y));
    this.map.scale.set(k);
    this.map.position.set(mx, my);
    this.bg.clear().rect(0, 0, screenW, screenH).fill(P.waterDark);
    return { x: mx, y: my, w: mw, h: mh };
  }

  destroy(): void {
    this.root.destroy({ children: true });
  }
}
