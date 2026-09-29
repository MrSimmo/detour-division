// Mouse, touch and keyboard (DESIGN.md §18.5). Pointer Events drive every device;
// only pinch/pan is touch-specific.
import type { TargetMode } from '../data/schemas.ts';
import { deviceClass } from './platform.ts';
import type { Game } from './game.ts';
import { consumeLongPress } from '../ui/tooltip.ts';

export interface InputHandle {
  detach(): void;
  pickFromBar(type: string, e: PointerEvent): void;
}

const TAP_SLOP = 10;
const DOUBLE_TAP_MS = 320;
const MODES: TargetMode[] = ['first', 'last', 'strongest', 'closest'];

/** Keys are stored as `KeyboardEvent.key`, with single characters in lower case. */
export const normaliseKey = (key: string): string => (key.length === 1 ? key.toLowerCase() : key);

/** The action bound to a key, if any. */
export function actionFor(keys: Record<string, string>, key: string): string | undefined {
  const k = normaliseKey(key);
  for (const [action, bound] of Object.entries(keys)) if (normaliseKey(bound) === k) return action;
  return undefined;
}

export function attachInput(game: Game, canvas: HTMLCanvasElement): InputHandle {
  const pointers = new Map<number, { x: number; y: number; x0: number; y0: number; t0: number; type: string }>();
  let drag: { id: number; type: string; touch: boolean; moved: boolean; x0: number; y0: number } | null = null;
  let pinch: { d0: number; z0: number; mx: number; my: number; px: number; py: number } | null = null;
  let lastTap = 0;

  // §18.5: the drag ghost sits above the finger, by the player's ghost offset (at least 48 px).
  const fingerLift = (): number => Math.max(48, game.layoutState.cell * game.settings.ghostOffset);

  const cellUnder = (x: number, y: number): { cx: number; cy: number } | null => {
    const c = game.toCell(x, y);
    const cx = Math.floor(c.x);
    const cy = Math.floor(c.y);
    if (cx < 0 || cy < 0 || cx >= game.sim.level.cols || cy >= game.sim.level.rows) return null;
    return { cx, cy };
  };

  /** Tower under a point, with a generous radius for fingers (≥ 44 pt). */
  const towerNear = (x: number, y: number, touch: boolean): number => {
    const c = game.toCell(x, y);
    const direct = game.towerAt(Math.floor(c.x), Math.floor(c.y));
    if (direct || !touch) return direct;
    const reach = Math.max(0.5, 22 / game.layoutState.cell);
    let best = 0;
    let bestD = Infinity;
    for (const t of game.sim.state.towers) {
      const d = Math.hypot(t.x - c.x, t.y - c.y);
      if (d < reach && d < bestD) {
        best = t.id;
        bestD = d;
      }
    }
    return best;
  };

  const updateDragGhost = (x: number, y: number): void => {
    if (!drag) return;
    const lift = drag.touch ? fingerLift() : 0;
    game.setGhost(game.bar.slotAt(x, y) ? null : cellUnder(x, y - lift));
  };

  const endDrag = (x: number, y: number): void => {
    if (!drag) return;
    const d = drag;
    drag = null;
    const lift = d.touch ? fingerLift() : 0;
    if (!d.moved) {
      // §18.6: a long press showed the slot's tooltip, which doesn't also arm the tower.
      if (consumeLongPress()) return;
      // A click or tap on a slot arms it; the next click or tap on the field places it.
      game.setTool(game.tool === d.type ? null : d.type);
      return;
    }
    const cell = game.bar.slotAt(x, y) ? null : cellUnder(x, y - lift);
    if (cell) game.tryBuild(d.type, cell.cx, cell.cy);
    game.setTool(null);
  };

  const onWindowMove = (e: PointerEvent): void => {
    if (!drag || e.pointerId !== drag.id) return;
    if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > TAP_SLOP) drag.moved = true;
    if (drag.moved) {
      game.tool = drag.type;
      game.bar.setSelected(drag.type);
      updateDragGhost(e.clientX, e.clientY);
    }
  };

  const onWindowUp = (e: PointerEvent): void => {
    if (!drag || e.pointerId !== drag.id) return;
    endDrag(e.clientX, e.clientY);
  };

  // §18.5: every pointer drags from the slot and drops on the field; a press that doesn't move arms
  // the tower instead (click to arm, tap to arm).
  const pickFromBar = (type: string, e: PointerEvent): void => {
    drag = { id: e.pointerId, type, touch: e.pointerType !== 'mouse', moved: false, x0: e.clientX, y0: e.clientY };
    game.select(0);
  };

  const onDown = (e: PointerEvent): void => {
    canvas.setPointerCapture?.(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: performance.now(), type: e.pointerType });
    if (e.pointerType === 'touch' && pointers.size === 2 && deviceClass() === 'phone') {
      const [a, b] = [...pointers.values()];
      pinch = { d0: Math.hypot(a!.x - b!.x, a!.y - b!.y), z0: game.zoom, mx: (a!.x + b!.x) / 2, my: (a!.y + b!.y) / 2, px: game.pan.x, py: game.pan.y };
      game.setGhost(null);
    }
  };

  const onMove = (e: PointerEvent): void => {
    const p = pointers.get(e.pointerId);
    if (p) {
      p.x = e.clientX;
      p.y = e.clientY;
    }
    if (pinch && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      const mx = (a!.x + b!.x) / 2;
      const my = (a!.y + b!.y) / 2;
      const z = Math.max(1, Math.min(2.5, pinch.z0 * (d / Math.max(1, pinch.d0))));
      const pf = game.layoutState.playfield;
      // Keep the point under the fingers' midpoint fixed while zooming, then follow the pan.
      const k = z / pinch.z0;
      game.pan.x = mx - pf.x - (pinch.mx - pf.x - pinch.px) * k;
      game.pan.y = my - pf.y - (pinch.my - pf.y - pinch.py) * k;
      game.zoom = z;
      game.clampView();
      return;
    }
    if (drag) return;
    if (e.pointerType === 'mouse') {
      if (game.tool) game.setGhost(cellUnder(e.clientX, e.clientY));
      else {
        const c = cellUnder(e.clientX, e.clientY);
        game.scene.setHover(c ? game.towerAt(c.cx, c.cy) : 0);
      }
    }
  };

  const onUp = (e: PointerEvent): void => {
    const p = pointers.get(e.pointerId);
    pointers.delete(e.pointerId);
    if (pinch) {
      if (pointers.size < 2) pinch = null;
      return;
    }
    if (!p || drag) return;
    if (e.button === 2) return;
    const moved = Math.hypot(e.clientX - p.x0, e.clientY - p.y0) > TAP_SLOP;
    if (moved) return;
    const touch = p.type !== 'mouse';
    const cell = cellUnder(e.clientX, e.clientY);
    if (game.tool) {
      if (cell) {
        const ok = game.tryBuild(game.tool, cell.cx, cell.cy);
        // Touch builds one tower per tap-selection; the mouse keeps the tool for fast building.
        if (touch && ok) game.setTool(null);
        else if (!touch) game.setGhost(cell);
      }
      return;
    }
    const id = towerNear(e.clientX, e.clientY, touch);
    if (id) {
      game.select(id === game.panel.towerId ? 0 : id);
      return;
    }
    game.select(0);
    if (cell && game.promptClear(cell.cx, cell.cy)) return;
    game.dismissClear();
    const now = performance.now();
    if (touch && now - lastTap < DOUBLE_TAP_MS) game.resetView();
    lastTap = now;
  };

  const onContext = (e: Event): void => {
    e.preventDefault();
    game.setTool(null);
    game.select(0);
  };

  const onLeave = (): void => {
    if (!drag && game.tool) game.setGhost(null);
  };

  const onKey = (e: KeyboardEvent): void => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    // §21: every action goes through the player's bindings.
    const action = actionFor(game.settings.keys, e.key);
    if (!action) return;
    const loadout = game.sim.state.loadout;
    const slot = /^slot([1-6])$/.exec(action);
    const towerId = game.panel.towerId;
    if (slot) {
      const type = loadout[Number(slot[1]) - 1];
      if (type) game.setTool(game.tool === type ? null : type);
    } else if (action === 'cancel') {
      game.setTool(null);
      game.select(0);
    } else if (action === 'pause') {
      e.preventDefault();
      game.setPaused(!game.paused);
    } else if (action === 'speed') game.cycleSpeed();
    else if (action === 'wave') game.command({ t: 'callWave' });
    else if (action === 'routes') game.toggleRoutes();
    else if (action === 'mute') game.toggleMute();
    else if (action === 'upgrade' && towerId) game.command({ t: 'upgrade', id: towerId });
    else if (action === 'sell' && towerId) {
      if (game.panel.keySell()) game.select(0);
    } else if (action === 'target' && towerId) {
      const t = game.sim.state.towers.find((x) => x.id === towerId);
      if (t) game.command({ t: 'target', id: t.id, mode: MODES[(MODES.indexOf(t.mode) + 1) % MODES.length]! });
    }
  };

  const blockGesture = (e: Event): void => e.preventDefault();

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('pointerleave', onLeave);
  canvas.addEventListener('contextmenu', onContext);
  window.addEventListener('pointermove', onWindowMove);
  window.addEventListener('pointerup', onWindowUp);
  window.addEventListener('pointercancel', onWindowUp);
  window.addEventListener('keydown', onKey);
  document.addEventListener('gesturestart', blockGesture);
  document.addEventListener('dblclick', blockGesture);

  return {
    pickFromBar,
    detach() {
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('pointerleave', onLeave);
      canvas.removeEventListener('contextmenu', onContext);
      window.removeEventListener('pointermove', onWindowMove);
      window.removeEventListener('pointerup', onWindowUp);
      window.removeEventListener('pointercancel', onWindowUp);
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('gesturestart', blockGesture);
      document.removeEventListener('dblclick', blockGesture);
    },
  };
}
