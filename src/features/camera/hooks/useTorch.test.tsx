import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FakeTrack } from '../../../../tests/fakes/fakeTrack';
import { useTorch } from './useTorch';

const asTrack = (t: FakeTrack) => t as unknown as MediaStreamTrack;

describe('useTorch', () => {
  it('is unsupported (and toggle is a no-op) without the torch capability', async () => {
    const track = new FakeTrack();
    const { result } = renderHook(() => useTorch(asTrack(track)));
    expect(result.current.supported).toBe(false);
    await act(() => result.current.toggle());
    expect(track.applyConstraints).not.toHaveBeenCalled();
    expect(result.current.on).toBe(false);
  });

  it('is unsupported with no track', () => {
    const { result } = renderHook(() => useTorch(null));
    expect(result.current).toMatchObject({ supported: false, on: false, pending: false });
  });

  it('toggles via applyConstraints and shows pending until the device confirms', async () => {
    let release!: () => void;
    const track = new FakeTrack({
      capabilities: { torch: true },
      applyConstraints: (c, t) =>
        new Promise<void>((resolve) => {
          release = () => {
            t.settings.torch = (c.advanced?.[0] as { torch: boolean }).torch;
            resolve();
          };
        }),
    });
    const { result } = renderHook(() => useTorch(asTrack(track)));
    expect(result.current.supported).toBe(true);
    let done!: Promise<void>;
    act(() => {
      done = result.current.toggle();
    });
    expect(result.current.pending).toBe(true);
    expect(result.current.on).toBe(false);
    expect(track.applyConstraints).toHaveBeenCalledWith({ advanced: [{ torch: true }] });
    await act(async () => {
      release();
      await done;
    });
    expect(result.current).toMatchObject({ pending: false, on: true });
  });

  it('reads the state back from the track rather than trusting the request', async () => {
    // The device "accepts" the request but the torch stays off.
    const track = new FakeTrack({ capabilities: { torch: true }, applyConstraints: async () => {} });
    const { result } = renderHook(() => useTorch(asTrack(track)));
    await act(() => result.current.toggle());
    expect(result.current.on).toBe(false);
  });

  it('keeps the last confirmed state and reports an error when the change fails', async () => {
    const track = new FakeTrack({
      capabilities: { torch: true },
      applyConstraints: async () => {
        throw new DOMException('nope', 'NotReadableError');
      },
    });
    const { result } = renderHook(() => useTorch(asTrack(track)));
    await act(() => result.current.toggle());
    expect(result.current.on).toBe(false);
    expect(result.current.error).toMatch(/couldn.t/i);
  });

  it('resets when the track changes or ends', async () => {
    const a = new FakeTrack({ capabilities: { torch: true } });
    const b = new FakeTrack();
    const { result, rerender } = renderHook(({ t }) => useTorch(asTrack(t)), { initialProps: { t: a } });
    await act(() => result.current.toggle());
    expect(result.current.on).toBe(true);
    rerender({ t: b });
    expect(result.current).toMatchObject({ supported: false, on: false });

    rerender({ t: a });
    await act(() => result.current.setTorch(true));
    expect(result.current.on).toBe(true);
    act(() => a.end());
    await waitFor(() => expect(result.current.on).toBe(false));
  });
});
