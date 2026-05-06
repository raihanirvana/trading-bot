const { calculateBbWidthPct } = require('../indicators/bollinger');

function getPreviousBandLevel(bollingerBands, currentIndex) {
  if (!Array.isArray(bollingerBands) || !Number.isInteger(currentIndex) || currentIndex <= 0) {
    return null;
  }

  const previousBand = bollingerBands[currentIndex - 1];

  if (!previousBand) {
    return null;
  }

  const bbWidthPrev = calculateBbWidthPct({
    upper: previousBand.upper,
    lower: previousBand.lower,
    basis: previousBand.basis
  });

  if (bbWidthPrev === null) {
    return null;
  }

  return {
    upperPrev: previousBand.upper,
    lowerPrev: previousBand.lower,
    bbWidthPrev,
    sourceIndex: currentIndex - 1
  };
}

function getLatestPreviousBandLevel(bollingerBands) {
  if (!Array.isArray(bollingerBands) || bollingerBands.length === 0) {
    return null;
  }

  return getPreviousBandLevel(bollingerBands, bollingerBands.length - 1);
}

module.exports = {
  getLatestPreviousBandLevel,
  getPreviousBandLevel
};
