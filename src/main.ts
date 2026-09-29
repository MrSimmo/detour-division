// Boot: fonts, data, renderer and art, then the title screen.
import './app/csp.ts';
import '@fontsource/lilita-one/latin-400.css';
import '@fontsource/fredoka/latin-500.css';
import '@fontsource/fredoka/latin-600.css';
import '@fontsource/fredoka/latin-700.css';
import './ui/tokens.css';
import './ui/styles.css';
import { Application, RendererType } from 'pixi.js';
import { P } from './art/palette.ts';
import { levels } from './app/data.ts';
import { App } from './app/app.ts';
import { loadProfile, profile, saveProfile } from './app/profile.ts';
import { applyWaitingUpdate, startServiceWorker } from './app/pwa.ts';
import { devDrive, installDiagnostics } from './app/devdrive.ts';
import { buildBuses } from './audio/engine.ts';
import { SFX } from './audio/sfx/patches.ts';
import { SfxPlayer } from './audio/sfx/player.ts';
import { AudioSystem } from './audio/system.ts';
import { computeLayout } from './app/layout.ts';
import { deviceClass, safeInsets } from './app/platform.ts';
import { applyTapSize, watchDialogs } from './app/fit.ts';
import { installTooltips } from './ui/tooltip.ts';
import { Art } from './render/assets.ts';
import { loadIcons } from './ui/icons.ts';

const ui = document.getElementById('ui')!;
const LEVEL = 'z1-01';

installDiagnostics();

async function boot(): Promise<void> {
  // §20: an update left waiting by the last session is applied now, before any menu appears.
  if (await applyWaitingUpdate()) return;
  // The saved profile comes first: settings (volumes, quality) apply from the first frame.
  await loadProfile();
  if (!profile.flags.persistAsked) {
    // §20: ask once for persistent storage, so the browser is less inclined to clear saves.
    profile.flags.persistAsked = true;
    void navigator.storage?.persist?.().catch(() => false);
    saveProfile();
  }
  await Promise.all([document.fonts.load('24px "Lilita One"'), document.fonts.load('500 16px Fredoka'), document.fonts.load('700 16px Fredoka')]);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  // §19, ADR-0012: Auto tries WebGL, then WebGPU (WebGL measured as fast or faster for this game);
  // WebGPU, when chosen and available, goes first. PixiJS picks the first supported renderer in the
  // list but doesn't try the next if that one then fails to start, so the rest are retried here.
  // A chosen WebGPU that fell back says so once, in Settings.
  const choice = profile.settings.renderer;
  const wantGpu = choice === 'webgpu' && 'gpu' in navigator;
  const order: ('webgl' | 'webgpu')[] = choice === 'webgl' ? ['webgl'] : wantGpu ? ['webgpu', 'webgl'] : ['webgl', 'webgpu'];
  const opts = { resizeTo: window, antialias: true, autoDensity: true, resolution: dpr, background: P.woodDark, powerPreference: 'high-performance' as const };
  let app = new Application();
  try {
    await app.init({ ...opts, preference: order });
  } catch (e) {
    if (order.length < 2) throw e;
    console.warn(`The ${order[0]} renderer failed to start; trying ${order[1]}`, e);
    app = new Application();
    await app.init({ ...opts, preference: order.slice(1) });
  }
  const rendererNotice = wantGpu && app.renderer.type !== RendererType.WEBGPU ? "WebGPU didn't start on this device, so the game is using WebGL." : null;
  document.getElementById('stage')!.append(app.canvas);
  const lv = levels[LEVEL]!;
  const L = computeLayout({ w: innerWidth, h: innerHeight, safe: safeInsets(), cols: lv.grid.cols + 2, rows: lv.grid.rows + 2, device: deviceClass() });
  // Low quality uses the @1x art (§19); the choice takes effect at launch.
  const art = await Art.load(profile.settings.quality !== 'low' && L.cell * dpr >= 80 ? 2 : 1);
  await loadIcons(art.manifest);
  document.documentElement.style.setProperty('--ui-scale', L.uiScale.toFixed(3));
  applyTapSize();
  watchDialogs(ui);
  installTooltips();

  // Audio starts suspended; the splash's button is the first gesture that unlocks it (§17.1).
  const audio = new AudioSystem(import.meta.env.BASE_URL);
  // Test hook: the mix graph and SFX, for the offline R-AUD-1 test (dev, or ?e2e on builds).
  if (import.meta.env.DEV || location.search.includes('e2e')) Object.assign(window as unknown as object, { __audioLab: { buildBuses, SfxPlayer, SFX } });
  const game = new App(app, art, ui, audio, rendererNotice);
  await game.checkResume();
  if (!devDrive(game)) game.splash();
  startServiceWorker();
}

boot().catch((e: unknown) => {
  console.error(e);
  ui.textContent = 'Something went wrong while loading. Reload to try again.';
});
