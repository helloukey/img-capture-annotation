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

/** Opens the camera and waits until the shutter is live. */
export async function openCamera(page: Page) {
  await page.goto('/');
  const video = page.getByTestId('camera-preview');
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.videoWidth)).toBeGreaterThan(0);
  await expect(page.getByRole('button', { name: 'Capture photo' })).toBeEnabled();
  return video;
}

/** Holds the shutter for `ms` with real input (CDP touch on touch projects, mouse otherwise). */
export async function holdShutter(page: Page, ms: number) {
  const box = await page.getByRole('button', { name: 'Capture photo' }).boundingBox();
  if (!box) throw new Error('shutter not visible');
  const at = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const isTouch = await page.evaluate(() => navigator.maxTouchPoints > 0);
  if (isTouch) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [at] });
    await page.waitForTimeout(ms);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await cdp.detach();
  } else {
    await page.mouse.move(at.x, at.y);
    await page.mouse.down();
    await page.waitForTimeout(ms);
    await page.mouse.up();
  }
}

/** Number of photos in the session, read from the strip (0 when the strip is hidden). */
export async function stripCount(page: Page): Promise<number> {
  const strip = page.getByRole('toolbar', { name: /^Photos \(/ });
  if ((await strip.count()) === 0)
    return (await page.getByRole('img', { name: 'Your capture' }).count()) ? 1 : 0;
  return Number((await strip.getAttribute('aria-label'))!.match(/\((\d+)\)/)![1]);
}

/** The first box's position and size as fractions of the rendered image (alignment checks). */
export async function fractions(page: Page) {
  return page.evaluate(() => {
    const img = document.querySelector('[data-testid="annotation-stage"] img')!.getBoundingClientRect();
    const box = document.querySelector('[data-annotation-id] rect')!.getBoundingClientRect();
    return {
      x: (box.left - img.left) / img.width,
      y: (box.top - img.top) / img.height,
      w: box.width / img.width,
      h: box.height / img.height,
    };
  });
}
