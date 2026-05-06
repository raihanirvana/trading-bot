const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const { createSignalIdempotencyRegistry } = require('../src/signals/idempotency');
const { evaluateSignalCandidate } = require('../src/signals/evaluator');

function baseInput(overrides = {}) {
  return {
    adx15m: 24,
    currentCandle: {
      high: 105,
      low: 99.9
    },
    dailyState: {
      dayKey: '2026-05-04',
      tradesToday: 0,
      dailyPnl: 0
    },
    hasActivePosition: false,
    leverage: 100,
    marginUsd: 25,
    previousBandLevel: {
      lowerPrev: 100,
      upperPrev: 110,
      bbWidthPrev: 1.2
    },
    symbol: 'ETHUSDT',
    timeframe: '15m',
    timestamp: '2026-05-04T12:00:00.000Z',
    ...overrides
  };
}

describe('signal evaluator', () => {
  it('emits a BUY signal through the integrated path', () => {
    const result = evaluateSignalCandidate(baseInput());

    assert.equal(result.reason, 'Signal emitted');
    assert.equal(result.signal.side, 'BUY');
    assert.equal(result.signal.entry_price, 100);
  });

  it('applies anti-band-walk before emitting BUY signal', () => {
    const result = evaluateSignalCandidate(baseInput({
      adx15m: 36,
      previousBandLevel: {
        lowerPrev: 100,
        upperPrev: 110,
        bbWidthPrev: 2.6
      }
    }));

    assert.equal(result.signal, null);
    assert.equal(result.reason, 'No signal triggered');
    assert.deepEqual(result.buyDecision.reasons, ['Anti-band-walk blocked trending market']);
  });

  it('applies daily target hard stop before signal emission', () => {
    const result = evaluateSignalCandidate(baseInput({
      dailyState: {
        dayKey: '2026-05-04',
        tradesToday: 3,
        dailyPnl: 6
      }
    }));

    assert.equal(result.signal, null);
    assert.equal(result.reason, 'Daily target hit');
    assert.equal(result.dailyDecision.dailyTargetHit, true);
  });

  it('applies daily loss hard stop before signal emission', () => {
    const result = evaluateSignalCandidate(baseInput({
      dailyState: {
        dayKey: '2026-05-04',
        tradesToday: 1,
        dailyPnl: -18
      }
    }));

    assert.equal(result.signal, null);
    assert.equal(result.reason, 'Daily loss stop hit');
    assert.equal(result.dailyDecision.dailyLossHit, true);
  });

  it('dedupes duplicate signals through idempotency registry', () => {
    const registry = createSignalIdempotencyRegistry();
    const first = evaluateSignalCandidate(baseInput({
      idempotencyRegistry: registry
    }));
    const second = evaluateSignalCandidate(baseInput({
      idempotencyRegistry: registry
    }));

    assert.equal(first.signal.signal_id, 'ETHUSDT-15m-20260504T120000Z-BUY');
    assert.equal(second.signal, null);
    assert.equal(second.reason, 'Duplicate signal');
    assert.equal(second.duplicate, true);
  });

  it('emits a SELL signal through the integrated path', () => {
    const result = evaluateSignalCandidate(baseInput({
      currentCandle: {
        high: 110.1,
        low: 101
      }
    }));

    assert.equal(result.reason, 'Signal emitted');
    assert.equal(result.signal.side, 'SELL');
    assert.equal(result.signal.entry_price, 110);
  });
});
