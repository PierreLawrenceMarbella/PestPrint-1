// Unit request fixtures and server-rendered UI with native views mocked.
// This verifies state/rendering contracts, not Android animation performance or AI accuracy.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

function nativeView({ children, testID, accessibilityLabel, accessibilityRole, accessibilityState, source }) {
  return React.createElement('div', {
    'data-testid': testID,
    'data-image-uri': source?.uri,
    role: accessibilityRole,
    'aria-label': accessibilityLabel,
    'aria-busy': accessibilityState?.busy,
  }, children);
}
const native = {
  View: nativeView, Text: nativeView, Image: nativeView, Pressable: nativeView, ScrollView: nativeView,
  StyleSheet: { create: (styles) => styles, absoluteFill: {}, hairlineWidth: 1 },
  useWindowDimensions: () => ({ width: 360, height: 640, fontScale: 1 }),
  AppState: { currentState: 'active' },
};
const animation = {
  __esModule: true,
  default: { View: nativeView, createAnimatedComponent: () => nativeView },
  useSharedValue: (value) => React.useRef({ value }).current,
  useAnimatedStyle: (style) => style(),
  Easing: { linear: (value) => value, out: (value) => value, cubic: (value) => value },
  ReduceMotion: { System: 'system' },
};
const modules = new Map();
function load(filename) {
  filename = path.resolve(__dirname, '../src', filename);
  if (!path.extname(filename)) {
    filename = [filename + '.ts', filename + '.tsx', path.join(filename, 'index.ts')].find(fs.existsSync);
  }
  if (modules.has(filename)) return modules.get(filename).exports;
  const module = { exports: {} };
  modules.set(filename, module);
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  new Function('require', 'module', 'exports', output)((specifier) => {
    if (specifier === 'react-native') return native;
    if (specifier === 'react-native-reanimated') return animation;
    if (specifier === '@expo/vector-icons') return { Ionicons: () => null };
    if (specifier === 'react-native-safe-area-context') return { SafeAreaView: nativeView };
    if (specifier === 'expo-router') return { useIsFocused: () => true };
    return specifier.startsWith('.') ? load(path.resolve(path.dirname(filename), specifier)) : require(specifier);
  }, module, module.exports);
  return module.exports;
}
const { ProcessingScreen } = load('screens/ProcessingScreen');
const { createAnalysisController } = load('services/analysisController');
const { AnalysisError } = load('services/analysisErrors');
const image = { uri: 'file:///processing-unit-fixture.jpg', fileName: 'processing-unit-fixture.jpg', width: 800, height: 600 };
function render(state) {
  return renderToStaticMarkup(React.createElement(ProcessingScreen, {
    image, state, onBack() {}, onCancel() {}, onRetry() {},
  }));
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

test('pending UI retains the original image, labels indeterminate processing and offers cancellation', () => {
  const markup = render({ status: 'analyzing' });
  assert.match(markup, /Analyzing Rice Crop Image\.\.\./);
  assert.match(markup, /data-image-uri="file:\/\/\/processing-unit-fixture\.jpg"/);
  assert.match(markup, /data-testid="processing-scan-sweep"/);
  assert.match(markup, /role="progressbar"[^>]*aria-busy="true"/);
  assert.match(markup, /Cancel Analysis/);
  assert.doesNotMatch(markup, /aria-valuenow|\d+%|Try Again/);
});

test('error, cancellation, success and idle render without an active scanner or busy indicator', () => {
  for (const state of [
    { status: 'idle' }, { status: 'canceled' }, { status: 'success', result: { unitFixture: true } },
    { status: 'error', code: 'request_failed', message: 'Unit fixture analysis failed.' },
  ]) {
    const markup = render(state);
    assert.match(markup, /processing-crop-image/);
    assert.doesNotMatch(markup, /processing-scan-sweep|processing-indicator|Cancel Analysis|aria-busy="true"/);
    if (state.status === 'error' || state.status === 'canceled') assert.match(markup, /Try Again/);
    if (state.status === 'error') assert.match(markup, /Unit fixture analysis failed\./);
  }
});

test('a pending real request drives the scanner, blocks duplicate starts, and preserves the returned result', async () => {
  const request = deferred();
  let calls = 0;
  const controller = createAnalysisController({ analyze() { calls++; return request.promise; } });
  const pending = controller.start(image);
  await controller.start(image);
  assert.equal(calls, 1);
  assert.match(render(controller.getSnapshot()), /processing-scan-sweep/);
  const result = Object.freeze({ unitFixture: true, exactValue: 0.123456789 });
  request.resolve(result);
  await pending;
  assert.equal(controller.getSnapshot().result, result);
  assert.doesNotMatch(render(controller.getSnapshot()), /processing-scan-sweep/);
});

test('failure stops scanning and exposes the existing safe retry state', async () => {
  const request = deferred();
  const controller = createAnalysisController({ analyze: () => request.promise });
  const pending = controller.start(image);
  request.reject(new AnalysisError('preprocessing', 'Choose a valid rice crop image.'));
  await pending;
  assert.equal(controller.getSnapshot().status, 'error');
  const markup = render(controller.getSnapshot());
  assert.match(markup, /Choose a valid rice crop image\./);
  assert.match(markup, /Try Again/);
  assert.doesNotMatch(markup, /processing-scan-sweep/);
});

test('cancellation immediately stops scanning and discards late results, including after retry', async () => {
  const first = deferred(), second = deferred();
  const signals = [];
  const controller = createAnalysisController({ analyze(_image, { signal }) {
    signals.push(signal);
    return signals.length === 1 ? first.promise : second.promise;
  } });
  const pending = controller.start(image);
  controller.cancel();
  assert.equal(signals[0].aborted, true);
  assert.equal(controller.getSnapshot().status, 'canceled');
  assert.doesNotMatch(render(controller.getSnapshot()), /processing-scan-sweep/);
  const retry = controller.start(image);
  first.resolve({ staleUnitFixture: true });
  await pending;
  assert.equal(controller.getSnapshot().status, 'analyzing');
  second.resolve({ currentUnitFixture: true });
  await retry;
  assert.deepEqual(controller.getSnapshot(), { status: 'success', result: { currentUnitFixture: true } });
});

test('instant inference publishes success on the next microtask without waiting for an animation or timer', async () => {
  const result = { fastUnitFixture: true };
  const controller = createAnalysisController({ analyze: () => Promise.resolve(result) });
  const states = [];
  controller.subscribe(() => states.push(controller.getSnapshot().status));
  const pending = controller.start(image);
  assert.equal(controller.getSnapshot().status, 'analyzing');
  await Promise.resolve();
  assert.equal(controller.getSnapshot().status, 'success');
  assert.equal(controller.getSnapshot().result, result);
  assert.deepEqual(states, ['analyzing', 'success']);
  await pending;
});
