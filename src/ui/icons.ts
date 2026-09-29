// DOM icons drawn from the baked UI atlas via the manifest. Sizes are in em, so an
// icon scales with its element's font-size (and so with --ui-scale).
import { ASSET_BASE, type Manifest } from '../render/assets.ts';

interface Frame {
  x: number;
  y: number;
  w: number;
  h: number;
  page: string;
  pw: number;
  ph: number;
}

const frames = new Map<string, Frame>();

export async function loadIcons(manifest: Manifest): Promise<void> {
  const files = manifest.atlases['ui']?.['2'] ?? [];
  for (const f of files) {
    const json = (await (await fetch(`${ASSET_BASE}${f}`)).json()) as {
      frames: Record<string, { frame: { x: number; y: number; w: number; h: number } }>;
      meta: { image: string; size: { w: number; h: number } };
    };
    const page = `${ASSET_BASE}atlas/${json.meta.image}`;
    for (const [k, v] of Object.entries(json.frames)) frames.set(k, { ...v.frame, page, pw: json.meta.size.w, ph: json.meta.size.h });
  }
}

/** An element showing sprite `key`, `height` em tall (width follows the frame's aspect). */
export function icon(key: string, height = 1, cls = 'icon'): HTMLElement {
  const el = document.createElement('span');
  el.className = cls;
  el.setAttribute('aria-hidden', 'true');
  setIcon(el, key, height);
  return el;
}

export function setIcon(el: HTMLElement, key: string, height = 1): void {
  const f = frames.get(key);
  if (!f) {
    if (import.meta.env.DEV) console.warn(`missing icon '${key}'`);
    return;
  }
  const k = height / f.h;
  el.style.width = `${f.w * k}em`;
  el.style.height = `${height}em`;
  el.style.backgroundImage = `url("${f.page}")`;
  el.style.backgroundSize = `${f.pw * k}em ${f.ph * k}em`;
  el.style.backgroundPosition = `${-f.x * k}em ${-f.y * k}em`;
}
