import { registerSW } from 'virtual:pwa-register';

type Listener = (updateWaiting: boolean) => void;

let updateSW: ((reloadPage?: boolean) => Promise<void>) | null = null;
let updateWaiting = false;
const listeners = new Set<Listener>();

/** Registers the service worker in "prompt" mode: new versions wait until applied. */
export function initServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;
  updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      updateWaiting = true;
      listeners.forEach((l) => l(true));
    },
    onRegisterError() {
      /* The app still works online; offline relaunch will not. */
    },
  });
}

export function subscribeToUpdates(listener: Listener): () => void {
  listeners.add(listener);
  listener(updateWaiting);
  return () => listeners.delete(listener);
}

/** Only call when canApplyUpdate() is true. Activates the waiting worker and reloads. */
export async function applyWaitingUpdate(): Promise<void> {
  await updateSW?.(true);
}
