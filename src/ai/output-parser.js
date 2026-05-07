const AI_MARKET_TYPES = Object.freeze(['MEAN_REVERSION', 'TRENDING_RISK', 'NOISE']);
const AI_RISK_LEVELS = Object.freeze(['LOW', 'MEDIUM', 'HIGH']);
const AI_ACTIONS = Object.freeze(['ALLOW', 'REDUCE_SIZE', 'BLOCK']);
const AI_SIZE_MULTIPLIERS = Object.freeze([1, 0.5, 0]);

const FALLBACK_AI_DECISION = Object.freeze({
  market_type: 'NOISE',
  risk_level: 'HIGH',
  action: 'BLOCK',
  size_multiplier: 0,
  reason: 'AI output invalid; fallback decision used.',
  fallback: true
});

function parseAiRiskDecision(input) {
  const text = extractAiText(input);

  if (typeof text !== 'string' || text.trim() === '') {
    return fallbackAiDecision('AI output empty');
  }

  let parsed;

  try {
    parsed = JSON.parse(text);
  } catch (_error) {
    return fallbackAiDecision('AI output was not valid JSON');
  }

  const decision = normalizeAiDecision(parsed);

  if (!decision.valid) {
    return fallbackAiDecision(decision.reason);
  }

  return {
    ...decision.value,
    fallback: false
  };
}

function normalizeAiDecision(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return invalidDecision('AI output must be an object');
  }

  const action = normalizeAction(value.action);
  const marketType = value.market_type;
  const riskLevel = value.risk_level;
  const sizeMultiplier = normalizeSizeMultiplier(value.size_multiplier);
  const reason = normalizeReason(value.reason);

  if (!AI_MARKET_TYPES.includes(marketType)) {
    return invalidDecision('Invalid AI market_type');
  }

  if (!AI_RISK_LEVELS.includes(riskLevel)) {
    return invalidDecision('Invalid AI risk_level');
  }

  if (!AI_ACTIONS.includes(action)) {
    return invalidDecision('Invalid AI action');
  }

  if (!AI_SIZE_MULTIPLIERS.includes(sizeMultiplier)) {
    return invalidDecision('Invalid AI size_multiplier');
  }

  if (!reason) {
    return invalidDecision('Invalid AI reason');
  }

  return {
    valid: true,
    value: {
      market_type: marketType,
      risk_level: riskLevel,
      action,
      size_multiplier: sizeMultiplier,
      reason
    }
  };
}

function extractAiText(input) {
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

function normalizeAction(action) {
  if (action === 'REDUCE') {
    return 'REDUCE_SIZE';
  }

  return action;
}

function normalizeSizeMultiplier(value) {
  if (typeof value === 'string' && value.trim() !== '') {
    return Number(value);
  }

  return value;
}

function normalizeReason(reason) {
  if (typeof reason !== 'string') {
    return null;
  }

  const trimmed = reason.trim();

  return trimmed === '' ? null : trimmed;
}

function fallbackAiDecision(reason) {
  return {
    ...FALLBACK_AI_DECISION,
    reason
  };
}

function invalidDecision(reason) {
  return {
    valid: false,
    reason
  };
}

module.exports = {
  AI_ACTIONS,
  AI_MARKET_TYPES,
  AI_RISK_LEVELS,
  AI_SIZE_MULTIPLIERS,
  FALLBACK_AI_DECISION,
  fallbackAiDecision,
  parseAiRiskDecision
};
