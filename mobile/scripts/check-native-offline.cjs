// Real native development-build verification through Hermes CDP. No mock inference.
// Requires Node 24, running Metro, an installed dev build, and Phase 11B reference data.
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const WebSocket = require('ws'); // Already provided by the Expo/Metro development toolchain.
const manifest = require('../assets/models/model-manifest.json');
const root = path.resolve(__dirname, '../..');
const artifact = path.join(root, '.artifacts/phase11c-native');
fs.mkdirSync(artifact, { recursive: true });
const serial = process.env.ANDROID_SERIAL || 'emulator-5554';
const sdk = process.env.ANDROID_HOME || path.join(process.env.LOCALAPPDATA, 'Android/Sdk');
const adb = path.join(sdk, 'platform-tools/adb.exe');
const pkg = 'com.pestprint.mobile';
const runAdb = (args, options = {}) => cp.execFileSync(adb, ['-s', serial, ...args], { encoding: 'utf8', timeout: 30_000, stdio: ['ignore', 'pipe', 'pipe'], ...options });
const references = fs.readFileSync(path.join(root, 'model/onnx/validation-samples.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
const rows = process.argv.includes('--all') ? references
  : [0, 1, 2, 3].map((index) => references.find((row) => row.onnx_index === index && row.label_index === index));
assert.ok(rows.every(Boolean), 'Need actual reference images for all four result states.');

async function connect() {
  const targets = await (await fetch('http://127.0.0.1:8081/json/list')).json();
  const target = targets.find((entry) => entry.webSocketDebuggerUrl && (entry.appId === pkg || entry.description?.includes(pkg)))
    || targets.find((entry) => entry.webSocketDebuggerUrl && entry.title?.includes('Hermes'));
  if (!target) throw new Error('No PESTPRINT Hermes target. Open the installed native dev build through Metro first.');
  const socket = new WebSocket(target.webSocketDebuggerUrl, { origin: 'http://127.0.0.1:8081' });
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let next = 1;
  const pending = new Map();
  socket.onmessage = (event) => {
    const message = JSON.parse(String(event.data));
    if (!message.id || !pending.has(message.id)) return;
    const { resolve, reject, timer } = pending.get(message.id); pending.delete(message.id); clearTimeout(timer);
    if (message.error) reject(new Error(JSON.stringify(message.error))); else resolve(message.result);
  };
  async function command(method, params = {}) {
    const id = next++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 120_000);
      pending.set(id, { resolve, reject, timer }); socket.send(JSON.stringify({ id, method, params }));
    });
  }
  let evaluationId = 0;
  async function evaluate(expression) {
    // Hermes does not consistently implement CDP's awaitPromise flag. Resolve
    // actual native promises in the app and poll only the diagnostic result.
    const key = `__pestprintCdpResult${evaluationId++}`;
    const response = await command('Runtime.evaluate', {
      expression: `globalThis[${JSON.stringify(key)}] = { done: false }; Promise.resolve().then(() => (0, eval)(${JSON.stringify(expression)})).then(value => { globalThis[${JSON.stringify(key)}] = { done: true, value }; }, e => { globalThis[${JSON.stringify(key)}] = { done: true, error: { name: e.name, message: e.message, code: e.code } }; }); true`,
      returnByValue: true,
    });
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description || JSON.stringify(response.exceptionDetails));
    const deadline = Date.now() + 120_000;
    while (Date.now() < deadline) {
      const state = (await command('Runtime.evaluate', { expression: `globalThis[${JSON.stringify(key)}]`, returnByValue: true })).result.value;
      if (state?.done) {
        await command('Runtime.evaluate', { expression: `delete globalThis[${JSON.stringify(key)}]` });
        if (state.error) throw Object.assign(new Error(state.error.message), { code: state.error.code });
        return state.value;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error('Timed out waiting for actual native operation');
  }
  await command('Runtime.enable');
  assert.equal(await evaluate('typeof globalThis.__pestprintOfflineDiagnostics?.analyzeUri'), 'function', 'Open the app and wait for its development diagnostics to register.');
  return { evaluate, close: () => socket.close() };
}

async function main() {
  fs.writeFileSync(path.join(artifact, 'report.json'), JSON.stringify({ status: 'IN_PROGRESS', requested_images: rows.length }, null, 2));
  const cdp = await connect();
  const results = [];
  const states = { wifi: runAdb(['shell', 'settings', 'get', 'global', 'wifi_on']).trim(),
    airplane: runAdb(['shell', 'settings', 'get', 'global', 'airplane_mode_on']).trim(),
    mobileData: runAdb(['shell', 'settings', 'get', 'global', 'mobile_data']).trim() };
  let networkGuardInstalled = false;
  const deviceInfo = { serial, abi: runAdb(['shell', 'getprop', 'ro.product.cpu.abi']).trim(),
    api: runAdb(['shell', 'getprop', 'ro.build.version.sdk']).trim() };
  const memoryBefore = runAdb(['shell', 'dumpsys', 'meminfo', pkg]);
  try {
    runAdb(['shell', 'run-as', pkg, 'mkdir', '-p', 'files/phase11c-fixtures']);
    runAdb(['shell', 'svc', 'wifi', 'disable']); runAdb(['shell', 'svc', 'data', 'disable']);
    runAdb(['shell', 'cmd', 'connectivity', 'airplane-mode', 'enable']);
    await cdp.evaluate(`globalThis.__pestprintPreviousFetch = globalThis.fetch; globalThis.__pestprintNetworkAttempts = 0; globalThis.fetch = () => { globalThis.__pestprintNetworkAttempts++; throw new Error('Network prohibited during native offline verification'); }; true`);
    networkGuardInstalled = true;
    if (process.argv.includes('--cold')) {
      await cdp.evaluate('globalThis.__pestprintOfflineDiagnostics.releaseModel()');
      // Only this emulator app's verified model CACHE is reset; original assets stay intact.
      assert.match(manifest.sha256, /^[a-f0-9]{64}$/);
      runAdb(['shell', 'run-as', pkg, 'rm', '-f', `files/pestprint-models/${manifest.sha256}.onnx`]);
    }
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]; const file = `files/phase11c-fixtures/${i}.jpg`;
      // adb push uses the binary sync protocol. Windows adb stdin can truncate
      // binary data at CTRL-Z; never pipe JPEG bytes through a shell/tee.
      const sourceBytes = fs.readFileSync(path.join(root, 'dataset', row.image));
      assert.equal(crypto.createHash('sha256').update(sourceBytes).digest('hex'), row.image_sha256,
        'The validation image must match the original Phase 11B reference.');
      const temporary = `/data/local/tmp/pestprint11c-${process.pid}-${i}.jpg`;
      runAdb(['push', path.join(root, 'dataset', row.image), temporary]);
      runAdb(['shell', 'run-as', pkg, 'cp', temporary, file]);
      runAdb(['shell', 'rm', temporary]);
      assert.equal(Number(runAdb(['shell', 'run-as', pkg, 'stat', '-c', '%s', file]).trim()), sourceBytes.length);
      assert.equal(runAdb(['shell', 'run-as', pkg, 'sha256sum', file]).trim().split(/\s+/)[0], crypto.createHash('sha256').update(sourceBytes).digest('hex'));
      const uri = `file:///data/user/0/${pkg}/${file}`;
      const tensor = await cdp.evaluate(`globalThis.__pestprintOfflineDiagnostics.prepareTensor(${JSON.stringify(uri)})`);
      const bytes = runAdb(['exec-out', 'run-as', pkg, 'cat', new URL(tensor.uri).pathname], { encoding: undefined, maxBuffer: 1024 * 1024 });
      assert.equal(bytes.length, 3 * 224 * 224 * 4);
      fs.writeFileSync(path.join(artifact, `${i}.f32`), bytes);
      await cdp.evaluate(`globalThis.__pestprintOfflineDiagnostics.deleteTensor(${JSON.stringify(tensor.uri)})`);
      const result = await cdp.evaluate(`globalThis.__pestprintOfflineDiagnostics.analyzeUri(${JSON.stringify(uri)})`);
      assert.equal(result.source, 'on-device'); assert.equal(result.inference.modelSha256, manifest.sha256);
      const scores = manifest.classes.map((id) => result.inference.probabilities[id]);
      assert.ok(scores.every(Number.isFinite)); assert.ok(Math.abs(scores.reduce((a, b) => a + b, 0) - 1) <= 1e-6);
      const index = scores.indexOf(Math.max(...scores));
      const item = {
        reference_image: row.image, reference_index: row.onnx_index, native_index: index,
        class_agreement: index === row.onnx_index, native: result, tensor,
        raw_max_abs_difference: Math.max(...result.inference.logits.map((v, j) => Math.abs(v - row.onnx_logits[j]))),
        probability_max_abs_difference: Math.max(...scores.map((v, j) => Math.abs(v - row.onnx_probabilities[j]))),
        tensor_file: `${i}.f32`,
      };
      results.push(item);
      runAdb(['shell', 'run-as', pkg, 'rm', file]);
      fs.writeFileSync(path.join(artifact, 'results.json'), JSON.stringify(results, null, 2));
      console.log(`${i + 1}/${rows.length} ${row.image}: ${manifest.classes[index]}, agreement=${item.class_agreement}`);
    }
    const invalidSource = path.join(artifact, 'invalid.jpg');
    fs.writeFileSync(invalidSource, 'invalid native image test fixture');
    const invalidTemporary = `/data/local/tmp/pestprint11c-${process.pid}-invalid.jpg`;
    runAdb(['push', invalidSource, invalidTemporary]);
    runAdb(['shell', 'run-as', pkg, 'cp', invalidTemporary, 'files/phase11c-fixtures/invalid.jpg']);
    runAdb(['shell', 'rm', invalidTemporary]);
    const invalid = await cdp.evaluate(`(async () => { try { await globalThis.__pestprintOfflineDiagnostics.analyzeUri('file:///data/user/0/${pkg}/files/phase11c-fixtures/invalid.jpg'); return { unexpectedSuccess: true }; } catch (e) { return { code: e.code, message: e.message }; } })()`);
    assert.equal(invalid.code, 'preprocessing');
    runAdb(['shell', 'run-as', pkg, 'rm', 'files/phase11c-fixtures/invalid.jpg']);
    const networkAttempts = await cdp.evaluate('globalThis.__pestprintNetworkAttempts');
    assert.equal(networkAttempts, 0);
    const report = {
      status: results.every((r) => r.class_agreement) ? 'FUNCTIONAL_SUCCESS' : 'CLASS_PARITY_FAILED',
      scope: 'Actual Android development build/native image helper/ONNX CPU inference, with Wi-Fi and mobile data disabled and fetch blocked. Not a standalone release test.',
      device: deviceInfo, images: results.length, class_agreements: results.filter((r) => r.class_agreement).length,
      model_cache_reset_before_test: process.argv.includes('--cold'),
      maximum_logit_difference: Math.max(...results.map((r) => r.raw_max_abs_difference)),
      maximum_probability_difference: Math.max(...results.map((r) => r.probability_max_abs_difference)),
      invalid_image: invalid, attempted_fetch_calls: networkAttempts,
      airplane_mode_during_test: runAdb(['shell', 'settings', 'get', 'global', 'airplane_mode_on']).trim(),
      memory_before: memoryBefore, memory_after: runAdb(['shell', 'dumpsys', 'meminfo', pkg]),
      results_file: 'results.json',
    };
    fs.writeFileSync(path.join(artifact, 'report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ ...report, memory_before: '[saved]', memory_after: '[saved]' }, null, 2));
    if (report.status !== 'FUNCTIONAL_SUCCESS') process.exitCode = 1;
  } finally {
    if (networkGuardInstalled) await cdp.evaluate('globalThis.fetch = globalThis.__pestprintPreviousFetch; delete globalThis.__pestprintPreviousFetch; true').catch(() => {});
    if (states.airplane === '0') runAdb(['shell', 'cmd', 'connectivity', 'airplane-mode', 'disable']);
    if (states.wifi === '1') runAdb(['shell', 'svc', 'wifi', 'enable']);
    if (states.mobileData === '1') runAdb(['shell', 'svc', 'data', 'enable']);
    cdp.close();
  }
}
main().catch((error) => {
  fs.writeFileSync(path.join(artifact, 'report.json'), JSON.stringify({ status: 'FAILED', error: error.message, requested_images: rows.length }, null, 2));
  console.error(error); process.exitCode = 1;
});
