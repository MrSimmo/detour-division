// Applying settings (DESIGN.md §16.6, §19, §21) outside the level: document attributes that the CSS
// follows, and the effective reduced-motion flag. The level applies the rest (Game.applySettings).
import type { Settings } from '../meta/progression.ts';

const osReduced = matchMedia('(prefers-reduced-motion: reduce)');

/** Reduced motion is on when the setting says so, or on 'auto' when the OS asks for it. */
export function reducedMotion(s: Settings): boolean {
  return s.reducedMotion === 'on' || (s.reducedMotion === 'auto' && osReduced.matches);
}

export function applyDocumentSettings(s: Settings): void {
  const root = document.documentElement;
  root.dataset.motion = reducedMotion(s) ? 'reduced' : 'full';
  root.dataset.cb = s.colourBlind ? 'on' : 'off';
}

/** Re-applies when the OS setting changes while the game is open. */
export function followOsMotion(get: () => Settings, then: () => void): void {
  osReduced.addEventListener('change', () => {
    applyDocumentSettings(get());
    then();
  });
}
