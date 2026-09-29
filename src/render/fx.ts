// Pooled particles, decals and floating text: the game-feel layer (DESIGN.md §16.1).
// Purely cosmetic, so Math.random is fine here (this is not the simulation).
import { BitmapText, Container, Graphics, Sprite, type Texture } from 'pixi.js';
import { P } from '../art/palette.ts';
import type { Art } from './assets.ts';

export const CELL = 64;

interface Particle {
  s: Sprite;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  grav: number;
  life: number;
  max: number;
  spin: number;
  s0: number;
  s1: number;
  a0: number;
  frames: Texture[] | null;
  drag: number;
}

interface Decal {
  s: Sprite;
  life: number;
  max: number;
}

interface Bolt {
  g: Graphics;
  pts: number[];
  life: number;
  max: number;
}

interface Speech {
  c: Container;
  follow: () => { x: number; y: number } | null;
  life: number;
}

interface Floater {
  t: BitmapText;
  coin: Sprite;
  x: number;
  y: number;
  life: number;
}

export function setTex(s: Sprite, t: Texture): void {
  s.texture = t;
  const a = t.defaultAnchor;
  if (a) s.anchor.set(a.x, a.y);
}

const rnd = (a: number, b: number): number => a + Math.random() * (b - a);

const MAX_FLOATERS = 24;

export class Fx {
  private parts: Particle[] = [];
  private pool: Sprite[] = [];
  private decals: Decal[] = [];
  private floaters: Floater[] = [];
  private floaterPool: Floater[] = [];
  private bolts: Bolt[] = [];
  private waves: Bolt[] = [];
  private speeches: Speech[] = [];
  /** 0..1 multiplier from the quality setting / reduced motion. */
  density = 1;
  shakeEnabled = true;
  shake = 0;
  /** §16.6: at most 6 px × the UI scale; the game sets it on every layout. */
  shakeMax = 6;

  private art: Art;

  private layer: Container;

  private decalLayer: Container;

  private textLayer: Container;

  /** Additive sprites live apart from normal ones: interleaved, every blend switch breaks the batch (§19). */
  private addLayer: Container;

  constructor(art: Art, layer: Container, decalLayer: Container, textLayer: Container, addLayer: Container) {
    this.art = art;

    this.layer = layer;

    this.addLayer = addLayer;

    this.decalLayer = decalLayer;

    this.textLayer = textLayer;}

  private sprite(key: string | Texture): Sprite {
    const s = this.pool.pop() ?? new Sprite();
    setTex(s, typeof key === 'string' ? this.art.tex(key) : key);
    s.visible = true;
    s.alpha = 1;
    s.rotation = 0;
    s.tint = 0xffffff;
    s.blendMode = 'normal';
    s.scale.set(1);
    this.layer.addChild(s);
    return s;
  }

  /** Makes a sprite additive, moving it to the additive layer. */
  private additive(s: Sprite): Sprite {
    s.blendMode = 'add';
    this.addLayer.addChild(s);
    return s;
  }

  private emit(key: string | Texture[], x: number, y: number, o: Partial<Omit<Particle, 's' | 'frames'>> = {}): Particle {
    const frames = Array.isArray(key) ? key : null;
    const s = this.sprite(frames ? frames[0]! : (key as string));
    const p: Particle = { s, x, y, z: 0, vx: 0, vy: 0, vz: 0, grav: 0, life: 0, max: 0.4, spin: 0, s0: 1, s1: 1, a0: 1, frames, drag: 0, ...o };
    this.parts.push(p);
    return p;
  }

  private frames(prefix: string, n: number): Texture[] {
    return Array.from({ length: n }, (_, i) => this.art.tex(`${prefix}.${i}`));
  }

  muzzle(x: number, y: number, angle: number, big: boolean): void {
    const p = this.emit(`fx.muzzle.${Math.floor(Math.random() * 3)}`, x, y, { max: big ? 0.09 : 0.06, s0: big ? 1.3 : 0.9, s1: big ? 1.1 : 0.8 });
    p.s.rotation = angle;
    this.additive(p.s);
  }

  tracer(x0: number, y0: number, x1: number, y1: number): void {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.hypot(dx, dy);
    const p = this.emit('fx.tracer', x1, y1, { max: 0.07, a0: 0.9 });
    p.s.rotation = Math.atan2(dy, dx);
    p.s.scale.set(Math.min(1, len / CELL) * 1, 1);
    p.s0 = p.s1 = -1;
    this.additive(p.s);
  }

  spark(x: number, y: number): void {
    const p = this.emit('fx.spark', x, y, { max: 0.12, s0: 0.9, s1: 0.3, spin: rnd(-8, 8) });
    this.additive(p.s);
  }

  smoke(x: number, y: number, n = 1, size = 1): void {
    for (let i = 0; i < Math.max(1, Math.round(n * this.density)); i++) {
      this.emit(`fx.smoke.${Math.floor(Math.random() * 4)}`, x + rnd(-6, 6), y + rnd(-4, 4), {
        vx: rnd(-10, 10),
        vy: rnd(-26, -12),
        max: rnd(0.6, 1.1),
        s0: 0.5 * size,
        s1: 1.3 * size,
        a0: 0.75,
        drag: 1.2,
      });
    }
  }

  blast(x: number, y: number, radius: number): void {
    const size = Math.max(0.6, radius);
    this.emit(this.frames('fx.blast', 5), x, y, { max: 0.45, s0: size, s1: size * 1.1 });
    const n = Math.round(6 * this.density * Math.min(2, size));
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = rnd(60, 160) * size;
      this.emit(`fx.debris.${Math.floor(Math.random() * 4)}`, x, y, { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6, vz: rnd(120, 260), grav: 700, max: rnd(0.5, 0.9), spin: rnd(-12, 12), drag: 0.5 });
    }
    this.smoke(x, y - 10, 3, size);
    this.decal(`fx.scorch.${Math.floor(Math.random() * 3)}`, x, y, size, 8);
    if (size >= 1) this.kick(size * 4);
  }

  poof(x: number, y: number, helmet: string | null): void {
    this.emit(this.frames('fx.poof', 4), x, y - 10, { max: 0.35, s0: 0.8, s1: 1.1 });
    if (helmet && this.art.has(helmet)) {
      this.emit(helmet, x, y - 14, { vx: rnd(-50, 50), vy: rnd(-8, 8), vz: rnd(170, 230), grav: 800, max: 0.7, spin: rnd(-10, 10) });
    }
  }

  splat(x: number, y: number): void {
    this.decal('fx.treacle.splat', x, y, rnd(0.5, 0.8), 3);
  }

  dust(x: number, y: number): void {
    for (let i = 0; i < Math.round(5 * this.density); i++) {
      const a = (i / 5) * Math.PI * 2 + rnd(0, 0.6);
      this.emit(`fx.smoke.${i % 4}`, x + Math.cos(a) * 20, y + Math.sin(a) * 10, { vx: Math.cos(a) * 40, vy: Math.sin(a) * 18, max: 0.45, s0: 0.35, s1: 0.8, a0: 0.6, drag: 3 });
    }
  }

  decal(key: string, x: number, y: number, scale: number, seconds: number): void {
    const s = this.pool.pop() ?? new Sprite();
    setTex(s, this.art.tex(key));
    s.visible = true;
    s.alpha = 1;
    s.tint = 0xffffff;
    s.blendMode = 'normal';
    s.rotation = Math.random() * 0.6 - 0.3;
    s.scale.set(scale);
    s.position.set(x, y);
    this.decalLayer.addChild(s);
    this.decals.push({ s, life: 0, max: seconds });
    if (this.decals.length > 40) this.retireDecal(0);
  }

  private retireDecal(i: number): void {
    const d = this.decals.splice(i, 1)[0]!;
    d.s.removeFromParent();
    this.pool.push(d.s);
  }

  coins(x: number, y: number, amount: number): void {
    if (amount <= 0) return;
    // §19: at most MAX_FLOATERS at once. A crowd of kills at 3× would otherwise put 150+ texts on
    // screen, which no one can read and which cost draws; the oldest restarts at the new spot.
    const f =
      (this.floaters.length >= MAX_FLOATERS ? this.floaters.shift() : undefined) ??
      this.floaterPool.pop() ??
      ({
        t: new BitmapText({ text: '', style: { fontFamily: 'Lilita One', fontSize: 30, fill: P.brassLight, stroke: { color: P.ink, width: 6 } } }),
        coin: new Sprite(),
        x: 0,
        y: 0,
        life: 0,
      } satisfies Floater);
    f.t.text = `+${amount}`;
    f.t.anchor.set(0, 0.5);
    setTex(f.coin, this.art.tex('fx.coin'));
    f.coin.anchor.set(1, 0.5);
    f.x = x;
    f.y = y - 20;
    f.life = 0;
    f.t.visible = f.coin.visible = true;
    this.textLayer.addChild(f.coin, f.t);
    this.floaters.push(f);
  }

  /** A sold tower is crated up and carried off by parachute (§16.1): the canopy opens as it rises. */
  sold(x: number, y: number): void {
    const rise = -48;
    this.emit('fx.crate', x, y, { max: 1.5, vy: rise, s0: 0.75, s1: 1 });
    this.emit('fx.parachute', x, y - 24, { max: 1.5, vy: rise, s0: 0.3, s1: 1.05 });
  }

  /** A leaker runs off with a biscuit (§16.1): it bounds away towards the edge it left by. */
  biscuit(x: number, y: number, dirX: number, dirY: number): void {
    this.emit('fx.biscuit', x, y, { max: 1.1, vx: dirX * 90, vy: dirY * 90, vz: 150, grav: 520, spin: rnd(-9, 9), drag: 0.6 });
  }

  /** Chain lightning: a jagged two-tone bolt through the points (world px), redrawn each frame so it flickers. */
  bolt(pts: number[]): void {
    const g = new Graphics();
    this.layer.addChild(g);
    this.bolts.push({ g, pts, life: 0, max: 0.16 });
    for (let i = 2; i < pts.length; i += 2) this.additive(this.emit('fx.spark.blue', pts[i]!, pts[i + 1]! - 10, { max: 0.15, s0: 1, s1: 0.4, spin: rnd(-6, 6) }).s);
  }

  /** Sunbeam: a warm shaft from (x0,y0) to (x1,y1), `w` cells wide. */
  beam(x0: number, y0: number, x1: number, y1: number, w: number): void {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const p = this.emit('fx.beam', x0, y0, { max: 0.28, a0: 1 });
    p.s.rotation = Math.atan2(y1 - y0, x1 - x0);
    p.s.scale.set(len / CELL, Math.max(1, w / 0.3));
    p.s0 = p.s1 = -1;
    this.additive(p.s);
    this.additive(this.emit('fx.beamflare', x0, y0, { max: 0.25, s0: 1.2, s1: 0.6 }).s);
    this.additive(this.emit('fx.beamflare', x1, y1, { max: 0.3, s0: 0.8, s1: 1.4 }).s);
    this.kick(1);
  }

  /** Icebox pulse: a frost ring decal and a scatter of ice shards. */
  frost(x: number, y: number, r: number): void {
    this.decal('fx.frost', x, y, r / 0.97, 1.2);
    for (let i = 0; i < Math.round(8 * this.density); i++) {
      const a = (i / 8) * Math.PI * 2;
      this.emit(`fx.ice.${i % 3}`, x + Math.cos(a) * r * CELL * 0.5, y + Math.sin(a) * r * CELL * 0.3, { vx: Math.cos(a) * 60, vy: Math.sin(a) * 30, vz: rnd(60, 120), grav: 500, max: 0.5, spin: rnd(-8, 8) });
    }
  }

  /** Bellower: expanding sound-wave arcs along the aim. */
  soundwave(x: number, y: number, angle: number, cone: number, r: number): void {
    const g = new Graphics();
    this.layer.addChild(g);
    this.waves.push({ g, pts: [x, y, angle, (cone * Math.PI) / 180, r * CELL], life: 0, max: 0.5 });
  }

  /** A speech bubble (e.g. "About turn!") that follows a unit until it fades. */
  speech(text: string, follow: () => { x: number; y: number } | null): void {
    if (this.speeches.length >= 4) return;
    const c = new Container();
    const bg = new Sprite();
    setTex(bg, this.art.tex('fx.speech'));
    const t = new BitmapText({ text, style: { fontFamily: 'Lilita One', fontSize: 22, fill: P.ink } });
    t.anchor.set(0.5, 0.5);
    t.position.set(0, -27);
    const k = Math.min(1, 86 / Math.max(1, t.width));
    t.scale.set(k);
    c.addChild(bg, t);
    this.textLayer.addChild(c);
    this.speeches.push({ c, follow, life: 0 });
  }

  /** Sparkles of `key` scattered round (x,y). */
  sparkle(key: string, x: number, y: number, n: number, spread: number): void {
    for (let i = 0; i < Math.max(1, Math.round(n * this.density)); i++) {
      this.emit(key, x + rnd(-spread, spread), y + rnd(-spread * 0.6, spread * 0.6), { vy: rnd(-40, -20), max: rnd(0.5, 0.8), s0: 0.6, s1: 1, a0: 0.95 });
    }
  }

  /** One puff of the Scorcher's flame stream. */
  flame(x: number, y: number, angle: number, reach: number): void {
    const sp = reach * rnd(2.2, 3.2);
    const a = angle + rnd(-0.25, 0.25);
    const p = this.emit(`fx.flame.${Math.floor(Math.random() * 4)}`, x, y, { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.8, max: 0.32, s0: 0.35, s1: 1.1, drag: 1.5, spin: rnd(-3, 3) });
    this.additive(p.s);
  }

  kick(amount: number): void {
    if (this.shakeEnabled) this.shake = Math.min(this.shakeMax, this.shake + amount);
  }

  update(dt: number): void {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i]!;
      p.life += dt;
      const f = p.life / p.max;
      if (f >= 1) {
        p.s.removeFromParent();
        this.pool.push(p.s);
        this.parts[i] = this.parts[this.parts.length - 1]!;
        this.parts.pop();
        continue;
      }
      const k = Math.max(0, 1 - p.drag * dt);
      p.vx *= k;
      p.vy *= k;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.grav) {
        p.vz -= p.grav * dt;
        p.z += p.vz * dt;
        if (p.z < 0) {
          p.z = 0;
          p.vz *= -0.35;
          p.vx *= 0.6;
          p.vy *= 0.6;
        }
      }
      p.s.position.set(p.x, p.y - p.z);
      p.s.rotation += p.spin * dt;
      if (p.s0 >= 0) p.s.scale.set(p.s0 + (p.s1 - p.s0) * f);
      p.s.alpha = p.a0 * (f > 0.6 ? 1 - (f - 0.6) / 0.4 : 1);
      if (p.frames) setTex(p.s, p.frames[Math.min(p.frames.length - 1, Math.floor(f * p.frames.length))]!);
    }
    for (let i = this.decals.length - 1; i >= 0; i--) {
      const d = this.decals[i]!;
      d.life += dt;
      d.s.alpha = d.life > d.max * 0.6 ? Math.max(0, 1 - (d.life - d.max * 0.6) / (d.max * 0.4)) : 1;
      if (d.life >= d.max) this.retireDecal(i);
    }
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i]!;
      f.life += dt;
      const k = f.life / 0.9;
      const rise = 1 - (1 - Math.min(1, k)) ** 3;
      f.t.position.set(f.x + 4, f.y - rise * 40);
      f.coin.position.set(f.x, f.y - rise * 40);
      f.coin.scale.set(0.7);
      const a = k > 0.7 ? Math.max(0, 1 - (k - 0.7) / 0.3) : 1;
      f.t.alpha = f.coin.alpha = a;
      const pop = k < 0.15 ? 0.6 + (k / 0.15) * 0.5 : 1.1 - Math.min(0.1, (k - 0.15) * 0.4);
      f.t.scale.set(pop * 0.8);
      if (k >= 1) {
        f.t.removeFromParent();
        f.coin.removeFromParent();
        this.floaters.splice(i, 1);
        this.floaterPool.push(f);
      }
    }
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i]!;
      b.life += dt;
      const g = b.g;
      g.clear();
      if (b.life >= b.max) {
        g.destroy();
        this.bolts.splice(i, 1);
        continue;
      }
      const a = 1 - b.life / b.max;
      const path: number[] = [];
      for (let k = 0; k + 3 < b.pts.length; k += 2) {
        const x0 = b.pts[k]!;
        const y0 = b.pts[k + 1]! - 10;
        const x1 = b.pts[k + 2]!;
        const y1 = b.pts[k + 3]! - 10;
        const segs = 6;
        for (let j = 0; j <= segs; j++) {
          const t = j / segs;
          const wob = j === 0 || j === segs ? 0 : rnd(-9, 9);
          path.push(x0 + (x1 - x0) * t - ((y1 - y0) / (Math.hypot(x1 - x0, y1 - y0) || 1)) * wob, y0 + (y1 - y0) * t + ((x1 - x0) / (Math.hypot(x1 - x0, y1 - y0) || 1)) * wob);
        }
      }
      g.poly(path, false).stroke({ width: 7, color: P.infoDark, alpha: 0.45 * a, join: 'round', cap: 'round' });
      g.poly(path, false).stroke({ width: 3.5, color: P.infoLight, alpha: 0.95 * a, join: 'round', cap: 'round' });
      g.poly(path, false).stroke({ width: 1.4, color: P.white, alpha: a, join: 'round', cap: 'round' });
    }
    for (let i = this.waves.length - 1; i >= 0; i--) {
      const w = this.waves[i]!;
      w.life += dt;
      const g = w.g;
      g.clear();
      if (w.life >= w.max) {
        g.destroy();
        this.waves.splice(i, 1);
        continue;
      }
      const [x, y, ang, cone, r] = w.pts as [number, number, number, number, number];
      for (let k = 0; k < 3; k++) {
        const f = (w.life / w.max + k * 0.22) % 1;
        const rr = r * (0.2 + f * 0.8);
        g.arc(x, y - 14, rr, ang - cone / 2, ang + cone / 2).stroke({ width: 5, color: P.cream, alpha: (1 - f) * 0.9, cap: 'round' });
      }
    }
    for (let i = this.speeches.length - 1; i >= 0; i--) {
      const sp = this.speeches[i]!;
      sp.life += dt;
      const at = sp.follow();
      if (!at || sp.life > 1.1) {
        sp.c.destroy({ children: true });
        this.speeches.splice(i, 1);
        continue;
      }
      sp.c.position.set(at.x, at.y - 52);
      const pop = sp.life < 0.12 ? 0.6 + (sp.life / 0.12) * 0.45 : 1.05 - Math.min(0.05, (sp.life - 0.12) * 0.3);
      sp.c.scale.set(pop);
      sp.c.alpha = sp.life > 0.85 ? Math.max(0, 1 - (sp.life - 0.85) / 0.25) : 1;
    }
    this.shake = Math.max(0, this.shake - dt * 40);
  }
}
