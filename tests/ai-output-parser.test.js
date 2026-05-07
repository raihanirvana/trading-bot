const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const {
  fallbackAiDecision,
  parseAiRiskDecision
} = require('../src/ai');

describe('AI JSON output parser', () => {
  it('parses valid ALLOW action', () => {
    assert.deepEqual(parseAiRiskDecision(JSON.stringify({
      market_type: 'MEAN_REVERSION',
      risk_level: 'LOW',
      action: 'ALLOW',
      size_multiplier: 1,
      reason: 'Setup is normal.'
    })), {
      market_type: 'MEAN_REVERSION',
      risk_level: 'LOW',
      action: 'ALLOW',
      size_multiplier: 1,
      reason: 'Setup is normal.',
      fallback: false
    });
  });

  it('parses valid REDUCE alias as REDUCE_SIZE', () => {
    assert.deepEqual(parseAiRiskDecision(JSON.stringify({
      market_type: 'TRENDING_RISK',
      risk_level: 'MEDIUM',
      action: 'REDUCE',
      size_multiplier: 0.5,
      reason: 'ADX is elevated.'
    })), {
      market_type: 'TRENDING_RISK',
      risk_level: 'MEDIUM',
      action: 'REDUCE_SIZE',
      size_multiplier: 0.5,
      reason: 'ADX is elevated.',
      fallback: false
    });
  });

  it('parses valid BLOCK action from OpenRouter response shape', () => {
    assert.deepEqual(parseAiRiskDecision({
      choices: [
        {
          message: {
            content: JSON.stringify({
              market_type: 'NOISE',
              risk_level: 'HIGH',
              action: 'BLOCK',
              size_multiplier: '0',
              reason: 'Noisy market.'
            })
          }
        }
      ]
    }), {
      market_type: 'NOISE',
      risk_level: 'HIGH',
      action: 'BLOCK',
      size_multiplier: 0,
      reason: 'Noisy market.',
      fallback: false
    });
  });

  it('falls back on invalid JSON', () => {
    assert.deepEqual(parseAiRiskDecision('{bad-json'), {
      market_type: 'NOISE',
      risk_level: 'HIGH',
      action: 'BLOCK',
      size_multiplier: 0,
      reason: 'AI output was not valid JSON',
      fallback: true
    });
  });

  it('falls back on invalid action, risk level, market type, size, or reason', () => {
    assert.equal(parseAiRiskDecision(JSON.stringify({
      market_type: 'MEAN_REVERSION',
      risk_level: 'LOW',
      action: 'BUY',
      size_multiplier: 1,
      reason: 'bad'
    })).fallback, true);
    assert.equal(parseAiRiskDecision(JSON.stringify({
      market_type: 'OTHER',
      risk_level: 'LOW',
      action: 'ALLOW',
      size_multiplier: 1,
      reason: 'bad'
    })).fallback, true);
    assert.equal(parseAiRiskDecision(JSON.stringify({
      market_type: 'MEAN_REVERSION',
      risk_level: 'EXTREME',
      action: 'ALLOW',
      size_multiplier: 1,
      reason: 'bad'
    })).fallback, true);
    assert.equal(parseAiRiskDecision(JSON.stringify({
      market_type: 'MEAN_REVERSION',
      risk_level: 'LOW',
      action: 'ALLOW',
      size_multiplier: 0.75,
      reason: 'bad'
    })).fallback, true);
    assert.equal(parseAiRiskDecision(JSON.stringify({
      market_type: 'MEAN_REVERSION',
      risk_level: 'LOW',
      action: 'ALLOW',
      size_multiplier: 1,
      reason: ''
    })).fallback, true);
  });

  it('ignores attempted overrides and extra keys', () => {
    const decision = parseAiRiskDecision(JSON.stringify({
      market_type: 'MEAN_REVERSION',
      risk_level: 'LOW',
      action: 'ALLOW',
      size_multiplier: 1,
      reason: 'Looks fine.',
      side: 'BUY',
      entry_price: 1,
      tp_price: 999999,
      sl_price: 0,
      leverage: 1000,
      margin_usd: 100000
    }));

    assert.deepEqual(Object.keys(decision), [
      'market_type',
      'risk_level',
      'action',
      'size_multiplier',
      'reason',
      'fallback'
    ]);
    assert.equal(decision.fallback, false);
  });

  it('supports explicit fallback helper', () => {
    assert.deepEqual(fallbackAiDecision('manual fallback'), {
      market_type: 'NOISE',
      risk_level: 'HIGH',
      action: 'BLOCK',
      size_multiplier: 0,
      reason: 'manual fallback',
      fallback: true
    });
  });
});
