import { expect, test } from '@playwright/test';
import { beginPractice, readyToPractise } from './helpers';

test('refresh, backgrounding and locking keep partial state without advancing (case 16)', async ({ page }) => {
  await readyToPractise(page);
  await beginPractice(page);
  await page.getByRole('button', { name: 'Done walking' }).click();
  await page.getByRole('button', { name: 'Done: 5' }).click();
  await page.getByRole('button', { name: "I'm ready — next" }).click();
  await expect(page.getByRole('heading', { name: 'Wall press-up' })).toBeVisible();

  // Phone locked / app backgrounded for 20 minutes.
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.clock.fastForward('20:00');
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.getByRole('heading', { name: 'Wall press-up' })).toBeVisible();
  await expect(page.getByText('Set 1 of 1')).toBeVisible();

  // Full reload mid-set.
  await page.reload();
  await expect(page.getByText(/Movement 2 of 4/)).toBeVisible();
  const ready = page.getByRole('button', { name: "I'm ready — next" });
  if (await ready.isVisible()) await ready.click();
  await expect(page.getByRole('heading', { name: 'Wall press-up' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Done: 5' })).toBeVisible();

  // Today shows the resume card; nothing was added automatically.
  await page.goto('/#/');
  await expect(page.getByTestId('resume-card')).toContainText('Nothing was added while you were away');
  await page.goto('/#/progress');
  await expect(page.getByText('Active 0 times this week')).toBeVisible();
});

test('the tiny session is 3 + 3 with at least 60 seconds of rest between, and is logged as small (case 26)', async ({ page }) => {
  await readyToPractise(page);
  await beginPractice(page, 'tiny');
  await expect(page.getByRole('heading', { name: 'Chair sit-to-stand' })).toBeVisible();
  await expect(page.getByText('1 set · 3 repetitions')).toBeVisible();
  await page.getByRole('button', { name: 'Done: 3' }).click();
  await expect(page.getByText('Rest at least 60 seconds before the wall press-ups.')).toBeVisible();
  const readyBtn = page.getByRole('button', { name: /Ready in \d+ s|I'm ready — next/ });
  await expect(readyBtn).toBeDisabled();
  await page.clock.fastForward('01:01');
  await expect(page.getByRole('button', { name: "I'm ready — next" })).toBeEnabled();
  await page.getByRole('button', { name: "I'm ready — next" }).click();
  await expect(page.getByRole('heading', { name: 'Wall press-up' })).toBeVisible();
  await page.getByRole('button', { name: 'Done: 3' }).click();
  await page.getByRole('radio', { name: 'Comfortable' }).check();
  await page.getByRole('group', { name: 'Did the movements feel controlled?' }).getByRole('radio', { name: 'Yes' }).check();
  await page.getByRole('group', { name: 'At the end, could you have done a few more?' }).getByRole('radio', { name: 'Yes' }).check();
  await page.getByRole('button', { name: 'Save and finish' }).click();
  await page.goto('/#/progress');
  await expect(page.getByText(/Smaller practice/)).toBeVisible();
  await expect(page.getByText('Current amount: Stage 1 of 8')).toBeVisible();
});

test('next-day question appears on the next opening; no automatic progression (case 7)', async ({ page }) => {
  await readyToPractise(page);
  await beginPractice(page);
  await page.getByRole('button', { name: 'Skip the warm-up' }).click();
  const ready = page.getByRole('button', { name: "I'm ready — next" });
  const finish = page.getByRole('radio', { name: 'Comfortable' });
  for (let i = 0; i < 5; i++) {
    await page.getByRole('button', { name: 'Done: 5' }).click();
    await expect(ready.or(finish)).toBeVisible();
    if (await ready.isVisible()) await ready.click();
  }
  await page.getByRole('radio', { name: 'Comfortable' }).check();
  await page.getByRole('group', { name: 'Did the movements feel controlled?' }).getByRole('radio', { name: 'Yes' }).check();
  await page.getByRole('group', { name: 'At the end, could you have done a few more?' }).getByRole('radio', { name: 'Yes' }).check();
  await page.getByRole('button', { name: 'Save and finish' }).click();
  await expect(page.getByRole('heading', { name: 'Saved' })).toBeVisible();

  // Same day: no next-day question yet, and no extra practice today.
  await page.goto('/#/');
  await expect(page.getByTestId('next-day-card')).toHaveCount(0);
  await expect(page.getByRole('link', { name: "Start today's practice" })).toHaveCount(0);

  // Next morning (Wednesday): asked once, without notifications.
  await page.clock.setSystemTime(new Date('2026-11-03T20:00:00.000Z'));
  await page.reload();
  await expect(page.getByTestId('next-day-card')).toBeVisible();
  await page.getByRole('radio', { name: /^As usual/ }).check();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Thank you.')).toBeVisible();
  // One comfortable session is never enough for an offer.
  await expect(page.getByTestId('offer-card')).toHaveCount(0);
  // The day after a practice is a rest/walking day: no start buttons, no catch-up.
  await expect(page.getByText('You practised yesterday, so today is a rest or walking day.')).toBeVisible();
  await expect(page.getByRole('link', { name: "Start today's practice" })).toHaveCount(0);
});
