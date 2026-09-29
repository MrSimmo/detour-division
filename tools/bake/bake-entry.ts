// Runs inside headless Chromium during `npm run bake-art`.
import { drawAppIcon, type IconVariant } from '../../src/art/appicon.ts';
import { bakeAll } from '../../src/art/bake.ts';
import { allSprites, towerMeta } from '../../src/art/catalogue.ts';
import { P } from '../../src/art/palette.ts';
import { U } from '../../src/art/spec.ts';

declare global {
  interface Window {
    __bake: (scale: number) => ReturnType<typeof bakeAll> & { keys: Record<string, string>; towers: ReturnType<typeof towerMeta> };
    __bakeReady: boolean;
    __sheet: (prefixes: string[], scale: number) => string;
    __icon: (size: number, variant: IconVariant) => string;
  }
}

window.__bake = (scale: number) => {
  const specs = allSprites().filter((s) => !s.scales || s.scales.includes(scale));
  const keys: Record<string, string> = {};
  for (const s of allSprites()) {
    if (keys[s.key]) throw new Error(`duplicate sprite key ${s.key}`);
    keys[s.key] = s.atlas;
  }
  return { ...bakeAll(specs, scale), keys, towers: towerMeta() };
};
/** Dev contact sheet: every sprite whose key starts with one of `prefixes`, labelled, on grass. */
window.__sheet = (prefixes: string[], scale: number) => {
  const specs = allSprites().filter((s) => prefixes.some((p) => s.key.startsWith(p)));
  const cellW = Math.ceil(Math.max(...specs.map((s) => s.w)) * U * scale) + 8;
  const cellH = Math.ceil(Math.max(...specs.map((s) => s.h)) * U * scale) + 22;
  const cols = Math.max(1, Math.min(16, Math.floor(2400 / cellW)));
  const rows = Math.ceil(specs.length / cols);
  const c = document.createElement('canvas');
  c.width = cols * cellW;
  c.height = rows * cellH;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = P.grass;
  ctx.fillRect(0, 0, c.width, c.height);
  specs.forEach((s, i) => {
    const x = (i % cols) * cellW;
    const y = Math.floor(i / cols) * cellH;
    const w = Math.ceil(s.w * U * scale);
    const h = Math.ceil(s.h * U * scale);
    ctx.save();
    ctx.translate(x + 4 + s.ax * w, y + 4 + s.ay * h);
    ctx.scale(scale, scale);
    s.draw(ctx);
    ctx.restore();
    ctx.fillStyle = P.ink;
    ctx.font = '11px monospace';
    ctx.fillText(s.key.replace(/^(tower|enemy|fx|terrain|ui)\./, ''), x + 2, y + cellH - 6);
  });
  return c.toDataURL('image/png').split(',')[1]!;
};
/** The app icon as base64 PNG (§20). */
window.__icon = (size: number, variant: IconVariant) => {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  drawAppIcon(c.getContext('2d')!, size, variant);
  return c.toDataURL('image/png').split(',')[1]!;
};
window.__bakeReady = true;
