const DEFAULT_TP_SL_PCT = 0.4;

function isFinitePositiveNumber(value) {
  return Number.isFinite(value) && value > 0;
}

function calculateTpSl({ side, entryPrice, percent = DEFAULT_TP_SL_PCT }) {
  if (!['BUY', 'SELL'].includes(side) || !isFinitePositiveNumber(entryPrice) || !isFinitePositiveNumber(percent)) {
    return null;
  }

  const multiplier = percent / 100;

  if (side === 'BUY') {
    return {
      tpPrice: entryPrice * (1 + multiplier),
      slPrice: entryPrice * (1 - multiplier)
    };
  }

  return {
    tpPrice: entryPrice * (1 - multiplier),
    slPrice: entryPrice * (1 + multiplier)
  };
}

module.exports = {
  DEFAULT_TP_SL_PCT,
  calculateTpSl
};
