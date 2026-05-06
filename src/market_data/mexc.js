const { DependencyError, ValidationError } = require('../errors');

const MEXC_KLINE_PATH = '/api/v3/klines';
const DEFAULT_MEXC_BASE_URL = 'https://api.mexc.fm';
const MIN_KLINE_LIMIT = 250;
const MAX_KLINE_LIMIT = 1000;
const SUPPORTED_SYMBOLS = Object.freeze(['ETHUSDT', 'SOLUSDT', 'XRPUSDT']);
const SUPPORTED_TIMEFRAMES = Object.freeze(['5m', '15m']);

function validateOhlcvRequest({ symbol, timeframe, limit }) {
  if (!SUPPORTED_SYMBOLS.includes(symbol)) {
    throw new ValidationError('Unsupported market data symbol', {
      symbol,
      supportedSymbols: SUPPORTED_SYMBOLS
    });
  }

  if (!SUPPORTED_TIMEFRAMES.includes(timeframe)) {
    throw new ValidationError('Unsupported market data timeframe', {
      timeframe,
      supportedTimeframes: SUPPORTED_TIMEFRAMES
    });
  }

  if (!Number.isInteger(limit) || limit < MIN_KLINE_LIMIT || limit > MAX_KLINE_LIMIT) {
    throw new ValidationError('Invalid market data limit', {
      limit,
      min: MIN_KLINE_LIMIT,
      max: MAX_KLINE_LIMIT
    });
  }
}

function buildMexcKlineUrl({ baseUrl, symbol, timeframe, limit = MIN_KLINE_LIMIT }) {
  validateOhlcvRequest({ symbol, timeframe, limit });

  let url;

  try {
    url = new URL(MEXC_KLINE_PATH, baseUrl || DEFAULT_MEXC_BASE_URL);
  } catch (error) {
    throw new DependencyError('Invalid MEXC base URL', {
      baseUrl,
      cause: error.message
    });
  }

  url.searchParams.set('symbol', symbol);
  url.searchParams.set('interval', timeframe);
  url.searchParams.set('limit', String(limit));

  return url.toString();
}

function validateMexcKlinePayload(payload) {
  if (!Array.isArray(payload)) {
    throw new DependencyError('MEXC kline response is not an array');
  }

  for (const row of payload) {
    if (!Array.isArray(row) || row.length < 8) {
      throw new DependencyError('MEXC kline row has invalid shape');
    }
  }
}

async function fetchOhlcvRaw(options) {
  const {
    baseUrl = DEFAULT_MEXC_BASE_URL,
    fetchImpl = globalThis.fetch,
    limit = MIN_KLINE_LIMIT,
    symbol,
    timeframe
  } = options;

  if (typeof fetchImpl !== 'function') {
    throw new DependencyError('Fetch implementation is unavailable');
  }

  const url = buildMexcKlineUrl({
    baseUrl,
    symbol,
    timeframe,
    limit
  });

  let response;

  try {
    response = await fetchImpl(url);
  } catch (error) {
    throw new DependencyError('MEXC OHLCV request failed', {
      cause: error.message,
      symbol,
      timeframe
    });
  }

  if (!response.ok) {
    throw new DependencyError('MEXC OHLCV request returned non-OK status', {
      status: response.status,
      symbol,
      timeframe
    });
  }

  const payload = await response.json();
  validateMexcKlinePayload(payload);

  return {
    exchange: 'mexc',
    symbol,
    timeframe,
    limit,
    raw: payload
  };
}

async function fetchRequiredOhlcv(options = {}) {
  const {
    baseUrl = DEFAULT_MEXC_BASE_URL,
    fetchImpl,
    limit = MIN_KLINE_LIMIT,
    symbols = SUPPORTED_SYMBOLS,
    timeframes = SUPPORTED_TIMEFRAMES
  } = options;
  const results = [];

  for (const symbol of symbols) {
    for (const timeframe of timeframes) {
      results.push(await fetchOhlcvRaw({
        baseUrl,
        fetchImpl,
        limit,
        symbol,
        timeframe
      }));
    }
  }

  return results;
}

module.exports = {
  DEFAULT_MEXC_BASE_URL,
  MAX_KLINE_LIMIT,
  MIN_KLINE_LIMIT,
  SUPPORTED_SYMBOLS,
  SUPPORTED_TIMEFRAMES,
  buildMexcKlineUrl,
  fetchOhlcvRaw,
  fetchRequiredOhlcv,
  validateMexcKlinePayload,
  validateOhlcvRequest
};
