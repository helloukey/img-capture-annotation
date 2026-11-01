import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseTorchResult {
  supported: boolean;
  /** Always read back from track.getSettings().torch, never the requested value. */
  on: boolean;
  pending: boolean;
  error: string | null;
  toggle(): Promise<void>;
  setTorch(on: boolean): Promise<void>;
}

interface TorchState {
  track: MediaStreamTrack | null;
  on: boolean;
  pending: boolean;
  error: string | null;
}

const idle = (track: MediaStreamTrack | null): TorchState => ({
  track,
  on: false,
  pending: false,
  error: null,
});

function hasTorch(track: MediaStreamTrack | null): boolean {
  if (!track || track.readyState !== 'live' || typeof track.getCapabilities !== 'function') return false;
  return 'torch' in track.getCapabilities();
}

function readTorch(track: MediaStreamTrack): boolean {
  return (track.getSettings() as MediaTrackSettings & { torch?: boolean }).torch === true;
}

/** Torch control with truthful state (research R5, contracts/camera.md). */
export function useTorch(track: MediaStreamTrack | null): UseTorchResult {
  const [state, setState] = useState<TorchState>(() => idle(track));
  const [ended, setEnded] = useState<MediaStreamTrack | null>(null);
  const trackRef = useRef(track);
  useEffect(() => {
    trackRef.current = track;
  });

  // State belongs to one track; a different (or ended) track starts from "off".
  const current = state.track === track && ended !== track ? state : idle(track);
  const supported = ended !== track && hasTorch(track);

  useEffect(() => {
    if (!track) return;
    const onEnded = () => setEnded(track);
    track.addEventListener('ended', onEnded);
    return () => track.removeEventListener('ended', onEnded);
  }, [track]);

  const setTorch = useCallback(async (next: boolean) => {
    const t = trackRef.current;
    if (!t || !hasTorch(t)) return;
    setState((s) => ({ ...(s.track === t ? s : idle(t)), pending: true, error: null }));
    try {
      await t.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] });
      if (trackRef.current !== t) return;
      setState({ track: t, on: readTorch(t), pending: false, error: null });
    } catch {
      if (trackRef.current !== t) return;
      setState((s) => ({
        ...(s.track === t ? s : idle(t)),
        pending: false,
        error: next ? 'Couldn’t turn on the flash' : 'Couldn’t turn off the flash',
      }));
    }
  }, []);

  const toggle = useCallback(async () => {
    if (!supported || current.pending) return;
    await setTorch(!current.on);
  }, [current.on, current.pending, setTorch, supported]);

  return {
    supported,
    on: supported && current.on,
    pending: current.pending,
    error: current.error,
    toggle,
    setTorch,
  };
}
