// UNIT FIXTURES test lifecycle/error handling. Phase 11B reference logits below are genuine saved CPU outputs.
// These tests do not claim Android execution, camera access, or native model inference.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const modules = new Map();
function load(filename) {
  filename = path.resolve(__dirname, '../src', filename);
  if (filename.endsWith('.json')) return JSON.parse(fs.readFileSync(filename, 'utf8'));
  if (!filename.endsWith('.ts')) filename += '.ts';
  if (modules.has(filename)) return modules.get(filename).exports;
  const module = { exports: {} };
  modules.set(filename, module);
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  new Function('require', 'module', 'exports', output)((specifier) => specifier.startsWith('.')
    ? load(path.resolve(path.dirname(filename), specifier)) : require(specifier), module, module.exports);
  return module.exports;
}
const { OnDeviceInferenceService } = load('services/OnDeviceInferenceService');
const { resultFromLogits } = load('services/offlineResult');
const { isClassificationResult } = load('services/pestResult');
const { AnalysisError } = load('services/analysisErrors');
const timing = { initializationMs: 0, preprocessingMs: 0, inferenceMs: 0, totalMs: 0 };
const image = { uri: 'file:///unit-fixture.jpg' };
const request = () => ({ signal: new AbortController().signal });
const tensor = () => new Float32Array(3 * 224 * 224).fill(0.5);
function fixtureRuntime() {
  const calls = { initializes: 0, runs: 0, releases: 0 };
  const session = { run: async () => { calls.runs++; return new Float32Array([0, 1, 2, 3]); }, release: async () => { calls.releases++; } };
  return { calls, session, runtime: { initialize: async () => { calls.initializes++; return session; }, preprocess: async () => tensor() } };
}

test('stable softmax maps exactly four on-device categories, handles ties and rejects invalid logits', () => {
  for (let best = 0; best < 4; best++) {
    const logits = new Float32Array(4).fill(-1000); logits[best] = 1000;
    const result = resultFromLogits(logits, timing);
    assert.equal(result.source, 'on-device');
    assert.equal(isClassificationResult(result), true);
    assert.equal(Object.keys(result.inference.probabilities)[best], ['healthy_rice', 'rice_leaffolder', 'rice_stem_borer', 'unknown'][best]);
    assert.equal(result.kind, ['healthy', 'known-pest', 'known-pest', 'unknown'][best]);
    if (best === 3) assert.equal(result.detectionMethod, 'trained_class');
  }
  assert.equal(resultFromLogits(new Float32Array([1, 1, 1, 1]), timing).kind, 'healthy');
  for (const bad of [[1, 2, 3], [NaN, 0, 0, 0], [Infinity, 0, 0, 0]]) assert.throws(() => resultFromLogits(new Float32Array(bad), timing));
});

const referencePath = path.resolve(__dirname, '../../model/onnx/validation-samples.jsonl');
test('JS postprocessing preserves all available genuine Phase 11B reference outputs', { skip: !fs.existsSync(referencePath) }, () => {
  const rows = fs.readFileSync(referencePath, 'utf8').trim().split('\n').map(JSON.parse);
  let maximumDifference = 0;
  for (const row of rows) {
    const result = resultFromLogits(new Float32Array(row.onnx_logits), timing);
    const entries = Object.entries(result.inference.probabilities);
    let index = 0;
    entries.forEach(([, score], i) => { if (score > entries[index][1]) index = i; });
    assert.equal(index, row.onnx_index, row.image);
    entries.forEach(([, score], i) => {
      const difference = Math.abs(score - row.onnx_probabilities[i]);
      maximumDifference = Math.max(maximumDifference, difference);
      assert.ok(difference <= 1e-6, row.image);
    });
  }
  console.log(`Genuine CPU-reference postprocessing: ${rows.length} images, max probability difference ${maximumDifference}`);
});

test('repeated analyses reuse one session, release it, and initialize again when needed', async () => {
  const f = fixtureRuntime(); const client = new OnDeviceInferenceService(f.runtime);
  await client.analyze(image, request()); await client.analyze(image, request());
  assert.deepEqual(f.calls, { initializes: 1, runs: 2, releases: 0 });
  await client.dispose(); await client.analyze(image, request()); await client.dispose();
  assert.deepEqual(f.calls, { initializes: 2, runs: 3, releases: 2 });
});

test('canceling a native job discards results and does not permit overlapping runs', async () => {
  const f = fixtureRuntime(); let finish; let entered;
  const running = new Promise((resolve) => { entered = resolve; });
  f.session.run = () => { entered(); return new Promise((resolve) => { finish = resolve; }); };
  const client = new OnDeviceInferenceService(f.runtime); const controller = new AbortController();
  const pending = client.analyze(image, { signal: controller.signal });
  await running; controller.abort();
  await assert.rejects(client.analyze(image, request()), (error) => error.code === 'busy');
  await client.dispose(); finish(new Float32Array([0, 1, 2, 3]));
  await assert.rejects(pending, (error) => error.name === 'AbortError');
  assert.equal(f.calls.releases, 1);
});

test('pre-cancellation, malformed tensors, model errors and preprocessing errors never produce predictions', async () => {
  const f = fixtureRuntime(); const client = new OnDeviceInferenceService(f.runtime);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(client.analyze(image, { signal: controller.signal }), (error) => error.name === 'AbortError');
  assert.equal(f.calls.initializes, 0);
  f.runtime.preprocess = async () => new Float32Array([1]);
  await assert.rejects(client.analyze(image, request()), (error) => error.code === 'preprocessing');
  f.runtime.preprocess = async () => { throw new Error('private decoder detail'); };
  await assert.rejects(client.analyze(image, request()), (error) => !error.message.includes('private'));
  assert.equal(f.calls.runs, 0);
  const unavailable = new OnDeviceInferenceService({ initialize: async () => { throw new AnalysisError('native_unavailable', 'Native development build required'); }, preprocess: async () => tensor() });
  await assert.rejects(unavailable.analyze(image, request()), (error) => error.code === 'native_unavailable');
  await client.dispose();
});

test('offline inference does not fetch even when networking is unavailable', async () => {
  const previous = global.fetch; global.fetch = () => { throw new Error('Network prohibited in unit test'); };
  try { const f = fixtureRuntime(); const c = new OnDeviceInferenceService(f.runtime); await c.analyze(image, request()); await c.dispose(); }
  finally { global.fetch = previous; }
  const selector = fs.readFileSync(path.resolve(__dirname, '../src/services/inference.ts'), 'utf8');
  assert.equal(selector.includes('apiConfiguration'), false);
  assert.equal(selector.includes('createPestPrintClient'), false);
});

test('model packaging checksum and repository-root EAS rules include only the intended binary', () => {
  const crypto = require('node:crypto');
  const ignore = require('ignore');
  const manifest = require('../assets/models/model-manifest.json');
  const model = fs.readFileSync(path.resolve(__dirname, '../assets/models', manifest.filename));
  assert.equal(model.length, manifest.bytes);
  assert.equal(crypto.createHash('sha256').update(model).digest('hex'), manifest.sha256);
  const rules = ignore().add(fs.readFileSync(path.resolve(__dirname, '../../.easignore'), 'utf8'));
  assert.equal(rules.ignores(`mobile/assets/models/${manifest.filename}`), false);
  for (const file of ['dataset/testing/healthy/photo.jpg', '.artifacts/test', 'model/onnx/model.onnx', 'mobile/.env.local', 'mobile/.signing/release.properties', 'mobile/.signing/pestprint-release.p12', 'mobile/node_modules/a/index.js', 'mobile/android/app/build/app.apk']) {
    assert.equal(rules.ignores(file), true, file);
  }
  assert.equal(rules.ignores('mobile/modules/pestprint-image-tensor/expo-module.config.json'), false);
});
