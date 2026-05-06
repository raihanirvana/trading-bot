const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const { ValidationError } = require('../src/errors');
const { buildSignal } = require('../src/signals/schema');
const {
  formatNumber,
  formatSignalMessage
} = require('../src/telegram');

function buildSampleSignal(overrides = {}) {
  return buildSignal({
    symbol: 'ETHUSDT',
    timeframe: '15m',
    timestamp: '2026-05-04T12:00:00.000Z',
    side: 'BUY',
    entryPrice: 3000,
    marginUsd: 25,
    leverage: 100,
    bbWidthPct: 1.23456,
    adx15m: 24.56789,
    reasons: ['Touched lower previous band', 'BB width above minimum'],
    ...overrides
  });
}

describe('telegram signal message formatter', () => {
  it('formats a complete signal message with all required fields', () => {
    const message = formatSignalMessage(buildSampleSignal());

    assert.match(message, /Signal BUY ETHUSDT/);
    assert.match(message, /Timeframe: 15m/);
    assert.match(message, /Entry: 3000/);
    assert.match(message, /TP: 3012/);
    assert.match(message, /SL: 2988/);
    assert.match(message, /Margin: 25 USDT/);
    assert.match(message, /Leverage: 100x/);
    assert.match(message, /Notional: 2500 USDT/);
    assert.match(message, /Qty: 0.8333/);
    assert.match(message, /BB Width: 1.2346%/);
    assert.match(message, /ADX 15m: 24.5679/);
    assert.match(message, /Signal ID: ETHUSDT-15m-20260504T120000Z-BUY/);
    assert.match(message, /Reasons:\n- Touched lower previous band\n- BB width above minimum/);
  });

  it('supports custom numeric precision', () => {
    const message = formatSignalMessage(buildSampleSignal(), {
      precision: {
        price: 2,
        qty: 6,
        indicator: 2
      }
    });

    assert.match(message, /Entry: 3000/);
    assert.match(message, /Qty: 0.833333/);
    assert.match(message, /BB Width: 1.23%/);
    assert.match(message, /ADX 15m: 24.57/);
  });

  it('formats an empty reason list safely', () => {
    const message = formatSignalMessage(buildSampleSignal({
      reasons: []
    }));

    assert.match(message, /Reasons:\n- No reason provided/);
  });

  it('rejects invalid signal input', () => {
    assert.throws(
      () => formatSignalMessage({ symbol: 'ETHUSDT' }),
      (error) => {
        assert.equal(error instanceof ValidationError, true);
        assert.equal(error.details.errors.includes('Missing required field: signal_id'), true);
        return true;
      }
    );
  });

  it('formats finite numbers without unnecessary trailing zeroes', () => {
    assert.equal(formatNumber(1.2300, 4), '1.23');
    assert.equal(formatNumber(Number.NaN, 4), 'n/a');
  });
});
