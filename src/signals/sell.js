const { evaluateAntiBandWalk, evaluateBbWidthMinimum } = require('./filters');

function isFiniteNumber(value) {
  return Number.isFinite(value);
}

function evaluateSellSignal({ adx15m, currentCandle, previousBandLevel, hasActivePosition = false }) {
  const reasons = [];

  if (hasActivePosition) {
    reasons.push('Active position exists');
  }

  if (!currentCandle || !isFiniteNumber(currentCandle.high)) {
    reasons.push('Invalid current candle high');
  }

  if (!previousBandLevel || !isFiniteNumber(previousBandLevel.upperPrev)) {
    reasons.push('Missing upper previous band');
  }

  const bbWidthFilter = evaluateBbWidthMinimum(previousBandLevel && previousBandLevel.bbWidthPrev);

  if (!bbWidthFilter.allowed) {
    reasons.push(bbWidthFilter.reason);
  }

  if (previousBandLevel && previousBandLevel.bbWidthPrev > 2.5) {
    const antiBandWalkFilter = evaluateAntiBandWalk({
      bbWidthPct: previousBandLevel.bbWidthPrev,
      adx: adx15m
    });

    if (!antiBandWalkFilter.allowed) {
      reasons.push(antiBandWalkFilter.reason);
    }
  }

  if (reasons.length > 0) {
    return {
      shouldSell: false,
      reasons
    };
  }

  if (currentCandle.high >= previousBandLevel.upperPrev) {
    return {
      shouldSell: true,
      reasons: ['Touched upper previous band']
    };
  }

  return {
    shouldSell: false,
    reasons: ['High did not touch upper previous band']
  };
}

module.exports = {
  evaluateSellSignal
};
