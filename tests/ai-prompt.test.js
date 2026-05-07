const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const {
  AI_RISK_CLASSIFIER_SYSTEM_PROMPT,
  buildAiRiskClassifierMessages,
  buildAiRiskInput
} = require('../src/ai');
const { buildSignal } = require('../src/signals/schema');

function buildSampleSignal(overrides = {}) {
  return buildSignal({
    symbol: 'ETHUSDT',
    timeframe: '15m',
    timestamp: '2026-05-04T12:00:00.000Z',
    side: 'SELL',
    entryPrice: 3030,
    marginUsd: 25,
    leverage: 100,
    bbWidthPct: 1.2,
    adx15m: 24,
    reasons: ['Touched upper previous band'],
    ...overrides
  });
}

describe('AI risk classifier fixed prompt', () => {
  it('contains hard rules from AI policy', () => {
    assert.match(AI_RISK_CLASSIFIER_SYSTEM_PROMPT, /bb_width_pct < 0\.6/);
    assert.match(AI_RISK_CLASSIFIER_SYSTEM_PROMPT, /bb_width_pct > 2\.5 and adx_15m > 35/);
    assert.match(AI_RISK_CLASSIFIER_SYSTEM_PROMPT, /daily_target_hit is true/);
    assert.match(AI_RISK_CLASSIFIER_SYSTEM_PROMPT, /daily_loss_hit is true/);
    assert.match(AI_RISK_CLASSIFIER_SYSTEM_PROMPT, /setup_against_ema200 is true/);
    assert.match(AI_RISK_CLASSIFIER_SYSTEM_PROMPT, /adx_15m >= 30/);
  });

  it('contains forbidden rule constraints', () => {
    for (const forbiddenText of [
      'Do not change trade direction',
      'Do not change entry price',
      'Do not change TP',
      'Do not change SL',
      'Do not change leverage',
      'Do not change margin',
      'Do not recommend martingale',
      'Do not recommend increasing size after a loss',
      'Do not override hard rules'
    ]) {
      assert.match(AI_RISK_CLASSIFIER_SYSTEM_PROMPT, new RegExp(forbiddenText));
    }
  });

  it('requires JSON only with allowed output contract', () => {
    assert.match(AI_RISK_CLASSIFIER_SYSTEM_PROMPT, /Return valid JSON only/);
    assert.match(AI_RISK_CLASSIFIER_SYSTEM_PROMPT, /MEAN_REVERSION/);
    assert.match(AI_RISK_CLASSIFIER_SYSTEM_PROMPT, /TRENDING_RISK/);
    assert.match(AI_RISK_CLASSIFIER_SYSTEM_PROMPT, /NOISE/);
    assert.match(AI_RISK_CLASSIFIER_SYSTEM_PROMPT, /ALLOW/);
    assert.match(AI_RISK_CLASSIFIER_SYSTEM_PROMPT, /REDUCE_SIZE/);
    assert.match(AI_RISK_CLASSIFIER_SYSTEM_PROMPT, /BLOCK/);
    assert.match(AI_RISK_CLASSIFIER_SYSTEM_PROMPT, /size_multiplier/);
  });

  it('builds fixed system and JSON user messages without dynamic prompt text', () => {
    const aiInput = buildAiRiskInput({
      signal: buildSampleSignal(),
      indicators: {
        bb_width_pct: 1.2,
        adx_15m: 24
      }
    });
    const messages = buildAiRiskClassifierMessages(aiInput);

    assert.deepEqual(messages, [
      {
        role: 'system',
        content: AI_RISK_CLASSIFIER_SYSTEM_PROMPT
      },
      {
        role: 'user',
        content: JSON.stringify(aiInput)
      }
    ]);
    assert.doesNotThrow(() => JSON.parse(messages[1].content));
  });
});
