import { expect, test } from '@playwright/test';
import { openCamera } from './helpers';

// Opt-in measurement for constitution VIII / SC-003 / SC-006: `PERF=1 npm run test:e2e -- perf`.
// Desktop Chromium with the fake camera is an approximation; the reference phone is measured by hand.
test.skip(!process.env.PERF, 'set PERF=1 to run performance measurements');

test('burst main-thread budget, release-to-stop delay, and photo-switch latency', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-chrome', 'measured once');
  await openCamera(page);
  await page.evaluate(() => {
    const w = window as unknown as { __longTasks: number[] };
    w.__longTasks = [];
    new PerformanceObserver((list) =>
      list.getEntries().forEach((e) => w.__longTasks.push(e.duration)),
    ).observe({
      type: 'longtask',
      buffered: false,
    });
  });

  const box = (await page.getByRole('button', { name: 'Capture photo' }).boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(2000);
  await page.mouse.up();
  await expect(page.getByRole('img', { name: 'Your capture' })).toBeVisible();

  // Only tasks while the burst was running count against the burst budget (constitution VIII);
  // rendering Review afterwards is reported separately.
  const { during, after } = await page.evaluate(() => {
    const tasks = (window as unknown as { __longTasks: { start: number; duration: number }[] }).__longTasks;
    const release = performance.getEntriesByName('burst-release').at(-1)!.startTime;
    return {
      during: tasks.filter((t) => t.start < release).map((t) => t.duration),
      after: tasks.filter((t) => t.start >= release).map((t) => t.duration),
    };
  });
  const releaseToStop = await page.evaluate(() => {
    const r = performance.getEntriesByName('burst-release').at(-1)!.startTime;
    const s = performance.getEntriesByName('burst-stopped').at(-1)!.startTime;
    return s - r;
  });

  const thumbs = page.getByRole('toolbar', { name: /^Photos/ }).getByRole('button');
  const switchMs = await page.evaluate(async () => {
    const strip = document.querySelector('[role="toolbar"][aria-label^="Photos"]')!;
    const target = strip.querySelectorAll('button')[2] as HTMLButtonElement;
    const img = () => document.querySelector('img[alt="Your capture"]') as HTMLImageElement;
    const before = img().src;
    const t0 = performance.now();
    target.click();
    await new Promise<void>((resolve) => {
      const tick = () => (img().src !== before ? resolve() : requestAnimationFrame(tick));
      tick();
    });
    return performance.now() - t0;
  });
  await expect(thumbs.nth(2)).toHaveAttribute('aria-pressed', 'true');

  const longest = Math.max(0, ...during);
  console.log(
    `PERF longest main-thread task during burst: ${longest.toFixed(0)} ms (${during.length} long tasks)`,
  );
  console.log(
    `PERF long tasks after release (opening Review): ${after.map((d) => d.toFixed(0)).join(', ') || 'none'}`,
  );
  console.log(`PERF release → burst stopped: ${releaseToStop.toFixed(0)} ms`);
  console.log(`PERF photo switch → new image shown: ${switchMs.toFixed(0)} ms`);
  expect(longest).toBeLessThanOrEqual(50); // constitution VIII main-thread budget
  expect(releaseToStop).toBeLessThan(200); // SC-003
  expect(switchMs).toBeLessThan(100); // SC-006
});
