const { ValidationError } = require('../errors');
const { validateSignal } = require('../signals/schema');
const { sanitizeForAi } = require('./input-builder');

const POST_SL_INPUT_SCHEMA_VERSION = 'ai-post-sl-input-v1';
const POST_SL_TASK = 'POST_SL_REASONING';
const POST_SL_ANALYSIS_EVENT = 'POST_SL_ANALYSIS';
const LOSS_TYPES = Object.freeze([
  'TREND_CONTINUATION',
  'VOLATILITY_SPIKE',
  'BAD_ENTRY',
  'NOISE',
  'UNKNOWN'
]);

const FALLBACK_POST_SL_LABEL = Object.freeze({
  loss_type: 'UNKNOWN',
  confidence: 'LOW',
  reason: 'AI post-SL output invalid; fallback label used.',
  fallback: true
});

function buildPostSlPayload(options = {}) {
  const {
    afterCandles = [],
    beforeCandles = [],
    indicators = {},
    outcome,
    signal,
    state = {}
  } = options;

  validatePostSlInput({ afterCandles, beforeCandles, outcome, signal });

  return {
    schema_version: POST_SL_INPUT_SCHEMA_VERSION,
    task: POST_SL_TASK,
    signal: {
      signal_id: signal.signal_id,
      symbol: signal.symbol,
      timeframe: signal.timeframe,
      timestamp: signal.timestamp,
      side: signal.side,
      entry_price: signal.entry_price,
      tp_price: signal.tp_price,
      sl_price: signal.sl_price,
      margin_usd: signal.margin_usd,
      leverage: signal.leverage,
      reasons: [...signal.reasons]
    },
    sl_outcome: {
      status: outcome.status,
      exit_reason: outcome.exit_reason,
      exit_price: outcome.exit_price,
      exit_at: outcome.exit_at,
      candle: sanitizeCandle(outcome.candle)
    },
    indicators: sanitizeForAi(indicators),
    market_context: {
      before_candles: beforeCandles.map(sanitizeCandle),
      after_candles: afterCandles.map(sanitizeCandle)
    },
    state: sanitizeForAi(state),
    output_contract: {
      loss_type: LOSS_TYPES,
      confidence: ['LOW', 'MEDIUM', 'HIGH'],
      reason: 'short explanation'
    }
  };
}

function parsePostSlLossLabel(input) {
  const text = extractText(input);

  if (typeof text !== 'string' || text.trim() === '') {
    return fallbackPostSlLabel('Post-SL AI output empty');
  }

  let parsed;

  try {
    parsed = JSON.parse(text);
  } catch (_error) {
    return fallbackPostSlLabel('Post-SL AI output was not valid JSON');
  }

  const normalized = normalizePostSlLossLabel(parsed);

  if (!normalized.valid) {
    return fallbackPostSlLabel(normalized.reason);
  }

  return {
    ...normalized.value,
    fallback: false
  };
}

function savePostSlAnalysisToJournal(options = {}) {
  const {
    journal,
    label,
    payload,
    rawResponse = null,
    recordedAt
  } = options;

  if (!journal || typeof journal.saveEvent !== 'function') {
    throw new ValidationError('Journal with saveEvent is required for post-SL analysis');
  }

  return journal.saveEvent(buildPostSlAnalysisEvent({
    label,
    payload,
    rawResponse,
    recordedAt
  }));
}

function buildPostSlAnalysisEvent(options = {}) {
  const {
    label,
    payload,
    rawResponse = null,
    recordedAt = new Date()
  } = options;
  const signalId = payload?.signal?.signal_id;
  const createdAt = normalizeTimestamp(recordedAt);

  if (!signalId) {
    throw new ValidationError('Post-SL analysis event requires signal_id');
  }

  if (!label || !LOSS_TYPES.includes(label.loss_type)) {
    throw new ValidationError('Valid post-SL loss label is required');
  }

  return {
    event_id: `${signalId}-${POST_SL_ANALYSIS_EVENT}-${formatEventTimestamp(createdAt)}`,
    signal_id: signalId,
    event_type: POST_SL_ANALYSIS_EVENT,
    created_at: createdAt,
    payload: {
      signal_id: signalId,
      post_sl_payload: payload,
      raw_response: rawResponse,
      loss_label: label
    }
  };
}

function normalizePostSlLossLabel(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return invalidLabel('Post-SL output must be an object');
  }

  const lossType = value.loss_type;
  const confidence = value.confidence;
  const reason = normalizeReason(value.reason);

  if (!LOSS_TYPES.includes(lossType)) {
    return invalidLabel('Invalid post-SL loss_type');
  }

  if (!['LOW', 'MEDIUM', 'HIGH'].includes(confidence)) {
    return invalidLabel('Invalid post-SL confidence');
  }

  if (!reason) {
    return invalidLabel('Invalid post-SL reason');
  }

  return {
    valid: true,
    value: {
      loss_type: lossType,
      confidence,
      reason
    }
  };
}

function fallbackPostSlLabel(reason) {
  return {
    ...FALLBACK_POST_SL_LABEL,
    reason
  };
}

function extractText(input) {
  if (typeof input === 'string') {
    return input;
  }

  if (input && typeof input === 'object') {
    const content = input.choices?.[0]?.message?.content;

    if (typeof content === 'string') {
      return content;
    }
  }

  return null;
}

function validatePostSlInput({ afterCandles, beforeCandles, outcome, signal }) {
  const validation = validateSignal(signal);

  if (!validation.valid) {
    throw new ValidationError('Cannot build post-SL payload from invalid signal', {
      errors: validation.errors
    });
  }

  if (!outcome || outcome.status !== 'SL' || outcome.exit_reason !== 'VIRTUAL_SL') {
    throw new ValidationError('Post-SL payload requires an SL outcome');
  }

  if (!outcome.exit_at || Number.isNaN(new Date(outcome.exit_at).getTime())) {
    throw new ValidationError('Post-SL outcome exit_at is required');
  }

  validateCandles(beforeCandles, 'before_candles');
  validateCandles(afterCandles, 'after_candles');
}

function validateCandles(candles, label) {
  if (!Array.isArray(candles)) {
    throw new ValidationError(`${label} must be an array`);
  }

  candles.forEach((candle) => validateCandle(candle, label));
}

function sanitizeCandle(candle) {
  if (candle === null || candle === undefined) {
    return null;
  }

  validateCandle(candle, 'candle');

  return {
    timestamp: new Date(candle.timestamp).toISOString(),
    open: getFiniteOrNull(candle.open),
    high: getFiniteOrNull(candle.high),
    low: getFiniteOrNull(candle.low),
    close: getFiniteOrNull(candle.close),
    volume: getFiniteOrNull(candle.volume)
  };
}

function validateCandle(candle, label) {
  if (!candle || Number.isNaN(new Date(candle.timestamp).getTime())) {
    throw new ValidationError(`Invalid ${label} timestamp`);
  }

  if (!Number.isFinite(candle.high) || !Number.isFinite(candle.low)) {
    throw new ValidationError(`Invalid ${label} high/low`);
  }
}

function normalizeReason(reason) {
  if (typeof reason !== 'string') {
    return null;
  }

  const trimmed = reason.trim();

  return trimmed === '' ? null : trimmed;
}

function normalizeTimestamp(timestamp) {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    throw new ValidationError('Post-SL analysis timestamp is invalid');
  }

  return date.toISOString();
}

function formatEventTimestamp(timestamp) {
  return normalizeTimestamp(timestamp)
    .replaceAll('-', '')
    .replaceAll(':', '')
    .replace('.000', '');
}

function getFiniteOrNull(value) {
  return Number.isFinite(value) ? value : null;
}

function invalidLabel(reason) {
  return {
    valid: false,
    reason
  };
}

module.exports = {
  FALLBACK_POST_SL_LABEL,
  LOSS_TYPES,
  POST_SL_ANALYSIS_EVENT,
  POST_SL_INPUT_SCHEMA_VERSION,
  POST_SL_TASK,
  buildPostSlAnalysisEvent,
  buildPostSlPayload,
  fallbackPostSlLabel,
  parsePostSlLossLabel,
  savePostSlAnalysisToJournal
};
