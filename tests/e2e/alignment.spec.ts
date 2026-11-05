import { expect, test } from '@playwright/test';
import { captureToAnnotate, dragOn, fractions, surfacePoint } from './helpers';

test('boxes stay aligned with the image across viewport sizes and orientations (US3, SC-003)', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'desktop-chrome', 'viewport sweep runs once');
  await page.setViewportSize({ width: 1440, height: 900 });
  await captureToAnnotate(page);
  await dragOn(page, await surfacePoint(page, 0.3, 0.25), await surfacePoint(page, 0.6, 0.7));
  await page.keyboard.press('Escape');
  const original = await fractions(page);

  for (const size of [
    { width: 768, height: 1024 },
    { width: 360, height: 740 },
    { width: 740, height: 360 },
    { width: 1280, height: 800 },
  ]) {
    await page.setViewportSize(size);
    await page.waitForTimeout(150);
    const now = await fractions(page);
    for (const k of ['x', 'y', 'w', 'h'] as const) {
      expect(Math.abs(now[k] - original[k]), `${k} at ${size.width}×${size.height}`).toBeLessThan(0.01);
    }
  }

  // Collapsing and reopening the side panel resizes the canvas; boxes must follow.
  const listToggle = page.getByRole('button', { name: /^Annotations\s*\d+$/ });
  for (const expanded of ['false', 'true']) {
    await listToggle.click();
    await expect(listToggle).toHaveAttribute('aria-expanded', expanded);
    await page.waitForTimeout(150);
    const now = await fractions(page);
    for (const k of ['x', 'y', 'w', 'h'] as const) expect(Math.abs(now[k] - original[k])).toBeLessThan(0.01);
  }
});

test('the annotation list opens as a bottom sheet on phones', async ({ page }, info) => {
  test.skip(info.project.name !== 'pixel-7', 'phone layout only');
  await captureToAnnotate(page);
  await dragOn(page, await surfacePoint(page, 0.2, 0.2), await surfacePoint(page, 0.6, 0.6));
  await page.getByRole('button', { name: /^Annotations\s*1$/ }).click();
  const sheet = page.getByRole('dialog', { name: 'Annotations' });
  await expect(sheet).toBeVisible();
  await sheet.getByRole('textbox').fill('Laptop');
  await sheet.getByRole('textbox').press('Enter');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Annotation Laptop' })).toBeVisible();
});
