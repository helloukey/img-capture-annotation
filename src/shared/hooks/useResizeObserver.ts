import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Observes an element's rendered box. Returns a callback ref and the latest client rect.
 * Used to derive the display scale of the annotation canvas (Constitution IV).
 */
export function useResizeObserver<T extends Element>(
  onResize?: () => void,
): { ref: (node: T | null) => void; rect: DOMRectReadOnly | null; node: T | null } {
  const [node, setNode] = useState<T | null>(null);
  const onResizeRef = useRef(onResize);
  useEffect(() => {
    onResizeRef.current = onResize;
  });
  const [rect, setRect] = useState<DOMRectReadOnly | null>(null);
  const frame = useRef<number | null>(null);

  const ref = useCallback((el: T | null) => {
    setNode(el);
    if (el) setRect(el.getBoundingClientRect());
  }, []);

  useEffect(() => {
    if (!node) return;
    const measure = () => {
      onResizeRef.current?.();
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(() => {
        frame.current = null;
        setRect(node.getBoundingClientRect());
      });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    window.addEventListener('orientationchange', measure);
    window.visualViewport?.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('orientationchange', measure);
      window.visualViewport?.removeEventListener('resize', measure);
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [node]);

  return { ref, rect, node };
}
