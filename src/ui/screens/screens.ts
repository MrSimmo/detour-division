// Menu screens (DESIGN.md §18.3): boot splash, title, settings, world map, level briefing,
// result, pause and field guide. Plain DOM built with h() (ADR-0005); the app wires the callbacks.
import type { BalanceDef, Difficulty, LevelDef } from '../../data/schemas.ts';
import { DEFAULT_KEYS, endlessUnlocked, levelUnlocked, totalStars, unlockedTowers, zoneOpen, type Campaign, type CampaignLevel, type Profile, type Settings } from '../../meta/progression.ts';
import { h } from '../h.ts';
import { icon } from '../icons.ts';
import { DIFFICULTY_LABEL, ENEMY_FLAVOUR, MODE_NAME, MODE_TEXT, TOWER_BLURB, TOWER_FLAVOUR, keyName, targetsLabel } from '../text.ts';

const DIFFS: Difficulty[] = ['casual', 'tough', 'heroic'];

function stars(n: number, size = 1): HTMLElement {
  return h('span', { class: 'star-row', 'aria-label': `${n} of 3 stars` }, ...[0, 1, 2].map((i) => icon(i < n ? 'ui.icon.star' : 'ui.icon.star-empty', size)));
}

// ------------------------------------------------------------ boot splash

/** The first screen. Its button is the gesture that unlocks audio (§17.1). */
export function splashScreen(on: { start(): void }): HTMLElement {
  return h(
    'div',
    { class: 'overlay title-screen splash' },
    h('div', { class: 'card' }, h('div', { class: 'title' }, 'Detour Division'), h('button', { class: 'btn go big', type: 'button', onclick: on.start }, 'Tap to start')),
  );
}

// ------------------------------------------------------------ settings

const VOLUMES = [
  ['master', 'Master'],
  ['music', 'Music'],
  ['sfx', 'Effects'],
  ['ui', 'Buttons'],
] as const;

/** Key actions in the order the Controls tab lists them (§18.5), with their labels. */
const ACTIONS: [string, string][] = [
  ['slot1', 'Build slot 1'],
  ['slot2', 'Build slot 2'],
  ['slot3', 'Build slot 3'],
  ['slot4', 'Build slot 4'],
  ['slot5', 'Build slot 5'],
  ['slot6', 'Build slot 6'],
  ['cancel', 'Cancel'],
  ['pause', 'Pause'],
  ['speed', 'Game speed'],
  ['wave', 'Call the next wave'],
  ['upgrade', 'Upgrade tower'],
  ['sell', 'Sell tower'],
  ['target', 'Change targeting'],
  ['routes', 'Show routes'],
  ['mute', 'Sound on or off'],
];

const keyLabel = keyName;
const normalise = (k: string): string => (k.length === 1 ? k.toLowerCase() : k);

/** A labelled one-of-several choice, as a radio group of buttons. `tips` explains each option (§18.6). */
function choice<T extends string>(label: string, options: [T, string][], value: () => T, pick: (v: T) => void, disabled: (v: T) => boolean = () => false, tips: Partial<Record<T, string>> = {}): HTMLElement {
  const group = h('div', { class: 'tabs choice', role: 'radiogroup', 'aria-label': label });
  const draw = (): void => {
    group.replaceChildren(
      ...options.map(([v, text]) =>
        h(
          'button',
          // aria-disabled, not `disabled`: a disabled button gets no touch events, so a long press
          // could never show the tooltip that says why the option is off (R-GPU-1).
          { class: `btn quiet${v === value() ? ' is-on' : ''}`, type: 'button', role: 'radio', 'aria-checked': String(v === value()), 'aria-disabled': disabled(v) && 'true', 'data-tip': tips[v], onclick: () => disabled(v) || (pick(v), draw()) },
          text,
        ),
      ),
    );
  };
  draw();
  return h('div', { class: 'setting' }, h('span', { class: 'label' }, label), group);
}

export interface SettingsEnv {
  /** WebGPU is available in this browser. */
  webgpu: boolean;
  /** The page is a secure context; browsers expose WebGPU only there (§19). */
  secure: boolean;
  /** A one-time message to show on opening (the WebGPU fallback, §19). */
  notice: string | null;
}

/** Settings (§18.3 screen 8): Sound, Display and Controls. */
export function settingsScreen(s: Settings, env: SettingsEnv, on: { change(): void; back(): void }): HTMLElement {
  let tab: 'sound' | 'display' | 'controls' = 'sound';
  const body = h('div', { class: 'settings-body' });
  const tabs = h('div', { class: 'tabs', role: 'tablist' });
  const status = h('p', { class: 'notice', role: 'status', style: { display: 'none' } });
  const say = (text: string): void => {
    status.textContent = text;
    status.style.display = text ? '' : 'none';
  };
  const set = <K extends keyof Settings>(k: K, v: Settings[K]): void => {
    s[k] = v;
    on.change();
  };

  const sound = (): HTMLElement[] => {
    const rows = VOLUMES.map(([key, label]) => {
      const value = h('span', { class: 'value' }, `${Math.round(s[key] * 100)}%`);
      const input = h('input', { type: 'range', min: '0', max: '100', step: '5', value: String(Math.round(s[key] * 100)), 'aria-label': `${label} volume` });
      input.addEventListener('input', () => {
        s[key] = Number(input.value) / 100;
        value.textContent = `${input.value}%`;
        on.change();
      });
      return h('label', { class: 'setting slider' }, h('span', { class: 'label' }, label), input, value);
    });
    const mute = h('button', { class: 'btn', type: 'button', 'aria-pressed': String(s.muted) }, s.muted ? 'Sound off' : 'Sound on');
    mute.addEventListener('click', () => {
      set('muted', !s.muted);
      mute.setAttribute('aria-pressed', String(s.muted));
      mute.textContent = s.muted ? 'Sound off' : 'Sound on';
    });
    return [h('div', { class: 'settings' }, ...rows), mute];
  };

  const display = (): HTMLElement[] => {
    const offsetValue = h('span', { class: 'value' }, `${s.ghostOffset.toFixed(1)}`);
    const offset = h('input', { type: 'range', min: '0.8', max: '2.4', step: '0.1', value: String(s.ghostOffset), 'aria-label': 'Drag ghost offset, in cells' });
    offset.addEventListener('input', () => {
      s.ghostOffset = Number(offset.value);
      offsetValue.textContent = s.ghostOffset.toFixed(1);
      on.change();
    });
    const onOff = (label: string, k: 'shake' | 'colourBlind' | 'routes', yes = 'On', no = 'Off'): HTMLElement =>
      choice(label, [['on', yes], ['off', no]], () => (s[k] ? 'on' : 'off'), (v) => set(k, v === 'on'));
    return [
      h(
        'div',
        { class: 'settings' },
        choice('Quality', [['auto', 'Auto'], ['high', 'High'], ['low', 'Low']], () => s.quality, (v) => set('quality', v)),
        choice(
          'Renderer',
          [['auto', 'Auto'], ['webgl', 'WebGL'], ['webgpu', 'WebGPU']],
          () => s.renderer,
          (v) => {
            set('renderer', v);
            say('The renderer changes next time you open the game.');
          },
          (v) => v === 'webgpu' && !env.webgpu,
          {
            auto: 'Recommended. Picks the fastest way of drawing the game that works on this device.',
            webgl: 'Always draw with WebGL. It works almost everywhere.',
            webgpu: env.webgpu
              ? 'Try the newer WebGPU first. The game falls back to WebGL if it won\'t start.'
              : env.secure
                ? 'This browser has no WebGPU.'
                : 'WebGPU only works when the game is opened from a secure (https) address. This copy was opened over plain http.',
          },
        ),
        onOff('Screen shake', 'shake'),
        choice('Reduced motion', [['auto', 'Auto'], ['on', 'On'], ['off', 'Off']], () => s.reducedMotion, (v) => set('reducedMotion', v)),
        onOff('Colour-blind colours', 'colourBlind'),
        onOff('Route markers', 'routes', 'Shown', 'Hidden'),
        h('label', { class: 'setting slider' }, h('span', { class: 'label' }, 'Drag ghost offset'), offset, offsetValue),
      ),
    ];
  };

  // Key capture for the Controls tab: one listener for the life of the screen, removed on Done.
  let waiting: string | null = null;
  let onKey: ((e: KeyboardEvent) => void) | null = null;
  const capture = (e: KeyboardEvent): void => onKey?.(e);
  window.addEventListener('keydown', capture, { capture: true });

  const controls = (): HTMLElement[] => {
    waiting = null;
    const reset = h('button', { class: 'btn', type: 'button', onclick: () => ((s.keys = { ...DEFAULT_KEYS }), on.change(), say('Keys are back to the defaults.'), draw()) }, 'Reset keys');
    const list = h('div', { class: 'settings keys' });
    // Reset keys is the grid's last cell, so on a short screen it shares a row with the keys (R-LAYOUT-3).
    const draw = (): void => {
      list.replaceChildren(
        ...ACTIONS.map(([action, label]) =>
          h(
            'div',
            { class: 'setting' },
            h('span', { class: 'label' }, label),
            h(
              'button',
              { class: `btn quiet key${waiting === action ? ' is-on' : ''}`, type: 'button', 'aria-label': `${label}: ${keyLabel(s.keys[action] ?? '')}. Change`, onclick: () => ((waiting = action), say(`Press a key for "${label}", or Esc to cancel.`), draw()) },
              waiting === action ? '…' : keyLabel(s.keys[action] ?? ''),
            ),
          ),
        ),
        h('div', { class: 'setting reset' }, reset),
      );
    };
    onKey = (e: KeyboardEvent): void => {
      if (!waiting || !list.isConnected) return;
      e.preventDefault();
      e.stopPropagation();
      const action = waiting;
      waiting = null;
      if (e.key === 'Escape' && action !== 'cancel') {
        say('');
        return draw();
      }
      const k = normalise(e.key);
      // §21: a key can only do one thing; taking one that's in use swaps the two bindings.
      const clash = Object.entries(s.keys).find(([a, bound]) => a !== action && normalise(bound) === k)?.[0];
      if (clash) s.keys[clash] = s.keys[action] ?? '';
      s.keys[action] = k;
      on.change();
      const label = (a: string): string => ACTIONS.find(([x]) => x === a)?.[1] ?? a;
      say(clash ? `${keyLabel(k)} now does "${label(action)}". "${label(clash)}" moved to ${keyLabel(s.keys[clash]!)}.` : `${keyLabel(k)} now does "${label(action)}".`);
      draw();
    };
    draw();
    return [list];
  };

  const drawTabs = (): void => {
    tabs.replaceChildren(
      ...(['sound', 'display', 'controls'] as const).map((t) =>
        h('button', { class: `btn quiet${t === tab ? ' is-on' : ''}`, type: 'button', role: 'tab', 'aria-selected': String(t === tab), onclick: () => ((tab = t), say(''), drawTabs()) }, t === 'sound' ? 'Sound' : t === 'display' ? 'Display' : 'Controls'),
      ),
    );
    body.replaceChildren(...(tab === 'sound' ? sound() : tab === 'display' ? display() : controls()));
  };
  drawTabs();
  if (env.notice) say(env.notice);
  return h(
    'div',
    { class: 'overlay opaque settings-screen' },
    h(
      'div',
      { class: 'card settings-card', role: 'dialog', 'aria-label': 'Settings' },
      h('h1', null, 'Settings'),
      tabs,
      body,
      status,
      h(
        'button',
        {
          class: 'btn go',
          type: 'button',
          onclick: () => {
            window.removeEventListener('keydown', capture, { capture: true });
            on.back();
          },
        },
        'Done',
      ),
    ),
  );
}

// ------------------------------------------------------------ saves

export interface SavesActions {
  /** Downloads the `.ddsave` file. */
  saveFile(): void;
  /** Resolves to the text code (the screen offers to copy it). */
  makeCode(): Promise<string>;
  /** Reads an imported file or code; resolves to a summary for the confirmation, or rejects with a plain reason. */
  check(source: File | string): Promise<{ stars: number; current: number; apply(): Promise<void> }>;
  back(): void;
}

/** Saves (§18.3 screen 9, §20): export and import, as a file and as a text code. */
export function savesScreen(on: SavesActions): HTMLElement {
  const status = h('p', { class: 'notice', role: 'status', style: { display: 'none' } });
  const say = (text: string): void => {
    status.textContent = text;
    status.style.display = '';
  };
  const codeBox = h('textarea', { class: 'save-code', rows: 3, 'aria-label': 'Save code', spellcheck: false, autocomplete: 'off' }) as HTMLTextAreaElement;
  const confirmRow = h('div', { class: 'row', style: { display: 'none' } });
  const offer = async (source: File | string): Promise<void> => {
    try {
      const r = await on.check(source);
      confirmRow.replaceChildren(
        h('button', { class: 'btn stop', type: 'button', onclick: () => void r.apply().then(() => say('Loaded. Welcome back.')) }, 'Replace my progress'),
        h('button', { class: 'btn quiet', type: 'button', onclick: () => ((confirmRow.style.display = 'none'), say('Nothing was changed.')) }, 'Keep mine'),
      );
      confirmRow.style.display = '';
      say(`This save has ${r.stars} ${r.stars === 1 ? 'star' : 'stars'}. Loading it replaces the progress on this device (${r.current} ${r.current === 1 ? 'star' : 'stars'}).`);
    } catch (e) {
      say(`That didn't load: ${(e as Error).message}.`);
    }
  };
  const file = h('input', { type: 'file', accept: '.ddsave,application/json', class: 'visually-hidden', 'aria-label': 'Save file to load' }) as HTMLInputElement;
  file.addEventListener('change', () => {
    const f = file.files?.[0];
    if (f) void offer(f);
    file.value = '';
  });
  return h(
    'div',
    { class: 'overlay opaque settings-screen' },
    h(
      'div',
      { class: 'card saves', role: 'dialog', 'aria-label': 'Saves' },
      h('h1', null, 'Saves'),
      // Export and import as two groups, side by side on a short landscape screen (§18.2 item 7).
      h(
        'div',
        { class: 'saves-cols' },
        h(
          'div',
          { class: 'saves-col' },
          h('p', null, 'Keep a copy of your progress, or move it to another device.'),
          h(
            'div',
            { class: 'row' },
            h('button', { class: 'btn', type: 'button', onclick: on.saveFile }, 'Save to a file'),
            h(
              'button',
              {
                class: 'btn',
                type: 'button',
                onclick: () =>
                  void on.makeCode().then(async (code) => {
                    codeBox.value = code;
                    try {
                      await navigator.clipboard.writeText(code);
                      say('Save code copied.');
                    } catch {
                      codeBox.select();
                      say('Copy the code from the box.');
                    }
                  }),
              },
              'Copy a save code',
            ),
          ),
        ),
        h('div', { class: 'saves-col' }, codeBox, h('div', { class: 'row' }, h('button', { class: 'btn', type: 'button', onclick: () => file.click() }, 'Load a file'), h('button', { class: 'btn', type: 'button', onclick: () => void offer(codeBox.value) }, 'Load the code'))),
      ),
      file,
      status,
      confirmRow,
      h('button', { class: 'btn go', type: 'button', onclick: on.back }, 'Done'),
    ),
  );
}

// ------------------------------------------------------------ iOS Add to Home Screen

/** One-time explainer for iOS and iPadOS Safari (§20). */
export function homeScreenExplainer(on: { done(): void }): HTMLElement {
  return h(
    'div',
    { class: 'overlay opaque' },
    h(
      'div',
      { class: 'card explainer', role: 'dialog', 'aria-label': 'Add to Home Screen' },
      h('h1', null, 'Add to Home Screen'),
      h('ol', { class: 'steps' }, h('li', null, 'Tap Share in Safari. On newer iPhones and iPads it is inside the ⋯ menu.'), h('li', null, 'Choose ', h('b', null, 'Add to Home Screen'), '.'), h('li', null, 'Open Detour Division from its new icon.')),
      h('p', null, "It plays offline from the icon, full screen. Safari can clear the saved data of websites you haven't visited for a while; games added to the Home Screen are much less exposed to that."),
      h('button', { class: 'btn go', type: 'button', onclick: on.done }, 'Got it'),
    ),
  );
}

// ------------------------------------------------------------ update badge

/** Shown on menu screens only (§20): the update installs itself at the next launch. */
export function updateBadge(): HTMLElement {
  return h('div', { class: 'update-badge', role: 'status' }, h('b', null, 'Update ready'), h('span', null, 'It installs next time you open the game.'));
}

// ------------------------------------------------------------ title

export function titleScreen(on: { play(): void; guide(): void; settings(): void; saves(): void; resume: { label: string; go(): void } | null; notice: string | null }): HTMLElement {
  return h(
    'div',
    { class: 'overlay title-screen' },
    h(
      'div',
      { class: 'card' },
      // Two groups, so a short landscape screen can put the buttons beside the name (§18.2 item 7).
      h(
        'div',
        { class: 'title-text' },
        h('div', { class: 'title' }, 'Detour Division'),
        h('p', null, "General Bluster's army is marching on the Crown Biscuit Stores. You can't stop them. You can send them the long way round."),
        on.notice ? h('p', { class: 'notice', role: 'status' }, on.notice) : null,
      ),
      h(
        'div',
        { class: 'title-actions' },
        on.resume ? h('button', { class: 'btn go', type: 'button', onclick: on.resume.go }, icon('ui.icon.play', 1), on.resume.label) : null,
        h(
          'div',
          { class: 'row' },
          h('button', { class: on.resume ? 'btn big' : 'btn go big', type: 'button', onclick: on.play }, 'Play'),
          h('button', { class: 'btn', type: 'button', onclick: on.guide }, icon('ui.icon.book', 1), 'Field guide'),
          h('button', { class: 'btn', type: 'button', onclick: on.settings }, 'Settings'),
          h('button', { class: 'btn', type: 'button', onclick: on.saves }, 'Saves'),
        ),
      ),
    ),
  );
}

// ------------------------------------------------------------ world map

export interface MapScreen {
  el: HTMLElement;
  /** Places the medallions on the drawn map. `u`, when given, is the CSS px per unit for them, and `tap`
   * their minimum size in CSS px, when a touch map is zoomed out below its opening size (§18.2 item 8). */
  layout(rect: { x: number; y: number; w: number; h: number }, u?: number | null, tap?: number | null): void;
}

/** Why a level is locked (§12): the zone's stars, or the level before it. */
function lockedTip(p: Profile, c: Campaign, b: BalanceDef, lv: CampaignLevel): string {
  const i = c.levels.findIndex((l) => l.id === lv.id);
  const first = i === 0 || c.levels[i - 1]!.zone !== lv.zone;
  const need = b.progression.zoneGates[lv.zone - 1]!;
  if (first && totalStars(p) < need) return `Locked. You need ${need} stars to enter this zone.`;
  return i > 0 ? `Locked. Win ${c.levels[i - 1]!.name} to open it.` : 'Locked.';
}

export function mapScreen(c: Campaign, p: Profile, b: BalanceDef, available: (id: string) => boolean, on: { open(id: string): void; back(): void; guide(): void }): MapScreen {
  const nodes: { el: HTMLElement; lv: CampaignLevel }[] = [];
  const labels: { el: HTMLElement; x: number; y: number }[] = [];
  const layer = h('div', { class: 'map-nodes' });
  let n = 0;
  for (const lv of c.levels) {
    n++;
    const open = available(lv.id) && levelUnlocked(p, c, b, lv.id);
    const got = p.stars[lv.id] ?? 0;
    const badge = lv.boss ? icon('ui.icon.boss', 1) : lv.mode === 'puzzle' ? icon('ui.icon.puzzle', 1) : lv.mode === 'timeTrial' || lv.mode === 'suddenDeath' ? icon('ui.icon.timer', 1) : null;
    const el = h(
      'button',
      {
        class: `btn node${open ? '' : ' locked'}${lv.boss ? ' boss' : ''}`,
        type: 'button',
        'aria-label': `${lv.name}${open ? `, ${got} stars` : ', locked'}`,
        'data-tip-title': lv.name,
        'data-tip': !available(lv.id) ? 'Coming soon.' : open ? `${MODE_NAME[lv.mode]}. ${got ? `You have ${got} of 3 stars.` : 'Not won yet.'}` : lockedTip(p, c, b, lv),
        // aria-disabled rather than disabled: disabled buttons get no pointer events in some browsers,
        // and a locked medallion still needs its tooltip (§18.6).
        'aria-disabled': open ? null : 'true',
        onclick: open ? () => on.open(lv.id) : null,
      },
      h('span', { class: 'num' }, open ? String(n) : ''),
      open ? null : icon('ui.icon.lock', 1, 'icon lock'),
      badge ? h('span', { class: 'badge' }, badge) : null,
      open ? stars(got, 1) : null,
    );
    nodes.push({ el, lv });
    layer.append(el);
  }
  for (const z of c.zones) {
    const zl = c.levels.filter((l) => l.zone === z.zone);
    const cx = zl.reduce((s, l) => s + l.x, 0) / zl.length;
    const cy = Math.min(...zl.map((l) => l.y)) - 0.07;
    const open = zoneOpen(p, c, b, z.zone);
    const need = b.progression.zoneGates[z.zone - 1]!;
    const el = h('div', { class: `zone-label${open ? '' : ' shut'}` }, h('span', null, z.name), open ? null : h('span', { class: 'need' }, icon('ui.icon.star', 1), ` ${need}`));
    labels.push({ el, x: cx, y: Math.max(0.03, cy) });
    layer.append(el);
  }
  const bar = h(
    'div',
    { class: 'map-bar' },
    h('button', { class: 'btn round quiet', type: 'button', 'aria-label': 'Back', 'data-tip': 'Back to the title', onclick: on.back }, icon('ui.icon.back', 1)),
    h('div', { class: 'plate', 'data-tip-title': 'Stars', 'data-tip': 'A Casual win earns 1 star, Tough 2 and Heroic 3. Stars open new zones and towers.' }, icon('ui.icon.star', 1.3), h('span', { class: 'num' }, String(totalStars(p)))),
    h('button', { class: 'btn round', type: 'button', 'aria-label': 'Field guide', 'data-tip-title': 'Field guide', 'data-tip': 'Your towers, and every enemy you have met.', onclick: on.guide }, icon('ui.icon.book', 1.1)),
  );
  const el = h('div', { class: 'map-screen' }, layer, bar);
  return {
    el,
    layout(r, u, tap) {
      if (u) layer.style.setProperty('--map-u', `${u.toFixed(3)}px`);
      else layer.style.removeProperty('--map-u');
      if (tap) layer.style.setProperty('--tap', `${tap.toFixed(1)}px`);
      else layer.style.removeProperty('--tap');
      for (const { el: node, lv } of nodes) {
        node.style.left = `${r.x + lv.x * r.w}px`;
        node.style.top = `${r.y + lv.y * r.h}px`;
      }
      for (const l of labels) {
        l.el.style.left = `${r.x + l.x * r.w}px`;
        l.el.style.top = `${r.y + l.y * r.h}px`;
      }
    },
  };
}

// ------------------------------------------------------------ briefing

export interface BriefingChoice {
  difficulty: Difficulty;
  loadout: string[];
  endless: boolean;
}

export function briefingScreen(lv: LevelDef, p: Profile, b: BalanceDef, on: { start(c: BriefingChoice): void; close(): void }): HTMLElement {
  let difficulty: Difficulty = 'casual';
  const fixed = lv.loadout.fixed;
  const owned = unlockedTowers(p, b);
  const lent = new Set(fixed ?? []);
  let chosen = (fixed ?? p.loadouts[lv.id] ?? owned.slice(0, 6)).filter((t) => fixed || owned.includes(t)).slice(0, 6);
  const tabs = h('div', { class: 'tabs', role: 'radiogroup', 'aria-label': 'Difficulty' });
  const best = h('p', { class: 'label best' });
  const drawTabs = (): void => {
    tabs.replaceChildren(
      ...DIFFS.map((d, i) =>
        h(
          'button',
          { class: `btn quiet${d === difficulty ? ' is-on' : ''}`, type: 'button', role: 'radio', 'aria-checked': String(d === difficulty), onclick: () => ((difficulty = d), drawTabs()) },
          h('span', null, DIFFICULTY_LABEL[d]),
          h('span', { class: 'mini-stars' }, ...Array.from({ length: i + 1 }, () => icon('ui.icon.star', 1))),
        ),
      ),
    );
    const rec = p.bests[lv.id]?.[difficulty];
    best.textContent = rec ? `Best: won with ${rec.lives} lives left` : 'Not won yet on this difficulty.';
  };
  drawTabs();
  const grid = h('div', { class: 'loadout', role: 'group', 'aria-label': 'Loadout' });
  const count = h('span', { class: 'label' });
  const drawLoadout = (): void => {
    const pool = fixed ?? owned;
    grid.replaceChildren(
      ...pool.map((t) => {
        const def = b.towers[t]!;
        const on = chosen.includes(t);
        return h(
          'button',
          {
            class: `btn quiet slot pick${on ? ' is-on' : ''}${fixed ? ' is-disabled' : ''}`,
            type: 'button',
            'aria-pressed': String(on),
            'data-tip-title': def.name,
            'data-tip': TOWER_BLURB[t] ?? '',
            'data-tip-meta': `${targetsLabel(def.targets.ground, def.targets.air)} · ${def.tiers[0].cost} coins`,
            'aria-label': def.name,
            onclick: () => {
              if (fixed) return;
              if (on) chosen = chosen.filter((x) => x !== t);
              else if (chosen.length < 6) chosen = [...chosen, t];
              drawLoadout();
            },
          },
          icon(`ui.tower.${t}`, 1),
          h('span', { class: 'cost' }, icon('ui.icon.coin', 1), String(def.tiers[0].cost)),
        );
      }),
    );
    count.textContent = fixed ? 'This level uses a fixed set of towers.' : `Loadout ${chosen.length} of 6`;
    startBtn.disabled = chosen.length === 0;
  };
  const startBtn = h('button', { class: 'btn go big', type: 'button', onclick: () => on.start({ difficulty, loadout: chosen, endless: false }) }, 'Start');
  const endlessBtn = endlessUnlocked(p, lv.id)
    ? h('button', { class: 'btn', type: 'button', 'data-tip-title': 'Endless', 'data-tip': 'Waves never stop, on Tough. How long can you hold?', onclick: () => on.start({ difficulty: 'tough', loadout: chosen, endless: true }) }, icon('ui.icon.endless', 1), 'Endless')
    : null;
  drawLoadout();
  void lent;
  const waves = lv.waves.count;
  const modeLine = lv.mode === 'standard' ? `Survive ${waves[0]} waves (${waves[1]} on Tough, ${waves[2]} on Heroic).` : MODE_TEXT[lv.mode];
  return h(
    'div',
    { class: 'overlay' },
    h(
      'div',
      { class: 'card briefing', role: 'dialog', 'aria-label': lv.name },
      h('div', { class: 'card-head' }, h('h1', null, lv.name), h('button', { class: 'btn quiet round', type: 'button', 'aria-label': 'Close', 'data-tip': 'Close', onclick: on.close }, icon('ui.icon.close', 0.8))),
      h('div', { class: 'brief-cols' }, h('div', { class: 'brief-a' }, h('p', null, modeLine), lv.hints[0] ? h('p', { class: 'hint' }, lv.hints[0]) : null, tabs, best), h('div', { class: 'brief-b' }, count, grid, h('div', { class: 'row' }, startBtn, endlessBtn))),
    ),
  );
}

// ------------------------------------------------------------ result

export interface ResultInfo {
  won: boolean;
  endless: boolean;
  stars: number;
  lives: number;
  wave: number;
  kills: number;
  seconds: number;
  unlocked: string[];
  hasNext: boolean;
}

function mmss(s: number): string {
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

export function resultScreen(r: ResultInfo, b: BalanceDef, on: { next(): void; retry(): void; map(): void }): HTMLElement {
  const title = r.endless ? 'Holding on!' : r.won ? 'Victory!' : 'Retreat!';
  const line = r.endless
    ? `You held for ${r.wave} waves.`
    : r.won
      ? `The Stores are safe with ${r.lives} ${r.lives === 1 ? 'life' : 'lives'} to spare.`
      : `They broke through on wave ${r.wave}. Try a longer road.`;
  return h(
    'div',
    { class: 'overlay' },
    h(
      'div',
      { class: `card result${r.won ? ' won' : ''}`, role: 'dialog', 'aria-label': title },
      h('h1', null, title),
      // §16.1: a loss gets a white flag and "Retreat!".
      !r.won && !r.endless ? h('div', { class: 'white-flag' }, icon('ui.icon.whiteflag', 2.4)) : null,
      r.won && !r.endless ? h('div', { class: 'stars stamp' }, ...[0, 1, 2].map((i) => icon(i < r.stars ? 'ui.icon.star' : 'ui.icon.star-empty', 1))) : null,
      h('p', null, line),
      h('dl', { class: 'stats' }, h('dt', null, 'Defeated'), h('dd', null, String(r.kills)), h('dt', null, 'Time'), h('dd', null, mmss(r.seconds))),
      r.unlocked.length ? h('div', { class: 'unlocks' }, ...r.unlocked.map((t) => h('p', { class: 'unlock' }, icon(`ui.tower.${t}`, 1), `New tower: ${b.towers[t]?.name ?? t}`))) : null,
      h(
        'div',
        { class: 'row' },
        r.won && r.hasNext ? h('button', { class: 'btn go', type: 'button', onclick: on.next }, 'Next level') : null,
        h('button', { class: r.won && r.hasNext ? 'btn' : 'btn go', type: 'button', onclick: on.retry }, icon('ui.icon.restart', 1), 'Try again'),
        h('button', { class: 'btn quiet', type: 'button', onclick: on.map }, icon('ui.icon.map', 1), 'Map'),
      ),
    ),
  );
}

// ------------------------------------------------------------ pause

export function pauseScreen(on: { resume(): void; restart(): void; settings(): void; quit(): void }): HTMLElement {
  return h(
    'div',
    { class: 'overlay' },
    h(
      'div',
      { class: 'card', role: 'dialog', 'aria-label': 'Paused' },
      h('h1', null, 'Paused'),
      h('div', { class: 'col' }, h('button', { class: 'btn go big', type: 'button', onclick: on.resume }, icon('ui.icon.play', 1), 'Resume'), h('button', { class: 'btn', type: 'button', onclick: on.restart }, icon('ui.icon.restart', 1), 'Restart'), h('button', { class: 'btn', type: 'button', onclick: on.settings }, 'Settings'), h('button', { class: 'btn quiet', type: 'button', onclick: on.quit }, icon('ui.icon.map', 1), 'Quit to map')),
    ),
  );
}

// ------------------------------------------------------------ field guide

export function guideScreen(p: Profile, b: BalanceDef, on: { back(): void }): HTMLElement {
  let tab: 'towers' | 'enemies' = 'towers';
  const owned = new Set(unlockedTowers(p, b));
  const grid = h('div', { class: 'guide-grid' });
  const detail = h('div', { class: 'guide-detail' });
  const tabs = h('div', { class: 'tabs', role: 'tablist' });
  const show = (kind: 'tower' | 'enemy', id: string, elite: boolean): void => {
    if (kind === 'tower') {
      const def = b.towers[id]!;
      const t = def.tiers[0];
      detail.replaceChildren(
        icon(`ui.tower.${id}`, 1, 'icon portrait'),
        h('h2', null, def.name),
        h('p', null, TOWER_BLURB[id] ?? ''),
        h('p', { class: 'flavour' }, TOWER_FLAVOUR[id] ?? ''),
        h('dl', { class: 'stats' }, h('dt', null, 'Cost'), h('dd', null, String(t.cost)), h('dt', null, 'Range'), h('dd', null, String(t.range)), h('dt', null, 'Hits'), h('dd', null, targetsLabel(def.targets.ground, def.targets.air)), h('dt', null, 'Unlocks at'), h('dd', null, `${b.progression.towerStars[id] ?? 0} stars`)),
      );
    } else {
      const def = b.enemies[id]!;
      detail.replaceChildren(
        icon(`ui.enemy.${id}.${elite ? 'e' : 'n'}`, 1, 'icon portrait'),
        h('h2', null, elite ? def.elite.name : def.name),
        h('p', { class: 'flavour' }, ENEMY_FLAVOUR[id] ?? ''),
        h('dl', { class: 'stats' }, h('dt', null, 'Health'), h('dd', null, String(Math.round(def.hp * (elite ? def.elite.hpMul : 1)))), h('dt', null, 'Speed'), h('dd', null, `${elite && def.elite.speed ? def.elite.speed : def.speed} cells/s`), h('dt', null, 'Armour'), h('dd', null, String(elite && def.elite.armour !== undefined ? def.elite.armour : def.armour)), h('dt', null, 'Moves by'), h('dd', null, def.air ? 'Air' : 'Ground')),
      );
    }
  };
  const draw = (): void => {
    tabs.replaceChildren(
      ...(['towers', 'enemies'] as const).map((t) => h('button', { class: `btn quiet${t === tab ? ' is-on' : ''}`, type: 'button', role: 'tab', 'aria-selected': String(t === tab), onclick: () => ((tab = t), draw()) }, t === 'towers' ? 'Towers' : 'Enemies')),
    );
    grid.replaceChildren();
    if (tab === 'towers') {
      for (const id of Object.keys(b.progression.towerStars)) {
        const known = owned.has(id);
        grid.append(h('button', { class: `btn quiet entry${known ? '' : ' unknown'}`, type: 'button', 'aria-disabled': known ? null : 'true', 'aria-label': known ? b.towers[id]?.name ?? id : 'Locked', 'data-tip-title': known ? b.towers[id]?.name ?? id : 'Locked', 'data-tip': known ? TOWER_BLURB[id] ?? '' : `Unlocks at ${b.progression.towerStars[id] ?? 0} stars.`, onclick: known ? () => show('tower', id, false) : null }, icon(`ui.tower.${id}`, 1)));
      }
    } else {
      for (const id of Object.keys(b.enemies)) {
        for (const elite of [false, true]) {
          const known = Boolean(p.seen[`enemy.${id}.${elite ? 'e' : 'n'}`]);
          const def = b.enemies[id]!;
          grid.append(h('button', { class: `btn quiet entry${known ? '' : ' unknown'}`, type: 'button', 'aria-disabled': known ? null : 'true', 'aria-label': known ? (elite ? def.elite.name : def.name) : 'Not yet encountered', 'data-tip-title': known ? (elite ? def.elite.name : def.name) : 'Not met yet', 'data-tip': known ? (elite ? `The elite ${def.name}: tougher, and worth more.` : ENEMY_FLAVOUR[id] ?? '') : 'It appears here once it has marched onto one of your fields.', onclick: known ? () => show('enemy', id, elite) : null }, icon(`ui.enemy.${id}.${elite ? 'e' : 'n'}`, 1)));
        }
      }
    }
    detail.replaceChildren(h('p', { class: 'label' }, tab === 'towers' ? 'Pick a tower to read about it.' : 'Enemies appear here once you have met them.'));
  };
  draw();
  return h(
    'div',
    { class: 'overlay guide' },
    h(
      'div',
      { class: 'card guide-card', role: 'dialog', 'aria-label': 'Field guide' },
      h('div', { class: 'card-head' }, h('h1', null, 'Field guide'), h('button', { class: 'btn quiet round', type: 'button', 'aria-label': 'Close', 'data-tip': 'Close', onclick: on.back }, icon('ui.icon.close', 0.8))),
      tabs,
      h('div', { class: 'guide-body' }, grid, detail),
    ),
  );
}
