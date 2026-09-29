// Service worker registration and the update flow (DESIGN.md §20). Updates never interrupt play:
// a new version found mid-session shows an "Update ready" badge on menu screens, and the worker
// it left waiting is activated at the next cold launch, before the menu appears.
import { registerSW } from 'virtual:pwa-register';

let ready = false;
const listeners = new Set<() => void>();

export const updates = {
  get ready(): boolean {
    return ready;
  },
  /** Calls `f` when an update becomes ready (at once if it already is). */
  onReady(f: () => void): void {
    if (ready) f();
    else listeners.add(f);
  },
};

/** At launch: if a worker from the last session is waiting, activate it and reload. True if reloading. */
export async function applyWaitingUpdate(): Promise<boolean> {
  if (import.meta.env.DEV || !('serviceWorker' in navigator)) return false;
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg?.waiting || !navigator.serviceWorker.controller) return false;
  navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true });
  reg.waiting.postMessage({ type: 'SKIP_WAITING' });
  return true;
}

export function startServiceWorker(): void {
  if (import.meta.env.DEV || !('serviceWorker' in navigator)) return;
  registerSW({
    immediate: true,
    onNeedRefresh() {
      ready = true;
      for (const f of listeners) f();
      listeners.clear();
    },
  });
}
