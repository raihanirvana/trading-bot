const { MIN_BB_WIDTH_PCT, evaluateAntiBandWalk, evaluateBbWidthMinimum } = require('./filters');

function isFiniteNumber(value) {
  return Number.isFinite(value);
}

function evaluateBuySignal({ adx15m, currentCandle, previousBandLevel, hasActivePosition = false }) {
  const reasons = [];

  if (hasActivePosition) {
    reasons.push('Active position exists');
  }

  if (!currentCandle || !isFiniteNumber(currentCandle.low)) {
    reasons.push('Invalid current candle low');
  }

  if (!previousBandLevel || !isFiniteNumber(previousBandLevel.lowerPrev)) {
    reasons.push('Missing lower previous band');
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
      shouldBuy: false,
      reasons
    };
  }

  if (currentCandle.low <= previousBandLevel.lowerPrev) {
    return {
      shouldBuy: true,
      reasons: ['Touched lower previous band']
    };
  }

  return {
    shouldBuy: false,
    reasons: ['Low did not touch lower previous band']
  };
}

module.exports = {
  MIN_BB_WIDTH_PCT,
  evaluateBuySignal
};
