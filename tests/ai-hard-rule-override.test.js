const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const {
  applyHardRuleOverride,
  getActiveHardRuleBlocks,
  getActiveHardRuleRiskFloors
} = require('../src/ai');

function aiDecision(overrides = {}) {
  return {
    market_type: 'MEAN_REVERSION',
    risk_level: 'LOW',
    action: 'ALLOW',
    size_multiplier: 1,
    reason: 'AI allows setup.',
    fallback: false,
    ...overrides
  };
}

describe('AI hard-rule override', () => {
  it('keeps AI decision when no hard block is active', () => {
    assert.deepEqual(applyHardRuleOverride({
      aiDecision: aiDecision(),
      hardRules: {
        bb_width_minimum_block: false,
        anti_band_walk_block: false,
        daily_target_block: false,
        daily_loss_block: false,
        active_position_block: false
      }
    }), {
      market_type: 'MEAN_REVERSION',
      risk_level: 'LOW',
      action: 'ALLOW',
      size_multiplier: 1,
      reason: 'AI allows setup.',
      fallback: false,
      final_action: 'ALLOW',
      final_size_multiplier: 1,
      hard_rule_override: false,
      hard_rule_reasons: []
    });
  });

  it('forces final BLOCK when AI allows but hard rule blocks', () => {
    const finalDecision = applyHardRuleOverride({
      aiDecision: aiDecision(),
      hardRules: {
        anti_band_walk_block: true
      }
    });

    assert.equal(finalDecision.action, 'BLOCK');
    assert.equal(finalDecision.final_action, 'BLOCK');
    assert.equal(finalDecision.size_multiplier, 0);
    assert.equal(finalDecision.final_size_multiplier, 0);
    assert.equal(finalDecision.risk_level, 'HIGH');
    assert.equal(finalDecision.hard_rule_override, true);
    assert.deepEqual(finalDecision.hard_rule_reasons, ['Anti-band-walk hard rule']);
    assert.deepEqual(finalDecision.original_ai_decision, aiDecision());
  });

  it('keeps final BLOCK when AI already blocks and records hard rule reason', () => {
    const finalDecision = applyHardRuleOverride({
      aiDecision: aiDecision({
        action: 'BLOCK',
        size_multiplier: 0,
        risk_level: 'HIGH',
        reason: 'AI blocks.'
      }),
      hardRules: {
        daily_loss_block: true
      }
    });

    assert.equal(finalDecision.action, 'BLOCK');
    assert.equal(finalDecision.hard_rule_override, true);
    assert.deepEqual(finalDecision.hard_rule_reasons, ['Daily loss stop hit']);
  });

  it('returns all active hard-rule block reasons', () => {
    assert.deepEqual(getActiveHardRuleBlocks({
      active_position_block: true,
      anti_band_walk_block: true,
      bb_width_minimum_block: true,
      daily_loss_block: true,
      daily_target_block: true
    }), [
      'Active position exists',
      'Anti-band-walk hard rule',
      'BB width below minimum',
      'Daily loss stop hit',
      'Daily target hit'
    ]);
  });

  it('forces minimum MEDIUM risk when risk-floor hard rules are active', () => {
    const finalDecision = applyHardRuleOverride({
      aiDecision: aiDecision(),
      hardRules: {
        setup_against_ema200_risk_floor: true
      }
    });

    assert.equal(finalDecision.action, 'ALLOW');
    assert.equal(finalDecision.final_action, 'ALLOW');
    assert.equal(finalDecision.risk_level, 'MEDIUM');
    assert.equal(finalDecision.size_multiplier, 1);
    assert.equal(finalDecision.hard_rule_override, true);
    assert.deepEqual(finalDecision.hard_rule_reasons, ['Setup against EMA200 risk floor']);
    assert.deepEqual(finalDecision.original_ai_decision, aiDecision());
  });

  it('keeps MEDIUM risk unchanged when risk-floor hard rules are already satisfied', () => {
    const finalDecision = applyHardRuleOverride({
      aiDecision: aiDecision({
        risk_level: 'MEDIUM'
      }),
      hardRules: {
        adx_15m_risk_floor: true
      }
    });

    assert.equal(finalDecision.risk_level, 'MEDIUM');
    assert.equal(finalDecision.hard_rule_override, false);
    assert.deepEqual(finalDecision.hard_rule_reasons, []);
  });

  it('returns active risk-floor hard-rule reasons', () => {
    assert.deepEqual(getActiveHardRuleRiskFloors({
      adx_15m_risk_floor: true,
      setup_against_ema200_risk_floor: true
    }), [
      'ADX risk floor',
      'Setup against EMA200 risk floor'
    ]);
  });

  it('preserves fallback marker from AI parser', () => {
    const finalDecision = applyHardRuleOverride({
      aiDecision: aiDecision({
        fallback: true,
        reason: 'AI invalid.'
      }),
      hardRules: {
        daily_target_block: true
      }
    });

    assert.equal(finalDecision.fallback, true);
    assert.equal(finalDecision.original_ai_decision.fallback, true);
  });
});
