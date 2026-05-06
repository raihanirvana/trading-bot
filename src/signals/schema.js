const { calculatePositionSize } = require('./position-sizing');
const { calculateTpSl } = require('./tp-sl');

const SIGNAL_STATUS = Object.freeze({
  NEW: 'NEW'
});

function isFinitePositiveNumber(value) {
  return Number.isFinite(value) && value > 0;
}

function formatSignalTimestamp(timestamp) {
  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString()
    .replaceAll('-', '')
    .replaceAll(':', '')
    .replace('.000', '');
}

function buildSignalId({ symbol, timeframe, timestamp, side }) {
  const formattedTimestamp = formatSignalTimestamp(timestamp);

  if (!symbol || !timeframe || !formattedTimestamp || !['BUY', 'SELL'].includes(side)) {
    return null;
  }

  return `${symbol}-${timeframe}-${formattedTimestamp}-${side}`;
}

function buildSignal(input) {
  const {
    adx15m,
    bbWidthPct,
    entryPrice,
    leverage,
    marginUsd,
    reasons = [],
    side,
    symbol,
    timeframe,
    timestamp
  } = input;

  const signalId = buildSignalId({
    symbol,
    timeframe,
    timestamp,
    side
  });
  const tpSl = calculateTpSl({
    side,
    entryPrice
  });
  const positionSize = calculatePositionSize({
    marginUsd,
    leverage,
    price: entryPrice
  });

  if (!signalId || !tpSl || !positionSize || !Number.isFinite(bbWidthPct) || !Number.isFinite(adx15m) || !Array.isArray(reasons)) {
    return null;
  }

  return {
    signal_id: signalId,
    symbol,
    side,
    entry_price: entryPrice,
    tp_price: tpSl.tpPrice,
    sl_price: tpSl.slPrice,
    margin_usd: marginUsd,
    leverage,
    notional_usd: positionSize.notionalUsd,
    qty: positionSize.qty,
    bb_width_pct: bbWidthPct,
    adx_15m: adx15m,
    status: SIGNAL_STATUS.NEW,
    timeframe,
    timestamp,
    reasons
  };
}

function validateSignal(signal) {
  const missing = [];

  for (const field of [
    'signal_id',
    'symbol',
    'side',
    'entry_price',
    'tp_price',
    'sl_price',
    'margin_usd',
    'leverage',
    'notional_usd',
    'bb_width_pct',
    'adx_15m',
    'status',
    'reasons'
  ]) {
    if (signal == null || signal[field] === undefined || signal[field] === null) {
      missing.push(field);
    }
  }

  if (missing.length > 0) {
    return {
      valid: false,
      errors: missing.map((field) => `Missing required field: ${field}`)
    };
  }

  const errors = [];

  if (!['BUY', 'SELL'].includes(signal.side)) {
    errors.push('Invalid side');
  }

  for (const field of ['entry_price', 'tp_price', 'sl_price', 'margin_usd', 'leverage', 'notional_usd']) {
    if (!isFinitePositiveNumber(signal[field])) {
      errors.push(`Invalid positive number: ${field}`);
    }
  }

  if (!Number.isFinite(signal.bb_width_pct)) {
    errors.push('Invalid number: bb_width_pct');
  }

  if (!Number.isFinite(signal.adx_15m)) {
    errors.push('Invalid number: adx_15m');
  }

  if (signal.status !== SIGNAL_STATUS.NEW) {
    errors.push('Invalid status');
  }

  if (!Array.isArray(signal.reasons)) {
    errors.push('Invalid reasons');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

module.exports = {
  SIGNAL_STATUS,
  buildSignal,
  buildSignalId,
  formatSignalTimestamp,
  validateSignal
};
