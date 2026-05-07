const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const {
  buildAiRiskInput,
  buildRuleBasedFallbackDecision,
  buildSkipFallbackDecision,
  classifyAiRiskWithFallback,
  normalizeAiFallbackMode,
  resolveAiFallbackDecision
} = require('../src/ai');
const { loadConfig } = require('../src/config');
const { DependencyError, ValidationError } = require('../src/errors');
const { buildSignal } = require('../src/signals/schema');

function buildSampleSignal(overrides = {}) {
  return buildSignal({
    symbol: 'ETHUSDT',
    timeframe: '15m',
    timestamp: '2026-05-04T12:00:00.000Z',
    side: 'BUY',
    entryPrice: 3000,
    marginUsd: 25,
    leverage: 100,
    bbWidthPct: 1.2,
    adx15m: 24,
    reasons: ['Touched lower previous band'],
    ...overrides
  });
}

function buildSampleAiInput(overrides = {}) {
  return buildAiRiskInput({
    signal: buildSampleSignal(overrides.signal),
    indicators: {
      bb_width_pct: 1.2,
      adx_15m: 24,
      setup_against_ema200: false,
      ...overrides.indicators
    },
    state: overrides.state || {}
  });
}

describe('AI fallback behavior', () => {
  it('falls back to deterministic rule-based decision on timeout', async () => {
    const aiInput = buildSampleAiInput();
    const aiClient = {
      createChatCompletion: async () => {
        throw new DependencyError('OpenRouter request timed out', {
          retryable: true
        });
      }
    };

    const result = await classifyAiRiskWithFallback({
      aiClient,
      aiInput,
      config: loadConfig({
        AI_FALLBACK_MODE: 'rule_based'
      })
    });

    assert.equal(result.fallback_used, true);
    assert.equal(result.fallback_mode, 'rule_based');
    assert.equal(result.error.name, 'DependencyError');
    assert.equal(result.final_decision.fallback, true);
    assert.equal(result.final_decision.fallback_source, 'rule_based');
    assert.equal(result.final_decision.final_action, 'ALLOW');
    assert.equal(result.final_decision.final_size_multiplier, 1);
  });

  it('can skip safely on timeout when configured', async () => {
    const aiInput = buildSampleAiInput();
    const aiClient = {
      createChatCompletion: async () => {
        throw new DependencyError('OpenRouter request timed out', {
          retryable: true
        });
      }
    };

    const result = await classifyAiRiskWithFallback({
      aiClient,
      aiInput,
      config: loadConfig({
        AI_FALLBACK_MODE: 'skip'
      })
    });

    assert.equal(result.fallback_used, true);
    assert.equal(result.fallback_mode, 'skip');
    assert.equal(result.final_decision.action, 'BLOCK');
    assert.equal(result.final_decision.final_action, 'BLOCK');
    assert.equal(result.final_decision.final_size_multiplier, 0);
    assert.equal(result.final_decision.fallback_source, 'skip');
  });

  it('falls back safely when AI output is invalid', async () => {
    const aiInput = buildSampleAiInput({
      indicators: {
        setup_against_ema200: true
      }
    });
    const aiClient = {
      createChatCompletion: async () => ({
        choices: [
          {
            message: {
              content: '{"action":"BUY"}'
            }
          }
        ]
      })
    };

    const result = await classifyAiRiskWithFallback({
      aiClient,
      aiInput,
      config: loadConfig({
        AI_FALLBACK_MODE: 'rule_based'
      })
    });

    assert.equal(result.parsed_decision.fallback, true);
    assert.equal(result.fallback_used, true);
    assert.equal(result.final_decision.action, 'REDUCE_SIZE');
    assert.equal(result.final_decision.final_size_multiplier, 0.5);
    assert.equal(result.final_decision.fallback_source, 'rule_based');
  });

  it('keeps valid AI output and still applies hard-rule override', async () => {
    const aiInput = buildAiRiskInput({
      signal: buildSampleSignal(),
      indicators: {
        bb_width_pct: 2.6,
        adx_15m: 36
      }
    });
    const aiClient = {
      createChatCompletion: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                market_type: 'MEAN_REVERSION',
                risk_level: 'LOW',
                action: 'ALLOW',
                size_multiplier: 1,
                reason: 'Looks fine.'
              })
            }
          }
        ]
      })
    };

    const result = await classifyAiRiskWithFallback({
      aiClient,
      aiInput,
      config: loadConfig({})
    });

    assert.equal(result.fallback_used, false);
    assert.equal(result.parsed_decision.fallback, false);
    assert.equal(result.final_decision.final_action, 'BLOCK');
    assert.equal(result.final_decision.hard_rule_override, true);
  });

  it('supports direct fallback decision helpers', () => {
    const aiInput = buildSampleAiInput({
      indicators: {
        adx_15m: 37
      }
    });

    assert.equal(normalizeAiFallbackMode('RULE_BASED'), 'rule_based');
    assert.equal(resolveAiFallbackDecision({
      aiInput,
      mode: 'rule_based',
      reason: 'manual'
    }).action, 'REDUCE_SIZE');
    assert.equal(buildRuleBasedFallbackDecision({
      aiInput,
      reason: 'manual'
    }).fallback_source, 'rule_based');
    assert.equal(buildSkipFallbackDecision('manual').action, 'BLOCK');
  });

  it('rejects invalid fallback mode', () => {
    assert.throws(
      () => normalizeAiFallbackMode('panic'),
      ValidationError
    );
    assert.throws(
      () => loadConfig({
        AI_FALLBACK_MODE: 'panic'
      }),
      /Invalid AI fallback mode/
    );
  });
});
