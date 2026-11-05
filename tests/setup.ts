import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import { notify } from '@/shared/ui/toast';
import type { SizedBlob } from './fakes/fakeImage';

let urlCounter = 0;

beforeEach(() => {
  Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });

  URL.createObjectURL = vi.fn(() => `blob:test/${++urlCounter}`);
  URL.revokeObjectURL = vi.fn();

  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(private cb: ResizeObserverCallback) {}
      observe() {}
      unobserve() {}
      disconnect() {}
      trigger() {
        this.cb([], this as unknown as ResizeObserver);
      }
    },
  );

  // Decode stub: fake blobs carry their own size; size 0 means "corrupt".
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn(async (blob: SizedBlob) => {
      if (!blob.__width || !blob.__height) throw new DOMException('decode failed', 'InvalidStateError');
      return { width: blob.__width, height: blob.__height, close: vi.fn() };
    }),
  );

  HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve());
  HTMLMediaElement.prototype.pause = vi.fn();

  if (!window.matchMedia) {
    window.matchMedia = vi.fn((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia;
  }

  // jsdom lacks pointer capture.
  Element.prototype.setPointerCapture ??= vi.fn();
  Element.prototype.releasePointerCapture ??= vi.fn();
  Element.prototype.hasPointerCapture ??= vi.fn(() => false);
  Element.prototype.scrollIntoView ??= vi.fn();
});

afterEach(() => {
  notify.dismissAll();
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  Reflect.deleteProperty(window, 'ImageCapture');
});
