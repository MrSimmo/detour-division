// In-level controller: owns the simulation, the fixed-step clock and the views, and
// turns player intent into simulation commands. Rendering observes; it never mutates.
import type { Application } from 'pixi.js';
import { GameAudio } from '../audio/director.ts';
import type { AudioSystem } from '../audio/system.ts';
import type { BalanceDef, Difficulty, LevelDef, TargetMode } from '../data/schemas.ts';
import { Clock } from '../sim/clock.ts';
import type { Sim } from '../sim/context.ts';
import { apply, checkPlacement, createSim, drainEvents, hashSim, restoreSim, routePaths, snapshot, step, unbuildableCells, type Command, type Snapshot } from '../sim/sim.ts';
import type { SnapshotRecord } from '../meta/save.ts';
import type { Settings } from '../meta/progression.ts';
import { reducedMotion } from './settings.ts';
import { spawnEnemy } from '../sim/enemies.ts';
import type { CommandResult, SimEvent } from '../sim/types.ts';
import type { Art } from '../render/assets.ts';
import { CELL } from '../render/fx.ts';
import { AutoQuality } from '../render/quality.ts';
import { GameScene } from '../render/scene.ts';
import { BuildBar } from '../ui/buildbar.ts';
import { h } from '../ui/h.ts';
import { icon } from '../ui/icons.ts';
import { T } from '../sim/terrain.ts';
import { Hud } from '../ui/hud.ts';
import { TowerPanel } from '../ui/panel.ts';
import { REASONS, keyName } from '../ui/text.ts';
import { attachInput, type InputHandle } from './input.ts';
import { computeLayout, type Layout } from './layout.ts';
import { deviceClass, safeInsets } from './platform.ts';

export interface GameOpts {
  app: Application;
  art: Art;
  balance: BalanceDef;
  level: LevelDef;
  difficulty: Difficulty;
  loadout: string[];
  endless: boolean;
  ui: HTMLElement;
  audio: AudioSystem;
  /** The player's settings (a live object: changes apply through applySettings). */
  settings: Settings;
  /** The mute key (§18.5): the app owns volumes. */
  toggleMute(): void;
  /** Resume a battle from this snapshot instead of starting fresh (§20). */
  restore?: Snapshot;
  /** A snapshot to store: taken at each wave start and when the page is hidden or closed. */
  onSnapshot(rec: SnapshotRecord): void;
  onExit(result: 'won' | 'lost' | 'quit', sim: Sim): void;
  onPause(paused: boolean): void;
  /** A unit type (with elite flag) appeared for the first time this run. */
  onSeen(type: string, elite: boolean): void;
}

const SPEEDS = [1, 2, 3] as const;

export class Game {
  readonly sim: Sim;
  readonly scene: GameScene;
  readonly hud: Hud;
  readonly bar: BuildBar;
  readonly panel: TowerPanel;
  private bubble: HTMLDivElement;
  private clearPrompt: HTMLDivElement | null = null;
  private bubbleT = 0;
  private clock = new Clock();
  speed: (typeof SPEEDS)[number] = 1;
  paused = false;
  showRoutes = true;
  tool: string | null = null;
  ghostCell: { cx: number; cy: number } | null = null;
  private ghostKey = '';
  private ghostCheckT = 0;
  /** §18.5: the cell a tower was just built on. The ghost stays off it until the pointer moves on. */
  private builtCell: string | null = null;
  /** The maze version the unbuildable shading was drawn for, or -1 when it's hidden (R-BLOCK-4). */
  private maskV = -1;
  layoutState!: Layout;
  zoom = 1;
  pan = { x: 0, y: 0 };
  private input: InputHandle;
  private ended = false;
  private tickFn = (): void => this.frame();
  private keyOf = (action: string): string => keyName(this.o.settings.keys[action] ?? '');
  private resizeFn = (): void => this.relayout();
  // §21: the game pauses when the window loses focus, unless the player chose a faster speed.
  private blurFn = (): void => {
    if (this.speed === 1) this.setPaused(true);
  };
  private hideFn = (): void => {
    if (document.visibilityState === 'hidden') this.takeSnapshot();
  };
  private pagehideFn = (): void => this.takeSnapshot();

  private o: GameOpts;
  private audio: GameAudio;
  /** Performance probe (R-PERF-1 e2e): when a test sets an array, each tick's duration lands in it. */
  tickTimes: number[] | null = null;
  /** §19: Auto quality steps particles and resolution with the frame rate. */
  private auto: AutoQuality;
  /** The resolution the renderer started at (device pixel ratio, capped at 2): the ceiling. */
  private readonly maxRes: number;

  constructor(o: GameOpts) {
    this.o = o;
    this.sim = o.restore ? restoreSim(o.restore, o.level, o.balance) : createSim({ level: o.level, balance: o.balance, difficulty: o.difficulty, loadout: o.loadout, endless: o.endless });
    this.scene = new GameScene(o.art, this.sim);
    this.maxRes = o.app.renderer.resolution;
    this.auto = new AutoQuality(this.maxRes);
    this.audio = new GameAudio(o.audio, o.balance, o.level.zone, (x, y) => (this.toScreen(x, y).x / window.innerWidth) * 2 - 1);
    o.app.stage.addChild(this.scene.root);
    this.hud = new Hud(this.sim, {
      callWave: () => this.command({ t: 'callWave' }),
      cycleSpeed: () => this.cycleSpeed(),
      togglePause: () => this.setPaused(!this.paused),
      toggleRoutes: () => this.toggleRoutes(),
    }, this.keyOf);
    this.bar = new BuildBar(this.sim, { pick: (type, e) => this.input.pickFromBar(type, e) }, this.keyOf);
    this.panel = new TowerPanel(this.sim, o.ui, {
      upgrade: (id) => this.command({ t: 'upgrade', id }),
      sell: (id) => {
        const r = this.command({ t: 'sell', id });
        if (r.ok) this.select(0);
      },
      target: (id, mode: TargetMode) => this.command({ t: 'target', id, mode }),
      close: () => this.select(0),
    });
    this.bubble = h('div', { class: 'bubble', style: { display: 'none' } });
    o.ui.append(this.hud.el, this.bar.el, this.bubble);
    this.input = attachInput(this, o.app.canvas);
    window.addEventListener('resize', this.resizeFn);
    window.visualViewport?.addEventListener('resize', this.resizeFn);
    document.addEventListener('visibilitychange', this.hideFn);
    window.addEventListener('pagehide', this.pagehideFn);
    window.addEventListener('blur', this.blurFn);
    this.showRoutes = o.settings.routes;
    this.scene.routes.visible = this.showRoutes;
    this.applySettings();
    this.relayout();
    o.app.ticker.add(this.tickFn);
    // Test hook for Playwright (dev builds, or ?e2e on production builds).
    if (import.meta.env.DEV || location.search.includes('e2e')) {
      Object.assign(window as unknown as object, { __game: this, __hash: () => hashSim(this.sim), __spawn: (type: string, elite = false, route = 0) => spawnEnemy(this.sim, type, route, elite).id });
    }
  }

  destroy(): void {
    this.o.app.ticker.remove(this.tickFn);
    window.removeEventListener('resize', this.resizeFn);
    window.visualViewport?.removeEventListener('resize', this.resizeFn);
    document.removeEventListener('visibilitychange', this.hideFn);
    window.removeEventListener('pagehide', this.pagehideFn);
    window.removeEventListener('blur', this.blurFn);
    this.input.detach();
    this.hud.el.remove();
    this.bar.el.remove();
    this.panel.close();
    this.bubble.remove();
    this.dismissClear();
    this.audio.destroy();
    this.scene.root.destroy({ children: true });
    // Menus get full resolution back, whatever Auto quality did during the level.
    const r = this.o.app.renderer;
    if (r.resolution !== this.maxRes) r.resize(window.innerWidth, window.innerHeight, this.maxRes);
  }

  // ------------------------------------------------------------ layout

  relayout(): void {
    const w = window.innerWidth;
    const hgt = window.innerHeight;
    const lv = this.sim.level;
    const L = computeLayout({ w, h: hgt, safe: safeInsets(), cols: lv.cols + 2, rows: lv.rows + 2, device: deviceClass(), slots: this.sim.state.loadout.length });
    this.layoutState = L;
    // Anything anchored in screen space to the old layout would now point at the wrong cell.
    this.hideBubble();
    this.dismissClear();
    this.scene.fx.shakeMax = 6 * L.uiScale;
    document.documentElement.style.setProperty('--ui-scale', L.uiScale.toFixed(3));
    const pf = L.playfield;
    const u = L.uiScale;
    const hud = this.hud.el;
    const bar = this.bar.el;
    hud.classList.toggle('rails', L.rails !== null);
    this.bar.setArrangement(L.arrangement);
    if (L.rails) {
      // ADR-0013: phones put the HUD and the build bar in columns either side of the map.
      const { hud: hr, bar: br, slot } = L.rails;
      Object.assign(hud.style, { left: `${hr.x}px`, top: `${hr.y}px`, width: `${hr.w}px`, height: `${hr.h}px` });
      Object.assign(bar.style, { left: `${br.x}px`, top: `${br.y}px`, width: `${br.w}px`, height: `${br.h}px` });
      bar.style.setProperty('--slot', `${slot.toFixed(1)}px`);
      this.clampView();
      return;
    }
    hud.style.left = `${pf.x + 6 * u}px`;
    hud.style.width = `${pf.w - 12 * u}px`;
    hud.style.top = `${pf.y - L.bands.top + 6 * u}px`;
    hud.style.height = '';
    bar.style.removeProperty('--slot');
    if (L.arrangement === 'side') {
      bar.style.left = `${pf.x + pf.w + (L.bands.right - 64 * u) / 2}px`;
      bar.style.top = `${pf.y}px`;
      bar.style.height = `${pf.h}px`;
      bar.style.width = '';
    } else {
      bar.style.left = `${pf.x}px`;
      bar.style.width = `${pf.w}px`;
      bar.style.top = `${pf.y + pf.h + (L.bands.bottom - 64 * u - 5 * u) / 2}px`;
      bar.style.height = '';
    }
    this.clampView();
  }

  clampView(): void {
    const L = this.layoutState;
    this.zoom = Math.max(1, Math.min(2.5, this.zoom));
    // Keep the zoomed map covering the playfield rectangle.
    const pf = L.playfield;
    const minX = pf.w * (1 - this.zoom);
    const minY = pf.h * (1 - this.zoom);
    this.pan.x = Math.max(minX, Math.min(0, this.pan.x));
    this.pan.y = Math.max(minY, Math.min(0, this.pan.y));
    this.scene.layout(pf, L.cell, window.innerWidth, window.innerHeight, this.zoom, this.pan);
  }

  resetView(): void {
    this.zoom = 1;
    this.pan = { x: 0, y: 0 };
    this.clampView();
  }

  /** Screen (CSS px) → world cell coordinates (fractional). */
  toCell(clientX: number, clientY: number): { x: number; y: number } {
    const p = this.scene.world.toLocal({ x: clientX, y: clientY });
    return { x: p.x / CELL, y: p.y / CELL };
  }

  toScreen(cellX: number, cellY: number): { x: number; y: number } {
    const p = this.scene.world.toGlobal({ x: cellX * CELL, y: cellY * CELL });
    return { x: p.x, y: p.y };
  }

  // ------------------------------------------------------------ commands

  command(cmd: Command): CommandResult {
    const r = apply(this.sim, cmd);
    if (!r.ok && r.reason && cmd.t !== 'build') {
      this.o.audio.play('ui.error');
      this.say(REASONS[r.reason], this.selectedAnchor(), true);
    }
    return r;
  }

  tryBuild(type: string, cx: number, cy: number): boolean {
    const r = apply(this.sim, { t: 'build', tower: type, cx, cy });
    if (r.ok) {
      this.ghostKey = '';
      this.builtCell = `${cx}.${cy}`;
      return true;
    }
    this.explainRefusal(r, cx, cy);
    return false;
  }

  private explainRefusal(r: { reason?: string; routes?: string[]; enemies?: number[] }, cx: number, cy: number): void {
    if (!r.reason) return;
    this.o.audio.play('ui.error');
    this.say(REASONS[r.reason as keyof typeof REASONS], this.toScreen(cx + 0.5, cy - 0.3), true);
    if (r.routes) for (const id of r.routes) this.scene.routes.flashRoute(this.sim.level.routes.findIndex((x) => x.id === id));
    if (r.enemies) this.scene.flashEnemies(r.enemies);
  }

  /** Shows the reason bubble. `hold` keeps it up for 1.4 s (a refused action); without it the bubble
   * belongs to the ghost's cell and goes as soon as the ghost moves on (§3.2, §18.5). */
  say(text: string, at: { x: number; y: number } | null, bad: boolean, hold = true): void {
    if (!at) return;
    this.bubble.textContent = text;
    this.bubble.classList.toggle('bad', bad);
    this.bubble.style.display = '';
    this.bubble.style.left = `${at.x}px`;
    this.bubble.style.top = `${at.y}px`;
    this.bubbleT = hold ? 1.4 : 0;
  }

  hideBubble(): void {
    this.bubble.style.display = 'none';
    this.bubbleT = 0;
  }

  setTool(type: string | null): void {
    this.tool = type;
    this.bar.setSelected(type);
    if (!type) this.setGhost(null);
    if (type) this.select(0);
  }

  /** Shows the placement ghost and live route preview for a cell (R-MARK-2, R-BLOCK-3). */
  setGhost(cell: { cx: number; cy: number } | null): void {
    this.ghostCell = cell;
    if (!cell || this.builtCell !== `${cell.cx}.${cell.cy}`) this.builtCell = null;
    if (!cell || !this.tool || this.builtCell) {
      this.scene.setGhost(null);
      this.scene.routes.setPreview(null);
      this.ghostKey = '';
      if (this.bubbleT <= 0) this.hideBubble();
      return;
    }
    const key = `${this.tool}.${cell.cx}.${cell.cy}`;
    if (key === this.ghostKey && this.ghostCheckT > 0) return;
    const fresh = key !== this.ghostKey;
    this.ghostKey = key;
    this.ghostCheckT = 0.1;
    const chk = checkPlacement(this.sim, cell.cx, cell.cy, this.tool);
    const tier = this.sim.balance.towers[this.tool]!.tiers[0];
    this.scene.setGhost({ type: this.tool, cx: cell.cx, cy: cell.cy, valid: chk.ok, range: tier.range, minRange: tier.minRange });
    this.scene.routes.setPreview(chk.fields && chk.reason !== 'BLOCKS_ROUTE' ? routePaths(this.sim, chk.fields).filter((p) => p.length) : null);
    if (!chk.ok && chk.reason && chk.reason !== 'OUT_OF_BOUNDS') {
      this.say(REASONS[chk.reason], this.toScreen(cell.cx + 0.5, cell.cy - 0.3), true, false);
      if (fresh) {
        if (chk.routes) for (const id of chk.routes) this.scene.routes.flashRoute(this.sim.level.routes.findIndex((x) => x.id === id));
        if (chk.enemies) this.scene.flashEnemies(chk.enemies);
      }
    } else if (fresh || this.bubbleT <= 0) {
      // A new cell that's fine: whatever was said about the last one no longer applies.
      this.hideBubble();
    }
  }

  /** Offers to clear a removable blocker (§14.3) for the level's fee. */
  promptClear(cx: number, cy: number): boolean {
    this.clearPrompt?.remove();
    this.clearPrompt = null;
    const lv = this.sim.level;
    if (this.sim.grid.terrain[cy * lv.cols + cx] !== T.BLOCKER) return false;
    const cost = lv.def.blockers.clearCost;
    const at = this.toScreen(cx + 0.5, cy - 0.2);
    const el = h(
      'div',
      { class: 'panel clear-prompt', style: { left: `${at.x}px`, top: `${at.y}px` } },
      h('p', { class: 'label' }, 'Clear this out of the way?'),
      h(
        'div',
        { class: 'actions' },
        h('button', { class: 'btn go', type: 'button', onclick: () => { const r = this.command({ t: 'clear', cx, cy }); if (r.ok) this.dismissClear(); } }, h('span', null, 'Clear'), h('span', { class: 'sub' }, icon('ui.icon.coin', 1), ` ${cost}`)),
        h('button', { class: 'btn quiet', type: 'button', onclick: () => this.dismissClear() }, 'Leave it'),
      ),
    );
    this.o.ui.append(el);
    this.clearPrompt = el;
    return true;
  }

  dismissClear(): void {
    this.clearPrompt?.remove();
    this.clearPrompt = null;
  }

  towerAt(cx: number, cy: number): number {
    const t = this.sim.state.towers.find((x) => x.cx === cx && x.cy === cy);
    return t ? t.id : 0;
  }

  select(id: number): void {
    if (id && id !== this.panel.towerId) this.o.audio.play('ui.select');
    if (id) this.panel.open(id);
    else this.panel.close();
    this.scene.setSelected(id);
  }

  selectedAnchor(): { x: number; y: number } | null {
    const t = this.sim.state.towers.find((x) => x.id === this.panel.towerId);
    return t ? this.toScreen(t.x, t.y - 0.4) : null;
  }

  cycleSpeed(): void {
    this.speed = SPEEDS[(SPEEDS.indexOf(this.speed) + 1) % SPEEDS.length]!;
  }

  setPaused(p: boolean): void {
    if (this.paused === p || this.ended) return;
    this.paused = p;
    this.o.onPause(p);
  }

  toggleRoutes(): void {
    this.showRoutes = !this.showRoutes;
    this.scene.routes.visible = this.showRoutes;
  }

  get settings(): Settings {
    return this.o.settings;
  }

  toggleMute(): void {
    this.o.toggleMute();
  }

  /** Applies the player's settings to the level (§16.6, §19, §21). Safe to call at any time. */
  applySettings(): void {
    const s = this.o.settings;
    const reduced = reducedMotion(s);
    this.scene.fx.shakeEnabled = s.shake && !reduced;
    if (!this.scene.fx.shakeEnabled) this.scene.fx.shake = 0;
    // §19: High is full particles at the device's resolution; Low is 30% particles at resolution 1.
    const q = s.quality === 'high' ? { density: 1, resolution: this.maxRes } : s.quality === 'low' ? { density: 0.3, resolution: 1 } : this.auto.current();
    this.scene.fx.density = (reduced ? 0.3 : 1) * q.density;
    this.scene.colourBlind = s.colourBlind;
    const r = this.o.app.renderer;
    if (r.resolution !== q.resolution) r.resize(window.innerWidth, window.innerHeight, q.resolution);
  }

  /** §16.1 juice: a boss gets an entrance banner. */
  private bossBanner(type: string): void {
    const name = this.o.balance.enemies[type]?.elite.name ?? 'A boss';
    const el = h('div', { class: 'boss-banner', role: 'status' }, icon('ui.icon.boss', 1.3), h('span', null, `${name} is coming!`));
    this.o.ui.append(el);
    window.setTimeout(() => el.remove(), 2800);
  }

  /** Stores the battle so far (§20), unless it's over. */
  takeSnapshot(): void {
    if (this.ended || this.sim.state.result !== 'playing') return;
    const lv = this.o.level;
    this.o.onSnapshot({
      schemaVersion: 1,
      levelId: lv.id,
      levelName: lv.name,
      difficulty: this.o.difficulty,
      loadout: this.o.loadout,
      endless: this.o.endless,
      wave: this.sim.state.waves.next,
      snap: snapshot(this.sim) as unknown as SnapshotRecord['snap'],
    });
  }

  // ------------------------------------------------------------ loop

  private frame(): void {
    const dtMs = Math.min(100, this.o.app.ticker.deltaMS);
    const dt = dtMs / 1000;
    if (this.o.settings.quality === 'auto' && this.auto.frame(dtMs)) this.applySettings();
    let n = this.clock.advance(dtMs, this.paused ? 0 : this.speed);
    const events: SimEvent[] = [];
    while (n-- > 0 && this.sim.state.result === 'playing') {
      if (this.tickTimes) {
        const t0 = performance.now();
        step(this.sim);
        this.tickTimes.push(performance.now() - t0);
      } else step(this.sim);
      events.push(...drainEvents(this.sim));
    }
    for (const ev of events) {
      if (ev.e !== 'spawn') continue;
      this.o.onSeen(ev.type, ev.elite);
      if (this.o.balance.enemies[ev.type]?.boss) this.bossBanner(ev.type);
    }
    this.scene.onEvents(events);
    if (events.some((ev) => ev.e === 'wave')) this.takeSnapshot();
    this.audio.onEvents(events, this.sim);
    // While paused the music keeps its layers rather than following a frozen field.
    this.audio.frame(this.sim, this.paused ? 0 : dt);
    this.hud.update(this.speed, this.paused, this.showRoutes);
    this.bar.update();
    this.scene.update(this.paused ? 1 : this.clock.alpha, this.paused ? 0 : dt);
    const L = this.layoutState;
    this.panel.update(this.selectedAnchor(), { w: window.innerWidth, h: window.innerHeight, cell: L.cell * this.zoom, dock: L.rails ? { left: L.rails.hud.x, right: L.rails.bar.x + L.rails.bar.w, top: L.rails.hud.y, bottom: L.rails.hud.y + L.rails.hud.h } : null });
    // R-BLOCK-4: shade the unbuildable cells while a tower is armed or dragged; redraw if the maze changes.
    const maskV = this.tool && this.sim.state.result === 'playing' ? this.sim.state.pathV : -1;
    if (maskV !== this.maskV) {
      this.maskV = maskV;
      this.scene.setBuildMask(maskV >= 0 ? unbuildableCells(this.sim) : null);
    }
    if (this.ghostCell && this.tool) {
      this.ghostCheckT -= dt;
      if (this.ghostCheckT <= 0) this.setGhost(this.ghostCell);
    }
    if (this.bubbleT > 0) {
      this.bubbleT -= dt;
      if (this.bubbleT <= 0 && !(this.ghostCell && this.tool)) this.hideBubble();
    }
    if (!this.ended && this.sim.state.result !== 'playing') {
      this.ended = true;
      const res = this.sim.state.result;
      window.setTimeout(() => this.o.onExit(res === 'won' ? 'won' : 'lost', this.sim), 900);
    }
  }
}
