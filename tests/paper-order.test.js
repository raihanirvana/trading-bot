const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const { ValidationError } = require('../src/errors');
const {
  VIRTUAL_ORDER_STATUS,
  buildVirtualOrderFromSignal,
  buildVirtualOrderId,
  canTransitionVirtualOrder,
  isTerminalVirtualOrderStatus,
  transitionVirtualOrder,
  validateVirtualOrder
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

describe('virtual order model', () => {
  it('creates an initial pending virtual order from a signal', () => {
    const signal = buildSampleSignal();
    const order = buildVirtualOrderFromSignal({
      createdAt: '2026-05-04T12:01:00.000Z',
      expiresAt: '2026-05-04T12:16:00.000Z',
      signal
    });

    assert.deepEqual(order, {
      order_id: 'paper-ETHUSDT-15m-20260504T120000Z-BUY',
      signal_id: signal.signal_id,
      symbol: 'ETHUSDT',
      timeframe: '15m',
      side: 'BUY',
      status: VIRTUAL_ORDER_STATUS.PENDING,
      entry_price: 100,
      tp_price: 100.4,
      sl_price: 99.6,
      margin_usd: 25,
      leverage: 100,
      notional_usd: 2500,
      qty: 25,
      created_at: '2026-05-04T12:01:00.000Z',
      updated_at: '2026-05-04T12:01:00.000Z',
      expires_at: '2026-05-04T12:16:00.000Z',
      filled_at: null,
      exit_at: null,
      exit_reason: null,
      pnl_gross: null,
      pnl_net: null,
      fees_usd: null
    });
    assert.deepEqual(validateVirtualOrder(order), {
      valid: true,
      errors: []
    });
  });

  it('allows valid pending to filled to TP transition', () => {
    const pending = buildVirtualOrderFromSignal({
      createdAt: '2026-05-04T12:01:00.000Z',
      signal: buildSampleSignal()
    });
    const filled = transitionVirtualOrder({
      nextStatus: VIRTUAL_ORDER_STATUS.FILLED,
      order: pending,
      timestamp: '2026-05-04T12:03:00.000Z'
    });
    const tp = transitionVirtualOrder({
      exitReason: 'PAPER_TP',
      nextStatus: VIRTUAL_ORDER_STATUS.TP,
      order: filled,
      pnlGross: 10,
      pnlNet: 9.8,
      timestamp: '2026-05-04T12:15:00.000Z'
    });

    assert.equal(filled.status, VIRTUAL_ORDER_STATUS.FILLED);
    assert.equal(filled.filled_at, '2026-05-04T12:03:00.000Z');
    assert.equal(filled.exit_at, null);
    assert.equal(tp.status, VIRTUAL_ORDER_STATUS.TP);
    assert.equal(tp.exit_reason, 'PAPER_TP');
    assert.equal(tp.exit_at, '2026-05-04T12:15:00.000Z');
    assert.equal(tp.pnl_gross, 10);
    assert.equal(tp.pnl_net, 9.8);
  });

  it('allows valid terminal transitions from pending or filled', () => {
    const pending = buildVirtualOrderFromSignal({
      createdAt: '2026-05-04T12:01:00.000Z',
      signal: buildSampleSignal()
    });
    const cancelled = transitionVirtualOrder({
      nextStatus: VIRTUAL_ORDER_STATUS.CANCELLED,
      order: pending,
      timestamp: '2026-05-04T12:02:00.000Z'
    });
    const expired = transitionVirtualOrder({
      nextStatus: VIRTUAL_ORDER_STATUS.EXPIRED,
      order: pending,
      timestamp: '2026-05-04T12:16:00.000Z'
    });
    const filled = transitionVirtualOrder({
      nextStatus: VIRTUAL_ORDER_STATUS.FILLED,
      order: pending
    });
    const sl = transitionVirtualOrder({
      nextStatus: VIRTUAL_ORDER_STATUS.SL,
      order: filled
    });
    const timeExit = transitionVirtualOrder({
      nextStatus: VIRTUAL_ORDER_STATUS.TIME_EXIT,
      order: filled
    });

    assert.equal(cancelled.status, VIRTUAL_ORDER_STATUS.CANCELLED);
    assert.equal(expired.status, VIRTUAL_ORDER_STATUS.EXPIRED);
    assert.equal(sl.status, VIRTUAL_ORDER_STATUS.SL);
    assert.equal(timeExit.status, VIRTUAL_ORDER_STATUS.TIME_EXIT);
    assert.equal(isTerminalVirtualOrderStatus(VIRTUAL_ORDER_STATUS.CANCELLED), true);
    assert.equal(isTerminalVirtualOrderStatus(VIRTUAL_ORDER_STATUS.FILLED), false);
  });

  it('rejects invalid state transitions', () => {
    const pending = buildVirtualOrderFromSignal({
      signal: buildSampleSignal()
    });
    const filled = transitionVirtualOrder({
      nextStatus: VIRTUAL_ORDER_STATUS.FILLED,
      order: pending
    });
    const tp = transitionVirtualOrder({
      nextStatus: VIRTUAL_ORDER_STATUS.TP,
      order: filled
    });

    assert.equal(canTransitionVirtualOrder(VIRTUAL_ORDER_STATUS.PENDING, VIRTUAL_ORDER_STATUS.TP), false);
    assert.equal(canTransitionVirtualOrder(VIRTUAL_ORDER_STATUS.FILLED, VIRTUAL_ORDER_STATUS.CANCELLED), false);
    assert.throws(
      () => transitionVirtualOrder({
        nextStatus: VIRTUAL_ORDER_STATUS.TP,
        order: pending
      }),
      ValidationError
    );
    assert.throws(
      () => transitionVirtualOrder({
        nextStatus: VIRTUAL_ORDER_STATUS.SL,
        order: tp
      }),
      ValidationError
    );
  });

  it('rejects invalid transition timelines', () => {
    const pending = buildVirtualOrderFromSignal({
      createdAt: '2026-05-04T12:00:00.000Z',
      expiresAt: '2026-05-04T12:15:00.000Z',
      signal: buildSampleSignal()
    });
    const filled = transitionVirtualOrder({
      nextStatus: VIRTUAL_ORDER_STATUS.FILLED,
      order: pending,
      timestamp: '2026-05-04T12:10:00.000Z'
    });

    assert.throws(
      () => transitionVirtualOrder({
        nextStatus: VIRTUAL_ORDER_STATUS.FILLED,
        order: pending,
        timestamp: '2026-05-04T12:15:00.000Z'
      }),
      ValidationError
    );
    assert.throws(
      () => transitionVirtualOrder({
        nextStatus: VIRTUAL_ORDER_STATUS.SL,
        order: filled,
        timestamp: '2026-05-04T12:05:00.000Z'
      }),
      ValidationError
    );
    assert.throws(
      () => transitionVirtualOrder({
        nextStatus: VIRTUAL_ORDER_STATUS.CANCELLED,
        order: pending,
        timestamp: '2026-05-04T11:59:59.000Z'
      }),
      ValidationError
    );
  });

  it('rejects invalid virtual order inputs', () => {
    assert.equal(buildVirtualOrderId(buildSampleSignal()), 'paper-ETHUSDT-15m-20260504T120000Z-BUY');
    assert.throws(
      () => buildVirtualOrderFromSignal({
        signal: {
          symbol: 'ETHUSDT'
        }
      }),
      ValidationError
    );
    assert.throws(
      () => validateVirtualOrder({
        status: 'BROKEN'
      }),
      ValidationError
    );
    assert.throws(
      () => buildVirtualOrderFromSignal({
        createdAt: 'bad-date',
        signal: buildSampleSignal()
      }),
      ValidationError
    );
  });
});
