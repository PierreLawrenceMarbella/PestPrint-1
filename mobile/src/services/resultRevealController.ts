export const resultRevealTiming = { duration: 800, stagger: 50 } as const;

type RevealEnvironment = {
  visible: boolean;
  focused: boolean;
  foreground: boolean;
  reduced: boolean | null;
};

/** One reveal per mounted score. Navigation and accessibility always settle it. */
export function createResultRevealController(effects: {
  animate: () => void;
  finish: () => void;
  cancel: () => void;
}) {
  let started = false;
  let settled = false;
  let disposed = false;
  function finish() {
    if (settled) return;
    settled = true;
    effects.finish();
  }
  return {
    update({ visible, focused, foreground, reduced }: RevealEnvironment) {
      if (disposed) return;
      if (!started) {
        if (!visible) return;
        if (reduced === null && focused && foreground) return;
        started = true;
        if (!focused || !foreground || reduced) finish();
        else effects.animate();
      } else if (!visible || !focused || !foreground || reduced) finish();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      effects.cancel();
    },
  };
}
