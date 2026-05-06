const DEFAULT_EMA_PERIOD = 200;

function isFiniteNumber(value) {
  return Number.isFinite(value);
}

function calculateSma(values) {
  if (!Array.isArray(values) || values.length === 0 || values.some((value) => !isFiniteNumber(value))) {
    return null;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
}

function calculateEmaSeries(values, options = {}) {
  const period = options.period || DEFAULT_EMA_PERIOD;

  if (!Array.isArray(values)) {
    return [];
  }

  if (!Number.isInteger(period) || period <= 0 || values.some((value) => !isFiniteNumber(value))) {
    return values.map(() => null);
  }

  const output = Array.from({ length: values.length }, () => null);

  if (values.length < period) {
    return output;
  }

  const multiplier = 2 / (period + 1);
  let previousEma = calculateSma(values.slice(0, period));

  output[period - 1] = previousEma;

  for (let index = period; index < values.length; index += 1) {
    previousEma = (values[index] * multiplier) + (previousEma * (1 - multiplier));
    output[index] = previousEma;
  }

  return output;
}

function calculateEma(values, options = {}) {
  const series = calculateEmaSeries(values, options);

  if (series.length === 0) {
    return null;
  }

  return series[series.length - 1];
}

module.exports = {
  DEFAULT_EMA_PERIOD,
  calculateEma,
  calculateEmaSeries
};
