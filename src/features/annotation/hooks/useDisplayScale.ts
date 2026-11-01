import { useResizeObserver } from '@/shared/hooks/useResizeObserver';
import { displayScale, type Size } from '../lib/geometry';

/**
 * Measures the rendered annotation surface. `scale` (CSS px per image px) sizes handles, labels
 * and the minimum box; geometry itself never stores screen pixels (Constitution IV).
 */
export function useDisplayScale<T extends Element>(natural: Size, onLayoutChange?: () => void) {
  const { ref, rect, node } = useResizeObserver<T>(onLayoutChange);
  const scale = rect && rect.width > 0 ? displayScale(rect, natural) : 0;
  return { ref, rect, node, scale };
}
