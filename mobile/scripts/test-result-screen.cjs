// Actual result components with native views/animation bindings mocked. These are
// UI interaction/lifecycle checks, not physical touch, Android rendering or inference tests.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const flatten = (style) => Object.assign({}, ...[style].flat(Infinity).filter(Boolean).map((part) => part.__style ? part.__style() : part));

function harness(reduced = true) {
  const modules = new Map(), nodes = new Map(), cleanups = [], rootState = [], timings = [];
  let cursor = 0, props, fraction, motion, canceled = 0, listeners = 0, modal;
  const rootReact = { ...React, useState(initial) {
    const index = cursor++;
    if (!(index in rootState)) rootState[index] = initial;
    return [rootState[index], (value) => { rootState[index] = value; }];
  } };
  const effectReact = { ...React, useEffect(effect) { const cleanup = effect(); if (cleanup) cleanups.push(cleanup); } };
  function nativeView(viewProps) {
    if (viewProps.testID) nodes.set(viewProps.testID, viewProps);
    if (viewProps.accessibilityLabel === 'Go back') nodes.set('header-back-button', viewProps);
    return React.createElement('div', { 'data-testid': viewProps.testID }, viewProps.animatedProps?.text ?? viewProps.defaultValue ?? viewProps.children);
  }
  const native = {
    View: nativeView, Text: nativeView, Image: nativeView, TextInput: nativeView, ScrollView: nativeView, Pressable: nativeView,
    StyleSheet: { create: (styles) => styles, absoluteFill: { position: 'absolute' }, hairlineWidth: 1 },
    AppState: { currentState: 'active' },
    Modal(modalProps) { modal = modalProps; return modalProps.visible ? nativeView(modalProps) : null; },
    AccessibilityInfo: {
      isReduceMotionEnabled: () => Promise.resolve(reduced),
      addEventListener() { listeners++; return { remove() { listeners--; } }; },
    },
  };
  const interpolate = (value, [start, end], [from, to]) => from + Math.max(0, Math.min(1, (value - start) / (end - start))) * (to - from);
  const animation = {
    __esModule: true, default: { View: nativeView, createAnimatedComponent: () => nativeView },
    Extrapolation: { CLAMP: 'clamp' }, interpolate,
    Easing: { cubic: (value) => value ** 3, out: (easing) => (value) => 1 - easing(1 - value) },
    ReduceMotion: { System: 'system' }, useReducedMotion: () => reduced,
    useSharedValue: (initial) => React.useRef({ value: fraction ?? initial }).current,
    useAnimatedStyle: (callback) => ({ __style: callback }),
    useAnimatedProps: (callback) => callback(),
    withTiming(target, config) { timings.push(config); return target; },
    cancelAnimation() { canceled++; },
  };
  function load(filename) {
    filename = path.resolve(__dirname, '../src', filename);
    if (!path.extname(filename)) filename = [filename + '.ts', filename + '.tsx', path.join(filename, 'index.ts')].find(fs.existsSync);
    if (filename.endsWith('.json')) return JSON.parse(fs.readFileSync(filename, 'utf8'));
    if (modules.has(filename)) return modules.get(filename).exports;
    const module = { exports: {} }; modules.set(filename, module);
    const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText;
    new Function('require', 'module', 'exports', output)((specifier) => {
      if (specifier === 'react') {
        if (filename.endsWith('ResultScreen.tsx')) return rootReact;
        if (filename.endsWith('AppButton.tsx') || filename.endsWith('ResultEducationModal.tsx')) return effectReact;
        return React;
      }
      if (specifier === 'react-native') return native;
      if (specifier === 'react-native-reanimated') return animation;
      if (specifier === 'react-native-safe-area-context') return { SafeAreaView: nativeView };
      if (specifier === 'expo-router') return { useIsFocused: () => true };
      if (specifier === '@expo/vector-icons') return { Ionicons: () => null };
      return specifier.startsWith('.') ? load(path.resolve(path.dirname(filename), specifier)) : require(specifier);
    }, module, module.exports);
    return module.exports;
  }
  const { ResultScreen } = load('screens/ResultScreen');
  const { useResultScreenMotion } = load('hooks/useResultScreenMotion');
  function Probe({ kind }) { motion = useResultScreenMotion(kind); return null; }
  return {
    load,
    node: (id) => nodes.get(id),
    render(nextProps = props) {
      props = nextProps; cursor = 0; nodes.clear();
      return renderToStaticMarkup(React.createElement(ResultScreen, props));
    },
    frame(kind, progress) {
      fraction = progress;
      renderToStaticMarkup(React.createElement(Probe, { kind }));
      fraction = undefined;
      return Object.fromEntries(Object.entries(motion).filter(([, value]) => typeof value === 'object').map(([key, value]) => [key, flatten(value)]));
    },
    cleanup() { while (cleanups.length) cleanups.pop()(); },
    get modal() { return modal; }, get canceled() { return canceled; },
    get listeners() { return listeners; }, get timings() { return timings; },
  };
}
const image = { uri: 'file:///result-unit-fixture.jpg', fileName: 'result-unit-fixture.jpg', width: 800, height: 600 };
function fixture(h, index) {
  // Explicit UNIT fixture logits; never presented as a new real model prediction.
  const logits = new Float32Array([-2, -3, -4, -5]); logits[index] = 8;
  const result = h.load('services/offlineResult').resultFromLogits(logits, {
    initializationMs: 0, preprocessingMs: 0, inferenceMs: 0, totalMs: 0,
  });
  assert.equal(h.load('services/pestResult').isClassificationResult(result), true);
  return result;
}

test('all four result screens preserve scores, images, educational content and expected themed decorations', () => {
  for (let index = 0; index < 4; index++) {
    const h = harness(); const result = fixture(h, index); const original = structuredClone(result);
    const html = h.render({ image, result, onBack() {}, onAnalyzeAnother() {} });
    assert.equal(h.node('result-crop-image').source.uri, image.uri);
    assert.equal(h.node('result-confidence').accessibilityValue.now, result.kind === 'unknown' ? result.score.value : result.confidencePercent);
    assert.ok(h.node('result-characteristics-reveal'));
    assert.equal(h.node('result-prediction-reveal').needsOffscreenAlphaCompositing, true);
    assert.equal(h.node('result-characteristics-reveal').needsOffscreenAlphaCompositing, true);
    assert.ok(h.node('analyze-another-image-button'));
    assert.equal(!!h.node('learn-more-pest-button'), result.kind !== 'healthy');
    assert.equal(!!h.node('result-pest-highlight'), result.kind === 'known-pest');
    assert.equal(!!h.node('result-classification-icon'), result.kind !== 'known-pest');
    assert.deepEqual(result, original);
    assert.doesNotMatch(html, /Brown Planthopper/);
    h.cleanup(); assert.equal(h.listeners, 0);
  }
});

test('entrances stay subtle and bounded, overlap in sequence, and finish with the original geometry', () => {
  const h = harness(false);
  for (const kind of ['known-pest', 'healthy', 'unknown']) {
    const initial = h.frame(kind, 0);
    assert.equal(initial.image.opacity, 0);
    assert.equal(initial.prediction.transform[0].translateY, 6);
    assert.ok(initial.icon.transform[0].scale >= 0.94);
    assert.equal(initial.actions.opacity, 0.92);
    const overlap = h.frame(kind, 0.25);
    assert.ok(overlap.image.opacity > overlap.prediction.opacity);
    assert.ok(overlap.prediction.opacity > overlap.characteristics.opacity);
    for (const fraction of [0, 0.2, 0.5, 0.8, 1]) {
      const current = h.frame(kind, fraction);
      for (const style of Object.values(current)) assert.ok(style.opacity >= 0 && style.opacity <= 1);
      assert.ok(current.icon.transform[0].scale <= 1);
    }
    const final = h.frame(kind, 1);
    for (const key of ['image', 'prediction', 'icon', 'characteristics', 'actions']) assert.equal(final[key].opacity, 1);
    assert.equal(final.prediction.transform[0].translateY, 0);
    assert.equal(final.characteristics.transform[0].translateY, 0);
    assert.equal(final.icon.transform[0].scale, 1);
    assert.equal(final.highlight.opacity, 0);
  }
});

test('Analyze Another Image dispatches immediately during entrance and repeated analysis uses the next image/result', async () => {
  const h = harness(false);
  const { createAnalysisController } = h.load('services/analysisController');
  let next = 0, resets = 0;
  const controller = createAnalysisController({ analyze: async () => fixture(h, next++) });
  for (let index = 0; index < 4; index++) {
    const currentImage = { ...image, uri: `file:///repeat-unit-fixture-${index}.jpg` };
    await controller.start(currentImage);
    h.render({ image: currentImage, result: controller.getSnapshot().result,
      onBack() {}, onAnalyzeAnother() { resets++; controller.reset(); } });
    assert.equal(h.node('result-crop-image').source.uri, currentImage.uri);
    assert.equal(flatten(h.node('result-actions-reveal').style).opacity, 0.92);
    const button = h.node('analyze-another-image-button');
    assert.ok(!button.disabled);
    button.onPress();
    assert.equal(resets, index + 1);
    assert.equal(controller.getSnapshot().status, 'idle');
    h.cleanup();
  }
});

test('Learn More, modal back and Android request-close preserve the result and image for each applicable class', () => {
  for (const index of [1, 2, 3]) {
    const h = harness(); const result = fixture(h, index);
    h.render({ image, result, onBack() {}, onAnalyzeAnother() {} });
    h.node('learn-more-pest-button').onPress(); h.render();
    assert.equal(h.modal.visible, true);
    assert.equal(h.modal.animationType, 'none');
    assert.ok(h.node('pest-education-screen'));
    h.node('close-pest-education-button').onPress(); h.render();
    assert.equal(h.modal.visible, false);
    h.node('learn-more-pest-button').onPress(); h.render();
    h.modal.onRequestClose(); h.render();
    assert.equal(h.modal.visible, false);
    assert.equal(h.node('result-crop-image').source.uri, image.uri);
    assert.equal(flatten(h.node('result-prediction-reveal').style).opacity, 1);
    h.cleanup();
  }
  const h = harness(false);
  h.render({ image, result: fixture(h, 1), onBack() {}, onAnalyzeAnother() {} });
  h.node('learn-more-pest-button').onPress(); h.render();
  assert.equal(h.modal.animationType, 'fade'); h.cleanup();
});

test('result press feedback moves the existing refresh icon subtly and cleans up on blur/unmount', () => {
  const h = harness();
  h.render({ image, result: fixture(h, 2), onBack() {}, onAnalyzeAnother() {} });
  const button = h.node('analyze-another-image-button');
  const icon = h.node('analyze-another-image-button-icon-feedback');
  assert.equal(flatten(icon.style).transform[0].rotate, '0deg');
  button.onPressIn();
  assert.equal(flatten(icon.style).transform[0].rotate, '8deg');
  assert.equal(flatten(button.style).transform[0].translateY, 0.75);
  assert.equal(flatten(button.style).opacity, 0.95);
  assert.equal(h.timings.at(-1).reduceMotion, 'system');
  button.onPressOut();
  assert.equal(flatten(icon.style).transform[0].rotate, '0deg');
  button.onPressIn(); button.onBlur();
  assert.equal(flatten(icon.style).transform[0].rotate, '0deg');
  const canceled = h.canceled; h.cleanup();
  assert.ok(h.canceled > canceled);
  assert.equal(h.listeners, 0);
});

test('ordinary AppButton usage retains its existing feedback and unwrapped icon', () => {
  const h = harness(); const { AppButton } = h.load('components/AppButton');
  renderToStaticMarkup(React.createElement(AppButton, {
    label: 'Ordinary button', testID: 'ordinary-button', leadingIcon: 'refresh-outline', onPress() {},
  }));
  const button = h.node('ordinary-button');
  assert.equal(h.node('ordinary-button-icon-feedback'), undefined);
  button.onPressIn();
  assert.equal(flatten(button.style).transform[0].translateY, 1);
  assert.ok(Math.abs(flatten(button.style).opacity - 0.93) < 1e-12);
  h.cleanup();
});

test('unavailable images keep actions functional and return/back callbacks never wait on entrances', () => {
  const h = harness(false); let backs = 0, repeats = 0;
  h.render({ image, result: fixture(h, 3), onBack() { backs++; }, onAnalyzeAnother() { repeats++; } });
  h.node('result-crop-image').onError();
  const html = h.render();
  assert.match(html, /This image is no longer available/);
  h.node('analyze-another-image-button').onPress(); assert.equal(repeats, 1);
  h.node('header-back-button').onPress(); assert.equal(backs, 1);
  assert.ok(h.node('unknown-result-screen'));
  h.cleanup();
});
