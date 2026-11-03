/**
 * A waiting service worker may only replace app assets when the person is
 * idle: no practice in progress and not on a practice screen. Updates never
 * reload mid-set.
 */
export function canApplyUpdate(state: { hasActiveSession: boolean; routePath: string }): boolean {
  return !state.hasActiveSession && !state.routePath.startsWith('/session');
}
