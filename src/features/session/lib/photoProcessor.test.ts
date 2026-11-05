import { describe, expect, it, vi } from 'vitest';
import { makePhoto } from '../../../../tests/fakes/appState';
import { createPhotoProcessor, type ProcessorDeps } from './photoProcessor';

function setup(overrides: Partial<ProcessorDeps> = {}) {
  const tasks: (() => void)[] = [];
  const closes: string[] = [];
  const order: string[] = [];
  let resolveDecode: (() => void) | null = null;
  const deps: ProcessorDeps = {
    decode: vi.fn(async (blob: Blob) => {
      const id = (blob as Blob & { id: string }).id;
      order.push(id);
      return { source: {} as CanvasImageSource, width: 400, height: 300, close: () => closes.push(id) };
    }),
    analyze: vi.fn(() => ({ brightnessPct: 50, sharpness: 400 })),
    thumbnail: vi.fn(async () => new Blob(['t'], { type: 'image/jpeg' })),
    schedule: (task) => tasks.push(task),
    ...overrides,
  };
  const proc = createPhotoProcessor(deps);
  /** Runs scheduled tasks and lets their promises settle, until idle. */
  const flush = async () => {
    for (let i = 0; i < 50; i++) {
      const t = tasks.shift();
      if (t) t();
      await new Promise((r) => setTimeout(r, 0));
      if (!tasks.length) await new Promise((r) => setTimeout(r, 0));
      if (!tasks.length) break;
    }
  };
  return {
    proc,
    deps,
    tasks,
    closes,
    order,
    flush,
    setResolve: (f: () => void) => (resolveDecode = f),
    get resolveDecode() {
      return resolveDecode;
    },
  };
}

function photo() {
  const p = makePhoto();
  Object.assign(p.blob, { id: p.id });
  return p;
}

describe('photoProcessor', () => {
  it('processes one photo at a time, decoding each exactly once, into ready thumbnails + metrics', async () => {
    const { proc, deps, closes, flush } = setup();
    const [a, b] = [photo(), photo()];
    proc.enqueue([a, b]);
    expect(proc.get(a.id)?.status).toBe('queued');
    await flush();
    expect(deps.decode).toHaveBeenCalledTimes(2);
    expect(closes).toEqual([a.id, b.id]);
    expect(proc.get(a.id)).toMatchObject({ status: 'ready', thumbnailUrl: expect.stringMatching(/^blob:/) });
    expect(proc.get(a.id)?.metrics).toMatchObject({
      brightnessPct: 50,
      sharpness: 400,
      width: 4000,
      height: 3000,
    });
  });

  it('never runs two jobs concurrently', async () => {
    let active = 0;
    let maxActive = 0;
    const { proc, flush } = setup({
      decode: async () => {
        active++;
        maxActive = Math.max(maxActive, active);
        await new Promise((r) => setTimeout(r, 1));
        active--;
        return { source: {} as CanvasImageSource, width: 10, height: 10, close: () => {} };
      },
    });
    proc.enqueue([photo(), photo(), photo()]);
    await flush();
    await new Promise((r) => setTimeout(r, 20));
    await flush();
    expect(maxActive).toBe(1);
  });

  it('runs the prioritized photo first, then capture order', async () => {
    const { proc, order, flush } = setup();
    const [a, b, c] = [photo(), photo(), photo()];
    proc.enqueue([a, b, c]);
    proc.prioritize(c.id);
    await flush();
    expect(order).toEqual([c.id, a.id, b.id]);
  });

  it('starts no new job while paused', async () => {
    const { proc, deps, flush } = setup();
    proc.pause();
    proc.enqueue([photo()]);
    await flush();
    expect(deps.decode).not.toHaveBeenCalled();
    proc.resume();
    await flush();
    expect(deps.decode).toHaveBeenCalledTimes(1);
  });

  it('closes the decoded source even when analysis throws, and reports an error', async () => {
    const { proc, closes, flush } = setup({
      analyze: () => {
        throw new Error('boom');
      },
    });
    const a = photo();
    proc.enqueue([a]);
    await flush();
    expect(closes).toEqual([a.id]);
    expect(proc.get(a.id)).toMatchObject({ status: 'error', thumbnailUrl: null });
  });

  it('reports a decode failure as an error with no thumbnail', async () => {
    const { proc, flush } = setup({
      decode: async () => {
        throw new Error('bad');
      },
    });
    const a = photo();
    proc.enqueue([a]);
    await flush();
    expect(proc.get(a.id)).toMatchObject({ status: 'error', thumbnailUrl: null, metrics: null });
  });

  it('release revokes the thumbnail and discards a running job result (no leak)', async () => {
    let finishDecode!: () => void;
    const { proc, flush, tasks } = setup({
      decode: () =>
        new Promise((resolve) => {
          finishDecode = () =>
            resolve({ source: {} as CanvasImageSource, width: 10, height: 10, close: () => {} });
        }),
    });
    const [a, b] = [photo(), photo()];
    proc.enqueue([a, b]);
    tasks.shift()?.(); // start a
    proc.release(a.id);
    finishDecode(); // a's job completes after release: its thumbnail must be revoked, not stored
    await flush();
    expect(proc.get(a.id)).toBeUndefined();
    const created = vi.mocked(URL.createObjectURL).mock.results.map((r) => r.value as string);
    const revoked = vi.mocked(URL.revokeObjectURL).mock.calls.map((c) => c[0]);
    expect(created).toHaveLength(1);
    expect(revoked).toContain(created[0]);
    finishDecode(); // now b
    await flush();
    expect(proc.get(b.id)?.status).toBe('ready');
  });

  it('releaseAll revokes every thumbnail and notifies subscribers', async () => {
    const { proc, flush } = setup();
    const listener = vi.fn();
    proc.subscribe(listener);
    const [a, b] = [photo(), photo()];
    proc.enqueue([a, b]);
    await flush();
    const urls = [proc.get(a.id)!.thumbnailUrl, proc.get(b.id)!.thumbnailUrl];
    proc.releaseAll();
    expect(proc.get(a.id)).toBeUndefined();
    for (const u of urls) expect(URL.revokeObjectURL).toHaveBeenCalledWith(u);
    expect(listener).toHaveBeenCalled();
  });

  it('enqueueing the same photo twice processes it once', async () => {
    const { proc, deps, flush } = setup();
    const a = photo();
    proc.enqueue([a]);
    proc.enqueue([a]);
    await flush();
    expect(deps.decode).toHaveBeenCalledTimes(1);
  });
});
