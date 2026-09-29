// MaxRects bin packing (best short-side fit). Pure, so it runs in the bake page and
// in unit tests alike.

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Placed<T> extends Rect {
  item: T;
  page: number;
}

function fits(free: Rect, w: number, h: number): boolean {
  return w <= free.w && h <= free.h;
}

function split(free: Rect, used: Rect): Rect[] {
  if (used.x >= free.x + free.w || used.x + used.w <= free.x || used.y >= free.y + free.h || used.y + used.h <= free.y) return [free];
  const out: Rect[] = [];
  if (used.x > free.x) out.push({ x: free.x, y: free.y, w: used.x - free.x, h: free.h });
  if (used.x + used.w < free.x + free.w) out.push({ x: used.x + used.w, y: free.y, w: free.x + free.w - used.x - used.w, h: free.h });
  if (used.y > free.y) out.push({ x: free.x, y: free.y, w: free.w, h: used.y - free.y });
  if (used.y + used.h < free.y + free.h) out.push({ x: free.x, y: used.y + used.h, w: free.w, h: free.y + free.h - used.y - used.h });
  return out;
}

function contained(a: Rect, b: Rect): boolean {
  return a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h;
}

/**
 * Packs items (largest first) into as many size×size pages as needed.
 * Throws if a single item is larger than a page.
 */
export function pack<T>(items: { w: number; h: number; item: T }[], size: number, gap: number): { placed: Placed<T>[]; pages: { w: number; h: number }[] } {
  const order = items.slice().sort((a, b) => b.h * b.w - a.h * a.w || b.h - a.h);
  const pages: { free: Rect[]; w: number; h: number }[] = [];
  const placed: Placed<T>[] = [];
  for (const it of order) {
    const w = it.w + gap;
    const h = it.h + gap;
    if (w > size || h > size) throw new Error(`sprite ${it.w}×${it.h} exceeds page size ${size}`);
    let done = false;
    for (let pi = 0; pi <= pages.length && !done; pi++) {
      if (pi === pages.length) pages.push({ free: [{ x: 0, y: 0, w: size, h: size }], w: 0, h: 0 });
      const page = pages[pi]!;
      let best: Rect | undefined;
      let bestScore = Infinity;
      for (const f of page.free) {
        if (!fits(f, w, h)) continue;
        const score = Math.min(f.w - w, f.h - h);
        if (score < bestScore || (score === bestScore && best && (f.y < best.y || (f.y === best.y && f.x < best.x)))) {
          bestScore = score;
          best = f;
        }
      }
      if (!best) continue;
      const used: Rect = { x: best.x, y: best.y, w, h };
      page.free = page.free.flatMap((f) => split(f, used));
      page.free = page.free.filter((f, i) => !page.free.some((g, j) => j !== i && contained(f, g) && (j < i || !contained(g, f))));
      page.w = Math.max(page.w, used.x + used.w);
      page.h = Math.max(page.h, used.y + used.h);
      placed.push({ x: used.x, y: used.y, w: it.w, h: it.h, item: it.item, page: pi });
      done = true;
    }
  }
  return { placed, pages: pages.map((p) => ({ w: p.w, h: p.h })) };
}
