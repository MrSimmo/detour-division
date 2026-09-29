// Test hooks for device checks where nothing can tap: the Xcode iOS Simulator (DESIGN.md §23.4)
// is driven only by URLs and screenshots. Only under ?e2e, like the other hooks:
//   diag=1        a corner badge counting errors, so a screenshot shows there were none
//   auto=title    skip the splash (audio stays locked: there has been no gesture)
//   auto=<level>  start that level on Casual, call the first wave, play at 3× speed, and pause once
//                 3 waves have launched (§23.4 step 4), so the battle stays in progress
import { P } from '../art/palette.ts';
import { levels } from './data.ts';
import type { App } from './app.ts';

const q = new URLSearchParams(location.search);
const on = q.has('e2e');

/** Call first thing at boot: counts errors from then on. */
export function installDiagnostics(): void {
  if (!on || q.get('diag') !== '1') return;
  let n = 0;
  const log: string[] = [];
  const badge = document.createElement('div');
  badge.style.cssText = `position:fixed;left:4px;bottom:4px;z-index:99;padding:2px 6px;font:12px monospace;background:${P.ink};color:${P.textOnDark};pointer-events:none`;
  const show = (): void => {
    badge.textContent = `diag: ${n} error${n === 1 ? '' : 's'}${log.length ? ` — ${log.slice(-2).join(' | ')}` : ''}`;
  };
  const note = (what: string): void => {
    n++;
    log.push(what.slice(0, 80));
    show();
  };
  window.addEventListener('error', (e) => note(e.message));
  window.addEventListener('unhandledrejection', (e) => note(String((e as PromiseRejectionEvent).reason)));
  const err = console.error.bind(console);
  console.error = (...a: unknown[]) => {
    note(a.map(String).join(' '));
    err(...a);
  };
  show();
  document.addEventListener('DOMContentLoaded', () => document.body.append(badge));
  if (document.body) document.body.append(badge);
}

/** Takes over from the splash when asked to. Returns true if it did. */
export function devDrive(app: App): boolean {
  const auto = on ? q.get('auto') : null;
  if (!auto) return false;
  if (auto === 'title') {
    app.title();
    return true;
  }
  const lv = levels[auto];
  if (!lv) return false;
  void app.play(auto, { difficulty: 'casual', loadout: lv.loadout.fixed ?? lv.loadout.bot, endless: false }).then(() => {
    const g = (window as unknown as { __game?: { sim: { state: { cash: number; waves: { next: number } } }; command(c: unknown): unknown; speed: number; setPaused(p: boolean): void } }).__game;
    if (!g) return;
    g.sim.state.cash += 400;
    for (const s of lv.bot.plan ?? []) if (s.build) g.command({ t: 'build', tower: s.build.tower, cx: s.build.cx, cy: s.build.cy });
    for (const y of [2, 4, 6, 8]) g.command({ t: 'build', tower: lv.loadout.bot[0] ?? 'rattler', cx: Math.floor(lv.grid.cols / 2), cy: y });
    g.command({ t: 'callWave' });
    g.speed = 3;
    const t = setInterval(() => {
      if (g.sim.state.waves.next < 3) return;
      g.setPaused(true);
      clearInterval(t);
    }, 250);
  });
  return true;
}
