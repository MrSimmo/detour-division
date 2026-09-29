// Screen flow (DESIGN.md §18.3): title → world map → briefing → level → result.
import type { Application } from 'pixi.js';
import type { AudioSystem } from '../audio/system.ts';
import type { Difficulty } from '../data/schemas.ts';
import { levelUnlocked, recordEndless, recordResult, totalStars, unlockedTowers } from '../meta/progression.ts';
import type { Art } from '../render/assets.ts';
import { MAP_H, MAP_W, MapScene } from '../render/mapscene.ts';
import { simSeconds } from '../sim/sim.ts';
import { expandWaves } from '../sim/waves.ts';
import type { Sim } from '../sim/context.ts';
import { briefingScreen, guideScreen, homeScreenExplainer, mapScreen, pauseScreen, resultScreen, savesScreen, settingsScreen, splashScreen, titleScreen, updateBadge, type BriefingChoice } from '../ui/screens/screens.ts';
import { updates } from './pwa.ts';
import { isIosSafariTab, safeInsets } from './platform.ts';
import { applyDocumentSettings, followOsMotion } from './settings.ts';
import { applyMenuScale } from './fit.ts';
import { deviceClass } from './platform.ts';
import { campaign } from './campaign.ts';
import { balance, levels } from './data.ts';
import { Game } from './game.ts';
import { acceptSnapshot, readSaveFile, saveFileText, type SnapshotRecord } from '../meta/save.ts';
import { decodeSaveCode, encodeSaveCode } from './savecode.ts';
import { SIM_VERSION } from '../sim/constants.ts';
import type { Snapshot } from '../sim/sim.ts';
import { flushProfile, markSeen, profile, replaceProfile, saveProfile, savesSettled, snapshots } from './profile.ts';

export class App {
  private game: Game | null = null;
  private mapScene: MapScene | null = null;
  private relayout: (() => void) | null = null;
  private pixi: Application;
  private art: Art;
  private ui: HTMLElement;
  private audio: AudioSystem;
  /** A battle that can be resumed from the title (§20), once checked. */
  private resumable: SnapshotRecord | null = null;
  private notice: string | null = null;

  /** Shown once, in Settings, if WebGPU was chosen but didn't start (§19). */
  private rendererNotice: string | null;

  constructor(pixi: Application, art: Art, ui: HTMLElement, audio: AudioSystem, rendererNotice: string | null = null) {
    this.rendererNotice = rendererNotice;
    this.pixi = pixi;
    this.art = art;
    this.ui = ui;
    this.audio = audio;
    audio.setVolumes(profile.settings);
    applyDocumentSettings(profile.settings);
    followOsMotion(() => profile.settings, () => this.game?.applySettings());
    // Profile writes are debounced; make sure the last one lands if the page goes away.
    window.addEventListener('pagehide', () => void flushProfile());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') void flushProfile();
    });
    // §21: arrow keys move focus through the buttons of whatever menu or dialog is on top.
    document.addEventListener('keydown', (e) => this.arrowFocus(e));
    // Every menu button clicks (§17.3 UI sounds); in-level actions have their own sounds.
    ui.addEventListener('click', (e) => {
      if ((e.target as Element).closest?.('.btn')) audio.play('ui.click');
    });
    // §18.2 item 6: menus re-scale on every resize; a level lays itself out (Game.relayout).
    window.addEventListener('resize', () => {
      if (!this.game) applyMenuScale();
      this.relayout?.();
    });
    // App-level hook for tests (dev, or ?e2e on production builds).
    if (import.meta.env.DEV || location.search.includes('e2e')) Object.assign(window as unknown as object, { __app: this, __profile: profile, __audio: audio, __saves: { settled: savesSettled } });
  }

  private arrowFocus(e: KeyboardEvent): void {
    const dir = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
    if (!dir || e.altKey || e.ctrlKey || e.metaKey) return;
    // Sliders and text boxes use the arrows themselves.
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    const overlays = this.ui.querySelectorAll<HTMLElement>('.overlay');
    const scope = overlays.length ? overlays[overlays.length - 1]! : this.game ? null : this.ui;
    if (!scope) return;
    const items = [...scope.querySelectorAll<HTMLElement>('button:not([disabled]), input, textarea, [tabindex="0"]')].filter((el) => el.offsetParent !== null);
    if (!items.length) return;
    e.preventDefault();
    const at = items.indexOf(document.activeElement as HTMLElement);
    const next = at < 0 ? (dir > 0 ? 0 : items.length - 1) : (at + dir + items.length) % items.length;
    items[next]!.focus();
  }

  /** The "Update ready" badge, on menu screens only (§20). */
  private badge(): void {
    updates.onReady(() => {
      if (!this.game && !this.ui.querySelector('.update-badge')) this.ui.append(updateBadge());
    });
  }

  private clear(): void {
    // Leaving a level: menus get their own scale back rather than keeping the level's HUD scale.
    if (this.game) applyMenuScale();
    this.game?.destroy();
    this.game = null;
    this.mapScene?.destroy();
    this.mapScene = null;
    this.relayout = null;
    this.ui.replaceChildren();
  }

  /** Boot splash: its button is the first gesture, which unlocks audio (§17.1). */
  splash(): void {
    this.clear();
    this.ui.append(splashScreen({ start: () => this.title() }));
  }

  /** Checks the stored battle in progress: offered on the title if it still fits this version (§20). */
  async checkResume(): Promise<void> {
    const rec = await snapshots.load();
    if (rec === undefined) return;
    const r = acceptSnapshot(rec, SIM_VERSION);
    if (r.ok && levels[r.rec.levelId]) this.resumable = r.rec;
    else {
      this.notice = "Your battle in progress was saved by an older version of the game, so it couldn't be resumed. All your stars and unlocks are safe.";
      await snapshots.clear();
    }
  }

  title(): void {
    this.clear();
    this.audio.cue('menu');
    const r = this.resumable;
    this.ui.append(
      titleScreen({
        play: () => void this.worldMap(),
        guide: () => this.guide(() => this.title()),
        settings: () => this.settings(() => this.title()),
        saves: () => this.saves(),
        resume: r ? { label: `Resume ${r.levelName}, wave ${Math.max(1, r.wave)}`, go: () => void this.play(r.levelId, { difficulty: r.difficulty as Difficulty, loadout: r.loadout, endless: r.endless }, r.snap as unknown as Snapshot) } : null,
        notice: this.notice,
      }),
    );
    this.notice = null;
    this.badge();
    // §20: once, on iOS Safari in a tab, explain Add to Home Screen (and why it keeps saves safer).
    if (!profile.flags.iosExplainer && isIosSafariTab()) {
      const el = homeScreenExplainer({
        done: () => {
          profile.flags.iosExplainer = true;
          saveProfile();
          el.remove();
        },
      });
      this.ui.append(el);
    }
  }

  /** Saves (§20): export and import. Returns to a fresh title, so an import shows straight away. */
  saves(): void {
    this.clear();
    this.ui.append(
      savesScreen({
        saveFile: () => {
          const url = URL.createObjectURL(new Blob([saveFileText(profile)], { type: 'application/json' }));
          const a = document.createElement('a');
          a.href = url;
          a.download = 'detour-division.ddsave';
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        },
        makeCode: () => encodeSaveCode(saveFileText(profile)),
        check: async (source) => {
          const text = typeof source === 'string' ? await decodeSaveCode(source) : await source.text();
          const p = readSaveFile(text);
          return {
            stars: totalStars(p),
            current: totalStars(profile),
            apply: async () => {
              await replaceProfile(p);
              this.audio.setVolumes(profile.settings);
            },
          };
        },
        back: () => this.title(),
      }),
    );
  }

  /** Any setting changed: apply it everywhere it matters, and save. */
  private settingsChanged(): void {
    this.audio.setVolumes(profile.settings);
    applyDocumentSettings(profile.settings);
    this.game?.applySettings();
    saveProfile();
  }

  settings(back: () => void): void {
    const notice = this.rendererNotice;
    this.rendererNotice = null;
    const el = settingsScreen(profile.settings, { webgpu: 'gpu' in navigator, secure: isSecureContext, notice }, {
      change: () => this.settingsChanged(),
      back: () => {
        el.remove();
        if (!this.ui.children.length) back();
      },
    });
    this.ui.append(el);
  }

  async worldMap(): Promise<void> {
    this.clear();
    this.audio.cue('menu');
    await this.art.release(['map']);
    await this.art.ensure(['map']);
    const scene = new MapScene(this.art);
    this.mapScene = scene;
    this.pixi.stage.addChild(scene.root);
    const screen = mapScreen(campaign, profile, balance, (id) => Boolean(levels[id]), {
      open: (id) => this.briefing(id),
      back: () => this.title(),
      guide: () => this.guide(() => void this.worldMap()),
    });
    this.ui.append(screen.el);
    this.badge();
    // §18.2 item 8. Desktop: the whole map fits the window. Touch: the map opens drawn larger than the
    // view (medallions need ~70 px spacing at the 44 px touch minimum), on the latest unlocked level;
    // a pinch zooms it between the whole map and MAX_ZOOM × the opening size, and one finger drags it.
    const MIN_MAP_W = 1300;
    const MAX_ZOOM = 1.5;
    const desktop = deviceClass() === 'desktop';
    const pan = { x: 0, y: 0 };
    /** The map's drawn scale; 0 until the first layout places it. */
    let k = 0;
    const focus = [...campaign.levels].reverse().find((l) => levelUnlocked(profile, campaign, balance, l.id) && levels[l.id]) ?? campaign.levels[0]!;
    /** The view rectangle (inside the safe area, below the map bar) and the zoom limits for it. */
    const view = (): { x: number; y: number; w: number; h: number; fit: number; open: number } => {
      const safe = safeInsets();
      const pad = 12;
      const top = 64;
      const w = innerWidth - safe.l - safe.r - pad * 2;
      const h = innerHeight - safe.t - safe.b - pad - top;
      const fit = Math.min(w / MAP_W, h / MAP_H);
      return { x: safe.l + pad, y: safe.t + top, w, h, fit, open: desktop ? fit : Math.max(fit, Math.min(MIN_MAP_W, 2.4 * w) / MAP_W) };
    };
    this.relayout = () => {
      const v = view();
      if (!k) {
        k = v.open;
        pan.x = v.w / 2 - focus.x * MAP_W * k;
        pan.y = v.h / 2 - focus.y * MAP_H * k;
      }
      k = desktop ? v.fit : Math.max(v.fit, Math.min(v.open * MAX_ZOOM, k));
      const r = scene.layout(v.x, v.y, v.w, v.h, innerWidth, innerHeight, k * MAP_W, pan);
      pan.x = r.x - v.x;
      pan.y = r.y - v.y;
      const menuU = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui-scale')) || 1;
      // Desktop: the medallions (sized for a map MIN_MAP_W wide) scale with the map, never above the menu
      // scale. Touch: full size from the opening zoom up, shrinking with the picture below it (V-2).
      const shrink = Math.min(1, k / v.open);
      screen.layout(r, desktop ? Math.min(menuU, r.w / MIN_MAP_W) : shrink < 1 ? menuU * shrink : null, desktop || shrink >= 1 ? null : 44 * shrink);
    };
    this.relayout();
    // Pointers on the map (the canvas, or a medallion): one drags, two pinch (touch only).
    const pointers = new Map<number, { x: number; y: number }>();
    let drag: { x: number; y: number; px: number; py: number } | null = null;
    let pinch: { d0: number; k0: number; mx: number; my: number; px: number; py: number } | null = null;
    /** The pointer moved far enough to count as a drag, so the medallion under it doesn't open. */
    let moved = false;
    const canvas = this.pixi.canvas;
    const nodesLayer = screen.el.querySelector<HTMLElement>('.map-nodes')!;
    const startDrag = (): void => {
      const [p] = [...pointers.values()];
      drag = p ? { x: p.x, y: p.y, px: pan.x, py: pan.y } : null;
    };
    const down = (e: PointerEvent): void => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 1) moved = false;
      if (pointers.size === 2 && e.pointerType === 'touch' && !desktop) {
        const [a, b] = [...pointers.values()];
        pinch = { d0: Math.hypot(a!.x - b!.x, a!.y - b!.y), k0: k, mx: (a!.x + b!.x) / 2, my: (a!.y + b!.y) / 2, px: pan.x, py: pan.y };
        drag = null;
      } else if (pointers.size === 1) startDrag();
    };
    const move = (e: PointerEvent): void => {
      const p = pointers.get(e.pointerId);
      if (!p) return;
      p.x = e.clientX;
      p.y = e.clientY;
      if (pinch && pointers.size >= 2) {
        const [a, b] = [...pointers.values()];
        const v = view();
        const z = Math.max(v.fit, Math.min(v.open * MAX_ZOOM, pinch.k0 * (Math.hypot(a!.x - b!.x, a!.y - b!.y) / Math.max(1, pinch.d0))));
        // Keep the map point that was under the fingers' midpoint under it, and follow the midpoint.
        const mx = (a!.x + b!.x) / 2;
        const my = (a!.y + b!.y) / 2;
        pan.x = mx - v.x - (pinch.mx - v.x - pinch.px) * (z / pinch.k0);
        pan.y = my - v.y - (pinch.my - v.y - pinch.py) * (z / pinch.k0);
        k = z;
        moved = true;
      } else if (drag) {
        if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 8) moved = true;
        if (!moved) return;
        pan.x = drag.px + e.clientX - drag.x;
        pan.y = drag.py + e.clientY - drag.y;
      } else return;
      this.relayout?.();
    };
    const up = (e: PointerEvent): void => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = null;
      // A finger left on the glass after a pinch carries on as a drag from where it is.
      if (pointers.size === 1) startDrag();
      else if (!pointers.size) drag = null;
    };
    // A drag that started on a medallion pans; it doesn't open the level (§18.2 item 8).
    const swallow = (e: MouseEvent): void => {
      if (!moved) return;
      e.stopPropagation();
      e.preventDefault();
    };
    canvas.addEventListener('pointerdown', down);
    nodesLayer.addEventListener('pointerdown', down);
    nodesLayer.addEventListener('click', swallow, true);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    const prevDestroy = scene.destroy.bind(scene);
    scene.destroy = () => {
      canvas.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      prevDestroy();
    };
    // Test hook: the map's zoom limits and scale (R-LAYOUT-5).
    if (import.meta.env.DEV || location.search.includes('e2e')) Object.assign(window as unknown as object, { __map: { zoom: () => ({ k, ...view() }) } });
  }

  briefing(id: string): void {
    const lv = levels[id];
    if (!lv) return;
    const el = briefingScreen(lv, profile, balance, {
      start: (c) => void this.play(id, c),
      close: () => el.remove(),
    });
    this.ui.append(el);
  }

  async play(id: string, c: BriefingChoice, restore?: Snapshot): Promise<void> {
    const lv = levels[id]!;
    // Starting (or resuming) a battle replaces whatever was in progress.
    this.resumable = null;
    if (!restore) void snapshots.clear();
    if (!lv.loadout.fixed) profile.loadouts[id] = c.loadout;
    saveProfile();
    this.clear();
    // Load the zone's terrain and the art for whichever bosses these waves bring.
    const bosses = new Set<string>();
    for (const w of expandWaves(lv, balance, c.endless ? balance.modes.endless.difficulty : c.difficulty, c.endless)) for (const g of w.groups) if (balance.enemies[g.enemy]!.boss) bosses.add(g.enemy);
    const needs = [`terrain-z${lv.zone}`, ...[...bosses].map((b) => `boss-${b}`)];
    await this.art.release(needs);
    await this.art.ensure(needs);
    const before = new Set(unlockedTowers(profile, balance));
    const game = new Game({
      app: this.pixi,
      art: this.art,
      balance,
      level: lv,
      difficulty: c.difficulty,
      loadout: c.loadout,
      endless: c.endless,
      ui: this.ui,
      audio: this.audio,
      settings: profile.settings,
      toggleMute: () => {
        profile.settings.muted = !profile.settings.muted;
        this.settingsChanged();
      },
      ...(restore ? { restore } : {}),
      onSnapshot: (rec) => void snapshots.save(rec),
      onExit: (result, sim) => this.finished(id, c, result, sim, before),
      onPause: (paused) => {
        const existing = this.ui.querySelector('.pause-overlay');
        existing?.remove();
        if (!paused) return;
        const el = pauseScreen({ resume: () => game.setPaused(false), restart: () => void this.play(id, c), settings: () => this.settings(() => {}), quit: () => void this.worldMap() });
        el.classList.add('pause-overlay');
        this.ui.append(el);
      },
      onSeen: (type, elite) => void markSeen(`enemy.${type}.${elite ? 'e' : 'n'}`),
    });
    this.game = game;
    // A resumed battle opens paused, on the pause menu, so the player picks it back up when ready.
    if (restore) game.setPaused(true);
  }

  private finished(id: string, c: BriefingChoice, result: 'won' | 'lost' | 'quit', sim: Sim, before: Set<string>): void {
    void snapshots.clear();
    if (result === 'quit') return void this.worldMap();
    const st = sim.state;
    const won = result === 'won' && !c.endless;
    const wave = Math.max(1, st.waves.next);
    if (c.endless) recordEndless(profile, id, Math.max(0, st.waves.next - 1));
    else recordResult(profile, id, c.difficulty as Difficulty, { won, lives: st.lives, seconds: simSeconds(sim), waves: wave, kills: st.stats.kills });
    saveProfile();
    const unlocked = unlockedTowers(profile, balance).filter((t) => !before.has(t));
    const i = campaign.levels.findIndex((l) => l.id === id);
    const next = campaign.levels[i + 1];
    const el = resultScreen(
      { won, endless: c.endless, stars: profile.stars[id] ?? 0, lives: st.lives, wave, kills: st.stats.kills, seconds: simSeconds(sim), unlocked, hasNext: Boolean(next && levels[next.id]) },
      balance,
      { next: () => void (next ? this.worldMap().then(() => this.briefing(next.id)) : this.worldMap()), retry: () => void this.play(id, c), map: () => void this.worldMap() },
    );
    this.ui.append(el);
    // The stars chime once the result card is up (the victory fanfare is still ringing).
    const earned = won ? (profile.stars[id] ?? 0) : 0;
    if (earned > 0) window.setTimeout(() => this.audio.stinger(`star${earned}`), 600);
  }

  guide(back: () => void): void {
    const el = guideScreen(profile, balance, {
      back: () => {
        el.remove();
        if (!this.ui.children.length) back();
      },
    });
    this.ui.append(el);
  }
}
