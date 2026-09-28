// Pull-to-refresh: pure helpers (tested) and a hook wiring touch events.

import { useEffect, useRef, useState, type RefObject } from "react";

/** Pull distance (px) at which releasing triggers a refresh. */
export const PULL_THRESHOLD = 70;
const PULL_MAX = 110;
const DAMPING = 0.5;

/** Damped indicator offset for a finger that moved `dy` px down. */
export function pullDistance(dy: number): number {
  return dy <= 0 ? 0 : Math.min(dy * DAMPING, PULL_MAX);
}

export function shouldRefresh(pull: number): boolean {
  return pull >= PULL_THRESHOLD;
}

/** Scroll offset of the nearest scrolling ancestor, crossing shadow roots (HA panel). */
function scrollTopOf(el: Element | null): number {
  let node: Node | null = el;
  while (node) {
    if (node instanceof Element) {
      const { overflowY } = getComputedStyle(node);
      if ((overflowY === "auto" || overflowY === "scroll") && node.scrollTop > 0) return node.scrollTop;
    }
    node = node.parentNode ?? (node instanceof ShadowRoot ? node.host : null);
  }
  return window.scrollY || document.scrollingElement?.scrollTop || 0;
}

/** Current pull offset (px) while the user drags down from the top of `ref`. */
export function usePullToRefresh(ref: RefObject<HTMLElement | null>, onRefresh: () => void, enabled = true): number {
  const [pull, setPull] = useState(0);
  const refreshRef = useRef(onRefresh);
  refreshRef.current = onRefresh;

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    let startY: number | null = null;
    let current = 0;

    const onStart = (e: TouchEvent) => {
      startY = e.touches.length === 1 && scrollTopOf(el) <= 0 ? e.touches[0].clientY : null;
    };
    const onMove = (e: TouchEvent) => {
      if (startY === null) return;
      current = pullDistance(e.touches[0].clientY - startY);
      if (current > 0 && e.cancelable) e.preventDefault(); // we own this gesture, not the page scroll
      setPull(current);
    };
    const onEnd = () => {
      if (startY !== null && shouldRefresh(current)) refreshRef.current();
      startY = null;
      current = 0;
      setPull(0);
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onEnd);
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, [ref, enabled]);

  return pull;
}
