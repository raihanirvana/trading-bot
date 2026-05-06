const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const { DependencyError, ValidationError } = require('../src/errors');
const {
  DEFAULT_MEXC_BASE_URL,
  MIN_KLINE_LIMIT,
  buildMexcKlineUrl,
  fetchOhlcvRaw,
  fetchRequiredOhlcv
} = require('../src/market_data/mexc');

function createMockKline(openTime = 1764505860000) {
  return [
    openTime,
    '3000.0',
    '3010.0',
    '2990.0',
    '3005.0',
    '12345.0',
    openTime + 899999,
    '37000000.0'
  ];
}

describe('MEXC market data client', () => {
  it('builds the MEXC kline URL with the default .fm base URL', () => {
    const url = buildMexcKlineUrl({
      symbol: 'ETHUSDT',
      timeframe: '15m',
      limit: MIN_KLINE_LIMIT
    });

    assert.equal(
      url,
      `${DEFAULT_MEXC_BASE_URL}/api/v3/klines?symbol=ETHUSDT&interval=15m&limit=250`
    );
  });

  it('builds the MEXC kline URL for supported symbols and timeframes', () => {
    const url = buildMexcKlineUrl({
      baseUrl: 'https://api.mexc.fm',
      symbol: 'ETHUSDT',
      timeframe: '15m',
      limit: MIN_KLINE_LIMIT
    });

    assert.equal(
      url,
      'https://api.mexc.fm/api/v3/klines?symbol=ETHUSDT&interval=15m&limit=250'
    );
  });

  it('fetches raw OHLCV candles from a mocked exchange response', async () => {
    const calls = [];
    const fetchImpl = async (url) => {
      calls.push(url);
      return {
        ok: true,
        json: async () => [createMockKline()]
      };
    };

    const result = await fetchOhlcvRaw({
      baseUrl: 'https://api.mexc.fm',
      fetchImpl,
      symbol: 'SOLUSDT',
      timeframe: '5m'
    });

    assert.equal(result.exchange, 'mexc');
    assert.equal(result.symbol, 'SOLUSDT');
    assert.equal(result.timeframe, '5m');
    assert.equal(result.limit, 250);
    assert.deepEqual(result.raw, [createMockKline()]);
    assert.equal(calls.length, 1);
    assert.equal(calls[0], 'https://api.mexc.fm/api/v3/klines?symbol=SOLUSDT&interval=5m&limit=250');
  });

  it('fetches all MVP symbols for 15m and 5m', async () => {
    const requests = [];
    const fetchImpl = async (url) => {
      requests.push(url);
      return {
        ok: true,
        json: async () => [createMockKline()]
      };
    };

    const results = await fetchRequiredOhlcv({
      baseUrl: 'https://api.mexc.fm',
      fetchImpl
    });

    assert.equal(results.length, 6);
    assert.deepEqual(results.map((result) => `${result.symbol}:${result.timeframe}`), [
      'ETHUSDT:5m',
      'ETHUSDT:15m',
      'SOLUSDT:5m',
      'SOLUSDT:15m',
      'XRPUSDT:5m',
      'XRPUSDT:15m'
    ]);
    assert.equal(requests.length, 6);
  });

  it('fetches required OHLCV using default base URL with a mock fetch implementation', async () => {
    const requests = [];
    const fetchImpl = async (url) => {
      requests.push(url);
      return {
        ok: true,
        json: async () => [createMockKline()]
      };
    };

    const results = await fetchRequiredOhlcv({
      fetchImpl,
      symbols: ['ETHUSDT'],
      timeframes: ['15m']
    });

    assert.equal(results.length, 1);
    assert.equal(requests[0], `${DEFAULT_MEXC_BASE_URL}/api/v3/klines?symbol=ETHUSDT&interval=15m&limit=250`);
  });

  it('handles invalid base URL as a project dependency error', () => {
    assert.throws(
      () => buildMexcKlineUrl({
        baseUrl: 'not a url',
        symbol: 'ETHUSDT',
        timeframe: '15m',
        limit: MIN_KLINE_LIMIT
      }),
      (error) => {
        assert.equal(error instanceof DependencyError, true);
        assert.equal(error.message, 'Invalid MEXC base URL');
        return true;
      }
    );
  });

  it('handles fetch failure', async () => {
    await assert.rejects(
      () => fetchOhlcvRaw({
        baseUrl: 'https://api.mexc.fm',
        fetchImpl: async () => {
          throw new Error('network down');
        },
        symbol: 'ETHUSDT',
        timeframe: '15m'
      }),
      (error) => {
        assert.equal(error instanceof DependencyError, true);
        assert.equal(error.message, 'MEXC OHLCV request failed');
        assert.equal(error.details.cause, 'network down');
        return true;
      }
    );
  });

  it('handles non-OK exchange response', async () => {
    await assert.rejects(
      () => fetchOhlcvRaw({
        baseUrl: 'https://api.mexc.fm',
        fetchImpl: async () => ({
          ok: false,
          status: 503
        }),
        symbol: 'XRPUSDT',
        timeframe: '15m'
      }),
      (error) => {
        assert.equal(error instanceof DependencyError, true);
        assert.equal(error.message, 'MEXC OHLCV request returned non-OK status');
        assert.equal(error.details.status, 503);
        return true;
      }
    );
  });

  it('rejects unsupported symbols before calling fetch', async () => {
    await assert.rejects(
      () => fetchOhlcvRaw({
        baseUrl: 'https://api.mexc.fm',
        fetchImpl: async () => {
          throw new Error('should not be called');
        },
        symbol: 'BTCUSDT',
        timeframe: '15m'
      }),
      ValidationError
    );
  });
});
