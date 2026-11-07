// Native animation bindings are mocked. These tests verify UI contracts and lifecycle,
// not Android graphics/frame rate. Synthetic logits below are explicitly UNIT fixtures.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

function loader(overrides) {
  const cache = new Map();
  function load(filename) {
    filename = path.resolve(__dirname, '../src', filename);
    if (!path.extname(filename)) filename = [filename + '.ts', filename + '.tsx', path.join(filename, 'index.ts')].find(fs.existsSync);
    if (filename.endsWith('.json')) return JSON.parse(fs.readFileSync(filename, 'utf8'));
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} };
    cache.set(filename, module);
    const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText;
    new Function('require', 'module', 'exports', output)((specifier) => {
      if (specifier in overrides) return overrides[specifier];
      return specifier.startsWith('.') ? load(path.resolve(path.dirname(filename), specifier)) : require(specifier);
    }, module, module.exports);
    return module.exports;
  }
  return load;
}
const flatten = (style) => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
function nativeView({ children, testID, style, accessibilityValue, accessibilityLabel, animatedProps, defaultValue }) {
  return React.createElement('div', {
    'data-testid': testID, 'data-width': flatten(style).width,
    'data-score': accessibilityValue?.now, 'aria-label': accessibilityLabel,
    'data-js-default': animatedProps?.defaultValue ?? defaultValue,
  }, animatedProps?.text ?? defaultValue ?? children);
}
let displayedProgress = 1;
const load = loader({
  'react-native': { View: nativeView, Text: nativeView, TextInput: nativeView, Pressable: nativeView,
    StyleSheet: { create: (styles) => styles }, AppState: { currentState: 'active' } },
  'react-native-reanimated': {
    __esModule: true, default: { View: nativeView, createAnimatedComponent: () => nativeView },
    useSharedValue: () => React.useRef({ value: displayedProgress }).current,
    useAnimatedStyle: (callback) => callback(), useAnimatedProps: (callback) => callback(),
    useReducedMotion: () => true,
  },
  'expo-router': { useIsFocused: () => true },
  '@expo/vector-icons': { Ionicons: () => null },
});
const { ConfidenceBar } = load('components/ConfidenceBar');
const { ResultPredictionCard } = load('components/ResultPredictionCard');
const { resultFromLogits } = load('services/offlineResult');
const { isClassificationResult } = load('services/pestResult');
const { formatPercentage } = load('utils/formatPercentage');
const { resultPalette } = load('theme/resultPalette');
const { resultRevealTiming } = load('services/resultRevealController');
const markup = (component, props) => renderToStaticMarkup(React.createElement(component, props));
const timings = { initializationMs: 0, preprocessingMs: 0, inferenceMs: 0, totalMs: 0 };

test('all four validated UI fixtures retain exact final scores, bar widths, formatting and themes', () => {
  displayedProgress = 1;
  const names = ['Healthy Rice', 'Rice Leaffolder', 'Stem Borer', 'Unknown (Other Damage)'];
  const accents = ['#056B27', '#C81D38', '#C81D38', '#9A6700'];
  for (let best = 0; best < 4; best++) {
    const logits = new Float32Array([1, -3, -5, -8]);
    logits[best] = 8;
    const fixture = resultFromLogits(logits, timings);
    assert.equal(isClassificationResult(fixture), true);
    const original = structuredClone(fixture);
    Object.freeze(fixture.inference.probabilities);
    Object.freeze(fixture);
    const html = markup(ResultPredictionCard, { result: fixture });
    const final = fixture.kind === 'unknown' ? fixture.score.value : fixture.confidencePercent;
    assert.ok(html.includes(names[best]));
    assert.ok(html.includes(`data-score="${final}"`));
    assert.ok(html.includes(`data-width="${final}%"`));
    assert.ok(html.includes(formatPercentage(final, 'percent')));
    for (const probability of Object.values(fixture.inference.probabilities)) {
      assert.ok(html.includes(`data-width="${probability * 100}%"`));
      assert.ok(html.includes(formatPercentage(probability, 'probability').replace('<', '&lt;')));
    }
    assert.equal(resultPalette[fixture.kind].accent, accents[best]);
    assert.deepEqual(fixture, original);
  }
});

test('native count-up text starts at zero, formats intermediate values, and settles exactly', () => {
  for (const value of [0, 0.037363875890150666, 99.38083291053772, 100]) {
    for (const fraction of [0, 0.25, 0.75, 1]) {
      displayedProgress = fraction;
      const html = markup(ConfidenceBar, { value });
      assert.ok(html.includes(formatPercentage(value * fraction, 'percent').replace('<', '&lt;')));
      assert.ok(html.includes(`data-width="${value * fraction}%"`));
      // Accessibility always receives the real final value, never an animated estimate.
      assert.ok(html.includes(`data-score="${value}"`));
    }
  }
  displayedProgress = 1;
});

test('counter text and React default stay synchronized during and after reveal/layout changes', () => {
  const confidence = 98.46722483634949;
  for (const progress of [0, 0.25, 0.75, 1]) {
    displayedProgress = progress;
    // Render twice to check both the initial binding and a subsequent React commit.
    for (let commit = 0; commit < 2; commit++) {
      const html = markup(ConfidenceBar, { value: confidence });
      const expected = formatPercentage(confidence * progress, 'percent').replace('<', '&lt;');
      assert.ok(html.includes(`data-js-default="${expected}"`));
      assert.ok(html.includes(`>${expected}</div>`));
    }
  }
  displayedProgress = 1;
});

test('unavailable and raw Unknown scores never acquire invented percentages or confidence fills', () => {
  for (const value of [null, undefined, NaN, -1, 101]) {
    const html = markup(ConfidenceBar, { value });
    assert.match(html, /Confidence unavailable/);
    assert.doesNotMatch(html, /result-confidence-number|result-confidence-fill/);
  }
  const raw = markup(ResultPredictionCard, { result: {
    kind: 'unknown', source: 'development-fixture', detectionMethod: 'unit-example',
    score: { scale: 'raw', value: 2.3456, label: 'Detection score' },
  } });
  assert.match(raw, /2\.3456/);
  assert.doesNotMatch(raw, /result-confidence-fill|%/);
});

// Minimal deterministic hook runner: effects/subscriptions and shared-value timing
// are executed; the native worklet scheduler itself is not emulated or measured.
function hookHarness(initiallyReduced = false, preferenceFails = false) {
  const slots = [];
  let cursor = 0, now = 0, focused = true, progress, animationCount = 0;
  const effects = [], listeners = new Map();
  const react = {
    useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; },
    useState(initial) {
      const i = cursor++;
      slots[i] ??= { value: initial };
      return [slots[i].value, (value) => { slots[i].value = value; }];
    },
    useEffect(effect, deps) {
      const i = cursor++, old = slots[i];
      if (!old || deps.some((value, j) => !Object.is(value, old.deps[j]))) {
        effects.push(() => { old?.cleanup?.(); slots[i] = { deps, cleanup: effect() }; });
      }
    },
  };
  function subscribe(event, callback) {
    listeners.set(event, callback);
    return { remove: () => listeners.delete(event) };
  }
  let pendingAnimation;
  const reanimated = {
    useReducedMotion: () => initiallyReduced,
    useSharedValue(value) {
      const ref = react.useRef(null);
      if (!ref.current) {
        let current = value;
        ref.current = {
          get value() { return current; },
          set value(next) {
            if (typeof next === 'object') { pendingAnimation = { ...next, at: now, from: current }; animationCount++; }
            else { current = next; pendingAnimation = null; }
          },
          step(value) { current = value; },
        };
      }
      progress = ref.current;
      return progress;
    },
    withTiming: (target, config) => ({ target, ...config }),
    withDelay: (delay, config) => ({ delay, ...config }),
    cancelAnimation: () => { pendingAnimation = null; },
    Easing: { cubic: (value) => value ** 3, out: (easing) => (value) => 1 - easing(1 - value) },
    ReduceMotion: { System: 'system' },
  };
  const native = {
    AppState: { currentState: 'active', addEventListener: subscribe },
    AccessibilityInfo: { addEventListener: subscribe,
      isReduceMotionEnabled: () => preferenceFails ? Promise.reject(new Error('Unit preference failure')) : Promise.resolve(initiallyReduced) },
  };
  const loadHook = loader({ react, 'react-native': native, 'react-native-reanimated': reanimated, 'expo-router': { useIsFocused: () => focused } });
  const { useResultReveal } = loadHook('hooks/useResultReveal');
  return {
    render(visible = true, delay = 0) { cursor = 0; const result = useResultReveal(visible, delay); while (effects.length) effects.shift()(); return result; },
    advance(ms) {
      now += ms;
      if (!pendingAnimation) return;
      const a = pendingAnimation;
      const fraction = Math.min(1, Math.max(0, (now - a.at - a.delay) / a.duration));
      progress.step(a.from + (a.target - a.from) * a.easing(fraction));
      if (fraction === 1) pendingAnimation = null;
    },
    focus(value) { focused = value; },
    event: (name, value) => listeners.get(name)?.(value),
    unmount() { slots.forEach((slot) => slot?.cleanup?.()); },
    get animationCount() { return animationCount; },
    get pending() { return !!pendingAnimation; },
    get listenerCount() { return listeners.size; },
  };
}

test('actual reveal hook completes in 800ms with bounded easing and 50ms row staggering', async () => {
  assert.ok(resultRevealTiming.duration >= 650 && resultRevealTiming.duration <= 900);
  for (let row = 0; row < 4; row++) {
    const h = hookHarness();
    const delay = row * resultRevealTiming.stagger;
    const { progress } = h.render(true, delay);
    await Promise.resolve(); h.render(true, delay);
    h.advance(delay);
    assert.equal(progress.value, 0);
    let previous = 0;
    for (let frame = 0; frame < 8; frame++) {
      h.advance(resultRevealTiming.duration / 8);
      assert.ok(progress.value >= previous && progress.value <= 1);
      previous = progress.value;
    }
    assert.equal(progress.value, 1);
    assert.equal(h.pending, false);
    assert.equal(h.animationCount, 1);
    h.unmount();
  }
});

test('navigation, backgrounding and closing details settle scores without replay on return', async () => {
  for (const action of ['navigation', 'background', 'collapse']) {
    const h = hookHarness();
    const { progress } = h.render();
    await Promise.resolve(); h.render(); h.advance(250);
    assert.ok(progress.value > 0 && progress.value < 1);
    if (action === 'navigation') h.focus(false);
    if (action === 'background') h.event('change', 'background');
    h.render(action !== 'collapse');
    assert.equal(progress.value, 1);
    assert.equal(h.pending, false);
    h.focus(true); h.event('change', 'active'); h.render(true);
    assert.equal(h.animationCount, 1);
    assert.equal(progress.value, 1);
    h.unmount();
  }
});

test('reduced motion and inaccessible preferences show final scores and never replay', async () => {
  for (const [initial, fails] of [[true, false], [false, true]]) {
    const h = hookHarness(initial, fails);
    const { progress } = h.render();
    await Promise.resolve(); await Promise.resolve(); h.render();
    assert.equal(progress.value, 1);
    assert.equal(h.animationCount, 0);
    h.unmount();
  }
  const h = hookHarness();
  const { progress } = h.render();
  await Promise.resolve(); h.render(); h.advance(200);
  h.event('reduceMotionChanged', true); h.render();
  assert.equal(progress.value, 1);
  h.event('reduceMotionChanged', false); h.render();
  assert.equal(h.animationCount, 1);
  h.unmount();
});

test('hidden probability rows wait until opened and unmount cancels delayed work/subscriptions', async () => {
  const h = hookHarness();
  h.render(false, 150);
  await Promise.resolve(); h.render(false, 150);
  assert.equal(h.animationCount, 0);
  h.render(true, 150);
  assert.equal(h.pending, true);
  h.unmount();
  assert.equal(h.pending, false);
  assert.equal(h.listenerCount, 0);
});
