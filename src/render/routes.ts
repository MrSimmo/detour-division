// Route marker (DESIGN.md §3.4): animated chevrons along each current ground route,
// a dotted line for each air lane, and a brighter preview while placing.
import { Container, Sprite } from 'pixi.js';
import { P } from '../art/palette.ts';
import type { Vec } from '../sim/core/math.ts';
import type { Art } from './assets.ts';
import { CELL, setTex } from './fx.ts';

const SPACING = 0.7;
const SPEED = 1.1;

interface Line {
  pts: Vec[];
  cum: number[];
  len: number;
}

function smooth(pts: Vec[]): Vec[] {
  // Two rounds of Chaikin corner cutting, keeping the endpoints.
  let p = pts;
  for (let k = 0; k < 2 && p.length > 2; k++) {
    const out: Vec[] = [p[0]!];
    for (let i = 0; i < p.length - 1; i++) {
      const a = p[i]!;
      const b = p[i + 1]!;
      out.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 }, { x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 });
    }
    out.push(p[p.length - 1]!);
    p = out;
  }
  return p;
}

function toLine(pts: Vec[]): Line {
  const s = smooth(pts);
  const cum = [0];
  for (let i = 1; i < s.length; i++) cum.push(cum[i - 1]! + Math.hypot(s[i]!.x - s[i - 1]!.x, s[i]!.y - s[i - 1]!.y));
  return { pts: s, cum, len: cum[cum.length - 1] ?? 0 };
}

function at(l: Line, d: number): { x: number; y: number; a: number } {
  let i = 1;
  while (i < l.cum.length - 1 && l.cum[i]! < d) i++;
  const a = l.pts[i - 1]!;
  const b = l.pts[i]!;
  const seg = l.cum[i]! - l.cum[i - 1]! || 1;
  const t = (d - l.cum[i - 1]!) / seg;
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, a: Math.atan2(b.y - a.y, b.x - a.x) };
}

export class RouteMarker {
  readonly layer = new Container();
  private pool: Sprite[] = [];
  private used = 0;
  private current: Line[] = [];
  private preview: Line[] | null = null;
  private air: Line[] = [];
  private offset = 0;
  private flash: { route: number; t: number } | null = null;
  visible = true;

  private art: Art;

  constructor(art: Art) {
    this.art = art;}

  setCurrent(paths: Vec[][]): void {
    this.current = paths.map((p) => toLine(p));
  }

  setPreview(paths: Vec[][] | null): void {
    this.preview = paths ? paths.map((p) => toLine(p)) : null;
  }

  setAir(lanes: { x0: number; y0: number; x1: number; y1: number }[]): void {
    this.air = lanes.map((l) => toLine([{ x: l.x0, y: l.y0 }, { x: l.x1, y: l.y1 }]));
  }

  /** Flash a route in the invalid colour (R-BLOCK-3): 3 pulses over 600 ms. */
  flashRoute(route: number): void {
    this.flash = { route, t: 0 };
  }

  private chevron(key: string): Sprite {
    let s = this.pool[this.used];
    if (!s) {
      s = new Sprite();
      this.pool.push(s);
      this.layer.addChild(s);
    }
    setTex(s, this.art.tex(key));
    s.visible = true;
    this.used++;
    return s;
  }

  update(dt: number): void {
    this.offset = (this.offset + dt * SPEED) % SPACING;
    this.used = 0;
    if (this.flash) {
      this.flash.t += dt;
      if (this.flash.t > 0.6) this.flash = null;
    }
    const show = this.visible || this.preview !== null || this.flash !== null;
    if (show) {
      this.current.forEach((l, ri) => {
        const flashing = this.flash?.route === ri && Math.floor(this.flash.t / 0.1) % 2 === 0;
        const alpha = this.preview ? 0.3 : 0.85;
        if (!this.visible && !flashing && this.flash?.route !== ri) return;
        for (let d = this.offset; d < l.len; d += SPACING) {
          const p = at(l, d);
          const s = this.chevron('fx.chevron');
          s.position.set(p.x * CELL, p.y * CELL);
          s.rotation = p.a;
          s.tint = flashing ? P.stop : P.cream;
          s.alpha = flashing ? 1 : alpha;
          s.scale.set(flashing ? 1.35 : 1.15);
        }
      });
      for (const l of this.preview ?? []) {
        for (let d = this.offset; d < l.len; d += SPACING) {
          const p = at(l, d);
          const s = this.chevron('fx.chevron');
          s.position.set(p.x * CELL, p.y * CELL);
          s.rotation = p.a;
          s.tint = P.infoLight;
          s.alpha = 1;
          s.scale.set(1.3);
        }
      }
      if (this.visible) {
        for (const l of this.air) {
          for (let d = this.offset * 0.5; d < l.len; d += SPACING * 1.2) {
            const p = at(l, d);
            const s = this.chevron('fx.dot');
            s.position.set(p.x * CELL, p.y * CELL);
            s.rotation = 0;
            s.tint = P.infoLight;
            s.alpha = 0.4;
            s.scale.set(0.7);
          }
        }
      }
    }
    for (let i = this.used; i < this.pool.length; i++) this.pool[i]!.visible = false;
  }
}
