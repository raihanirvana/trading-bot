const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const {
  DEFAULT_ATR_LENGTH,
  calculateAtr,
  calculateAtrPct,
  calculateAtrSeries,
  calculateTrueRanges
} = require('../src/indicators/atr');

function candle(high, low, close) {
  return { high, low, close };
}

function constantRangeCandles(count) {
  return Array.from({ length: count }, (_, index) => {
    const close = 100 + index;

    return candle(close + 1, close - 1, close);
  });
}

describe('ATR indicator', () => {
  it('calculates known true range samples', () => {
    assert.deepEqual(calculateTrueRanges([
      candle(10, 8, 9),
      candle(12, 9, 11),
      candle(13, 10, 12)
    ]), [
      3,
      3
    ]);
  });

  it('returns null until enough candles exist', () => {
    assert.deepEqual(calculateAtrSeries(constantRangeCandles(3), { length: 5 }), [
      null,
      null,
      null
    ]);
    assert.equal(calculateAtr(constantRangeCandles(3), { length: 5 }), null);
  });

  it('calculates ATR14 for a constant true range sample', () => {
    const atr = calculateAtr(constantRangeCandles(DEFAULT_ATR_LENGTH + 1));

    assert.equal(atr, 2);
  });

  it('output length is the same as input length', () => {
    const candles = constantRangeCandles(DEFAULT_ATR_LENGTH + 3);

    assert.equal(calculateAtrSeries(candles).length, candles.length);
  });

  it('calculates ATR pct formula', () => {
    assert.equal(calculateAtrPct({
      atr: 2,
      close: 100
    }), 2);
  });

  it('returns null ATR pct when close is zero', () => {
    assert.equal(calculateAtrPct({
      atr: 2,
      close: 0
    }), null);
  });

  it('is NaN safe', () => {
    const candles = constantRangeCandles(DEFAULT_ATR_LENGTH + 1);
    candles[3] = candle(Number.NaN, 100, 100);

    assert.equal(calculateAtr(candles), null);
  });
});
