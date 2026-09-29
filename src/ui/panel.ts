// Tower panel (DESIGN.md §18.4): name and tier pips, stats, upgrade with cost and stat
// changes, sell with the refund shown, and targeting priority.
import type { TargetMode, TowerTierDef } from '../data/schemas.ts';
import type { Sim } from '../sim/context.ts';
import { sellValue } from '../sim/sim.ts';
import type { Tower } from '../sim/types.ts';
import { h } from './h.ts';
import { icon } from './icons.ts';
import { TARGET_LABEL, TARGET_TIP, TOWER_BLURB, targetsLabel } from './text.ts';

export interface PanelActions {
  upgrade(id: number): void;
  sell(id: number): void;
  target(id: number, mode: TargetMode): void;
  close(): void;
}

const MODES: TargetMode[] = ['first', 'last', 'strongest', 'closest'];

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(n < 10 ? 2 : 1).replace(/0+$/, '').replace(/\.$/, '');
}

function statRows(t: TowerTierDef, next: TowerTierDef | undefined): [string, string, string | null][] {
  const rows: [string, string, string | null][] = [];
  const add = (label: string, a: number, b: number | undefined, unit = ''): void => {
    rows.push([label, `${fmt(a)}${unit}`, b !== undefined && b !== a ? `${fmt(b)}${unit}` : null]);
  };
  const pct = (v: number | undefined): number | undefined => (v === undefined ? undefined : Math.round(v * 100));
  if (t.damage > 0) add(t.cone && t.dmgType === 'fire' ? 'Damage per second' : 'Damage', t.damage, next?.damage);
  if (t.rate !== 1 || t.charge > 0) add(t.charge > 0 ? 'Shots' : 'Rate', t.rate, next?.rate, '/s');
  add(t.auraRate > 0 ? 'Aura range' : 'Range', t.range, next?.range);
  if (t.jumps > 0) add('Chain jumps', t.jumps, next?.jumps);
  if (t.charge > 0) add('Charge', t.charge, next?.charge, 's');
  if (t.freeze > 0) add('Freeze', t.freeze, next?.freeze, 's');
  if (t.brittle > 0) add('Brittle', pct(t.brittle)!, pct(next?.brittle), '%');
  if (t.burnDps > 0) add('Burn', t.burnDps, next?.burnDps, '/s');
  if (t.auraRate > 0 || (next && next.auraRate > 0)) add('Faster firing', pct(t.auraRate)!, pct(next?.auraRate), '%');
  if (t.auraDamage > 0 || (next && next.auraDamage > 0)) add('Extra damage', pct(t.auraDamage)!, pct(next?.auraDamage), '%');
  if (t.reverse > 0) add('About turn', t.reverse, next?.reverse, 's');
  if (t.bubbles > 0) add('Bubbles', t.bubbles, next?.bubbles);
  if (t.shred > 0) add('Armour stripped', t.shred, next?.shred);
  if (t.bomblets > 0 || (next && next.bomblets > 0)) add('Bomblets', t.bomblets, next?.bomblets);
  if (t.slow > 0) add('Slow', Math.round(t.slow * 100), next ? Math.round(next.slow * 100) : undefined, '%');
  if (t.splash > 0) add('Splash', t.splash, next?.splash);
  if (t.salvo > 1 || (next && next.salvo > 1)) add('Salvo', t.salvo, next?.salvo);
  if (t.armourPen > 0 || (next && next.armourPen > 0)) add('Armour pierce', t.armourPen, next?.armourPen);
  if (t.minRange > 0) rows.push(['Minimum range', fmt(t.minRange), null]);
  return rows;
}

export class TowerPanel {
  el: HTMLDivElement | null = null;
  towerId = 0;
  private sellArmed = false;
  private key = '';

  private sim: Sim;

  private root: HTMLElement;

  private actions: PanelActions;

  constructor(sim: Sim, root: HTMLElement, actions: PanelActions) {
    this.sim = sim;

    this.root = root;

    this.actions = actions;}

  open(id: number): void {
    this.towerId = id;
    this.sellArmed = false;
    this.key = '';
  }

  close(): void {
    this.towerId = 0;
    this.el?.remove();
    this.el = null;
  }

  /** Arms or confirms a keyboard sell (press S twice). Returns true when it sold. */
  keySell(): boolean {
    if (!this.towerId) return false;
    if (this.sellArmed) {
      this.actions.sell(this.towerId);
      return true;
    }
    this.sellArmed = true;
    this.key = '';
    return false;
  }

  /** `cell` is the on-screen cell size. `dock` (phones, §18.4) holds the panel beside the map: the HUD
   * column's left edge, the build bar's right edge, and the columns' top and bottom. */
  update(anchor: { x: number; y: number } | null, bounds: { w: number; h: number; cell: number; dock: { left: number; right: number; top: number; bottom: number } | null }): void {
    const t = this.towerId ? this.sim.state.towers.find((x) => x.id === this.towerId) : undefined;
    if (!t || !anchor) {
      if (this.el) this.close();
      return;
    }
    const k = `${t.id}.${t.tier}.${t.mode}.${this.sim.state.cash >= this.upgradeCost(t)}.${this.sellArmed}`;
    if (k !== this.key) {
      this.key = k;
      const fresh = this.render(t);
      fresh.classList.toggle('docked', bounds.dock !== null);
      if (this.el) this.el.replaceWith(fresh);
      else this.root.append(fresh);
      this.el = fresh;
    }
    const el = this.el!;
    const w = el.offsetWidth;
    const ht = el.offsetHeight;
    if (bounds.dock) {
      const d = bounds.dock;
      // Over the HUD column unless that would cover the tower; then over the build bar; if both would,
      // whichever covers it less.
      const left = d.left;
      const right = d.right - w;
      const overL = left + w + bounds.cell / 2 - anchor.x;
      const overR = anchor.x + bounds.cell / 2 - right;
      el.style.left = `${overL <= 0 || overL <= overR ? left : right}px`;
      el.style.top = `${Math.max(d.top, Math.min(d.bottom - ht, anchor.y - ht / 2))}px`;
      return;
    }
    const gap = Math.max(40, bounds.cell * 0.9);
    // Beside the tower, flipped to whichever side has room; clamped to the screen.
    let x = anchor.x + gap;
    if (x + w > bounds.w - 8) x = anchor.x - gap - w;
    let y = anchor.y - ht / 2;
    x = Math.max(8, Math.min(bounds.w - w - 8, x));
    y = Math.max(8, Math.min(bounds.h - ht - 8, y));
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
  }

  private upgradeCost(t: Tower): number {
    const tiers = this.sim.balance.towers[t.type]!.tiers;
    return t.tier < tiers.length - 1 ? tiers[t.tier + 1]!.cost : Infinity;
  }

  private render(t: Tower): HTMLDivElement {
    const def = this.sim.balance.towers[t.type]!;
    const tier = def.tiers[t.tier]!;
    const next = def.tiers[t.tier + 1];
    const refund = sellValue(this.sim, t);
    const up = this.upgradeCost(t);
    const rows = statRows(tier, next);
    const stats = h('dl', { class: 'stats' }, h('dt', null, 'Hits'), h('dd', null, targetsLabel(def.targets.ground, def.targets.air)));
    for (const [label, value, after] of rows) {
      stats.append(h('dt', null, label), h('dd', null, value, after ? h('span', { class: 'delta' }, ` → ${after}`) : null));
    }
    const upgrade = next
      ? h('button', { class: `btn go${this.sim.state.cash < up ? ' is-disabled' : ''}`, type: 'button', 'aria-label': `Upgrade for ${up} coins`, 'data-tip-title': `Upgrade to tier ${t.tier + 2}`, 'data-tip': `Costs ${up} coins. The arrows above show what changes.`, onclick: () => this.actions.upgrade(t.id) }, h('span', null, icon('ui.icon.upgrade', 1), ' Upgrade'), h('span', { class: 'sub' }, icon('ui.icon.coin', 1), ` ${up}`))
      : h('button', { class: 'btn quiet is-disabled', type: 'button', disabled: true }, 'Fully upgraded');
    const sell = h(
      'button',
      {
        class: 'btn stop',
        type: 'button',
        'aria-label': `Sell for ${refund} coins`,
        'data-tip-title': 'Sell',
        'data-tip': `Get ${refund} coins back: three quarters of what it cost. The road opens up again.`,
        onclick: () => this.actions.sell(t.id),
      },
      h('span', null, this.sellArmed ? 'Sure?' : 'Sell'),
      h('span', { class: 'sub' }, icon('ui.icon.coin', 1), ` +${refund}`),
    );
    const seg = h('div', { class: 'segmented', role: 'radiogroup', 'aria-label': 'Targeting' });
    for (const m of MODES) {
      seg.append(h('button', { class: `btn quiet${t.mode === m ? ' is-on' : ''}`, type: 'button', role: 'radio', 'aria-checked': String(t.mode === m), 'data-tip': TARGET_TIP[m], onclick: () => this.actions.target(t.id, m) }, TARGET_LABEL[m]));
    }
    const pips = h('div', { class: 'pips', 'aria-label': `Tier ${t.tier + 1} of 3` }, ...[0, 1, 2].map((i) => h('span', { class: i <= t.tier ? 'on' : '' })));
    return h(
      'div',
      { class: 'panel', role: 'dialog', 'aria-label': def.name },
      h('div', { class: 'head' }, icon(`ui.tower.${t.type}`, 1, 'icon portrait'), h('div', null, h('h2', null, def.name), pips), h('button', { class: 'btn quiet close', type: 'button', 'aria-label': 'Close', 'data-tip': 'Close', onclick: () => this.actions.close() }, icon('ui.icon.close', 0.8))),
      h('p', { class: 'label blurb' }, TOWER_BLURB[t.type] ?? ''),
      stats,
      h('div', { class: 'actions' }, upgrade, sell),
      def.targeting ? h('div', { class: 'label seg-label' }, 'Target') : null,
      def.targeting ? seg : null,
    );
  }
}
