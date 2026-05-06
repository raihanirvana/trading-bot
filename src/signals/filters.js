const MIN_BB_WIDTH_PCT = 0.6;
const BAND_WALK_BB_WIDTH_PCT = 2.5;
const BAND_WALK_ADX = 35;

function evaluateBbWidthMinimum(bbWidthPct, minimum = MIN_BB_WIDTH_PCT) {
  if (!Number.isFinite(bbWidthPct)) {
    return {
      allowed: false,
      reason: 'BB width unavailable'
    };
  }

  if (bbWidthPct < minimum) {
    return {
      allowed: false,
      reason: 'BB width below minimum'
    };
  }

  return {
    allowed: true,
    reason: 'BB width allowed'
  };
}

function evaluateAntiBandWalk({ bbWidthPct, adx }) {
  if (!Number.isFinite(bbWidthPct) || !Number.isFinite(adx)) {
    return {
      allowed: false,
      reason: 'Anti-band-walk inputs unavailable'
    };
  }

  if (bbWidthPct > BAND_WALK_BB_WIDTH_PCT && adx > BAND_WALK_ADX) {
    return {
      allowed: false,
      reason: 'Anti-band-walk blocked trending market'
    };
  }

  return {
    allowed: true,
    reason: 'Anti-band-walk allowed'
  };
}

module.exports = {
  BAND_WALK_ADX,
  BAND_WALK_BB_WIDTH_PCT,
  MIN_BB_WIDTH_PCT,
  evaluateAntiBandWalk,
  evaluateBbWidthMinimum
};
