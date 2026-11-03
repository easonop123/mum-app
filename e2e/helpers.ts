import { expect, type Page } from '@playwright/test';

/** Tuesday 3 November 2026, 10:00 in Auckland (a default practice day). */
export const TUESDAY_10AM_NZ = new Date('2026-11-02T21:00:00.000Z');

export async function startFresh(page: Page, options: { clock?: boolean } = {}) {
  if (options.clock !== false) await page.clock.install({ time: TUESDAY_10AM_NZ });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Welcome' })).toBeVisible();
}

/** Generic test answers with no concerns (not anyone's real answers). */
export async function completeOnboarding(page: Page) {
  await page.getByRole('button', { name: "Yes, let's have a look" }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Yes, New Zealand' }).click();
  await page.getByRole('button', { name: 'Start' }).click();
  for (let i = 0; i < 20; i++) {
    if ((await page.getByText(/Question \d+ of \d+/).count()) === 0) break;
    const legend = (await page.locator('legend').first().textContent()) ?? '';
    let label = 'No';
    if (/^First, a quick|^Do you have any of these|^Have you noticed/.test(legend)) label = 'No, none of these';
    if (/stand steadily/.test(legend)) label = 'Yes';
    await page.getByRole('radio', { name: label, exact: true }).check();
    await page.getByRole('button', { name: 'Next' }).click();
  }
  await page.getByRole('radio', { name: 'Getting up from a chair more easily' }).check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('radio', { name: 'morning tea' }).check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Finish' }).click();
  await expect(page.getByTestId('waiting-card')).toBeVisible();
}

export async function recordApprovedAdvice(page: Page) {
  await page.goto('/#/settings/advice');
  await page.getByRole('radio', { name: 'GP (family doctor)' }).check();
  await page.getByRole('group', { name: /look at your back pain history/ }).getByRole('radio', { name: 'Yes' }).check();
  for (const name of ['Chair sit-to-stand', 'Wall press-up', 'Supported heel raise', 'Supported side leg lift']) {
    await page.getByRole('group', { name, exact: true }).getByRole('radio', { name: 'OK for me' }).check();
  }
  await page.getByRole('group', { name: /build up slowly/ }).getByRole('radio', { name: 'Yes' }).check();
  await page.getByRole('radio', { name: 'Me', exact: true }).check();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText(/Your plan can be used now/)).toBeVisible();
}

export async function completeSetup(page: Page) {
  await page.goto('/#/settings/setup');
  const groups = page.getByRole('group');
  const count = await groups.count();
  for (let i = 0; i < count; i++) await groups.nth(i).getByRole('radio', { name: 'Yes, done' }).check();
  await expect(page.getByText('Setup check done.')).toBeVisible();
}

export async function readyToPractise(page: Page) {
  await startFresh(page);
  await completeOnboarding(page);
  await recordApprovedAdvice(page);
  await completeSetup(page);
  await page.goto('/#/');
  await expect(page.getByRole('link', { name: "Start today's practice" })).toBeVisible();
}

export async function beginPractice(page: Page, kind: 'full' | 'tiny' = 'full') {
  await page.getByRole('link', { name: kind === 'full' ? "Start today's practice" : /Smaller practice/ }).click();
  await page.getByRole('radio', { name: 'No, nothing new' }).check();
  await page.getByRole('button', { name: 'Start' }).click();
}
