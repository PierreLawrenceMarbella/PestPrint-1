import { useEffect, type CSSProperties } from "react";

/** Keep an exposed entrance visible after focus leaves or its control disables. */
export function useMotionFocus() {
  useEffect(() => {
    const expose = (event: FocusEvent) => {
      let element: Element | null = event.target instanceof Element ? event.target : null;
      while (element) {
        if (element.matches(".motion-fade-in, .motion-fade-up, .motion-scale"))
          element.classList.add("motion-entered");
        element = element.parentElement;
      }
    };
    document.addEventListener("focusin", expose);
    return () => document.removeEventListener("focusin", expose);
  }, []);
}

/** Zero-based position for a direct child of .motion-stagger. CSS caps the delay. */
export function staggerStyle(index: number): CSSProperties {
  return {
    "--motion-index": Number.isFinite(index) ? Math.max(0, Math.floor(index)) : 0,
  } as CSSProperties;
}
