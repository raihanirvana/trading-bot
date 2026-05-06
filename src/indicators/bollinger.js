const DEFAULT_BB_LENGTH = 20;
const DEFAULT_BB_DEVIATION = 3.5;

function isFiniteNumber(value) {
  return Number.isFinite(value);
}

function calculateSma(values) {
  if (!Array.isArray(values) || values.length === 0 || values.some((value) => !isFiniteNumber(value))) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function calculateStandardDeviation(values, mean) {
  if (!Array.isArray(values) || values.length === 0 || !isFiniteNumber(mean)) {
    return null;
  }

  const variance = values.reduce((sum, value) => (
    sum + ((value - mean) ** 2)
  ), 0) / values.length;

  return Math.sqrt(variance);
}

function calculateBollingerBand(values, options = {}) {
  const length = options.length || DEFAULT_BB_LENGTH;
  const deviation = options.deviation || DEFAULT_BB_DEVIATION;

  if (!Array.isArray(values) || values.length < length) {
    return null;
  }

  const window = values.slice(-length);
  const basis = calculateSma(window);

  if (basis === null) {
    return null;
  }

  const standardDeviation = calculateStandardDeviation(window, basis);

  if (standardDeviation === null) {
    return null;
  }

  return {
    basis,
    upper: basis + (standardDeviation * deviation),
    lower: basis - (standardDeviation * deviation),
    length,
    deviation
  };
}

function calculateBollingerBands(values, options = {}) {
  if (!Array.isArray(values)) {
    return [];
  }

  return values.map((_, index) => calculateBollingerBand(values.slice(0, index + 1), options));
}

function calculateBbWidthPct({ upper, lower, basis }) {
  if (![upper, lower, basis].every(isFiniteNumber) || basis === 0) {
    return null;
  }

  return ((upper - lower) / basis) * 100;
}

module.exports = {
  DEFAULT_BB_DEVIATION,
  DEFAULT_BB_LENGTH,
  calculateBbWidthPct,
  calculateBollingerBand,
  calculateBollingerBands,
  calculateSma,
  calculateStandardDeviation
};
