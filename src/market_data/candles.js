const { DependencyError } = require('../errors');

function toFiniteNumber(value, fieldName) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    throw new DependencyError('Invalid candle numeric value', {
      field: fieldName,
      value
    });
  }

  return numberValue;
}

function normalizeMexcKlineRow(row, { symbol, timeframe }) {
  if (!Array.isArray(row) || row.length < 6) {
    throw new DependencyError('Invalid MEXC kline row');
  }

  return {
    symbol,
    timeframe,
    timestamp: new Date(toFiniteNumber(row[0], 'timestamp')).toISOString(),
    open: toFiniteNumber(row[1], 'open'),
    high: toFiniteNumber(row[2], 'high'),
    low: toFiniteNumber(row[3], 'low'),
    close: toFiniteNumber(row[4], 'close'),
    volume: toFiniteNumber(row[5], 'volume')
  };
}

function normalizeCandles(rawRows, metadata) {
  if (!Array.isArray(rawRows)) {
    throw new DependencyError('Raw candle payload must be an array');
  }

  const byTimestamp = new Map();

  for (const row of rawRows) {
    const candle = normalizeMexcKlineRow(row, metadata);
    byTimestamp.set(candle.timestamp, candle);
  }

  return [...byTimestamp.values()].sort((left, right) => (
    new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime()
  ));
}

function normalizeOhlcvResult(result) {
  return normalizeCandles(result.raw, {
    symbol: result.symbol,
    timeframe: result.timeframe
  });
}

module.exports = {
  normalizeCandles,
  normalizeMexcKlineRow,
  normalizeOhlcvResult
};
