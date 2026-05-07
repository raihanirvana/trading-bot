const { ValidationError } = require('../errors');
const { validateSignal } = require('../signals/schema');

const AI_INPUT_SCHEMA_VERSION = 'ai-risk-input-v1';
const SECRET_KEY_PATTERN = /(secret|token|password|api_?key|private_?key)/i;

function buildAiRiskInput(options = {}) {
  const {
    indicators = {},
    signal,
    state = {}
  } = options;

  validateAiInputSignal(signal);

  const sanitizedIndicators = sanitizeForAi(indicators);
  const sanitizedState = sanitizeForAi(state);

  return {
    schema_version: AI_INPUT_SCHEMA_VERSION,
    task: 'RISK_CLASSIFICATION',
    signal: buildSignalContext(signal),
    indicators: buildIndicatorContext(sanitizedIndicators),
    state: buildStateContext(sanitizedState),
    hard_rules: buildHardRuleContext(signal, sanitizedIndicators, sanitizedState),
    output_contract: {
      market_type: ['MEAN_REVERSION', 'TRENDING_RISK', 'NOISE'],
      risk_level: ['LOW', 'MEDIUM', 'HIGH'],
      action: ['ALLOW', 'REDUCE_SIZE', 'BLOCK'],
      size_multiplier: [1, 0.5, 0],
      reason: 'short explanation'
    }
  };
}

function buildSignalContext(signal) {
  return {
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
    notional_usd: signal.notional_usd,
    qty: signal.qty,
    reasons: [...signal.reasons]
  };
}

function buildIndicatorContext(indicators) {
  return {
    bb_width_pct: getFiniteOrNull(indicators.bb_width_pct),
    adx_15m: getFiniteOrNull(indicators.adx_15m),
    ema200: getFiniteOrNull(indicators.ema200),
    atr_pct: getFiniteOrNull(indicators.atr_pct),
    relative_volume: getFiniteOrNull(indicators.relative_volume),
    setup_against_ema200: indicators.setup_against_ema200 === true
  };
}

function buildStateContext(state) {
  return {
    has_active_position: state.has_active_position === true,
    daily_pnl_usd: getFiniteOrZero(state.daily_pnl_usd),
    daily_target_hit: state.daily_target_hit === true,
    daily_loss_hit: state.daily_loss_hit === true,
    consecutive_losses: Number.isInteger(state.consecutive_losses) ? state.consecutive_losses : 0,
    open_positions_count: Number.isInteger(state.open_positions_count) ? state.open_positions_count : 0,
    recent_outcomes: Array.isArray(state.recent_outcomes) ? state.recent_outcomes.map(sanitizeForAi) : []
  };
}

function buildHardRuleContext(signal, indicators, state) {
  const bbWidthPct = getFiniteOrNull(indicators.bb_width_pct);
  const adx15m = getFiniteOrNull(indicators.adx_15m);

  return {
    bb_width_minimum_block: bbWidthPct !== null && bbWidthPct < 0.6,
    anti_band_walk_block: bbWidthPct !== null && adx15m !== null && bbWidthPct > 2.5 && adx15m > 35,
    daily_target_block: state.daily_target_hit === true,
    daily_loss_block: state.daily_loss_hit === true,
    active_position_block: state.has_active_position === true,
    setup_against_ema200_risk_floor: indicators.setup_against_ema200 === true,
    adx_15m_risk_floor: adx15m !== null && adx15m >= 30,
    immutable_trade_terms: {
      side: signal.side,
      entry_price: signal.entry_price,
      tp_price: signal.tp_price,
      sl_price: signal.sl_price,
      margin_usd: signal.margin_usd,
      leverage: signal.leverage
    }
  };
}

function sanitizeForAi(value) {
  if (Array.isArray(value)) {
    return value.map(sanitizeForAi);
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !SECRET_KEY_PATTERN.test(key))
      .map(([key, nestedValue]) => [key, sanitizeForAi(nestedValue)])
  );
}

function validateAiInputSignal(signal) {
  const validation = validateSignal(signal);

  if (!validation.valid) {
    throw new ValidationError('Cannot build AI input from invalid signal', {
      errors: validation.errors
    });
  }

  if (!signal.timestamp || Number.isNaN(new Date(signal.timestamp).getTime())) {
    throw new ValidationError('Signal timestamp is required for AI input');
  }
}

function getFiniteOrNull(value) {
  return Number.isFinite(value) ? value : null;
}

function getFiniteOrZero(value) {
  return Number.isFinite(value) ? value : 0;
}

module.exports = {
  AI_INPUT_SCHEMA_VERSION,
  buildAiRiskInput,
  sanitizeForAi
};
