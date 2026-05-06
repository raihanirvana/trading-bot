const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const { DependencyError } = require('../src/errors');
const {
  normalizeCandles,
  normalizeMexcKlineRow,
  normalizeOhlcvResult
} = require('../src/market_data/candles');

function kline(openTime, open = '3000.0') {
  return [
    openTime,
    open,
    '3010.0',
    '2990.0',
    '3005.0',
    '12345.0',
    openTime + 899999,
    '37000000.0'
  ];
}

describe('candle normalization', () => {
  it('normalizes a valid MEXC kline row into the standard candle schema', () => {
    assert.deepEqual(
      normalizeMexcKlineRow(kline(1764505860000), {
        symbol: 'ETHUSDT',
        timeframe: '15m'
      }),
      {
        symbol: 'ETHUSDT',
        timeframe: '15m',
        timestamp: '2025-11-30T12:31:00.000Z',
        open: 3000,
        high: 3010,
        low: 2990,
        close: 3005,
        volume: 12345
      }
    );
  });

  it('removes duplicate timestamps and keeps the latest row for that timestamp', () => {
    const candles = normalizeCandles([
      kline(1764505860000, '3000.0'),
      kline(1764505860000, '3001.0')
    ], {
      symbol: 'SOLUSDT',
      timeframe: '5m'
    });

    assert.equal(candles.length, 1);
    assert.equal(candles[0].open, 3001);
  });

  it('sorts candles by timestamp ascending', () => {
    const candles = normalizeCandles([
      kline(1764505980000),
      kline(1764505860000),
      kline(1764505920000)
    ], {
      symbol: 'XRPUSDT',
      timeframe: '15m'
    });

    assert.deepEqual(candles.map((candle) => candle.timestamp), [
      '2025-11-30T12:31:00.000Z',
      '2025-11-30T12:32:00.000Z',
      '2025-11-30T12:33:00.000Z'
    ]);
  });

  it('normalizes a raw OHLCV fetch result', () => {
    const candles = normalizeOhlcvResult({
      symbol: 'ETHUSDT',
      timeframe: '5m',
      raw: [kline(1764505860000)]
    });

    assert.equal(candles.length, 1);
    assert.equal(candles[0].symbol, 'ETHUSDT');
    assert.equal(candles[0].timeframe, '5m');
  });

  it('rejects invalid numeric values', () => {
    assert.throws(
      () => normalizeMexcKlineRow(kline(1764505860000, 'not-a-number'), {
        symbol: 'ETHUSDT',
        timeframe: '15m'
      }),
      DependencyError
    );
  });
});
