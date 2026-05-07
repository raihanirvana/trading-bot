const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const { ValidationError } = require('../src/errors');
const {
  VIRTUAL_ORDER_STATUS,
  buildPaperDailySummaries,
  buildPaperDailySummary
} = require('../src/paper');

function buildOrder(overrides = {}) {
  return {
    order_id: 'paper-order-1',
    signal_id: 'ETHUSDT-15m-20260504T120000Z-BUY',
    symbol: 'ETHUSDT',
    timeframe: '15m',
    side: 'BUY',
    status: VIRTUAL_ORDER_STATUS.TP,
    entry_price: 100,
    tp_price: 100.4,
    sl_price: 99.6,
    margin_usd: 25,
    leverage: 100,
    notional_usd: 2500,
    qty: 25,
    created_at: '2026-05-04T12:01:00.000Z',
    updated_at: '2026-05-04T12:15:00.000Z',
    expires_at: null,
    filled_at: '2026-05-04T12:03:00.000Z',
    exit_at: '2026-05-04T12:15:00.000Z',
    exit_reason: 'PAPER_TP',
    pnl_gross: 10,
    pnl_net: 8,
    fees_usd: 2,
    ...overrides
  };
}

describe('paper daily summary', () => {
  it('aggregates trades and pnl for one UTC day', () => {
    const summary = buildPaperDailySummary({
      date: '2026-05-04',
      orders: [
        buildOrder({
          order_id: 'tp',
          pnl_gross: 10,
          pnl_net: 8,
          fees_usd: 2
        }),
        buildOrder({
          order_id: 'sl',
          signal_id: 'ETHUSDT-15m-20260504T123000Z-SELL',
          status: VIRTUAL_ORDER_STATUS.SL,
          exit_at: '2026-05-04T12:45:00.000Z',
          pnl_gross: -10,
          pnl_net: -12,
          fees_usd: 2
        }),
        buildOrder({
          order_id: 'other-day',
          signal_id: 'ETHUSDT-15m-20260505T120000Z-BUY',
          exit_at: '2026-05-05T12:15:00.000Z',
          pnl_net: 100
        })
      ]
    });

    assert.deepEqual(summary, {
      date: '2026-05-04',
      trade_count: 2,
      win_count: 1,
      loss_count: 1,
      breakeven_count: 0,
      winrate_pct: 50,
      profit_factor: 8 / 12,
      gross_profit_usd: 8,
      gross_loss_usd: 12,
      pnl_gross_usd: 0,
      pnl_net_usd: -4,
      fees_usd: 4,
      daily_target_usd: 6,
      daily_loss_stop_usd: -18,
      min_trades_for_target: 3,
      daily_target_hit: false,
      daily_loss_hit: false,
      allowed_next_entry: true
    });
  });

  it('marks daily target hit only after minimum trades are reached', () => {
    const twoTrades = [
      buildOrder({
        order_id: 'win-1',
        pnl_net: 4
      }),
      buildOrder({
        order_id: 'win-2',
        signal_id: 'ETHUSDT-15m-20260504T123000Z-BUY',
        exit_at: '2026-05-04T12:45:00.000Z',
        pnl_net: 4
      })
    ];
    const beforeMinTrades = buildPaperDailySummary({
      date: '2026-05-04',
      orders: twoTrades
    });
    const afterMinTrades = buildPaperDailySummary({
      date: '2026-05-04',
      orders: [
        ...twoTrades,
        buildOrder({
          order_id: 'win-3',
          signal_id: 'ETHUSDT-15m-20260504T130000Z-BUY',
          exit_at: '2026-05-04T13:15:00.000Z',
          pnl_net: 1
        })
      ]
    });

    assert.equal(beforeMinTrades.pnl_net_usd, 8);
    assert.equal(beforeMinTrades.daily_target_hit, false);
    assert.equal(beforeMinTrades.allowed_next_entry, true);
    assert.equal(afterMinTrades.pnl_net_usd, 9);
    assert.equal(afterMinTrades.daily_target_hit, true);
    assert.equal(afterMinTrades.allowed_next_entry, false);
  });

  it('marks daily loss stop hit', () => {
    const summary = buildPaperDailySummary({
      date: '2026-05-04',
      orders: [
        buildOrder({
          status: VIRTUAL_ORDER_STATUS.SL,
          pnl_net: -20
        })
      ]
    });

    assert.equal(summary.daily_loss_hit, true);
    assert.equal(summary.daily_target_hit, false);
    assert.equal(summary.allowed_next_entry, false);
  });

  it('builds sorted summaries for all days with custom thresholds', () => {
    const summaries = buildPaperDailySummaries({
      dailyTargetUsd: 3,
      minTradesForTarget: 1,
      orders: [
        buildOrder({
          order_id: 'day-2',
          exit_at: '2026-05-05T12:15:00.000Z',
          pnl_net: -1
        }),
        buildOrder({
          order_id: 'day-1',
          exit_at: '2026-05-04T12:15:00.000Z',
          pnl_net: 4
        })
      ]
    });

    assert.deepEqual(summaries.map((summary) => summary.date), [
      '2026-05-04',
      '2026-05-05'
    ]);
    assert.equal(summaries[0].daily_target_hit, true);
    assert.equal(summaries[1].daily_target_hit, false);
  });

  it('returns an empty summary for a day with no reportable orders', () => {
    const summary = buildPaperDailySummary({
      date: '2026-05-04T12:00:00.000Z',
      orders: []
    });

    assert.equal(summary.date, '2026-05-04');
    assert.equal(summary.trade_count, 0);
    assert.equal(summary.pnl_net_usd, 0);
    assert.equal(summary.daily_target_hit, false);
    assert.equal(summary.allowed_next_entry, true);
  });

  it('rejects invalid daily summary inputs', () => {
    assert.throws(
      () => buildPaperDailySummary({
        date: 'bad-date',
        orders: []
      }),
      ValidationError
    );
    assert.throws(
      () => buildPaperDailySummary({
        date: '2026-05-04',
        orders: {},
      }),
      ValidationError
    );
    assert.throws(
      () => buildPaperDailySummaries({
        minTradesForTarget: 0,
        orders: []
      }),
      ValidationError
    );
  });
});
