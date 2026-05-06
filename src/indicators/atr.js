const { calculateTrueRange } = require('./adx');

const DEFAULT_ATR_LENGTH = 14;

function isFiniteNumber(value) {
  return Number.isFinite(value);
}

function isValidCandle(candle) {
  return candle
    && isFiniteNumber(candle.high)
    && isFiniteNumber(candle.low)
    && isFiniteNumber(candle.close);
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

function calculateTrueRanges(candles) {
  if (!Array.isArray(candles) || candles.length < 2 || candles.some((candle) => !isValidCandle(candle))) {
    return [];
  }

  const trueRanges = [];

  for (let index = 1; index < candles.length; index += 1) {
    trueRanges.push(calculateTrueRange(candles[index], candles[index - 1]));
  }

  return trueRanges;
}

function calculateAtrSeries(candles, options = {}) {
  const length = options.length || DEFAULT_ATR_LENGTH;

  if (!Array.isArray(candles)) {
    return [];
  }

  const output = Array.from({ length: candles.length }, () => null);

  if (!Number.isInteger(length) || length <= 0 || candles.length < length + 1 || candles.some((candle) => !isValidCandle(candle))) {
    return output;
  }

  const trueRanges = calculateTrueRanges(candles);
  let previousAtr = sum(trueRanges.slice(0, length)) / length;
  output[length] = previousAtr;

  for (let index = length + 1; index < candles.length; index += 1) {
    const trueRange = trueRanges[index - 1];
    previousAtr = ((previousAtr * (length - 1)) + trueRange) / length;
    output[index] = previousAtr;
  }

  return output;
}

function calculateAtr(candles, options = {}) {
  const series = calculateAtrSeries(candles, options);

  if (series.length === 0) {
    return null;
  }

  return series[series.length - 1];
}

function calculateAtrPct({ atr, close }) {
  if (!isFiniteNumber(atr) || !isFiniteNumber(close) || close === 0) {
    return null;
  }

  return (atr / close) * 100;
}

module.exports = {
  DEFAULT_ATR_LENGTH,
  calculateAtr,
  calculateAtrPct,
  calculateAtrSeries,
  calculateTrueRanges
};
