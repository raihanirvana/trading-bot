const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const { ValidationError } = require('../src/errors');
const {
  VIRTUAL_ORDER_STATUS,
  buildVirtualOrderFromSignal,
  isLimitTouched,
  simulatePendingLimitFill,
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

describe('pending limit fill simulation', () => {
  it('fills BUY pending limit when candle low touches entry', () => {
    const order = buildVirtualOrderFromSignal({
      createdAt: '2026-05-04T12:01:00.000Z',
      signal: buildSampleSignal({
        side: 'BUY',
        entryPrice: 100
      })
    });
    const result = simulatePendingLimitFill({
      candle: candle('2026-05-04T12:15:00.000Z', 100.3, 99.9),
      order
    });

    assert.equal(result.filled, true);
    assert.equal(result.fill_price, 100);
    assert.equal(result.reason, 'LIMIT_TOUCHED');
    assert.equal(result.order.status, VIRTUAL_ORDER_STATUS.FILLED);
    assert.equal(result.order.filled_at, '2026-05-04T12:15:00.000Z');
    assert.equal(result.order.updated_at, '2026-05-04T12:15:00.000Z');
  });

  it('fills SELL pending limit when candle high touches entry', () => {
    const order = buildVirtualOrderFromSignal({
      createdAt: '2026-05-04T12:01:00.000Z',
      signal: buildSampleSignal({
        side: 'SELL',
        entryPrice: 100,
        reasons: ['Touched upper previous band']
      })
    });
    const result = simulatePendingLimitFill({
      candle: candle('2026-05-04T12:15:00.000Z', 100.1, 99.7),
      order
    });

    assert.equal(result.filled, true);
    assert.equal(result.fill_price, 100);
    assert.equal(result.order.status, VIRTUAL_ORDER_STATUS.FILLED);
    assert.equal(isLimitTouched(order, candle('2026-05-04T12:15:00.000Z', 100.1, 99.7)), true);
  });

  it('does not fill when limit is not touched', () => {
    const buyOrder = buildVirtualOrderFromSignal({
      signal: buildSampleSignal({
        side: 'BUY',
        entryPrice: 100
      })
    });
    const sellOrder = buildVirtualOrderFromSignal({
      signal: buildSampleSignal({
        side: 'SELL',
        entryPrice: 100,
        reasons: ['Touched upper previous band']
      })
    });
    const buyResult = simulatePendingLimitFill({
      candle: candle('2026-05-04T12:15:00.000Z', 101, 100.01),
      order: buyOrder
    });
    const sellResult = simulatePendingLimitFill({
      candle: candle('2026-05-04T12:15:00.000Z', 99.99, 99),
      order: sellOrder
    });

    assert.equal(buyResult.filled, false);
    assert.equal(buyResult.reason, 'LIMIT_NOT_TOUCHED');
    assert.equal(buyResult.order, buyOrder);
    assert.equal(sellResult.filled, false);
    assert.equal(sellResult.reason, 'LIMIT_NOT_TOUCHED');
    assert.equal(sellResult.order, sellOrder);
  });

  it('expires pending order before fill when candle is at or after expires_at', () => {
    const order = buildVirtualOrderFromSignal({
      createdAt: '2026-05-04T12:00:00.000Z',
      expiresAt: '2026-05-04T12:15:00.000Z',
      signal: buildSampleSignal({
        side: 'BUY',
        entryPrice: 100
      })
    });
    const result = simulatePendingLimitFill({
      candle: candle('2026-05-04T12:30:00.000Z', 101, 99),
      order
    });

    assert.equal(result.filled, false);
    assert.equal(result.reason, 'ORDER_EXPIRED');
    assert.equal(result.order.status, VIRTUAL_ORDER_STATUS.EXPIRED);
    assert.equal(result.order.exit_reason, 'PAPER_EXPIRED');
    assert.equal(result.order.filled_at, null);
    assert.equal(result.order.exit_at, '2026-05-04T12:30:00.000Z');
  });

  it('does not fill non-pending orders and does not run TP/SL simulation', () => {
    const pending = buildVirtualOrderFromSignal({
      createdAt: '2026-05-04T12:01:00.000Z',
      signal: buildSampleSignal()
    });
    const filled = transitionVirtualOrder({
      nextStatus: VIRTUAL_ORDER_STATUS.FILLED,
      order: pending,
      timestamp: '2026-05-04T12:03:00.000Z'
    });
    const result = simulatePendingLimitFill({
      candle: candle('2026-05-04T12:15:00.000Z', 200, 50),
      order: filled
    });

    assert.equal(result.filled, false);
    assert.equal(result.reason, 'ORDER_NOT_PENDING');
    assert.equal(result.order.status, VIRTUAL_ORDER_STATUS.FILLED);
    assert.equal(result.order.exit_at, null);
    assert.equal(result.order.exit_reason, null);
  });

  it('rejects invalid candles', () => {
    const order = buildVirtualOrderFromSignal({
      signal: buildSampleSignal()
    });

    assert.throws(
      () => simulatePendingLimitFill({
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
