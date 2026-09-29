// Device class and safe-area insets (DESIGN.md §18.1–18.2).
import type { Insets } from './layout.ts';

export function deviceClass(): 'phone' | 'tablet' | 'desktop' {
  if (!matchMedia('(pointer: coarse)').matches) return 'desktop';
  return Math.min(screen.width, screen.height) < 500 ? 'phone' : 'tablet';
}

let probe: HTMLDivElement | null = null;

/** Reads env(safe-area-inset-*) through a hidden probe element (needs viewport-fit=cover). */
export function safeInsets(): Insets {
  // Test hook: Chromium cannot emulate notches, so e2e runs may pass ?e2e&safe=t,r,b,l.
  const q = new URLSearchParams(location.search);
  if (q.has('e2e') && q.get('safe')) {
    const [t = 0, r = 0, b = 0, l = 0] = q.get('safe')!.split(',').map(Number);
    return { t, r, b, l };
  }
  if (!probe) {
    probe = document.createElement('div');
    probe.style.cssText =
      'position:fixed;left:0;top:0;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
    document.body.append(probe);
  }
  const cs = getComputedStyle(probe);
  return { t: parseFloat(cs.paddingTop) || 0, r: parseFloat(cs.paddingRight) || 0, b: parseFloat(cs.paddingBottom) || 0, l: parseFloat(cs.paddingLeft) || 0 };
}

/** Running as an installed web app (Home Screen / standalone window). */
export function isInstalled(): boolean {
  return matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** iOS or iPadOS Safari in a browser tab, where Add to Home Screen is the way to install (§20).
 * iPadOS reports itself as a Mac, so a touch-capable "Mac" counts too. Other iOS browsers are left out:
 * their share menus differ. Test hooks: ?e2e&ios=1 forces it on, ?e2e&ios=0 off. */
export function isIosSafariTab(): boolean {
  const q = new URLSearchParams(location.search);
  if (q.has('e2e') && q.get('ios') === '1') return true;
  if (q.has('e2e') && q.get('ios') === '0') return false;
  const ua = navigator.userAgent;
  const ios = /iP(hone|od|ad)/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  return ios && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua) && !isInstalled();
}
