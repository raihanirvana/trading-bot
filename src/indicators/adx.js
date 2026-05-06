const DEFAULT_ADX_LENGTH = 14;

function isFiniteNumber(value) {
  return Number.isFinite(value);
}

function isValidCandle(candle) {
  return candle
    && isFiniteNumber(candle.high)
    && isFiniteNumber(candle.low)
    && isFiniteNumber(candle.close);
}

function calculateTrueRange(current, previous) {
  return Math.max(
    current.high - current.low,
    Math.abs(current.high - previous.close),
    Math.abs(current.low - previous.close)
  );
}

function calculateDirectionalMovement(current, previous) {
  const upMove = current.high - previous.high;
  const downMove = previous.low - current.low;

  return {
    plusDm: upMove > downMove && upMove > 0 ? upMove : 0,
    minusDm: downMove > upMove && downMove > 0 ? downMove : 0
  };
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

function calculateAdx(candles, options = {}) {
  const length = options.length || DEFAULT_ADX_LENGTH;

  if (!Array.isArray(candles) || candles.length < ((length * 2) + 1) || candles.some((candle) => !isValidCandle(candle))) {
    return null;
  }

  const trueRanges = [];
  const plusDms = [];
  const minusDms = [];

  for (let index = 1; index < candles.length; index += 1) {
    const current = candles[index];
    const previous = candles[index - 1];
    const directionalMovement = calculateDirectionalMovement(current, previous);

    trueRanges.push(calculateTrueRange(current, previous));
    plusDms.push(directionalMovement.plusDm);
    minusDms.push(directionalMovement.minusDm);
  }

  let smoothedTr = sum(trueRanges.slice(0, length));
  let smoothedPlusDm = sum(plusDms.slice(0, length));
  let smoothedMinusDm = sum(minusDms.slice(0, length));
  const dxValues = [];

  for (let index = length; index < trueRanges.length; index += 1) {
    smoothedTr = smoothedTr - (smoothedTr / length) + trueRanges[index];
    smoothedPlusDm = smoothedPlusDm - (smoothedPlusDm / length) + plusDms[index];
    smoothedMinusDm = smoothedMinusDm - (smoothedMinusDm / length) + minusDms[index];

    if (smoothedTr === 0) {
      dxValues.push(0);
      continue;
    }

    const plusDi = (smoothedPlusDm / smoothedTr) * 100;
    const minusDi = (smoothedMinusDm / smoothedTr) * 100;
    const directionalSum = plusDi + minusDi;

    dxValues.push(directionalSum === 0 ? 0 : (Math.abs(plusDi - minusDi) / directionalSum) * 100);
  }

  if (dxValues.length < length) {
    return null;
  }

  return sum(dxValues.slice(0, length)) / length;
}

function calculateAdxSeries(candles, options = {}) {
  if (!Array.isArray(candles)) {
    return [];
  }

  return candles.map((_, index) => calculateAdx(candles.slice(0, index + 1), options));
}

module.exports = {
  DEFAULT_ADX_LENGTH,
  calculateAdx,
  calculateAdxSeries,
  calculateDirectionalMovement,
  calculateTrueRange
};
