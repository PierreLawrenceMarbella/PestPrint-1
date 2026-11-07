// Protocol and transport UNIT TEST FIXTURES only. No predictions are generated here.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const modules = new Map();
class ExpoFileFixture {
  constructor(uri) {
    this.uri = uri;
    this.name = uri.split('/').pop();
    this.type = 'image/jpeg';
  }
  async bytes() { return new Uint8Array([0xff, 0xd8, 0xff]); }
}
function load(relativePath) {
  const filename = path.resolve(__dirname, '../src', relativePath);
  if (modules.has(filename)) return modules.get(filename).exports;
  const module = { exports: {} };
  modules.set(filename, module);
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function('require', 'module', 'exports', output)((specifier) => {
    if (specifier.startsWith('.')) return load(path.relative(path.resolve(__dirname, '../src'), path.resolve(path.dirname(filename), `${specifier}.ts`)));
    if (specifier === 'expo-file-system') return { File: ExpoFileFixture };
    return require(specifier);
  }, module, module.exports);
  return module.exports;
}

const { createPestPrintClient } = load('services/apiClient.ts');
const { parseApiConfiguration } = load('services/apiConfiguration.ts');
const { parseModelHealth, parsePrediction, mapPrediction } = load('services/apiResponse.ts');
const { createAnalysisController } = load('services/analysisController.ts');
const { AnalysisError } = load('services/analysisErrors.ts');
const classes = ['healthy_rice', 'rice_leaffolder', 'rice_stem_borer', 'unknown'];
const health = { available: true, classes, message: 'Unit test model status' };
const image = { uri: 'file:///unit-test.jpg', fileName: 'unit-test.jpg', mimeType: 'image/jpeg', size: 100, width: 20, height: 20 };
const config = parseApiConfiguration('http://192.168.1.100:5000/');
const options = () => ({ signal: new AbortController().signal });
function prediction(id) {
  return { prediction: id, confidence: 0.7, probabilities: Object.fromEntries(classes.map((key) => [key, key === id ? 0.7 : 0.1])), model: 'Unit test fixture', unknown_method: 'trained_class' };
}
const json = (data, status = 200) => new Response(JSON.stringify(data), { status });
class NativeFormDataFixture {
  parts = [];
  append(name, value) { this.parts.push([name, value]); }
}
async function transport(fetch, run) {
  const originalFetch = global.fetch;
  const originalFormData = global.FormData;
  global.fetch = fetch;
  global.FormData = NativeFormDataFixture;
  try { await run(); }
  finally { global.fetch = originalFetch; global.FormData = originalFormData; }
}

test('phone API configuration rejects loopback, non-HTTP URLs and embedded credentials', () => {
  assert.equal(parseApiConfiguration(undefined).baseUrl, null);
  assert.equal(parseApiConfiguration('   ').error, null);
  for (const value of ['http://localhost:5000', 'http://127.0.0.1:5000', 'http://0.0.0.0:5000', 'http://[::1]:5000', 'file:///test', 'http://user:password@example.com', 'https://example.com?secret=test', 'not-a-url']) {
    assert.ok(parseApiConfiguration(value).error);
  }
  assert.equal(config.baseUrl, 'http://192.168.1.100:5000');
  assert.equal(parseApiConfiguration('http://10.0.2.2:5000').error, null);
  assert.equal(parseApiConfiguration('https://example.com/pestprint/').baseUrl, 'https://example.com/pestprint');
});

test('health status requires exactly the four real model outputs', () => {
  assert.deepEqual(parseModelHealth(health), health);
  for (const ids of [[], classes.slice(0, 3), [...classes, 'unsupported'], [...classes.slice(0, 3), classes[0]]]) {
    assert.throws(() => parseModelHealth({ ...health, classes: ids }), (e) => e.code === 'unsupported_model');
  }
  assert.throws(() => parseModelHealth({}), (e) => e.code === 'invalid_response');
});

test('all four real output IDs map explicitly, preserving actual confidence and original probabilities', () => {
  for (const id of classes) {
    const response = parsePrediction(prediction(id));
    const result = mapPrediction(response);
    assert.equal(result.source, 'backend');
    assert.equal(result.backend, response);
    assert.equal(Object.keys(result.backend.probabilities).length, 4);
    if (id === 'unknown') {
      assert.equal(result.kind, 'unknown');
      assert.equal(result.detectionMethod, 'trained_class');
      assert.equal(result.score.value, response.confidence * 100);
      assert.equal(result.score.scale, 'percent');
    } else {
      assert.equal(result.confidencePercent, response.confidence * 100);
      assert.equal(result.kind, id === 'healthy_rice' ? 'healthy' : 'known-pest');
      if (result.kind === 'known-pest') assert.equal(result.pest, id);
    }
  }
  const lowConfidence = { ...prediction('healthy_rice'), confidence: 0.26, probabilities: { healthy_rice: 0.26, rice_leaffolder: 0.25, rice_stem_borer: 0.25, unknown: 0.24 } };
  assert.equal(mapPrediction(parsePrediction(lowConfidence)).kind, 'healthy', 'no confidence cutoff may invent Unknown');
  assert.equal(mapPrediction(parsePrediction({ ...prediction('healthy_rice'), confidence: 1, probabilities: { healthy_rice: 1, rice_leaffolder: 0, rice_stem_borer: 0, unknown: 0 } })).confidencePercent, 100);
});

test('malformed, unsupported, inconsistent and separately detected Unknown responses fail explicitly', () => {
  const valid = prediction('healthy_rice');
  for (const bad of [null, {}, { ...valid, prediction: 'unsupported' }, { ...valid, confidence: null }, { ...valid, confidence: NaN }, { ...valid, confidence: 1.7 }, { ...valid, probabilities: { healthy_rice: 1 } }, { ...valid, probabilities: { ...valid.probabilities, extra: 0 } }, { ...valid, confidence: 0.5 }, { ...valid, unknown_method: 'separate_detection' }, { ...valid, probabilities: { ...valid.probabilities, unknown: -0.1 } }]) {
    assert.throws(() => parsePrediction(bad), (e) => e.code === 'invalid_response');
  }
});

test('Expo multipart upload uses a File with bytes(), never an unsupported legacy URI object', async () => {
  const calls = [];
  await transport(async (url, init) => {
    calls.push({ url, init });
    return json(calls.length === 1 ? health : prediction('rice_leaffolder'));
  }, async () => {
    const result = await createPestPrintClient(config).analyze(image, options());
    assert.equal(result.pest, 'rice_leaffolder');
  });
  assert.equal(calls[0].url, `${config.baseUrl}/api/health`);
  assert.equal(calls[1].url, `${config.baseUrl}/api/analyze`);
  assert.equal(calls[1].init.method, 'POST');
  assert.equal('Content-Type' in calls[1].init.headers, false);
  const [[field, file]] = calls[1].init.body.parts;
  assert.equal(field, 'image');
  assert.ok(file instanceof ExpoFileFixture);
  assert.equal(file.uri, image.uri);
  assert.equal(file.name, image.fileName);
  assert.equal(file.type, image.mimeType);
  assert.equal(typeof file.bytes, 'function', 'Expo fetch requires File/Blob bytes rather than a URI descriptor');
});

test('unavailable or mismatched models block image upload', async () => {
  for (const status of [{ ...health, available: false }, { ...health, classes: ['unsupported'] }]) {
    let count = 0;
    await transport(async () => { count++; return json(status); }, async () => {
      await assert.rejects(createPestPrintClient(config).analyze(image, options()), (e) => ['model_unavailable', 'unsupported_model'].includes(e.code));
    });
    assert.equal(count, 1);
  }
});

test('timeouts, connectivity failures, HTTP errors and unreadable responses have safe actionable messages', async () => {
  const failures = [
    [async () => { throw new TypeError('private socket details'); }, 'network'],
    [async () => json({ error: 'Image too large' }, 413), 'server'],
    [async () => json({ error: 'unavailable' }, 503), 'model_unavailable'],
    [async () => new Response('private traceback', { status: 500 }), 'server'],
    [async () => new Response('not JSON'), 'invalid_response'],
  ];
  for (const [fetch, code] of failures) {
    await transport(fetch, async () => {
      await assert.rejects(createPestPrintClient(config).getHealth(options()), (e) => {
        assert.equal(e.code, code);
        assert.doesNotMatch(e.message, /private/);
        return true;
      });
    });
  }
  await transport((_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new Error('native request aborted')), { once: true });
  }), async () => {
    await assert.rejects(createPestPrintClient(config, 15).getHealth(options()), (e) => e.code === 'timeout');
  });
});

test('controller pending state follows real requests, prevents duplicates and supports cancellation/retry', async () => {
  let release;
  let count = 0;
  const requests = [];
  await transport(async (url, { signal }) => {
    count++;
    if (url.endsWith('/api/health')) return json(health);
    requests.push(signal);
    return new Promise((resolve, reject) => {
      release = () => resolve(json(prediction('unknown')));
      signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
    });
  }, async () => {
    const controller = createAnalysisController(createPestPrintClient(config));
    const first = controller.start(image);
    assert.equal(controller.getSnapshot().status, 'analyzing');
    await new Promise((resolve) => setImmediate(resolve));
    await controller.start(image);
    assert.equal(count, 2);
    controller.cancel();
    await first;
    assert.equal(requests[0].aborted, true);
    assert.equal(controller.getSnapshot().status, 'canceled');
    const retry = controller.start(image);
    await new Promise((resolve) => setImmediate(resolve));
    release();
    await retry;
    assert.equal(controller.getSnapshot().status, 'success');
    assert.equal(controller.getSnapshot().result.kind, 'unknown');
    controller.reset();
    assert.equal(controller.getSnapshot().status, 'idle');
  });
});

test('controller preserves typed API failures, hides arbitrary errors and remains safe when unconfigured', async () => {
  const client = { analyze: async () => { throw new AnalysisError('timeout', 'The service took too long.'); } };
  const controller = createAnalysisController(client);
  await controller.start(image);
  assert.equal(controller.getSnapshot().code, 'timeout');
  assert.equal(controller.getSnapshot().message, 'The service took too long.');
  const arbitrary = createAnalysisController({ analyze: async () => { throw new Error('private internals'); } });
  await arbitrary.start(image);
  assert.doesNotMatch(arbitrary.getSnapshot().message, /private/);
  const unconfigured = createAnalysisController(null);
  await unconfigured.start(image);
  assert.equal(unconfigured.getSnapshot().code, 'unconfigured');
  await assert.rejects(createPestPrintClient(parseApiConfiguration('http://localhost:5000')).getHealth(options()), (e) => e.code === 'configuration');
});
