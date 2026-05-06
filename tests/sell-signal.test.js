const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const { MIN_BB_WIDTH_PCT } = require('../src/signals/filters');
const { evaluateSellSignal } = require('../src/signals/sell');

function previousBandLevel(overrides = {}) {
  return {
    lowerPrev: 100,
    upperPrev: 110,
    bbWidthPrev: MIN_BB_WIDTH_PCT,
    ...overrides
  };
}

describe('SELL signal upper previous band', () => {
  it('returns SELL true when current high touches upper previous band', () => {
    assert.deepEqual(evaluateSellSignal({
      currentCandle: { high: 110.1 },
      previousBandLevel: previousBandLevel()
    }), {
      shouldSell: true,
      reasons: ['Touched upper previous band']
    });
  });

  it('returns SELL false when current high does not touch upper previous band', () => {
    assert.deepEqual(evaluateSellSignal({
      currentCandle: { high: 109.9 },
      previousBandLevel: previousBandLevel()
    }), {
      shouldSell: false,
      reasons: ['High did not touch upper previous band']
    });
  });

  it('returns SELL false when an active position exists', () => {
    const result = evaluateSellSignal({
      currentCandle: { high: 110.1 },
      previousBandLevel: previousBandLevel(),
      hasActivePosition: true
    });

    assert.equal(result.shouldSell, false);
    assert.deepEqual(result.reasons, ['Active position exists']);
  });

  it('returns SELL false when BB width is below minimum', () => {
    const result = evaluateSellSignal({
      currentCandle: { high: 110.1 },
      previousBandLevel: previousBandLevel({ bbWidthPrev: 0.59 })
    });

    assert.equal(result.shouldSell, false);
    assert.deepEqual(result.reasons, ['BB width below minimum']);
  });

  it('returns SELL false when anti-band-walk blocks trending market', () => {
    const result = evaluateSellSignal({
      adx15m: 36,
      currentCandle: { high: 110.1 },
      previousBandLevel: previousBandLevel({ bbWidthPrev: 2.6 })
    });

    assert.equal(result.shouldSell, false);
    assert.deepEqual(result.reasons, ['Anti-band-walk blocked trending market']);
  });

  it('returns SELL true when wide BB has non-trending ADX', () => {
    const result = evaluateSellSignal({
      adx15m: 34,
      currentCandle: { high: 110.1 },
      previousBandLevel: previousBandLevel({ bbWidthPrev: 2.6 })
    });

    assert.equal(result.shouldSell, true);
  });

  it('returns SELL false when upper previous band is missing', () => {
    const result = evaluateSellSignal({
      currentCandle: { high: 110.1 },
      previousBandLevel: null
    });

    assert.equal(result.shouldSell, false);
    assert.deepEqual(result.reasons, [
      'Missing upper previous band',
      'BB width unavailable'
    ]);
  });
});
