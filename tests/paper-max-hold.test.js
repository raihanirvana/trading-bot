const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const { ValidationError } = require('../src/errors');
const {
  DEFAULT_MAX_HOLD_BARS,
  VIRTUAL_ORDER_STATUS,
  buildVirtualOrderFromSignal,
  getHeldCandles,
  simulateMaxHoldExit,
  transitionVirtualOrder
} = require('../src/paper');
const { buildSignal } = require('../src/signals/schema');

function buildSampleSignal(overrides = {}) {
  return buildSignal({
    symbol: 'ETHUSDT',
    timeframe: '15m',
    timestamp: '2026-05-04T12:00:00.000Z',
    side: 'BUY',
    entryPrice: 100,
    marginUsd: 25,
    leverage: 100,
    bbWidthPct: 1.2,
    adx15m: 24,
    reasons: ['Touched lower previous band'],
    ...overrides
  });
}

function buildFilledOrder(signalOverrides = {}) {
  const pending = buildVirtualOrderFromSignal({
    createdAt: '2026-05-04T12:00:00.000Z',
    signal: buildSampleSignal(signalOverrides)
  });

  return transitionVirtualOrder({
    nextStatus: VIRTUAL_ORDER_STATUS.FILLED,
    order: pending,
    timestamp: '2026-05-04T12:00:00.000Z'
  });
}

describe('max-hold paper simulation', () => {
  it('exits after the default 8 held bars using the 8th candle close', () => {
    const order = buildFilledOrder({
      side: 'BUY',
      entryPrice: 100
    });
    const result = simulateMaxHoldExit({
      candles: buildCandles(8, 100),
      order
    });

    assert.equal(DEFAULT_MAX_HOLD_BARS, 8);
    assert.equal(result.exited, true);
    assert.equal(result.bars_held, 8);
    assert.equal(result.exit_price, 108);
    assert.equal(result.reason, 'PAPER_TIME_EXIT');
    assert.equal(result.order.status, VIRTUAL_ORDER_STATUS.TIME_EXIT);
    assert.equal(result.order.exit_reason, 'PAPER_TIME_EXIT');
    assert.equal(result.order.exit_at, '2026-05-04T14:00:00.000Z');
    assert.equal(result.order.pnl_gross, (108 - 100) * 25);
    assert.equal(result.order.pnl_net, result.order.pnl_gross - result.order.fees_usd);
  });

  it('does not exit before max hold bars are reached', () => {
    const order = buildFilledOrder();
    const result = simulateMaxHoldExit({
      candles: buildCandles(7, 100),
      order
    });

    assert.equal(result.exited, false);
    assert.equal(result.bars_held, 7);
    assert.equal(result.reason, 'MAX_HOLD_NOT_REACHED');
    assert.equal(result.order, order);
  });

  it('supports custom max hold bars and short PnL', () => {
    const order = buildFilledOrder({
      side: 'SELL',
      entryPrice: 100,
      reasons: ['Touched upper previous band']
    });
    const result = simulateMaxHoldExit({
      candles: buildCandles(3, 100),
      maxHoldBars: 3,
      order
    });

    assert.equal(result.exited, true);
    assert.equal(result.bars_held, 3);
    assert.equal(result.exit_price, 103);
    assert.equal(result.order.pnl_gross, (100 - 103) * 25);
    assert.equal(result.order.status, VIRTUAL_ORDER_STATUS.TIME_EXIT);
  });

  it('counts only candles after filled_at and sorts by timestamp', () => {
    const order = buildFilledOrder();
    const candles = [
      candle('2026-05-04T12:45:00.000Z', 103),
      candle('2026-05-04T12:00:00.000Z', 100),
      candle('2026-05-04T12:15:00.000Z', 101),
      candle('2026-05-04T12:30:00.000Z', 102)
    ];
    const heldCandles = getHeldCandles({
      candles,
      filledAt: order.filled_at
    });

    assert.deepEqual(heldCandles.map((heldCandle) => heldCandle.close), [101, 102, 103]);
  });

  it('does not exit non-filled orders and rejects invalid inputs', () => {
    const pending = buildVirtualOrderFromSignal({
      signal: buildSampleSignal()
    });

    assert.deepEqual(simulateMaxHoldExit({
      candles: buildCandles(8, 100),
      order: pending
    }), {
      bars_held: 0,
      exited: false,
      order: pending,
      reason: 'ORDER_NOT_FILLED'
    });
    assert.throws(
      () => simulateMaxHoldExit({
        candles: [{ timestamp: 'bad-date', close: 100 }],
        order: buildFilledOrder()
      }),
      ValidationError
    );
    assert.throws(
      () => simulateMaxHoldExit({
        candles: buildCandles(8, 100),
        maxHoldBars: 0,
        order: buildFilledOrder()
      }),
      ValidationError
    );
  });
});

function buildCandles(count, baseClose) {
  return Array.from({ length: count }, (_item, index) => {
    const timestamp = new Date(Date.UTC(2026, 4, 4, 12, 15 * (index + 1))).toISOString();

    return candle(timestamp, baseClose + index + 1);
  });
}

function candle(timestamp, close) {
  return {
    timestamp,
    close
  };
}
