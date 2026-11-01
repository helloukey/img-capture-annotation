import { expect, test } from '@playwright/test';

// Chromium's --deny-permission-prompts flag yields NotSupportedError, which is not what a real
// denial looks like. Reproduce a genuine user denial instead: NotAllowedError + permission "denied".
test('permission denied shows guidance, and the upload fallback reaches review', async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () =>
      Promise.reject(new DOMException('Permission denied', 'NotAllowedError'));
    const query = navigator.permissions.query.bind(navigator.permissions);
    navigator.permissions.query = (d: PermissionDescriptor) =>
      d.name === ('camera' as PermissionName)
        ? Promise.resolve({ state: 'denied' } as PermissionStatus)
        : query(d);
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Camera access is blocked' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Try again/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Choose a photo' })).toBeVisible();

  // Generate a real 1600×1200 JPEG in the browser to upload.
  const base64 = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 1600;
    c.height = 1200;
    const ctx = c.getContext('2d')!;
    const g = ctx.createLinearGradient(0, 0, 1600, 1200);
    g.addColorStop(0, '#345');
    g.addColorStop(1, '#cba');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1600, 1200);
    return c.toDataURL('image/jpeg', 0.92).split(',')[1]!;
  });
  await page
    .getByTestId('choose-photo-input')
    .first()
    .setInputFiles({
      name: 'sample.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from(base64, 'base64'),
    });

  await expect(page.getByRole('img', { name: 'Your capture' })).toBeVisible();
  await expect(page.getByRole('status', { name: 'Image quality' })).toContainText('1.9 MP (1600 × 1200)');
});
