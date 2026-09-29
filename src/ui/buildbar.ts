// Build bar (DESIGN.md §18.4): up to six loadout slots with icon, cost, hotkey and a
// ground/air badge. Pointer-down on a slot starts a drag (touch) or selects (mouse).
import type { Sim } from '../sim/context.ts';
import { h, setText } from './h.ts';
import { icon } from './icons.ts';
import { TOWER_BLURB, targetsLabel } from './text.ts';

export interface BuildBarActions {
  pick(type: string, e: PointerEvent): void;
}

export class BuildBar {
  readonly el: HTMLDivElement;
  private slots: { type: string; btn: HTMLButtonElement; cost: HTMLSpanElement; price: number }[] = [];
  private selected: string | null = null;

  private sim: Sim;

  /** `keyOf` gives the key bound to an action, for the tooltips (§18.6). */
  constructor(sim: Sim, actions: BuildBarActions, keyOf: (action: string) => string) {
    this.sim = sim;
    this.el = h('div', { id: 'buildbar', role: 'toolbar', 'aria-label': 'Towers' });
    this.sim.state.loadout.forEach((type, i) => {
      const def = sim.balance.towers[type]!;
      const price = def.tiers[0].cost;
      const cost = h('span', null, String(price));
      const btn = h(
        'button',
        {
          class: 'btn quiet slot',
          type: 'button',
          'data-tip-title': def.name,
          'data-tip': `${TOWER_BLURB[type] ?? ''} Drag it onto the field, or click it and then click where it goes.`,
          'data-tip-meta': `${targetsLabel(def.targets.ground, def.targets.air)} · ${price} coins · key ${keyOf(`slot${i + 1}`)}`,
          'aria-label': `${def.name}, ${price} coins, ${targetsLabel(def.targets.ground, def.targets.air)}`,
        },
        h('span', { class: 'key' }, String(i + 1)),
        icon(`ui.tower.${type}`, 1),
        h('span', { class: 'targets' }, def.targets.air ? icon('ui.icon.air', 1) : null),
        h('span', { class: 'cost' }, icon('ui.icon.coin', 1), cost),
      );
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        actions.pick(type, e);
      });
      this.slots.push({ type, btn, cost, price });
      this.el.append(btn);
    });
  }

  setArrangement(arrangement: 'bottom' | 'side' | 'rails'): void {
    this.el.classList.toggle('side', arrangement === 'side');
    this.el.classList.toggle('rails', arrangement === 'rails');
  }

  setSelected(type: string | null): void {
    if (type === this.selected) return;
    this.selected = type;
    for (const s of this.slots) s.btn.classList.toggle('is-selected', s.type === type);
  }

  update(): void {
    const cash = this.sim.state.cash;
    for (const s of this.slots) {
      const poor = cash < s.price;
      if (s.btn.classList.contains('is-poor') !== poor) s.btn.classList.toggle('is-poor', poor);
      setText(s.cost, String(s.price));
    }
  }

  slotAt(clientX: number, clientY: number): boolean {
    const r = this.el.getBoundingClientRect();
    return clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom;
  }
}
