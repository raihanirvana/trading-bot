const { ValidationError } = require('../errors');
const { validateSignal } = require('../signals/schema');

const VIRTUAL_OUTCOME = Object.freeze({
  OPEN: 'OPEN',
  TP: 'TP',
  SL: 'SL'
});

function trackVirtualOutcome(options = {}) {
  const {
    candles,
    journal,
    signal
  } = options;

  const outcome = evaluateVirtualOutcome({
    candles,
    signal
  });

  if (outcome.status === VIRTUAL_OUTCOME.OPEN || !journal) {
    return {
      outcome,
      eventResult: null
    };
  }

  const eventResult = journal.saveEvent(buildVirtualOutcomeEvent(signal, outcome));

  return {
    outcome,
    eventResult
  };
}

function evaluateVirtualOutcome({ signal, candles }) {
  validateVirtualOutcomeInput(signal, candles);

  const signalTimestampMs = new Date(signal.timestamp).getTime();
  const subsequentCandles = candles
    .filter((candle) => new Date(candle.timestamp).getTime() > signalTimestampMs)
    .sort((left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime());

  for (const candle of subsequentCandles) {
    const candleOutcome = evaluateCandleOutcome(signal, candle);

    if (candleOutcome.status !== VIRTUAL_OUTCOME.OPEN) {
      return candleOutcome;
    }
  }

  return {
    status: VIRTUAL_OUTCOME.OPEN,
    exit_reason: null,
    exit_price: null,
    exit_at: null,
    candle: null
  };
}

function evaluateCandleOutcome(signal, candle) {
  validateCandle(candle);

  if (signal.side === 'BUY') {
    const tpHit = candle.high >= signal.tp_price;
    const slHit = candle.low <= signal.sl_price;

    return resolveHit({
      candle,
      slHit,
      slPrice: signal.sl_price,
      tpHit,
      tpPrice: signal.tp_price
    });
  }

  const tpHit = candle.low <= signal.tp_price;
  const slHit = candle.high >= signal.sl_price;

  return resolveHit({
    candle,
    slHit,
    slPrice: signal.sl_price,
    tpHit,
    tpPrice: signal.tp_price
  });
}

function resolveHit({ candle, slHit, slPrice, tpHit, tpPrice }) {
  if (slHit) {
    return {
      status: VIRTUAL_OUTCOME.SL,
      exit_reason: 'VIRTUAL_SL',
      exit_price: slPrice,
      exit_at: candle.timestamp,
      candle
    };
  }

  if (tpHit) {
    return {
      status: VIRTUAL_OUTCOME.TP,
      exit_reason: 'VIRTUAL_TP',
      exit_price: tpPrice,
      exit_at: candle.timestamp,
      candle
    };
  }

  return {
    status: VIRTUAL_OUTCOME.OPEN,
    exit_reason: null,
    exit_price: null,
    exit_at: null,
    candle
  };
}

function buildVirtualOutcomeEvent(signal, outcome) {
  if (outcome.status === VIRTUAL_OUTCOME.OPEN) {
    throw new ValidationError('Open virtual outcome does not create a journal event');
  }

  return {
    event_id: `${signal.signal_id}-${outcome.exit_reason}-${formatEventTimestamp(outcome.exit_at)}`,
    signal_id: signal.signal_id,
    event_type: outcome.exit_reason,
    created_at: outcome.exit_at,
    payload: {
      signal_id: signal.signal_id,
      status: outcome.status,
      exit_reason: outcome.exit_reason,
      exit_price: outcome.exit_price,
      exit_at: outcome.exit_at
    }
  };
}

function formatEventTimestamp(timestamp) {
  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    throw new ValidationError('Virtual outcome timestamp is invalid');
  }

  return date.toISOString()
    .replaceAll('-', '')
    .replaceAll(':', '')
    .replace('.000', '');
}

function validateVirtualOutcomeInput(signal, candles) {
  const validation = validateSignal(signal);

  if (!validation.valid) {
    throw new ValidationError('Cannot track invalid signal outcome', {
      errors: validation.errors
    });
  }

  if (!signal.timestamp || Number.isNaN(new Date(signal.timestamp).getTime())) {
    throw new ValidationError('Signal timestamp is required for virtual outcome tracking');
  }

  if (!Array.isArray(candles)) {
    throw new ValidationError('Candles array is required for virtual outcome tracking');
  }
}

function validateCandle(candle) {
  if (
    !candle ||
    Number.isNaN(new Date(candle.timestamp).getTime()) ||
    !Number.isFinite(candle.high) ||
    !Number.isFinite(candle.low)
  ) {
    throw new ValidationError('Invalid candle for virtual outcome tracking');
  }
}

module.exports = {
  VIRTUAL_OUTCOME,
  buildVirtualOutcomeEvent,
  evaluateCandleOutcome,
  evaluateVirtualOutcome,
  trackVirtualOutcome
};
