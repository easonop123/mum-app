import { expect, test } from '@playwright/test';
import { FRIDAY_10AM_NZ, beginPractice, doFullPractice, readyToPractise } from './helpers';

test('first run is one tap, and practice starts with no questions', async ({ page }) => {
  await readyToPractise(page);
  await expect(page.getByText(/paused|waiting for medical advice/i)).toHaveCount(0);
  await beginPractice(page);
  await expect(page.getByRole('heading', { name: 'Warm-up: easy walking' })).toBeVisible();
  await expect(page.getByTestId('stop-button')).toBeVisible();
});

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

  // Full reload mid-practice.
  await page.reload();
  await expect(page.getByText(/Movement 2 of 4/)).toBeVisible();
  const ready = page.getByRole('button', { name: "I'm ready — next" });
  if (await ready.isVisible()) await ready.click();
  await expect(page.getByRole('heading', { name: 'Wall press-up' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Done: 5' })).toBeVisible();

  await page.goto('/#/');
  await expect(page.getByTestId('resume-card')).toContainText('Nothing was added while you were away');
});

test('the smaller practice is 3 + 3 with at least 60 seconds of rest between', async ({ page }) => {
  await readyToPractise(page);
  await beginPractice(page, 'tiny');
  await expect(page.getByRole('heading', { name: 'Chair sit-to-stand' })).toBeVisible();
  await expect(page.getByText('1 set · 3 repetitions')).toBeVisible();
  await page.getByRole('button', { name: 'Done: 3' }).click();
  await expect(page.getByText('Rest at least 60 seconds before the wall press-ups.')).toBeVisible();
  await expect(page.getByRole('button', { name: /Ready in \d+ s/ })).toBeDisabled();
  await page.clock.fastForward('01:01');
  await page.getByRole('button', { name: "I'm ready — next" }).click();
  await page.getByRole('button', { name: 'Done: 3' }).click();
  await expect(page.getByTestId('finished-view')).toBeVisible();
  await page.goto('/#/progress');
  await expect(page.getByText(/Smaller practice/)).toBeVisible();
  await expect(page.getByText('Current amount: Stage 1 of 8')).toBeVisible();
});

test('two full practices → "Ready for a little more?"; keeping the amount is the default', async ({ page }) => {
  await readyToPractise(page);
  await doFullPractice(page);
  await page.goto('/#/');
  await expect(page.getByText('Full practices at this stage: 1 of 2')).toBeVisible();
  await expect(page.getByTestId('offer-card')).toHaveCount(0);

  await page.clock.setSystemTime(FRIDAY_10AM_NZ);
  await page.reload();
  await doFullPractice(page);
  await page.goto('/#/');
  const offer = page.getByTestId('offer-card');
  await expect(offer).toContainText('Ready for a little more?');
  await expect(offer.getByRole('button', { name: 'Keep this amount / 保持这个量' })).toBeVisible();
  await offer.getByRole('button', { name: 'Try Stage 2' }).click();
  await expect(page.getByText('OK — Stage 2 from your next practice.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Stage 2 of 8' })).toBeVisible();
});

test('Stop saves the practice and never locks anything', async ({ page }) => {
  await readyToPractise(page);
  await beginPractice(page);
  await page.getByRole('button', { name: 'Skip the warm-up' }).click();
  await page.getByRole('button', { name: 'Done: 5' }).click();
  await page.getByTestId('stop-button').click();
  await page.getByRole('button', { name: 'Yes, stop' }).click();
  await expect(page.getByTestId('stopped-view')).toBeVisible();
  await expect(page.getByRole('link', { name: /Call 111/ })).toHaveAttribute('href', 'tel:111');
  // Friday: practice is simply available again.
  await page.clock.setSystemTime(FRIDAY_10AM_NZ);
  await page.goto('/#/');
  await page.reload();
  await expect(page.getByRole('link', { name: "Start today's practice" })).toBeVisible();
  await expect(page.getByText(/paused/i)).toHaveCount(0);
});
