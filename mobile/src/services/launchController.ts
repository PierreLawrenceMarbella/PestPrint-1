export const launchTiming = {
  logo: 540,
  wordmarkDelay: 220,
  wordmark: 480,
  subtitleDelay: 400,
  subtitle: 600,
  exit: 260,
  preparationLimit: 500,
  watchdog: 3000,
} as const;

type Cancel = () => void;
type Schedule = (callback: () => void, delay: number) => Cancel;
type LaunchEffects = {
  hideNative: () => void | Promise<unknown>;
  animate: (done: () => void) => Cancel;
  onComplete: () => void;
};

const scheduleTimeout: Schedule = (callback, delay) => {
  const timer = setTimeout(callback, delay);
  return () => clearTimeout(timer);
};

/** One launch per mounted root; optional asset/accessibility work cannot trap navigation. */
export function createLaunchController(effects: LaunchEffects, schedule: Schedule = scheduleTimeout) {
  let disposed = false;
  let complete = false;
  let started = false;
  let laidOut = false;
  let assetReady = false;
  let preferenceReady = false;
  let reducedMotion = true;
  let stopAnimation: Cancel | undefined;
  let cancelPreparation: Cancel | undefined;
  const cancelWatchdog = schedule(finish, launchTiming.watchdog);

  function hideNative() {
    try { void Promise.resolve(effects.hideNative()).catch(() => {}); }
    catch { /* A missing or failed native controller must not block Home. */ }
  }

  function finish() {
    if (disposed || complete) return;
    complete = true;
    cancelWatchdog();
    cancelPreparation?.();
    stopAnimation?.();
    hideNative();
    effects.onComplete();
  }

  function startIfReady() {
    if (disposed || complete || started || !laidOut || !assetReady || !preferenceReady) return;
    started = true;
    cancelPreparation?.();
    if (reducedMotion) { finish(); return; }
    hideNative();
    try {
      const stop = effects.animate(finish);
      if (complete) stop();
      else stopAnimation = stop;
    } catch { finish(); }
  }

  return {
    layoutReady() {
      if (disposed || complete || laidOut) return;
      laidOut = true;
      cancelPreparation = schedule(() => {
        // An unreadable asset or unavailable accessibility API skips optional motion.
        assetReady = preferenceReady = reducedMotion = true;
        startIfReady();
      }, launchTiming.preparationLimit);
      startIfReady();
    },
    assetReady() { assetReady = true; startIfReady(); },
    preferenceReady(reduced: boolean) {
      preferenceReady = true;
      reducedMotion = reduced;
      if (started && reduced) finish();
      else startIfReady();
    },
    skip: finish,
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelWatchdog();
      cancelPreparation?.();
      stopAnimation?.();
      if (!complete) hideNative();
    },
  };
}
