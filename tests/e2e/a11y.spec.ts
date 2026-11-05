import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { captureToReview, dragOn, surfacePoint } from './helpers';

async function expectNoSeriousViolations(page: Page, step: string) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(
    serious.map(
      (v) =>
        `${step}: ${v.id} – ${v.help} ${v.nodes.map((n) => n.target.join(' ') + ' ' + (n.failureSummary ?? '').replace(/\s+/g, ' ').slice(0, 160)).join(' | ')}`,
    ),
  ).toEqual([]);
}

test('no serious/critical axe violations on any step (FR-034)', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Capture photo' })).toBeEnabled();
  await expectNoSeriousViolations(page, 'camera');

  await captureToReview(page);
  await expect(page.getByRole('status', { name: 'Image quality' })).not.toContainText('Analyzing');
  await expectNoSeriousViolations(page, 'review');

  await page.getByRole('button', { name: /Use Photo|Use anyway/ }).click();
  await dragOn(page, await surfacePoint(page, 0.2, 0.2), await surfacePoint(page, 0.6, 0.6));
  await expectNoSeriousViolations(page, 'annotate');
});

test('no serious/critical axe violations in a multi-photo session (feature 002)', async ({ page }) => {
  const { holdShutter, openCamera } = await import('./helpers');
  await openCamera(page);
  await expectNoSeriousViolations(page, 'camera (burst controls)');
  await holdShutter(page, 1200);
  await expect(page.getByRole('toolbar', { name: /^Photos/ })).toBeVisible();
  await expectNoSeriousViolations(page, 'review (strip)');
  await page.getByRole('button', { name: /Continue to annotate/ }).click();
  await dragOn(page, await surfacePoint(page, 0.2, 0.2), await surfacePoint(page, 0.6, 0.6));
  await expectNoSeriousViolations(page, 'annotate (strip)');
});
