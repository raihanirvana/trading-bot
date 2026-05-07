const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const { ValidationError } = require('../src/errors');
const {
  VIRTUAL_ORDER_STATUS,
  replayHistoricalCandles
} = require('../src/paper');

function buildReplayInput(overrides = {}) {
  return {
    bollingerOptions: {
      deviation: 1,
      length: 2
    },
    candles: [
      {
        timestamp: '2026-05-04T12:00:00.000Z',
        open: 100,
        high: 101,
        low: 99,
        close: 100,
        volume: 1000
      },
      {
        timestamp: '2026-05-04T12:15:00.000Z',
        open: 101,
        high: 103,
        low: 101,
        close: 102,
        volume: 1000
      },
      {
        timestamp: '2026-05-04T12:30:00.000Z',
        open: 101,
        high: 100.2,
        low: 99.9,
        close: 100.1,
        volume: 1000
      },
      {
        timestamp: '2026-05-04T12:45:00.000Z',
        open: 100.2,
        high: 100.5,
        low: 100,
        close: 100.3,
        volume: 1000
      }
    ],
    leverage: 100,
    marginUsd: 25,
    symbol: 'ETHUSDT',
    timeframe: '15m',
    ...overrides
  };
}

describe('historical candle paper replay', () => {
  it('feeds candles sequentially and generates deterministic signal, fill, and TP outcome', () => {
    const input = buildReplayInput();
    const firstRun = replayHistoricalCandles(input);
    const secondRun = replayHistoricalCandles(input);

    assert.deepEqual(firstRun, secondRun);
    assert.equal(firstRun.signals.length, 1);
    assert.equal(firstRun.signals[0].signal_id, 'ETHUSDT-15m-20260504T123000Z-BUY');
    assert.equal(firstRun.signals[0].entry_price, 100);
    assert.equal(firstRun.orders.length, 1);
    assert.equal(firstRun.orders[0].status, VIRTUAL_ORDER_STATUS.TP);
    assert.equal(firstRun.orders[0].filled_at, '2026-05-04T12:30:00.000Z');
    assert.equal(firstRun.orders[0].exit_at, '2026-05-04T12:45:00.000Z');
    assert.deepEqual(firstRun.events.map((event) => event.type), [
      'PAPER_SIGNAL',
      'PAPER_FILL',
      'PAPER_TP'
    ]);
  });

  it('sorts input candles before replaying so output remains stable', () => {
    const ordered = replayHistoricalCandles(buildReplayInput());
    const shuffled = replayHistoricalCandles(buildReplayInput({
      candles: [...buildReplayInput().candles].reverse()
    }));

    assert.deepEqual(shuffled, ordered);
  });

  it('uses candle ADX values to block anti-band-walk signals deterministically', () => {
    const result = replayHistoricalCandles(buildReplayInput({
      bollingerOptions: {
        deviation: 2,
        length: 2
      },
      candles: buildReplayInput().candles.map((candle) => ({
        ...candle,
        adx_15m: 36,
        low: candle.timestamp === '2026-05-04T12:30:00.000Z' ? 98.9 : candle.low
      }))
    }));

    assert.deepEqual(result, {
      events: [],
      orders: [],
      signals: []
    });
  });

  it('rejects invalid replay input', () => {
    assert.throws(
      () => replayHistoricalCandles({
        candles: [],
        leverage: 100,
        marginUsd: 25,
        timeframe: '15m'
      }),
      ValidationError
    );
    assert.throws(
      () => replayHistoricalCandles(buildReplayInput({
        candles: [
          {
            timestamp: 'bad-date',
            open: 1,
            high: 1,
            low: 1,
            close: 1
          }
        ]
      })),
      ValidationError
    );
  });
});
