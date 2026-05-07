const HARD_RULE_BLOCK_REASONS = Object.freeze({
  active_position_block: 'Active position exists',
  anti_band_walk_block: 'Anti-band-walk hard rule',
  bb_width_minimum_block: 'BB width below minimum',
  daily_loss_block: 'Daily loss stop hit',
  daily_target_block: 'Daily target hit'
});

const HARD_RULE_RISK_FLOOR_REASONS = Object.freeze({
  adx_15m_risk_floor: 'ADX risk floor',
  setup_against_ema200_risk_floor: 'Setup against EMA200 risk floor'
});

function applyHardRuleOverride(options = {}) {
  const {
    aiDecision,
    hardRules = {}
  } = options;
  const activeBlocks = getActiveHardRuleBlocks(hardRules);

  if (activeBlocks.length === 0) {
    const activeRiskFloors = getActiveHardRuleRiskFloors(hardRules);

    if (activeRiskFloors.length > 0 && aiDecision.risk_level === 'LOW') {
      return {
        ...aiDecision,
        risk_level: 'MEDIUM',
        reason: `Hard rule risk floor: ${activeRiskFloors.join('; ')}`,
        final_action: aiDecision.action,
        final_size_multiplier: aiDecision.size_multiplier,
        hard_rule_override: true,
        hard_rule_reasons: activeRiskFloors,
        original_ai_decision: {
          market_type: aiDecision.market_type,
          risk_level: aiDecision.risk_level,
          action: aiDecision.action,
          size_multiplier: aiDecision.size_multiplier,
          reason: aiDecision.reason,
          fallback: aiDecision.fallback === true,
          ...getFallbackMetadata(aiDecision)
        }
      };
    }

    return {
      ...aiDecision,
      final_action: aiDecision.action,
      final_size_multiplier: aiDecision.size_multiplier,
      hard_rule_override: false,
      hard_rule_reasons: []
    };
  }

  return {
    market_type: aiDecision.market_type,
    risk_level: 'HIGH',
    action: 'BLOCK',
    size_multiplier: 0,
    reason: `Hard rule override: ${activeBlocks.join('; ')}`,
    fallback: aiDecision.fallback === true,
    ...getFallbackMetadata(aiDecision),
    final_action: 'BLOCK',
    final_size_multiplier: 0,
    hard_rule_override: true,
    hard_rule_reasons: activeBlocks,
    original_ai_decision: {
      market_type: aiDecision.market_type,
      risk_level: aiDecision.risk_level,
      action: aiDecision.action,
      size_multiplier: aiDecision.size_multiplier,
      reason: aiDecision.reason,
      fallback: aiDecision.fallback === true,
      ...getFallbackMetadata(aiDecision)
    }
  };
}

function getActiveHardRuleBlocks(hardRules = {}) {
  return Object.entries(HARD_RULE_BLOCK_REASONS)
    .filter(([key]) => hardRules[key] === true)
    .map(([, reason]) => reason);
}

function getActiveHardRuleRiskFloors(hardRules = {}) {
  return Object.entries(HARD_RULE_RISK_FLOOR_REASONS)
    .filter(([key]) => hardRules[key] === true)
    .map(([, reason]) => reason);
}

function getFallbackMetadata(aiDecision) {
  const metadata = {};

  if (aiDecision.fallback_source) {
    metadata.fallback_source = aiDecision.fallback_source;
  }

  if (aiDecision.fallback_reason) {
    metadata.fallback_reason = aiDecision.fallback_reason;
  }

  return metadata;
}

module.exports = {
  HARD_RULE_BLOCK_REASONS,
  HARD_RULE_RISK_FLOOR_REASONS,
  applyHardRuleOverride,
  getActiveHardRuleBlocks,
  getActiveHardRuleRiskFloors
};
