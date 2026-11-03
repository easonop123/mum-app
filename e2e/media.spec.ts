import { expect, test } from '@playwright/test';
import { letsStart, startFresh } from './helpers';

test('videos load only on tap, and a failed embed gives a truthful fallback (cases 11, 14)', async ({ page, context }) => {
  const youtubeRequests: string[] = [];
  await context.route(/youtube|ytimg|googlevideo/, (route) => {
    youtubeRequests.push(route.request().url());
    return route.abort();
  });
  await startFresh(page);
  await letsStart(page);
  await page.goto('/#/learn/supported-heel-raise');
  await expect(page.getByTestId('dose-note').first()).toContainText('视频用来看动作；次数和组数请按本页安排，不跟随视频加量。');
  expect(youtubeRequests).toHaveLength(0);
  await page.getByRole('button', { name: '看示范 / Watch demonstration' }).first().click();
  await expect(page.locator('iframe[src^="https://www.youtube-nocookie.com/embed/zpIkRgojpiY"]')).toBeAttached();
  await page.getByRole('button', { name: "It didn't play" }).click();
  await expect(page.getByText(/didn't play here/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open on YouTube' }).first()).toHaveAttribute('href', 'https://www.youtube.com/watch?v=zpIkRgojpiY');
  // Written steps remain readable throughout.
  await expect(page.getByText('Lift both heels a comfortable amount.')).toBeVisible();
});
