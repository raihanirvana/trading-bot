const { evaluateBuySignal } = require('./buy');
const { evaluateDailyRules } = require('./daily-rules');
const { createSignalIdempotencyRegistry } = require('./idempotency');
const { buildSignal } = require('./schema');
const { evaluateSellSignal } = require('./sell');

function noSignal(reason, details = {}) {
  return {
    signal: null,
    reason,
    ...details
  };
}

function evaluateSignalCandidate(input) {
  const {
    adx15m,
    currentCandle,
    dailyOptions,
    dailyState,
    hasActivePosition = false,
    idempotencyRegistry = createSignalIdempotencyRegistry(),
    leverage,
    marginUsd,
    previousBandLevel,
    symbol,
    timeframe,
    timestamp
  } = input;
  const dailyDecision = evaluateDailyRules(dailyState, dailyOptions);

  if (!dailyDecision.allowed) {
    return noSignal(dailyDecision.reason, {
      dailyDecision
    });
  }

  const buyDecision = evaluateBuySignal({
    adx15m,
    currentCandle,
    previousBandLevel,
    hasActivePosition
  });
  const sellDecision = evaluateSellSignal({
    adx15m,
    currentCandle,
    previousBandLevel,
    hasActivePosition
  });

  if (buyDecision.shouldBuy && sellDecision.shouldSell) {
    return noSignal('Ambiguous signal: BUY and SELL both triggered', {
      buyDecision,
      sellDecision
    });
  }

  const side = buyDecision.shouldBuy ? 'BUY' : sellDecision.shouldSell ? 'SELL' : null;

  if (!side) {
    return noSignal('No signal triggered', {
      buyDecision,
      sellDecision
    });
  }

  const entryPrice = side === 'BUY' ? previousBandLevel.lowerPrev : previousBandLevel.upperPrev;
  const reasons = side === 'BUY' ? buyDecision.reasons : sellDecision.reasons;
  const signal = buildSignal({
    adx15m,
    bbWidthPct: previousBandLevel.bbWidthPrev,
    entryPrice,
    leverage,
    marginUsd,
    reasons,
    side,
    symbol,
    timeframe,
    timestamp
  });

  if (!signal) {
    return noSignal('Signal build failed');
  }

  const idempotency = idempotencyRegistry.remember(signal.signal_id);

  if (!idempotency.accepted) {
    return noSignal(idempotency.reason, {
      duplicate: idempotency.duplicate
    });
  }

  return {
    signal,
    reason: 'Signal emitted'
  };
}

module.exports = {
  evaluateSignalCandidate
};
