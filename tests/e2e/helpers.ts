import { expect, type Page } from '@playwright/test';

/** Waits for the live preview, captures, and returns once the review photo is shown. */
export async function captureToReview(page: Page) {
  await page.goto('/');
  const video = page.getByTestId('camera-preview');
  await expect(video).toBeVisible();
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.readyState >= 2 && v.videoWidth > 0), {
      timeout: 3000,
    })
    .toBe(true);
  const shutter = page.getByRole('button', { name: 'Capture photo' });
  await expect(shutter).toBeEnabled();
  await shutter.click();
  const photo = page.getByRole('img', { name: 'Your capture' });
  await expect(photo).toBeVisible();
  await expect.poll(() => photo.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  return photo;
}

export async function captureToAnnotate(page: Page) {
  await captureToReview(page);
  await page.getByRole('button', { name: /Use Photo|Use anyway/ }).click();
  await expect(
    page.getByRole('navigation', { name: 'Progress' }).locator('[aria-current="step"]'),
  ).toContainText('Annotate');
}

type Pt = { x: number; y: number };

/** Drags with real input: touch (via CDP touch events) on touch projects, mouse otherwise. */
export async function dragOn(page: Page, from: Pt, to: Pt, steps = 8) {
  const isTouch = await page.evaluate(() => navigator.maxTouchPoints > 0);
  if (isTouch) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: from.x, y: from.y }],
    });
    for (let i = 1; i <= steps; i++) {
      const x = from.x + ((to.x - from.x) * i) / steps;
      const y = from.y + ((to.y - from.y) * i) / steps;
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] });
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await cdp.detach();
  } else {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps });
    await page.mouse.up();
  }
}

/** Converts fractions of the annotation surface into page coordinates. */
export async function surfacePoint(page: Page, fx: number, fy: number): Promise<Pt> {
  const box = await page.getByTestId('annotation-surface').boundingBox();
  if (!box) throw new Error('annotation surface not visible');
  return { x: box.x + box.width * fx, y: box.y + box.height * fy };
}
