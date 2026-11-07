const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

// Test actual lifecycle decisions with a deterministic clock; no native-device claims.
const compiled = ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '../src/services/launchController.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const controllerModule = { exports: {} };
new Function('module', 'exports', compiled)(controllerModule, controllerModule.exports);
const { createLaunchController, launchTiming } = controllerModule.exports;

function clock() {
  let now = 0;
  let id = 0;
  const tasks = new Map();
  return {
    schedule(callback, delay) {
      const key = ++id;
      tasks.set(key, { callback, at: now + delay });
      return () => tasks.delete(key);
    },
    advance(duration) {
      const until = now + duration;
      while (true) {
        const next = [...tasks.entries()].filter(([, task]) => task.at <= until).sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        now = next[1].at;
        tasks.delete(next[0]);
        next[1].callback();
      }
      now = until;
    },
    get pending() { return tasks.size; },
  };
}

function setup(overrides = {}) {
  const timer = clock();
  const calls = { hides: 0, animations: 0, stops: 0, completions: 0 };
  let animationDone;
  const effects = {
    hideNative() { calls.hides++; },
    animate(done) { calls.animations++; animationDone = done; return () => calls.stops++; },
    onComplete() { calls.completions++; },
    ...overrides,
  };
  const controller = createLaunchController(effects, timer.schedule);
  return { timer, calls, controller, done: () => animationDone() };
}

function ready(controller, reduced = false) {
  controller.layoutReady();
  controller.assetReady();
  controller.preferenceReady(reduced);
}

test('native handoff waits for layout, the bundled image and the motion preference', () => {
  const f = setup();
  f.controller.assetReady();
  f.controller.preferenceReady(false);
  assert.equal(f.calls.hides, 0);
  assert.equal(f.calls.animations, 0);
  f.controller.layoutReady();
  assert.equal(f.calls.hides, 1);
  assert.equal(f.calls.animations, 1);
  assert.equal(f.calls.completions, 0);
  f.done();
  assert.equal(f.calls.completions, 1);
  assert.equal(f.timer.pending, 0);
});

test('the sequence is brief, runs once and duplicate readiness/completion cannot replay it', () => {
  const total = Math.max(launchTiming.logo, launchTiming.wordmarkDelay + launchTiming.wordmark,
    launchTiming.subtitleDelay + launchTiming.subtitle) + launchTiming.exit;
  assert.ok(total >= 1200 && total <= 2000);
  const f = setup();
  ready(f.controller);
  f.done();
  ready(f.controller);
  f.done();
  f.timer.advance(10000);
  assert.equal(f.calls.animations, 1);
  assert.equal(f.calls.completions, 1);
  assert.equal(f.timer.pending, 0);
});

test('reduced motion skips all delay and animation, including a change during launch', () => {
  const reduced = setup();
  ready(reduced.controller, true);
  assert.equal(reduced.calls.animations, 0);
  assert.equal(reduced.calls.completions, 1);
  assert.equal(reduced.timer.pending, 0);

  const changed = setup();
  ready(changed.controller);
  changed.controller.preferenceReady(true);
  assert.equal(changed.calls.stops, 1);
  assert.equal(changed.calls.completions, 1);
  changed.done();
  assert.equal(changed.calls.completions, 1);
});

test('unresolved asset/accessibility preparation skips the optional animation safely', () => {
  const f = setup();
  f.controller.layoutReady();
  f.timer.advance(launchTiming.preparationLimit - 1);
  assert.equal(f.calls.completions, 0);
  f.timer.advance(1);
  assert.equal(f.calls.animations, 0);
  assert.equal(f.calls.completions, 1);
  assert.equal(f.timer.pending, 0);
});

test('a stalled animation or missing layout cannot keep the launch surface indefinitely', () => {
  for (const start of [false, true]) {
    const f = setup();
    if (start) ready(f.controller);
    f.timer.advance(launchTiming.watchdog);
    assert.equal(f.calls.completions, 1);
    assert.equal(f.timer.pending, 0);
    if (start) assert.equal(f.calls.stops, 1);
  }
});

test('backgrounding or an image error releases Home immediately and cancels pending motion', () => {
  for (const start of [false, true]) {
    const f = setup();
    if (start) ready(f.controller);
    f.controller.skip();
    assert.equal(f.calls.completions, 1);
    assert.equal(f.timer.pending, 0);
    if (start) assert.equal(f.calls.stops, 1);
  }
});

test('native splash and animation failures release navigation without an unhandled rejection', async () => {
  for (const hideNative of [() => { throw new Error('Native module unavailable'); }, () => Promise.reject(new Error('Native hide failed'))]) {
    const f = setup({ hideNative, animate() { throw new Error('Animation failed'); } });
    ready(f.controller);
    await Promise.resolve();
    assert.equal(f.calls.completions, 1);
    assert.equal(f.timer.pending, 0);
  }
});

test('unmount cancels timers and native animations, and ignores late callbacks', () => {
  const f = setup();
  ready(f.controller);
  f.controller.dispose();
  f.done();
  f.controller.preferenceReady(true);
  f.controller.layoutReady();
  f.timer.advance(10000);
  assert.equal(f.calls.stops, 1);
  assert.equal(f.calls.completions, 0);
  assert.equal(f.timer.pending, 0);
});
