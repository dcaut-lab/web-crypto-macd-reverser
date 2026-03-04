import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateMACD, reverseMACD } from '../src/utils/indicators';

test('calculateMACD rejects non-positive periods', () => {
  assert.throws(
    () => calculateMACD([100, 101, 102], { fast: 0, slow: 26, signal: 9 }),
    /period/i
  );
});

test('reverseMACD rejects fast equals slow', () => {
  assert.throws(
    () => reverseMACD(1, 100, 99, 0.5, { fast: 12, slow: 12, signal: 9 }),
    /fast.*slow/i
  );
});

test('reverseMACD rejects signal period of 1', () => {
  assert.throws(
    () => reverseMACD(1, 100, 99, 0.5, { fast: 12, slow: 26, signal: 1 }),
    /signal/i
  );
});

test('reverseMACD round-trip reproduces target histogram', () => {
  const config = { fast: 12, slow: 26, signal: 9 };
  const prices = [100, 101, 102, 100, 103, 104, 102, 105, 106, 107, 105, 108, 109, 110, 108, 111, 112];

  const prev = calculateMACD(prices.slice(0, -1), config).at(-1);
  assert.ok(prev);

  const targetHist = 1.2345;
  const impliedClose = reverseMACD(targetHist, prev.emaFast, prev.emaSlow, prev.dea, config);
  const hist = calculateMACD([...prices.slice(0, -1), impliedClose], config).at(-1)?.hist;

  assert.ok(typeof hist === 'number');
  assert.ok(Math.abs((hist as number) - targetHist) < 1e-9);
});
