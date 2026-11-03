import { expect, test } from '@playwright/test';
import { completeOnboarding, startFresh } from './helpers';

test('first-party offline relaunch works after a successful first visit (case 20)', async ({ page, context }) => {
  await startFresh(page, { clock: false });
  // Wait until the service worker has installed and controls the page.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await completeOnboarding(page);

  await context.setOffline(true);
  await page.reload();
  // App shell, plan status, safety/help text and local history all load offline.
  await expect(page.getByTestId('waiting-card')).toBeVisible();
  await expect(page.getByText('Your goal: Getting up from a chair more easily')).toBeVisible();
  await page.goto('/#/help');
  await expect(page.getByRole('link', { name: /Call 111/ })).toBeVisible();
  await page.goto('/#/learn/supported-heel-raise');
  await expect(page.getByText('Hold the fixed counter with both hands.')).toBeVisible();
  // External video is honestly unavailable offline — never labelled cached.
  await expect(page.getByText("You're offline, so the video can't load. The written steps are below.").first()).toBeVisible();
  await expect(page.getByRole('button', { name: /Watch demonstration/ }).first()).toBeDisabled();
  await context.setOffline(false);
});

test('the service worker precaches only first-party files — no third-party video (case 15)', async ({ request }) => {
  const sw = await (await request.get('/sw.js')).text();
  expect(sw).toContain('index.html');
  expect(sw).not.toMatch(/youtube|ytimg|googlevideo|\.mp4/i);
});
