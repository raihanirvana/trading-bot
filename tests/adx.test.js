const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const {
  DEFAULT_ADX_LENGTH,
  calculateAdx,
  calculateAdxSeries,
  calculateDirectionalMovement,
  calculateTrueRange
} = require('../src/indicators/adx');

function candle(high, low, close) {
  return { high, low, close };
}

function flatCandles(count, price = 100) {
  return Array.from({ length: count }, () => candle(price, price, price));
}

function trendCandles(count) {
  return Array.from({ length: count }, (_, index) => {
    const base = 100 + index;

    return candle(base + 2, base, base + 1);
  });
}

describe('ADX indicator', () => {
  it('returns null when there are not enough candles and does not crash', () => {
    assert.equal(calculateAdx(flatCandles(10)), null);
  });

  it('returns null for invalid candle values instead of NaN', () => {
    const candles = flatCandles((DEFAULT_ADX_LENGTH * 2) + 1);
    candles[5] = candle(Number.NaN, 100, 100);

    assert.equal(calculateAdx(candles), null);
  });

  it('calculates true range', () => {
    assert.equal(
      calculateTrueRange(candle(110, 95, 100), candle(105, 99, 102)),
      15
    );
  });

  it('calculates directional movement', () => {
    assert.deepEqual(
      calculateDirectionalMovement(candle(110, 100, 105), candle(105, 99, 102)),
      {
        plusDm: 5,
        minusDm: 0
      }
    );
  });

  it('flat market has low ADX', () => {
    assert.equal(calculateAdx(flatCandles((DEFAULT_ADX_LENGTH * 2) + 1)), 0);
  });

  it('trend sample returns a valid ADX without crashing', () => {
    const adx = calculateAdx(trendCandles((DEFAULT_ADX_LENGTH * 2) + 1));

    assert.equal(Number.isFinite(adx), true);
    assert.equal(adx > 0, true);
    assert.equal(adx <= 100, true);
  });

  it('calculates an ADX series with nulls until enough candles exist', () => {
    const series = calculateAdxSeries(trendCandles((DEFAULT_ADX_LENGTH * 2) + 1));

    assert.equal(series[0], null);
    assert.equal(series.at(-1) > 0, true);
  });
});
