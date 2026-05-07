const { ValidationError } = require('../errors');
const { applyHardRuleOverride } = require('./hard-rule-override');
const { parseAiRiskDecision } = require('./output-parser');
const { buildAiRiskClassifierMessages } = require('./prompt');

const AI_FALLBACK_MODES = Object.freeze(['rule_based', 'skip']);
const DEFAULT_AI_FALLBACK_MODE = 'rule_based';

async function classifyAiRiskWithFallback(options = {}) {
  const {
    aiClient,
    aiInput,
    config = {},
    messages = buildAiRiskClassifierMessages(aiInput)
  } = options;

  validateAiClassificationInput({ aiClient, aiInput, messages });

  const fallbackMode = normalizeAiFallbackMode(config.aiFallbackMode);

  try {
    const rawResponse = await aiClient.createChatCompletion({ messages });
    const parsedDecision = parseAiRiskDecision(rawResponse);

    if (parsedDecision.fallback === true) {
      return buildFallbackResult({
        aiInput,
        fallbackMode,
        parsedDecision,
        rawResponse,
        reason: parsedDecision.reason
      });
    }

    return {
      ai_input: aiInput,
      raw_response: rawResponse,
      parsed_decision: parsedDecision,
      final_decision: applyHardRuleOverride({
        aiDecision: parsedDecision,
        hardRules: aiInput.hard_rules
      }),
      fallback_used: false,
      fallback_mode: null
    };
  } catch (error) {
    return buildFallbackResult({
      aiInput,
      error,
      fallbackMode,
      parsedDecision: null,
      rawResponse: null,
      reason: `AI request failed: ${error.message}`
    });
  }
}

function buildFallbackResult(options = {}) {
  const {
    aiInput,
    error = null,
    fallbackMode = DEFAULT_AI_FALLBACK_MODE,
    parsedDecision = null,
    rawResponse = null,
    reason = 'AI unavailable'
  } = options;
  const finalDecision = resolveAiFallbackDecision({
    aiInput,
    mode: fallbackMode,
    reason
  });

  return {
    ai_input: aiInput,
    raw_response: rawResponse,
    parsed_decision: parsedDecision,
    final_decision: finalDecision,
    fallback_used: true,
    fallback_mode: fallbackMode,
    fallback_reason: reason,
    error: error
      ? {
          name: error.name,
          message: error.message,
          code: error.code || null
        }
      : null
  };
}

function resolveAiFallbackDecision(options = {}) {
  const {
    aiInput,
    mode = DEFAULT_AI_FALLBACK_MODE,
    reason = 'AI unavailable'
  } = options;
  const normalizedMode = normalizeAiFallbackMode(mode);

  if (normalizedMode === 'skip') {
    return buildSkipFallbackDecision(reason);
  }

  return buildRuleBasedFallbackDecision({ aiInput, reason });
}

function buildRuleBasedFallbackDecision(options = {}) {
  const {
    aiInput,
    reason = 'AI unavailable; rule-based fallback used.'
  } = options;
  const baseDecision = buildBaseRuleBasedDecision(aiInput, reason);

  return applyHardRuleOverride({
    aiDecision: baseDecision,
    hardRules: aiInput?.hard_rules
  });
}

function buildBaseRuleBasedDecision(aiInput, reason) {
  const indicators = aiInput?.indicators || {};
  const adx = indicators.adx_15m;
  const setupAgainstEma = indicators.setup_against_ema200 === true;

  if (setupAgainstEma || (Number.isFinite(adx) && adx >= 35)) {
    return {
      market_type: 'TRENDING_RISK',
      risk_level: 'MEDIUM',
      action: 'REDUCE_SIZE',
      size_multiplier: 0.5,
      reason: `${reason}; deterministic risk reduction applied.`,
      fallback: true,
      fallback_source: 'rule_based'
    };
  }

  return {
    market_type: 'MEAN_REVERSION',
    risk_level: 'LOW',
    action: 'ALLOW',
    size_multiplier: 1,
    reason: `${reason}; deterministic rule-based allow.`,
    fallback: true,
    fallback_source: 'rule_based'
  };
}

function buildSkipFallbackDecision(reason = 'AI unavailable; skip fallback used.') {
  return {
    market_type: 'NOISE',
    risk_level: 'HIGH',
    action: 'BLOCK',
    size_multiplier: 0,
    reason,
    fallback: true,
    fallback_source: 'skip',
    final_action: 'BLOCK',
    final_size_multiplier: 0,
    hard_rule_override: false,
    hard_rule_reasons: []
  };
}

function normalizeAiFallbackMode(mode = DEFAULT_AI_FALLBACK_MODE) {
  if (mode === undefined || mode === null || mode === '') {
    return DEFAULT_AI_FALLBACK_MODE;
  }

  const normalized = String(mode).trim().toLowerCase();

  if (!AI_FALLBACK_MODES.includes(normalized)) {
    throw new ValidationError('Invalid AI fallback mode', {
      allowed: AI_FALLBACK_MODES,
      value: mode
    });
  }

  return normalized;
}

function validateAiClassificationInput({ aiClient, aiInput, messages }) {
  if (!aiInput || typeof aiInput !== 'object') {
    throw new ValidationError('AI input is required for classification');
  }

  if (!aiClient || typeof aiClient.createChatCompletion !== 'function') {
    throw new ValidationError('AI client with createChatCompletion is required');
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    throw new ValidationError('AI classification messages are required');
  }
}

module.exports = {
  AI_FALLBACK_MODES,
  DEFAULT_AI_FALLBACK_MODE,
  buildRuleBasedFallbackDecision,
  buildSkipFallbackDecision,
  classifyAiRiskWithFallback,
  normalizeAiFallbackMode,
  resolveAiFallbackDecision
};
