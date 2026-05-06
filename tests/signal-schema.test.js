const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const {
  buildSignal,
  buildSignalId,
  formatSignalTimestamp,
  validateSignal
} = require('../src/signals/schema');

function validInput(overrides = {}) {
  return {
    symbol: 'ETHUSDT',
    timeframe: '15m',
    timestamp: '2026-05-04T12:00:00.000Z',
    side: 'SELL',
    entryPrice: 3030,
    marginUsd: 25,
    leverage: 100,
    bbWidthPct: 1.2,
    adx15m: 24,
    reasons: ['Touched upper previous band'],
    ...overrides
  };
}

describe('signal object schema', () => {
  it('formats signal timestamp', () => {
    assert.equal(formatSignalTimestamp('2026-05-04T12:00:00.000Z'), '20260504T120000Z');
  });

  it('builds deterministic signal id', () => {
    assert.equal(buildSignalId({
      symbol: 'ETHUSDT',
      timeframe: '15m',
      timestamp: '2026-05-04T12:00:00.000Z',
      side: 'SELL'
    }), 'ETHUSDT-15m-20260504T120000Z-SELL');
  });

  it('builds a valid SELL signal schema', () => {
    const signal = buildSignal(validInput());

    assert.deepEqual(signal, {
      signal_id: 'ETHUSDT-15m-20260504T120000Z-SELL',
      symbol: 'ETHUSDT',
      side: 'SELL',
      entry_price: 3030,
      tp_price: 3017.88,
      sl_price: 3042.12,
      margin_usd: 25,
      leverage: 100,
      notional_usd: 2500,
      qty: 2500 / 3030,
      bb_width_pct: 1.2,
      adx_15m: 24,
      status: 'NEW',
      timeframe: '15m',
      timestamp: '2026-05-04T12:00:00.000Z',
      reasons: ['Touched upper previous band']
    });
    assert.deepEqual(validateSignal(signal), {
      valid: true,
      errors: []
    });
  });

  it('builds a valid BUY signal schema', () => {
    const signal = buildSignal(validInput({
      side: 'BUY',
      entryPrice: 100,
      reasons: ['Touched lower previous band']
    }));

    assert.equal(signal.tp_price, 100.4);
    assert.equal(signal.sl_price, 99.6);
    assert.equal(validateSignal(signal).valid, true);
  });

  it('returns null when required build inputs are missing', () => {
    assert.equal(buildSignal(validInput({
      symbol: ''
    })), null);
    assert.equal(buildSignal(validInput({
      entryPrice: 0
    })), null);
  });

  it('fails validation when required schema field is missing', () => {
    const signal = buildSignal(validInput());
    delete signal.entry_price;

    assert.deepEqual(validateSignal(signal), {
      valid: false,
      errors: ['Missing required field: entry_price']
    });
  });

  it('fails validation when side is invalid', () => {
    const signal = buildSignal(validInput());
    signal.side = 'HOLD';

    assert.deepEqual(validateSignal(signal), {
      valid: false,
      errors: ['Invalid side']
    });
  });
});
