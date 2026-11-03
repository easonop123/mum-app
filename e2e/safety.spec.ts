import { expect, test } from '@playwright/test';
import { beginPractice, completeOnboarding, readyToPractise, startFresh } from './helpers';

const EMERGENCY_ZH = '先停止练习。这些新出现的症状需要立即寻求医疗帮助，不要继续测试动作。';
const WORKOUT_AND_LEARNING_ROUTES = ['/#/session/full', '/#/session/tiny', '/#/session', '/#/learn', '/#/plan'];

test('emergency answer blocks every workout route, deep link and reload (case 1)', async ({ page }) => {
  await startFresh(page);
  await page.getByRole('button', { name: "Yes, let's have a look" }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Yes, New Zealand' }).click();
  await page.getByRole('button', { name: 'Start' }).click();
  await page.getByRole('radio', { name: 'Yes, one or more' }).check();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: "Yes, that's right" }).click();
  await expect(page.getByTestId('emergency-view')).toContainText(EMERGENCY_ZH);
  await expect(page.getByRole('link', { name: /Call 111/ })).toHaveAttribute('href', 'tel:111');

  for (const route of WORKOUT_AND_LEARNING_ROUTES) {
    await page.goto(route);
    await page.reload();
    await expect(page.getByTestId('emergency-view')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Start' })).toHaveCount(0);
    await expect(page.getByText(/try seated|just walk/i)).toHaveCount(0);
  }
});

test('an emergency reported mid-session blocks resuming that session (case 1)', async ({ page }) => {
  await readyToPractise(page);
  await beginPractice(page);
  await page.getByRole('button', { name: 'Done walking' }).click();
  await page.getByRole('button', { name: 'Done: 5' }).click();
  // Leave the session open and report new symptoms through the re-check flow.
  // Nothing is on hold yet, so the re-check starts directly with current symptoms.
  await page.goto('/#/rescreen');
  await page.getByRole('radio', { name: 'Yes, one or more' }).check();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: "Yes, that's right" }).click();
  await expect(page.getByTestId('emergency-view')).toBeVisible();
  await page.goto('/#/session');
  await expect(page.getByTestId('emergency-view')).toBeVisible();
  await expect(page.getByRole('button', { name: /Done:/ })).toHaveCount(0);
  await expect(page.getByTestId('stop-button')).toHaveCount(0);
});

test('assessment pending cannot be bypassed by clear answers, the tiny session, or deep links (case 25)', async ({ page }) => {
  await startFresh(page);
  await completeOnboarding(page);
  await expect(page.getByTestId('waiting-card')).toContainText('Your plan is waiting for medical advice');
  for (const route of ['/#/session/full', '/#/session/tiny']) {
    await page.goto(route);
    await expect(page.getByTestId('practice-blocked')).toContainText('waits until a GP or physiotherapist');
  }
  // Learning is allowed, and clearly labelled as watch/read only.
  await page.goto('/#/learn');
  await expect(page.getByText(/Watch and read only/)).toBeVisible();
});

test('"no new changes" cannot clear an earlier hold (case 2)', async ({ page }) => {
  await readyToPractise(page);
  await page.getByRole('link', { name: "Start today's practice" }).click();
  await page.getByRole('radio', { name: 'Yes', exact: true }).check();
  const groups = page.getByRole('group');
  await groups.nth(1).getByRole('radio', { name: 'No, none of these' }).check();
  await groups.nth(2).getByRole('radio', { name: 'No, none of these' }).check();
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page.getByTestId('held-view')).toBeVisible();
  // Two days later (Thursday → moved day), a "nothing new" check-in must not get past the hold.
  await page.clock.setSystemTime(new Date('2026-11-04T21:00:00.000Z'));
  await page.goto('/#/session/tiny');
  await expect(page.getByTestId('practice-blocked')).toBeVisible();
  await page.goto('/#/');
  await expect(page.getByTestId('waiting-card')).toContainText('Practice is paused for now');
});
