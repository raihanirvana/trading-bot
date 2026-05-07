const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const { ValidationError } = require('../src/errors');
const {
  VIRTUAL_ORDER_STATUS,
  buildVirtualOrderFromSignal,
  calculateGrossPnl,
  getTpSlTouch,
  simulateTpSlExit,
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
    timestamp: '2026-05-04T12:03:00.000Z'
  });
}

describe('TP/SL paper exit simulation', () => {
  it('exits long order at TP when candle high touches tp_price', () => {
    const order = buildFilledOrder({
      side: 'BUY',
      entryPrice: 100
    });
    const result = simulateTpSlExit({
      candle: candle('2026-05-04T12:15:00.000Z', 100.4, 99.9),
      order
    });

    assert.equal(result.exited, true);
    assert.equal(result.exit_price, 100.4);
    assert.equal(result.reason, 'PAPER_TP');
    assert.equal(result.order.status, VIRTUAL_ORDER_STATUS.TP);
    assert.equal(result.order.exit_reason, 'PAPER_TP');
    assert.equal(result.order.exit_at, '2026-05-04T12:15:00.000Z');
    assert.equal(result.order.pnl_gross, (100.4 - 100) * 25);
    assert.equal(result.order.fees_usd, 100 * 25 * 0.0002 + 100.4 * 25 * 0.0006);
    assert.equal(result.order.pnl_net, result.order.pnl_gross - result.order.fees_usd);
  });

  it('exits long order at SL when candle low touches sl_price', () => {
    const order = buildFilledOrder({
      side: 'BUY',
      entryPrice: 100
    });
    const result = simulateTpSlExit({
      candle: candle('2026-05-04T12:15:00.000Z', 100.1, 99.6),
      order
    });

    assert.equal(result.exited, true);
    assert.equal(result.exit_price, 99.6);
    assert.equal(result.reason, 'PAPER_SL');
    assert.equal(result.order.status, VIRTUAL_ORDER_STATUS.SL);
    assert.equal(result.order.pnl_gross, (99.6 - 100) * 25);
    assert.equal(result.order.pnl_net, result.order.pnl_gross - result.order.fees_usd);
  });

  it('exits short order at TP when candle low touches tp_price', () => {
    const order = buildFilledOrder({
      side: 'SELL',
      entryPrice: 100,
      reasons: ['Touched upper previous band']
    });
    const result = simulateTpSlExit({
      candle: candle('2026-05-04T12:15:00.000Z', 100.1, 99.6),
      order
    });

    assert.equal(result.exited, true);
    assert.equal(result.exit_price, 99.6);
    assert.equal(result.reason, 'PAPER_TP');
    assert.equal(result.order.status, VIRTUAL_ORDER_STATUS.TP);
    assert.equal(result.order.pnl_gross, (100 - 99.6) * 25);
    assert.equal(result.order.pnl_net, result.order.pnl_gross - result.order.fees_usd);
  });

  it('exits short order at SL when candle high touches sl_price', () => {
    const order = buildFilledOrder({
      side: 'SELL',
      entryPrice: 100,
      reasons: ['Touched upper previous band']
    });
    const result = simulateTpSlExit({
      candle: candle('2026-05-04T12:15:00.000Z', 100.4, 99.9),
      order
    });

    assert.equal(result.exited, true);
    assert.equal(result.exit_price, 100.4);
    assert.equal(result.reason, 'PAPER_SL');
    assert.equal(result.order.status, VIRTUAL_ORDER_STATUS.SL);
    assert.equal(result.order.pnl_gross, (100 - 100.4) * 25);
    assert.equal(result.order.pnl_net, result.order.pnl_gross - result.order.fees_usd);
  });

  it('supports custom maker/taker fee config for net PnL', () => {
    const order = buildFilledOrder({
      side: 'BUY',
      entryPrice: 100
    });
    const result = simulateTpSlExit({
      candle: candle('2026-05-04T12:15:00.000Z', 100.4, 99.9),
      feeConfig: {
        makerFeeRate: 0.001,
        takerFeeRate: 0.002
      },
      order
    });

    assert.deepEqual(result.fees, {
      entry_fee_usd: 2.5,
      exit_fee_usd: 5.0200000000000005,
      fees_usd: 7.5200000000000005,
      maker_fee_rate: 0.001,
      taker_fee_rate: 0.002
    });
    assert.equal(result.order.pnl_gross, 10.000000000000142);
    assert.equal(result.order.pnl_net, result.order.pnl_gross - 7.5200000000000005);
  });

  it('uses conservative SL when TP and SL are both touched in one candle', () => {
    const order = buildFilledOrder({
      side: 'BUY',
      entryPrice: 100
    });
    const touch = getTpSlTouch(order, candle('2026-05-04T12:15:00.000Z', 100.5, 99.5));
    const result = simulateTpSlExit({
      candle: candle('2026-05-04T12:15:00.000Z', 100.5, 99.5),
      order
    });

    assert.equal(touch.exit_reason, 'PAPER_SL');
    assert.equal(result.order.status, VIRTUAL_ORDER_STATUS.SL);
  });

  it('does not exit when TP/SL are not touched or order is not filled', () => {
    const filled = buildFilledOrder({
      side: 'BUY',
      entryPrice: 100
    });
    const pending = buildVirtualOrderFromSignal({
      signal: buildSampleSignal()
    });
    const noTouch = simulateTpSlExit({
      candle: candle('2026-05-04T12:15:00.000Z', 100.2, 99.8),
      order: filled
    });
    const notFilled = simulateTpSlExit({
      candle: candle('2026-05-04T12:15:00.000Z', 100.4, 99.6),
      order: pending
    });

    assert.equal(noTouch.exited, false);
    assert.equal(noTouch.reason, 'TP_SL_NOT_TOUCHED');
    assert.equal(noTouch.order, filled);
    assert.equal(notFilled.exited, false);
    assert.equal(notFilled.reason, 'ORDER_NOT_FILLED');
    assert.equal(notFilled.order, pending);
  });

  it('rejects exit candles before filled_at', () => {
    const pending = buildVirtualOrderFromSignal({
      createdAt: '2026-05-04T12:00:00.000Z',
      signal: buildSampleSignal()
    });
    const order = transitionVirtualOrder({
      nextStatus: VIRTUAL_ORDER_STATUS.FILLED,
      order: pending,
      timestamp: '2026-05-04T12:30:00.000Z'
    });

    assert.throws(
      () => simulateTpSlExit({
        candle: candle('2026-05-04T12:15:00.000Z', 100.4, 99.6),
        order
      }),
      ValidationError
    );
  });

  it('calculates gross PnL and rejects invalid candles', () => {
    const order = buildFilledOrder({
      side: 'BUY',
      entryPrice: 100
    });

    assert.equal(calculateGrossPnl({
      exitPrice: 101,
      order
    }), 25);
    assert.throws(
      () => simulateTpSlExit({
        candle: {
          timestamp: 'bad-date',
          high: 100,
          low: 99
        },
        order
      }),
      ValidationError
    );
  });
});

function candle(timestamp, high, low) {
  return {
    timestamp,
    high,
    low
  };
}
