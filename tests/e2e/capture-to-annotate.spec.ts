import { expect, test } from '@playwright/test';
import { captureToAnnotate, captureToReview, dragOn, surfacePoint } from './helpers';

test.describe('US1 capture → review', () => {
  test('captures at least the stream resolution, retakes, and accepts', async ({ page }) => {
    await page.goto('/');
    const video = page.getByTestId('camera-preview');
    await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.videoWidth)).toBeGreaterThan(0);
    const stream = await video.evaluate((v: HTMLVideoElement) => v.videoWidth * v.videoHeight);

    const photo = await captureToReview(page);
    // The capture is never smaller than what the camera streamed (takePhoto may be larger).
    const natural = await photo.evaluate((img: HTMLImageElement) => img.naturalWidth * img.naturalHeight);
    expect(natural).toBeGreaterThanOrEqual(stream);

    await page.getByRole('button', { name: /Retake/ }).click();
    await expect(page.getByTestId('camera-preview')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Capture photo' })).toBeEnabled();
    await page.getByRole('button', { name: 'Capture photo' }).click();
    await expect(page.getByRole('img', { name: 'Your capture' })).toBeVisible();

    await page.getByRole('button', { name: /Use Photo|Use anyway/ }).click();
    await expect(
      page.getByRole('navigation', { name: 'Progress' }).locator('[aria-current="step"]'),
    ).toContainText('Annotate');
  });
});

test.describe('US2 draw and edit', () => {
  test('draw, label, move, resize, delete and undo a box', async ({ page }) => {
    await captureToAnnotate(page);

    await dragOn(page, await surfacePoint(page, 0.2, 0.2), await surfacePoint(page, 0.5, 0.55));
    const box = page.getByRole('button', { name: 'Annotation Untitled 1' });
    await expect(box).toBeVisible();

    const label = page.getByRole('textbox', { name: 'Label', exact: true });
    await label.fill('Bottle');
    await label.press('Enter');
    const bottle = page.getByRole('button', { name: 'Annotation Bottle' });
    await expect(bottle).toBeVisible();

    const before = await bottle.boundingBox();
    await dragOn(page, await surfacePoint(page, 0.35, 0.4), await surfacePoint(page, 0.45, 0.5));
    const moved = await bottle.boundingBox();
    expect(moved!.x).toBeGreaterThan(before!.x + 5);
    expect(moved!.width).toBeCloseTo(before!.width, 0);

    const se = await page.locator('[data-handle="se"] rect').first().boundingBox();
    await dragOn(
      page,
      { x: se!.x + se!.width / 2, y: se!.y + se!.height / 2 },
      await surfacePoint(page, 0.85, 0.85),
    );
    const resized = await bottle.boundingBox();
    expect(resized!.width).toBeGreaterThan(moved!.width + 10);

    await page.getByRole('button', { name: 'Delete annotation' }).click();
    await expect(bottle).toHaveCount(0);
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(bottle).toBeVisible();
    await expect(page.getByText('Bottle', { exact: true }).first()).toBeVisible();
  });
});

test('photos never leave the device: no requests to other origins (FR-035)', async ({ page, baseURL }) => {
  const foreign: string[] = [];
  page.on('request', (req) => {
    const url = new URL(req.url());
    if (!['blob:', 'data:'].includes(url.protocol) && url.origin !== new URL(baseURL!).origin)
      foreign.push(req.url());
  });
  await captureToAnnotate(page);
  await dragOn(page, await surfacePoint(page, 0.2, 0.2), await surfacePoint(page, 0.6, 0.6));
  expect(foreign).toEqual([]);
});

test('US8 export: JSON with full-resolution integer coordinates', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-chrome', 'download check runs once');
  await captureToAnnotate(page);
  await dragOn(page, await surfacePoint(page, 0.25, 0.25), await surfacePoint(page, 0.75, 0.75));
  await page.getByRole('button', { name: 'Export' }).click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /Data \(JSON/ }).click(),
  ]);
  const data = JSON.parse(
    await (await download.createReadStream()).toArray().then((c) => Buffer.concat(c).toString()),
  );
  const { width, height } = data.image;
  const box = data.annotations[0].bbox;
  expect(Number.isInteger(box.x) && Number.isInteger(box.width)).toBe(true);
  expect(Math.abs(box.x / width - 0.25)).toBeLessThan(0.02);
  expect(Math.abs(box.width / width - 0.5)).toBeLessThan(0.02);
  expect(Math.abs(box.height / height - 0.5)).toBeLessThan(0.02);
});
