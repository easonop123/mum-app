import { expect, type Page } from '@playwright/test';

/** Tuesday 3 November 2026, 10:00 in Auckland (a default practice day). */
export const TUESDAY_10AM_NZ = new Date('2026-11-02T21:00:00.000Z');
/** Friday 6 November 2026, 10:00 in Auckland. */
export const FRIDAY_10AM_NZ = new Date('2026-11-05T21:00:00.000Z');

export async function startFresh(page: Page, options: { clock?: boolean } = {}) {
  if (options.clock !== false) await page.clock.install({ time: TUESDAY_10AM_NZ });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Welcome' })).toBeVisible();
}

/** The whole first run: one tap. */
export async function letsStart(page: Page) {
  await page.getByRole('button', { name: "Let's start" }).click();
  await expect(page.getByRole('link', { name: "Start today's practice" })).toBeVisible();
}

export async function readyToPractise(page: Page) {
  await startFresh(page);
  await letsStart(page);
}

export async function beginPractice(page: Page, kind: 'full' | 'tiny' = 'full') {
  await page.getByRole('link', { name: kind === 'full' ? "Start today's practice" : /Smaller practice/ }).click();
}

/** Taps through a whole full practice, doing the planned amount every time. */
export async function doFullPractice(page: Page) {
  await beginPractice(page);
  await page.getByRole('button', { name: 'Skip the warm-up' }).click();
  const ready = page.getByRole('button', { name: "I'm ready — next" });
  const finished = page.getByTestId('finished-view');
  for (let i = 0; i < 40; i++) {
    if (await finished.isVisible()) break;
    await page.getByRole('button', { name: /^Done: \d+$/ }).click();
    await expect(ready.or(finished)).toBeVisible();
    if (await ready.isVisible()) await ready.click();
  }
  await expect(finished).toContainText('You did the full amount for this stage.');
}
