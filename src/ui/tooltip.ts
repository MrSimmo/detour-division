// Tooltips (DESIGN.md §18.6, R-TIP-1). Any element with `data-tip` (and optionally `data-tip-title`
// and `data-tip-meta`) gets a styled description: after the mouse rests on it for 400 ms, at once on
// keyboard focus, or on a touch long press of 450 ms. A long press must not also trigger the control,
// so it swallows the click that follows and tells drag code through consumeLongPress().
const HOVER_MS = 400;
const PRESS_MS = 450;
const SLOP = 10;
const GAP = 8;

let tip: HTMLDivElement | null = null;
let anchor: HTMLElement | null = null;
let shownKey = '';
let timer = 0;
let press: { id: number; x: number; y: number } | null = null;
let byPress = false;
/** A long press showed a tip during the current press (read once by the drag code). */
let consumed = false;

const target = (e: Event): HTMLElement | null => (e.target instanceof Element ? e.target.closest<HTMLElement>('[data-tip]') : null);

function cancel(): void {
  window.clearTimeout(timer);
  timer = 0;
}

function hide(): void {
  cancel();
  anchor?.removeAttribute('aria-describedby');
  anchor = null;
  byPress = false;
  if (tip) tip.hidden = true;
}

function fill(el: HTMLElement): void {
  const title = el.dataset.tipTitle ?? '';
  const text = el.dataset.tip ?? '';
  const meta = el.dataset.tipMeta ?? '';
  const key = `${title}\u0000${text}\u0000${meta}`;
  if (key === shownKey) return;
  shownKey = key;
  tip!.replaceChildren();
  if (title) tip!.append(Object.assign(document.createElement('b'), { textContent: title }));
  if (text) tip!.append(Object.assign(document.createElement('span'), { textContent: text }));
  if (meta) tip!.append(Object.assign(document.createElement('small'), { textContent: meta }));
}

/** Above the control, or beside or below it when there's no room; always inside the viewport. */
function place(el: HTMLElement): void {
  const r = el.getBoundingClientRect();
  const w = tip!.offsetWidth;
  const h = tip!.offsetHeight;
  let x = r.left + r.width / 2 - w / 2;
  let y = r.top - h - GAP;
  if (y < GAP) {
    // On touch the finger covers the control and what's under it, so try beside it first.
    const side = r.right + GAP + w <= innerWidth - GAP ? r.right + GAP : r.left - GAP - w >= GAP ? r.left - GAP - w : null;
    if (byPress && side !== null) {
      x = side;
      y = r.top + r.height / 2 - h / 2;
    } else y = r.bottom + GAP;
  }
  tip!.style.left = `${Math.round(Math.max(GAP, Math.min(innerWidth - w - GAP, x)))}px`;
  tip!.style.top = `${Math.round(Math.max(GAP, Math.min(innerHeight - h - GAP, y)))}px`;
}

function show(el: HTMLElement, fromPress: boolean): void {
  if (!tip || !el.isConnected || !el.dataset.tip) return;
  anchor = el;
  byPress = fromPress;
  shownKey = '';
  fill(el);
  tip.hidden = false;
  place(el);
  el.setAttribute('aria-describedby', tip.id);
  const follow = (): void => {
    if (anchor !== el) return;
    // The HUD and the tower panel rebuild or relabel their buttons; keep up, or go if it's gone.
    if (!el.isConnected || !el.dataset.tip) return hide();
    fill(el);
    place(el);
    requestAnimationFrame(follow);
  };
  requestAnimationFrame(follow);
}

/** True once if a long press showed a tooltip during the press that is ending. */
export function consumeLongPress(): boolean {
  const c = consumed;
  consumed = false;
  return c;
}

export function installTooltips(): void {
  if (tip) return;
  tip = document.createElement('div');
  tip.className = 'tooltip';
  tip.id = 'tooltip';
  tip.setAttribute('role', 'tooltip');
  tip.hidden = true;
  document.body.append(tip);
  const opts = { capture: true };

  document.addEventListener(
    'pointerover',
    (e) => {
      if (e.pointerType !== 'mouse' || press) return;
      const el = target(e);
      if (el === anchor) return;
      hide();
      if (el) timer = window.setTimeout(() => show(el, false), HOVER_MS);
    },
    opts,
  );
  document.addEventListener(
    'pointerout',
    (e) => {
      if (e.pointerType !== 'mouse') return;
      const into = e.relatedTarget instanceof Element ? e.relatedTarget.closest('[data-tip]') : null;
      if (into !== anchor || !anchor) hide();
    },
    opts,
  );
  document.addEventListener(
    'pointerdown',
    (e) => {
      consumed = false;
      hide();
      if (e.pointerType === 'mouse') return;
      const el = target(e);
      if (!el) return;
      press = { id: e.pointerId, x: e.clientX, y: e.clientY };
      timer = window.setTimeout(() => {
        consumed = true;
        show(el, true);
      }, PRESS_MS);
    },
    opts,
  );
  document.addEventListener(
    'pointermove',
    (e) => {
      if (!press || e.pointerId !== press.id) return;
      if (Math.hypot(e.clientX - press.x, e.clientY - press.y) <= SLOP) return;
      // A drag, not a long press (dragging a build-bar slot stays a drag).
      press = null;
      consumed = false;
      hide();
    },
    opts,
  );
  const release = (e: PointerEvent): void => {
    if (!press || e.pointerId !== press.id) return;
    press = null;
    if (byPress) hide();
    else cancel();
    if (!consumed) return;
    // Swallow the click this press would otherwise deliver to the control.
    const swallow = (c: Event): void => {
      c.preventDefault();
      c.stopPropagation();
    };
    document.addEventListener('click', swallow, { capture: true, once: true });
    window.setTimeout(() => document.removeEventListener('click', swallow, { capture: true }), 400);
  };
  document.addEventListener('pointerup', release, opts);
  document.addEventListener('pointercancel', release, opts);
  document.addEventListener(
    'focusin',
    (e) => {
      const el = target(e);
      if (el && el.matches(':focus-visible')) show(el, false);
    },
    opts,
  );
  document.addEventListener('focusout', () => hide(), opts);
  document.addEventListener('keydown', (e) => e.key === 'Escape' && hide(), opts);
  window.addEventListener('resize', hide);
}

/** Sets an element's tooltip. `meta` is a small third line (what it hits, its cost, its key). */
export function setTip(el: HTMLElement, text: string, title = '', meta = ''): void {
  if (el.dataset.tip !== text) el.dataset.tip = text;
  if (title) el.dataset.tipTitle = title;
  else delete el.dataset.tipTitle;
  if (meta) el.dataset.tipMeta = meta;
  else delete el.dataset.tipMeta;
}
