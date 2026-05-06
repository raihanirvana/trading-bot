const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const {
  DEFAULT_EMA_PERIOD,
  calculateEma,
  calculateEmaSeries
} = require('../src/indicators/ema');

function round(value, precision = 10) {
  return Number(value.toFixed(precision));
}

describe('EMA indicator', () => {
  it('constant price EMA is constant after enough values', () => {
    const values = Array.from({ length: DEFAULT_EMA_PERIOD + 5 }, () => 100);
    const series = calculateEmaSeries(values);

    assert.equal(series[DEFAULT_EMA_PERIOD - 2], null);
    assert.equal(series[DEFAULT_EMA_PERIOD - 1], 100);
    assert.equal(round(series.at(-1)), 100);
  });

  it('output length is the same as input length', () => {
    const values = [100, 101, 102];

    assert.equal(calculateEmaSeries(values).length, values.length);
  });

  it('returns null until period has enough data', () => {
    assert.deepEqual(calculateEmaSeries([100, 101, 102], { period: 5 }), [
      null,
      null,
      null
    ]);
  });

  it('uses SMA as the first EMA seed then applies the EMA formula', () => {
    const series = calculateEmaSeries([1, 2, 3, 4], { period: 3 });

    assert.deepEqual(series.slice(0, 3), [
      null,
      null,
      2
    ]);
    assert.equal(round(series[3]), round((4 * 0.5) + (2 * 0.5)));
  });

  it('returns latest EMA value', () => {
    assert.equal(calculateEma([1, 2, 3, 4], { period: 3 }), 3);
  });

  it('is NaN safe', () => {
    assert.deepEqual(calculateEmaSeries([100, Number.NaN, 102], { period: 2 }), [
      null,
      null,
      null
    ]);
    assert.equal(calculateEma([100, Number.NaN, 102], { period: 2 }), null);
  });
});
