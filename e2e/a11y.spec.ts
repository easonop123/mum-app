import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { beginPractice, completeOnboarding, readyToPractise, startFresh } from './helpers';

async function expectNoSeriousViolations(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  if (results.violations.length) {
    console.log(`[axe] ${label}: ${results.violations.map((v) => `${v.id}(${v.impact}, ${v.nodes.length})`).join(', ')}`);
  }
  expect(serious, `${label}: ${serious.map((v) => `${v.id}: ${v.help}`).join('; ')}`).toEqual([]);
}

test('axe: onboarding, Today, learn, plan, settings, help — English and Chinese (case 19)', async ({ page }) => {
  await startFresh(page);
  await expectNoSeriousViolations(page, 'welcome');
  await completeOnboarding(page);
  await expectNoSeriousViolations(page, 'today (waiting)');
  for (const route of ['/#/learn', '/#/learn/chair-sit-to-stand', '/#/plan', '/#/settings', '/#/settings/advice', '/#/settings/summary', '/#/settings/data', '/#/help', '/#/progress']) {
    await page.goto(route);
    await expect(page.locator('h1')).toBeVisible();
    await expectNoSeriousViolations(page, route);
  }
  await page.getByRole('button', { name: /Switch to Simplified Chinese/ }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-Hans');
  await expect(page.getByRole('navigation', { name: '主菜单' })).toBeVisible();
  for (const route of ['/#/', '/#/learn/supported-side-leg-lift', '/#/plan', '/#/help']) {
    await page.goto(route);
    await expectNoSeriousViolations(page, `zh ${route}`);
  }
});

test('axe + touch targets during a practice; stop stays reachable (case 19)', async ({ page }) => {
  await readyToPractise(page);
  await beginPractice(page);
  await page.getByRole('button', { name: 'Done walking' }).click();
  await expectNoSeriousViolations(page, 'session exercise');
  const small = await page.evaluate(() =>
    [...document.querySelectorAll('main button, main .btn, .stop-bar button, .app-header .btn, .choice')]
      .map((el) => el.getBoundingClientRect())
      .filter((r) => r.width > 0 && (r.height < 44 || r.width < 44)).length,
  );
  expect(small).toBe(0);
  await expect(page.getByTestId('stop-button')).toBeInViewport();
});

test('320 px wide with 200% text: no hidden safety actions or sideways scrolling (case 19)', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await readyToPractise(page);
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
  await expect(page.getByTestId('help-link')).toBeInViewport();
  await beginPractice(page);
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
  await page.getByRole('button', { name: 'Done walking' }).click();
  const stop = page.getByTestId('stop-button');
  await expect(stop).toBeInViewport();
  const box = await stop.boundingBox();
  expect(box && box.y + box.height <= 640).toBe(true);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await stop.click();
  await expect(page.getByRole('heading', { name: 'Stop now' })).toBeVisible();
});

test('keyboard only: reach and activate primary actions with visible focus (case 19)', async ({ page }) => {
  await startFresh(page);
  const target = page.getByRole('button', { name: "Yes, let's have a look" });
  for (let i = 0; i < 12 && !(await target.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press('Tab');
  await expect(target).toBeFocused();
  const outline = await target.evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(outline).not.toBe('none');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Which language?' })).toBeVisible();
});

test('reduced motion is respected (case 19)', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await startFresh(page);
  const duration = await page.getByRole('button', { name: "Yes, let's have a look" }).evaluate((el) => getComputedStyle(el).transitionDuration);
  expect(['0s', '0s, 0s']).toContain(duration);
});
