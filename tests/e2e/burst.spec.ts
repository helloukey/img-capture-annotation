import { expect, test } from '@playwright/test';
import { holdShutter, openCamera, stripCount } from './helpers';

test.describe('US1 hold-to-burst', () => {
  test('holding the shutter takes several full-stream-resolution photos', async ({ page }) => {
    const video = await openCamera(page);
    const stream = await video.evaluate((v: HTMLVideoElement) => `${v.videoWidth} × ${v.videoHeight}`);
    await holdShutter(page, 1300);
    await expect(page.getByRole('img', { name: 'Your capture' })).toBeVisible();
    await expect.poll(() => stripCount(page)).toBeGreaterThanOrEqual(3);
    // Every burst photo reports its own (stream) resolution in the quality panel.
    await expect(page.getByRole('status', { name: 'Image quality' })).toContainText(stream);
    const thumbs = page.getByRole('toolbar', { name: /^Photos/ }).getByRole('button');
    await thumbs.nth(1).click();
    await expect(page.getByRole('status', { name: 'Image quality' })).toContainText(stream);
    await expect(thumbs.nth(1)).toHaveAttribute('aria-pressed', 'true');
  });

  test('a tap still takes exactly one photo, with no strip', async ({ page }) => {
    await openCamera(page);
    await page.getByRole('button', { name: 'Capture photo' }).click();
    await expect(page.getByRole('img', { name: 'Your capture' })).toBeVisible();
    expect(await stripCount(page)).toBe(1);
    await expect(page.getByRole('toolbar', { name: /^Photos/ })).toHaveCount(0);
  });

  test('a long hold stops at the burst limit (≤ 3 s, ≤ 10 photos) and says so', async ({ page }) => {
    await openCamera(page);
    await holdShutter(page, 3800);
    await expect(page.getByRole('img', { name: 'Your capture' })).toBeVisible();
    const n = await stripCount(page);
    expect(n).toBeGreaterThanOrEqual(2);
    expect(n).toBeLessThanOrEqual(10);
    await expect(page.getByText(/Burst limit reached/)).toBeVisible();
  });

  test('a long press shows no selection or context menu', async ({ page }, info) => {
    test.skip(info.project.name !== 'pixel-7', 'touch long-press');
    await openCamera(page);
    const menus: string[] = [];
    await page.exposeFunction('reportMenu', (t: string) => menus.push(t));
    await page.evaluate(() =>
      window.addEventListener('contextmenu', (e) => {
        if (!e.defaultPrevented) (window as unknown as { reportMenu(t: string): void }).reportMenu('menu');
      }),
    );
    await holdShutter(page, 1000);
    await expect(page.getByRole('img', { name: 'Your capture' })).toBeVisible();
    expect(await page.evaluate(() => window.getSelection()?.toString() ?? '')).toBe('');
    expect(menus).toEqual([]);
  });
});

test.describe('US2 review and delete', () => {
  test('delete photos from the strip, undo one, then add more to the same session', async ({
    page,
  }, info) => {
    test.skip(info.project.name !== 'desktop-chrome', 'keyboard flow runs once');
    await openCamera(page);
    await holdShutter(page, 1700);
    await expect(page.getByRole('img', { name: 'Your capture' })).toBeVisible();
    await expect.poll(() => stripCount(page)).toBeGreaterThanOrEqual(4);
    const start = await stripCount(page);

    const thumbs = page.getByRole('toolbar', { name: /^Photos/ }).getByRole('button');
    await thumbs.nth(1).focus();
    await page.keyboard.press('Delete');
    await expect.poll(() => stripCount(page)).toBe(start - 1);
    await thumbs.nth(1).focus();
    await page.keyboard.press('Delete');
    await expect.poll(() => stripCount(page)).toBe(start - 2);

    // Sonner stacks toasts newest-first; the front one belongs to the latest deletion.
    await page.getByRole('button', { name: 'Undo' }).first().click();
    await expect.poll(() => stripCount(page)).toBe(start - 1);

    await page.getByRole('button', { name: /Add more/ }).click();
    await expect(page.getByRole('button', { name: 'Capture photo' })).toBeEnabled();
    await page.getByRole('button', { name: 'Capture photo' }).click();
    await expect(page.getByRole('img', { name: 'Your capture' })).toBeVisible();
    await expect.poll(() => stripCount(page)).toBe(start);
  });
});
