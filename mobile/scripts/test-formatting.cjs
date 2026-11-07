const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

// Exercise the actual TypeScript helpers without loading the native UI/runtime.
function load(relative) {
  const filename = path.resolve(__dirname, '../src', `${relative}.ts`);
  const module = { exports: {} };
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function('require', 'module', 'exports', output)(
    (specifier) => load(path.join(path.dirname(relative), specifier)), module, module.exports,
  );
  return module.exports;
}

const { formatPercentage } = load('utils/formatPercentage');
const { formatConfidencePercent } = load('services/pestResult');

test('percent values match all requested examples with one decimal place', () => {
  for (const [value, expected] of [
    [99.38083291053772, '99.4%'],
    [0.3808397566899657, '0.4%'],
    [0.20096118096262217, '0.2%'],
    [0.037363875890150666, '<0.1%'],
    [1, '1.0%'], [100, '100.0%'],
  ]) assert.equal(formatPercentage(value, 'percent'), expected);
});

test('zero stays zero and positive values below 0.05% stay visibly nonzero', () => {
  for (const [value, expected] of [
    [0, '0.0%'], [Number.MIN_VALUE, '<0.1%'],
    [0.000001, '<0.1%'], [0.049999999, '<0.1%'],
    [0.05, '0.1%'], [0.050000001, '0.1%'],
  ]) assert.equal(formatPercentage(value, 'percent'), expected);
});

test('probabilities convert once and retain the same threshold and decimal rules', () => {
  for (const [value, expected] of [
    [0.9938083291053772, '99.4%'],
    [0.003808397566899657, '0.4%'],
    [0.0020096118096262217, '0.2%'],
    [0.00037363875890150666, '<0.1%'],
    [0, '0.0%'], [0.00049999999, '<0.1%'],
    [0.0005, '0.1%'], [0.5, '50.0%'], [1, '100.0%'],
  ]) assert.equal(formatPercentage(value, 'probability'), expected);
  assert.equal(formatPercentage(0.5, 'percent'), '0.5%');
});

test('shared confidence formatter covers all four result states without changing stored scores', () => {
  // UI contract fixtures only; these values are not model predictions.
  const results = [
    { kind: 'healthy', confidencePercent: 99.38083291053772 },
    { kind: 'known-pest', pest: 'rice_leaffolder', confidencePercent: 87.412345 },
    { kind: 'known-pest', pest: 'rice_stem_borer', confidencePercent: 89.234567 },
    { kind: 'unknown', score: { value: 74.98895525932312, scale: 'percent' } },
  ];
  const original = structuredClone(results);
  assert.deepEqual(results.map((result) => formatConfidencePercent(
    result.kind === 'unknown' ? result.score.value : result.confidencePercent,
  )), ['99.4%', '87.4%', '89.2%', '75.0%']);
  assert.deepEqual(results, original);
  assert.equal(formatConfidencePercent(0), '0.0%');
  assert.equal(formatConfidencePercent(0.037363875890150666), '<0.1%');
});

test('unavailable or invalid scores do not become fabricated percentages', () => {
  for (const value of [null, undefined, NaN, Infinity, -1, 101, '99']) {
    assert.equal(formatConfidencePercent(value), 'Confidence unavailable');
  }
  for (const value of [NaN, Infinity, -1, 101]) {
    assert.equal(formatPercentage(value, 'percent'), 'Percentage unavailable');
  }
  assert.equal(formatPercentage(1.01, 'probability'), 'Percentage unavailable');
});
