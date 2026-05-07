const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { describe, it } = require('node:test');

const packageJson = require('../package.json');
const {
  VIRTUAL_ORDER_STATUS,
  buildPaperDailySummaries,
  buildPaperPnlReport,
  replayHistoricalCandles
} = require('../src/paper');

function buildTwoDayReplayInput() {
  return {
    bollingerOptions: {
      deviation: 1,
      length: 2
    },
    candles: [
      buildCandle('2026-05-04T12:00:00.000Z', 100, 101, 99, 100),
      buildCandle('2026-05-04T12:15:00.000Z', 101, 103, 101, 102),
      buildCandle('2026-05-04T12:30:00.000Z', 101, 100.2, 99.9, 100.1),
      buildCandle('2026-05-04T12:45:00.000Z', 100.2, 100.5, 100, 100.3),
      buildCandle('2026-05-05T12:00:00.000Z', 100, 101, 99, 100),
      buildCandle('2026-05-05T12:15:00.000Z', 101, 103, 101, 102),
      buildCandle('2026-05-05T12:30:00.000Z', 101, 100.2, 99.9, 100.1),
      buildCandle('2026-05-05T12:45:00.000Z', 100.2, 100.5, 100, 100.3)
    ],
    dailyOptions: {
      dailyTargetUsd: 1,
      minTradesForTarget: 1
    },
    leverage: 100,
    marginUsd: 25,
    symbol: 'ETHUSDT',
    timeframe: '15m'
  };
}

function buildCandle(timestamp, open, high, low, close) {
  return {
    close,
    high,
    low,
    open,
    timestamp,
    volume: 1000
  };
}

describe('paper trading test suite', () => {
  it('includes every paper test file in npm run test:paper', () => {
    const testDir = path.join(__dirname);
    const paperTestFiles = fs.readdirSync(testDir)
      .filter((file) => /^paper-.*\.test\.js$/.test(file))
      .sort();

    for (const file of paperTestFiles) {
      assert.match(packageJson.scripts['test:paper'], new RegExp(`tests/${file.replaceAll('.', '\\.')}`));
    }
  });

  it('runs replay to PnL report to daily summary without live trading dependencies', () => {
    const replay = replayHistoricalCandles(buildTwoDayReplayInput());
    const report = buildPaperPnlReport({
      orders: replay.orders
    });
    const summaries = buildPaperDailySummaries({
      dailyTargetUsd: 1,
      minTradesForTarget: 1,
      orders: replay.orders
    });

    assert.deepEqual(replay.signals.map((signal) => signal.signal_id), [
      'ETHUSDT-15m-20260504T123000Z-BUY',
      'ETHUSDT-15m-20260505T123000Z-BUY'
    ]);
    assert.deepEqual(replay.orders.map((order) => order.status), [
      VIRTUAL_ORDER_STATUS.TP,
      VIRTUAL_ORDER_STATUS.TP
    ]);
    assert.equal(report.total.trade_count, 2);
    assert.equal(report.total.win_count, 2);
    assert.deepEqual(summaries.map((summary) => ({
      allowed_next_entry: summary.allowed_next_entry,
      daily_target_hit: summary.daily_target_hit,
      date: summary.date,
      trade_count: summary.trade_count
    })), [
      {
        allowed_next_entry: false,
        daily_target_hit: true,
        date: '2026-05-04',
        trade_count: 1
      },
      {
        allowed_next_entry: false,
        daily_target_hit: true,
        date: '2026-05-05',
        trade_count: 1
      }
    ]);
  });

  it('does not expose exchange order placement from the paper module', () => {
    const paper = require('../src/paper');
    const exportedNames = Object.keys(paper);

    assert.equal(exportedNames.some((name) => /live|exchange|place|submit/i.test(name)), false);
  });
});
