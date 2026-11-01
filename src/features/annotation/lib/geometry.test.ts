import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  clampRect,
  clientToImage,
  displayScale,
  HANDLES,
  hitTest,
  imageToClient,
  isBelowMin,
  MIN_BOX_SCREEN_PX,
  minBoxSize,
  moveRect,
  rectFromPoints,
  resizeRect,
  type Handle,
} from './geometry';

const bounds = { width: 4000, height: 3000 };
const display = (left: number, top: number, width: number, height: number) =>
  ({
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
  }) as DOMRectReadOnly;

const arbPoint = fc.record({
  x: fc.double({ min: -500, max: 4500, noNaN: true }),
  y: fc.double({ min: -500, max: 3500, noNaN: true }),
});
const arbRect = fc
  .record({
    x: fc.double({ min: 0, max: 3900, noNaN: true }),
    y: fc.double({ min: 0, max: 2900, noNaN: true }),
    width: fc.double({ min: 40, max: 4000, noNaN: true }),
    height: fc.double({ min: 40, max: 3000, noNaN: true }),
  })
  .map((r) => clampRect(r, bounds));
const arbHandle = fc.constantFrom<Handle>(...HANDLES);
const EPS = 1e-6;

function insideBounds(r: { x: number; y: number; width: number; height: number }) {
  return (
    r.x >= -EPS && r.y >= -EPS && r.x + r.width <= bounds.width + EPS && r.y + r.height <= bounds.height + EPS
  );
}

describe('screen ↔ image mapping', () => {
  it('maps the display rect corners to the image corners', () => {
    const rect = display(100, 50, 800, 600);
    expect(clientToImage({ x: 100, y: 50 }, rect, bounds)).toEqual({ x: 0, y: 0 });
    expect(clientToImage({ x: 900, y: 650 }, rect, bounds)).toEqual({ x: 4000, y: 3000 });
    expect(displayScale(rect, bounds)).toBeCloseTo(0.2);
  });

  it('round-trips image → client → image for any display rect (US3, SC-003)', () => {
    fc.assert(
      fc.property(
        arbPoint,
        fc.double({ min: 0, max: 2000, noNaN: true }),
        fc.double({ min: 0, max: 2000, noNaN: true }),
        fc.double({ min: 50, max: 3000, noNaN: true }),
        (p, left, top, width) => {
          const rect = display(left, top, width, (width * bounds.height) / bounds.width);
          const back = clientToImage(imageToClient(p, rect, bounds), rect, bounds);
          expect(Math.abs(back.x - p.x)).toBeLessThan(1e-6 * Math.max(1, Math.abs(p.x)));
          expect(Math.abs(back.y - p.y)).toBeLessThan(1e-6 * Math.max(1, Math.abs(p.y)));
        },
      ),
    );
  });

  it('a box drawn at 0.25 display scale maps to the same image region as at 1.0 (within 1%)', () => {
    const small = display(0, 0, 1000, 750); // scale 0.25
    const large = display(0, 0, 4000, 3000); // scale 1.0
    const a = rectFromPoints(
      clientToImage({ x: 250, y: 150 }, small, bounds),
      clientToImage({ x: 500, y: 450 }, small, bounds),
    );
    const b = rectFromPoints(
      clientToImage({ x: 1000, y: 600 }, large, bounds),
      clientToImage({ x: 2000, y: 1800 }, large, bounds),
    );
    expect(Math.abs(a.x - b.x) / bounds.width).toBeLessThan(0.01);
    expect(Math.abs(a.width - b.width) / bounds.width).toBeLessThan(0.01);
    expect(Math.abs(a.y - b.y) / bounds.height).toBeLessThan(0.01);
    expect(Math.abs(a.height - b.height) / bounds.height).toBeLessThan(0.01);
  });
});

describe('rect helpers', () => {
  it('rectFromPoints always yields positive dimensions', () => {
    fc.assert(
      fc.property(arbPoint, arbPoint, (a, b) => {
        const r = rectFromPoints(a, b);
        expect(r.width).toBeGreaterThanOrEqual(0);
        expect(r.height).toBeGreaterThanOrEqual(0);
        expect(r.x).toBe(Math.min(a.x, b.x));
      }),
    );
  });

  it('clampRect keeps any rect inside the image', () => {
    fc.assert(
      fc.property(arbPoint, arbPoint, (a, b) => {
        expect(insideBounds(clampRect(rectFromPoints(a, b), bounds))).toBe(true);
      }),
    );
  });

  it('moveRect keeps the size and stays inside the image', () => {
    fc.assert(
      fc.property(
        arbRect,
        fc.double({ min: -5000, max: 5000, noNaN: true }),
        fc.double({ min: -5000, max: 5000, noNaN: true }),
        (r, dx, dy) => {
          const m = moveRect(r, dx, dy, bounds);
          expect(m.width).toBeCloseTo(r.width, 6);
          expect(m.height).toBeCloseTo(r.height, 6);
          expect(insideBounds(m)).toBe(true);
        },
      ),
    );
  });

  it('resizeRect from any handle to any point stays in bounds, positive, and ≥ minSize', () => {
    fc.assert(
      fc.property(
        arbRect,
        arbHandle,
        arbPoint,
        fc.double({ min: 1, max: 200, noNaN: true }),
        (r, handle, to, min) => {
          const out = resizeRect(r, handle, to, bounds, min);
          expect(out.width).toBeGreaterThanOrEqual(min - EPS);
          expect(out.height).toBeGreaterThanOrEqual(min - EPS);
          expect(insideBounds(out)).toBe(true);
        },
      ),
    );
  });

  it('resizes from the se handle and the n edge as expected', () => {
    const r = { x: 100, y: 100, width: 200, height: 100 };
    expect(resizeRect(r, 'se', { x: 500, y: 400 }, bounds, 10)).toEqual({
      x: 100,
      y: 100,
      width: 400,
      height: 300,
    });
    expect(resizeRect(r, 'n', { x: 9999, y: 50 }, bounds, 10)).toEqual({
      x: 100,
      y: 50,
      width: 200,
      height: 150,
    });
    expect(resizeRect(r, 'w', { x: 150, y: 0 }, bounds, 10)).toEqual({
      x: 150,
      y: 100,
      width: 150,
      height: 100,
    });
  });

  it('flips and normalizes when dragged past the opposite edge', () => {
    const r = { x: 100, y: 100, width: 200, height: 100 };
    expect(resizeRect(r, 'e', { x: 40, y: 0 }, bounds, 10)).toEqual({
      x: 40,
      y: 100,
      width: 60,
      height: 100,
    });
    expect(resizeRect(r, 'nw', { x: 500, y: 300 }, bounds, 10)).toEqual({
      x: 300,
      y: 200,
      width: 200,
      height: 100,
    });
  });

  it('enforces the minimum size against the fixed edge', () => {
    const r = { x: 100, y: 100, width: 200, height: 100 };
    expect(resizeRect(r, 'e', { x: 102, y: 0 }, bounds, 30)).toEqual({
      x: 100,
      y: 100,
      width: 30,
      height: 100,
    });
  });

  it('minBoxSize is max(1% of the shorter side, 24 CSS px in image units)', () => {
    expect(MIN_BOX_SCREEN_PX).toBe(24);
    expect(minBoxSize(bounds, 1)).toBe(30); // 1% of 3000 > 24px
    expect(minBoxSize(bounds, 0.2)).toBe(120); // 24 / 0.2
    expect(minBoxSize({ width: 100, height: 50 }, 0.01)).toBe(50); // never larger than the image
  });

  it('isBelowMin checks both axes', () => {
    expect(isBelowMin({ x: 0, y: 0, width: 29, height: 100 }, 30)).toBe(true);
    expect(isBelowMin({ x: 0, y: 0, width: 30, height: 30 }, 30)).toBe(false);
  });
});

describe('hitTest', () => {
  const items = [
    { id: 'big', x: 0, y: 0, width: 1000, height: 1000 },
    { id: 'small', x: 100, y: 100, width: 100, height: 100 },
  ];

  it('prefers the smallest box containing the point', () => {
    expect(hitTest({ x: 150, y: 150 }, items, null)).toBe('small');
    expect(hitTest({ x: 500, y: 500 }, items, null)).toBe('big');
  });

  it('prefers the selected box when it contains the point', () => {
    expect(hitTest({ x: 150, y: 150 }, items, 'big')).toBe('big');
  });

  it('returns null on empty space', () => {
    expect(hitTest({ x: 2000, y: 2000 }, items, null)).toBeNull();
  });
});
