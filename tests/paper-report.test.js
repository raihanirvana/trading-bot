const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const { ValidationError } = require('../src/errors');
const {
  VIRTUAL_ORDER_STATUS,
  buildPaperPnlReport,
  isReportablePaperOrder
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

describe('paper PnL report', () => {
  it('aggregates daily pnl, winrate, and profit factor from terminal orders', () => {
    const report = buildPaperPnlReport({
      orders: [
        buildOrder({
          order_id: 'win-1',
          exit_at: '2026-05-04T12:15:00.000Z',
          pnl_gross: 10,
          pnl_net: 8,
          fees_usd: 2
        }),
        buildOrder({
          order_id: 'loss-1',
          signal_id: 'ETHUSDT-15m-20260504T123000Z-SELL',
          status: VIRTUAL_ORDER_STATUS.SL,
          exit_at: '2026-05-04T12:45:00.000Z',
          pnl_gross: -10,
          pnl_net: -12,
          fees_usd: 2
        }),
        buildOrder({
          order_id: 'win-2',
          signal_id: 'BTCUSDT-15m-20260505T120000Z-BUY',
          exit_at: '2026-05-05T12:15:00.000Z',
          pnl_gross: 6,
          pnl_net: 4,
          fees_usd: 2
        })
      ]
    });

    assert.deepEqual(report.daily, [
      {
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
        fees_usd: 4
      },
      {
        date: '2026-05-05',
        trade_count: 1,
        win_count: 1,
        loss_count: 0,
        breakeven_count: 0,
        winrate_pct: 100,
        profit_factor: null,
        gross_profit_usd: 4,
        gross_loss_usd: 0,
        pnl_gross_usd: 6,
        pnl_net_usd: 4,
        fees_usd: 2
      }
    ]);
    assert.deepEqual(report.total, {
      date: null,
      trade_count: 3,
      win_count: 2,
      loss_count: 1,
      breakeven_count: 0,
      winrate_pct: (2 / 3) * 100,
      profit_factor: 1,
      gross_profit_usd: 12,
      gross_loss_usd: 12,
      pnl_gross_usd: 6,
      pnl_net_usd: 0,
      fees_usd: 6
    });
  });

  it('filters report by exit date range inclusively', () => {
    const report = buildPaperPnlReport({
      fromDate: '2026-05-05T00:00:00.000Z',
      orders: [
        buildOrder({
          order_id: 'older',
          exit_at: '2026-05-04T23:59:59.999Z',
          pnl_net: 10
        }),
        buildOrder({
          order_id: 'included',
          exit_at: '2026-05-05T00:00:00.000Z',
          pnl_net: 5
        })
      ],
      toDate: '2026-05-05T23:59:59.999Z'
    });

    assert.equal(report.total.trade_count, 1);
    assert.equal(report.total.pnl_net_usd, 5);
    assert.equal(report.daily[0].date, '2026-05-05');
  });

  it('ignores non-reportable paper orders without PnL', () => {
    const pending = buildOrder({
      status: VIRTUAL_ORDER_STATUS.PENDING,
      exit_at: null,
      pnl_net: null
    });
    const cancelled = buildOrder({
      status: VIRTUAL_ORDER_STATUS.CANCELLED,
      exit_at: '2026-05-04T12:15:00.000Z',
      pnl_net: null
    });

    assert.equal(isReportablePaperOrder(pending), false);
    assert.equal(isReportablePaperOrder(cancelled), false);
    assert.deepEqual(buildPaperPnlReport({
      orders: [
        pending,
        cancelled
      ]
    }), {
      daily: [],
      total: {
        date: null,
        trade_count: 0,
        win_count: 0,
        loss_count: 0,
        breakeven_count: 0,
        winrate_pct: 0,
        profit_factor: null,
        gross_profit_usd: 0,
        gross_loss_usd: 0,
        pnl_gross_usd: 0,
        pnl_net_usd: 0,
        fees_usd: 0
      }
    });
  });

  it('counts breakeven trades separately', () => {
    const report = buildPaperPnlReport({
      orders: [
        buildOrder({
          pnl_gross: 2,
          pnl_net: 0,
          fees_usd: 2
        })
      ]
    });

    assert.equal(report.total.trade_count, 1);
    assert.equal(report.total.win_count, 0);
    assert.equal(report.total.loss_count, 0);
    assert.equal(report.total.breakeven_count, 1);
    assert.equal(report.total.winrate_pct, 0);
  });

  it('rejects invalid report inputs', () => {
    assert.throws(
      () => buildPaperPnlReport({
        orders: {}
      }),
      ValidationError
    );
    assert.throws(
      () => buildPaperPnlReport({
        fromDate: '2026-05-06T00:00:00.000Z',
        orders: [],
        toDate: '2026-05-05T00:00:00.000Z'
      }),
      ValidationError
    );
    assert.throws(
      () => buildPaperPnlReport({
        orders: [
          {
            status: 'BROKEN'
          }
        ]
      }),
      ValidationError
    );
  });
});
