const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const { evaluateBuySignal } = require('../src/signals/buy');
const { MIN_BB_WIDTH_PCT } = require('../src/signals/filters');

function previousBandLevel(overrides = {}) {
  return {
    lowerPrev: 100,
    upperPrev: 110,
    bbWidthPrev: MIN_BB_WIDTH_PCT,
    ...overrides
  };
}

describe('BUY signal lower previous band', () => {
  it('returns BUY true when current low touches lower previous band', () => {
    assert.deepEqual(evaluateBuySignal({
      currentCandle: { low: 99.9 },
      previousBandLevel: previousBandLevel()
    }), {
      shouldBuy: true,
      reasons: ['Touched lower previous band']
    });
  });

  it('returns BUY false when current low does not touch lower previous band', () => {
    assert.deepEqual(evaluateBuySignal({
      currentCandle: { low: 100.1 },
      previousBandLevel: previousBandLevel()
    }), {
      shouldBuy: false,
      reasons: ['Low did not touch lower previous band']
    });
  });

  it('returns BUY false when an active position exists', () => {
    const result = evaluateBuySignal({
      currentCandle: { low: 99.9 },
      previousBandLevel: previousBandLevel(),
      hasActivePosition: true
    });

    assert.equal(result.shouldBuy, false);
    assert.deepEqual(result.reasons, ['Active position exists']);
  });

  it('returns BUY false when BB width is below minimum', () => {
    const result = evaluateBuySignal({
      currentCandle: { low: 99.9 },
      previousBandLevel: previousBandLevel({ bbWidthPrev: 0.59 })
    });

    assert.equal(result.shouldBuy, false);
    assert.deepEqual(result.reasons, ['BB width below minimum']);
  });

  it('returns BUY false when anti-band-walk blocks trending market', () => {
    const result = evaluateBuySignal({
      adx15m: 36,
      currentCandle: { low: 99.9 },
      previousBandLevel: previousBandLevel({ bbWidthPrev: 2.6 })
    });

    assert.equal(result.shouldBuy, false);
    assert.deepEqual(result.reasons, ['Anti-band-walk blocked trending market']);
  });

  it('returns BUY true when wide BB has non-trending ADX', () => {
    const result = evaluateBuySignal({
      adx15m: 34,
      currentCandle: { low: 99.9 },
      previousBandLevel: previousBandLevel({ bbWidthPrev: 2.6 })
    });

    assert.equal(result.shouldBuy, true);
  });

  it('returns BUY false when lower previous band is missing', () => {
    const result = evaluateBuySignal({
      currentCandle: { low: 99.9 },
      previousBandLevel: null
    });

    assert.equal(result.shouldBuy, false);
    assert.deepEqual(result.reasons, [
      'Missing lower previous band',
      'BB width unavailable'
    ]);
  });
});
