// In-level HUD (DESIGN.md §18.4): lives, cash, wave x/y, next-wave preview, call early,
// speed, pause and the route marker toggle. Updates only what changed each frame.
import type { Sim } from '../sim/context.ts';
import { earlyBonus } from '../sim/sim.ts';
import { h, setText } from './h.ts';
import { icon, setIcon } from './icons.ts';
import { setTip } from './tooltip.ts';

export interface HudActions {
  callWave(): void;
  cycleSpeed(): void;
  togglePause(): void;
  toggleRoutes(): void;
}

/** The wave counter's tooltip, by mode (§10.1, §18.6). */
const WAVE_TIP = {
  standard: ['Wave', 'Waves sent so far, out of the total. The icons show the next wave.'],
  puzzle: ['Wave', 'Waves sent so far, out of the total. The icons show the next wave.'],
  endless: ['Wave', 'Waves survived so far. The icons show the next wave.'],
  suddenDeath: ['Hold', 'Hold out until the clock runs down. The icons show the next wave.'],
  timeTrial: ['Defeated', 'Enemies defeated, out of the target. Reach it before the clock runs out.'],
} as const;

export class Hud {
  readonly el: HTMLDivElement;
  private lives: HTMLSpanElement;
  private cash: HTMLSpanElement;
  private wave: HTMLSpanElement;
  private waveLabel: HTMLSpanElement;
  private clock: HTMLSpanElement;
  private chips: HTMLDivElement;
  private next: HTMLButtonElement;
  private nextLabel: HTMLSpanElement;
  private timer: HTMLDivElement;
  private speedBtn: HTMLButtonElement;
  private speedIcon: HTMLSpanElement;
  private pauseBtn: HTMLButtonElement;
  private pauseIcon: HTMLSpanElement;
  private routeBtn: HTMLButtonElement;
  private last = { lives: -1, cash: -1, wave: -1, chips: '', bonus: -1, speed: 0, paused: null as boolean | null, routes: true };

  private sim: Sim;
  /** The key bound to an action, as the player sees it (for the tooltips, §18.6). */
  private keyOf: (action: string) => string;

  constructor(sim: Sim, actions: HudActions, keyOf: (action: string) => string) {
    this.sim = sim;
    this.keyOf = keyOf;
    this.lives = h('span', { class: 'num' });
    this.cash = h('span', { class: 'num' });
    this.wave = h('span', { class: 'num' });
    this.waveLabel = h('span', { class: 'small' }, 'Wave');
    this.clock = h('span', { class: 'num clock' });
    this.chips = h('div', { class: 'chips' });
    this.nextLabel = h('span');
    this.timer = h('div', { class: 'timer' }, h('div'));
    this.next = h('button', { class: 'btn go', type: 'button', onclick: () => actions.callWave() }, icon('ui.icon.wave', 1.2), this.nextLabel, this.timer);
    this.speedIcon = icon('ui.icon.speed1', 1.1);
    this.speedBtn = h('button', { class: 'btn round', type: 'button', 'aria-label': 'Game speed', onclick: () => actions.cycleSpeed() }, this.speedIcon);
    this.pauseIcon = icon('ui.icon.pause', 1.1);
    this.pauseBtn = h('button', { class: 'btn round', type: 'button', 'aria-label': 'Pause', onclick: () => actions.togglePause() }, this.pauseIcon);
    this.routeBtn = h('button', { class: 'btn round is-on', type: 'button', 'aria-label': 'Show routes', 'aria-pressed': 'true', onclick: () => actions.toggleRoutes() }, icon('ui.icon.route', 1.1));
    this.el = h(
      'div',
      { id: 'hud' },
      h('div', { class: 'hud-cluster' }, h('div', { class: 'plate', 'data-tip-title': 'Lives', 'data-tip': 'Biscuits left in the Stores. Each enemy that gets through takes one; bosses take more.' }, icon('ui.icon.lives', 1.6), this.lives, h('span', { class: 'visually-hidden' }, 'lives')), h('div', { class: 'plate', 'data-tip-title': 'Cash', 'data-tip': 'Spend it on towers and upgrades. Every enemy you defeat pays a bounty.' }, icon('ui.icon.coin', 1.4), this.cash)),
      h('div', { class: 'hud-cluster' }, h('div', { class: 'plate wave', 'data-tip-title': WAVE_TIP[this.mode()][0], 'data-tip': WAVE_TIP[this.mode()][1] }, this.waveLabel, this.wave, this.clock, this.chips), h('div', { class: 'next-wave' }, this.next)),
      h('div', { class: 'hud-cluster' }, this.routeBtn, this.speedBtn, this.pauseBtn),
    );
    setTip(this.routeBtn, 'Show or hide the route markers.', 'Routes', `Key ${keyOf('routes')}`);
  }

  private mode(): keyof typeof WAVE_TIP {
    return this.sim.level.endless ? 'endless' : this.sim.level.mode;
  }

  /** Makes the lives counter wobble (a leak). */
  bumpLives(): void {
    this.lives.classList.remove('wobble');
    void this.lives.offsetWidth;
    this.lives.classList.add('wobble');
  }

  update(speed: number, paused: boolean, routes: boolean): void {
    const st = this.sim.state;
    const L = this.last;
    if (st.lives !== L.lives) {
      if (L.lives >= 0 && st.lives < L.lives) this.bumpLives();
      L.lives = st.lives;
      setText(this.lives, String(st.lives));
    }
    if (st.cash !== L.cash) {
      L.cash = st.cash;
      setText(this.cash, String(st.cash));
    }
    const total = this.sim.level.waves.length;
    const mode = this.sim.level.mode;
    const lv = this.sim.level;
    if (st.waves.next !== L.wave) {
      L.wave = st.waves.next;
      this.renderChips();
    }
    // Mode variations (§10.1): Sudden Death shows its clock, Time Trial kills and clock, Endless an open count.
    if (mode === 'suddenDeath') {
      setText(this.waveLabel, 'Hold');
      setText(this.wave, '');
    } else if (mode === 'timeTrial') {
      setText(this.waveLabel, 'Defeated');
      setText(this.wave, `${st.stats.kills}/${st.mode.target}`);
    } else if (lv.endless) {
      setText(this.wave, String(Math.max(1, st.waves.next)));
    } else setText(this.wave, `${Math.max(1, st.waves.next)}/${total}`);
    if (lv.timerTicks > 0) {
      const left = Math.ceil((st.mode.timer >= 0 ? st.mode.timer : lv.timerTicks) / 30);
      setText(this.clock, `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`);
    } else setText(this.clock, '');
    const bonus = earlyBonus(this.sim);
    const started = st.waves.started;
    const label = !started ? 'Start' : st.waves.next >= total ? 'Last wave' : mode === 'puzzle' ? 'Next' : `Next +${bonus}`;
    setText(this.nextLabel, label);
    this.next.disabled = started && st.waves.next >= total;
    this.next.setAttribute('aria-label', !started ? 'Start the first wave' : `Send the next wave now for a ${bonus} coin bonus`);
    const waveKey = `Key ${this.keyOf('wave')}`;
    if (!started) setTip(this.next, 'Send the first wave. After that they come on a timer, a little quicker each time.', 'Start', waveKey);
    else if (st.waves.next >= total) setTip(this.next, 'Every wave is on its way.', 'Last wave');
    else setTip(this.next, mode === 'puzzle' ? 'Send it now. The bar shows how long until it comes anyway.' : `Send it now for a ${bonus}-coin bonus. The bar shows how long until it comes anyway.`, 'Next wave', waveKey);
    const bar = this.timer.firstElementChild as HTMLDivElement;
    const frac = started && st.waves.next < total ? Math.max(0, Math.min(1, (st.waves.nextAt - st.tick) / this.sim.level.gapTicks[st.waves.next - 1]!)) : 0;
    bar.style.transform = `scaleX(${frac})`;
    if (speed !== L.speed) {
      L.speed = speed;
      setIcon(this.speedIcon, `ui.icon.speed${speed}`, 1.1);
      this.speedBtn.setAttribute('aria-label', `Game speed ${speed}×`);
      setTip(this.speedBtn, `Playing at ${speed}×. Press to switch between 1×, 2× and 3×.`, 'Speed', `Key ${this.keyOf('speed')}`);
    }
    if (paused !== L.paused) {
      L.paused = paused;
      setIcon(this.pauseIcon, paused ? 'ui.icon.play' : 'ui.icon.pause', 1.1);
      this.pauseBtn.setAttribute('aria-label', paused ? 'Resume' : 'Pause');
      setTip(this.pauseBtn, paused ? 'Carry on with the battle.' : 'Stop the battle and open the menu.', paused ? 'Resume' : 'Pause', `Key ${this.keyOf('pause')}`);
    }
    if (routes !== L.routes) {
      L.routes = routes;
      this.routeBtn.classList.toggle('is-on', routes);
      this.routeBtn.setAttribute('aria-pressed', String(routes));
    }
  }

  private renderChips(): void {
    const w = this.sim.level.waves[this.sim.state.waves.next];
    const key = w ? w.groups.map((g) => `${g.enemy}${g.elite}${g.count}`).join() : '';
    if (key === this.last.chips) return;
    this.last.chips = key;
    this.chips.replaceChildren();
    if (!w) return;
    // Merge groups of the same unit for a compact preview (§9.5).
    const merged = new Map<string, { enemy: string; elite: boolean; count: number }>();
    for (const g of w.groups) {
      const k = `${g.enemy}.${g.elite}`;
      const m = merged.get(k) ?? { enemy: g.enemy, elite: g.elite, count: 0 };
      m.count += g.count;
      merged.set(k, m);
    }
    for (const m of merged.values()) {
      const air = this.sim.balance.enemies[m.enemy]?.air;
      const name = this.sim.balance.enemies[m.enemy]?.[m.elite ? 'elite' : 'name'];
      const label = typeof name === 'string' ? name : (name as { name: string } | undefined)?.name ?? m.enemy;
      this.chips.append(
        h(
          'div',
          {
            class: 'chip',
            'data-tip-title': label,
            'data-tip': `${m.count} in the next wave.${m.elite ? ' Elite: tougher, and worth more.' : ''}${air ? ' Flies straight over your maze.' : ''}`,
          },
          icon(`ui.enemy.${m.enemy}.${m.elite ? 'e' : 'n'}`, 1),
          h('span', { class: 'count' }, `×${m.count}`),
          m.elite ? h('span', { class: 'badge' }, icon('ui.icon.elite', 1)) : air ? h('span', { class: 'badge' }, icon('ui.icon.air', 1)) : null,
        ),
      );
    }
  }
}
