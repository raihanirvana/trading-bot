const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const {
  AI_DECISION_EVENT,
  applyHardRuleOverride,
  buildAiDecisionEvent,
  buildAiRiskInput,
  createJournalRepository,
  parseAiRiskDecision,
  saveAiDecisionToJournal
} = require('../src/ai');
const { ValidationError } = require('../src/errors');
const { createJournalRepository: createJournal } = require('../src/journal');
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

describe('AI decision journal', () => {
  it('builds AI decision journal event with input, response, parsed, and final decision', () => {
    const aiInput = buildAiRiskInput({
      signal: buildSampleSignal(),
      indicators: {
        bb_width_pct: 1.2,
        adx_15m: 24
      }
    });
    const parsedDecision = parseAiRiskDecision(JSON.stringify({
      market_type: 'MEAN_REVERSION',
      risk_level: 'LOW',
      action: 'ALLOW',
      size_multiplier: 1,
      reason: 'Looks fine.'
    }));
    const finalDecision = applyHardRuleOverride({
      aiDecision: parsedDecision,
      hardRules: aiInput.hard_rules
    });
    const event = buildAiDecisionEvent({
      aiInput,
      finalDecision,
      parsedDecision,
      rawResponse: {
        id: 'chatcmpl-1'
      },
      recordedAt: '2026-05-04T12:02:00.000Z'
    });

    assert.equal(event.event_id, 'ETHUSDT-15m-20260504T120000Z-SELL-AI_DECISION-20260504T120200Z');
    assert.equal(event.signal_id, aiInput.signal.signal_id);
    assert.equal(event.event_type, AI_DECISION_EVENT);
    assert.equal(event.created_at, '2026-05-04T12:02:00.000Z');
    assert.deepEqual(event.payload, {
      signal_id: aiInput.signal.signal_id,
      ai_input: aiInput,
      raw_response: {
        id: 'chatcmpl-1'
      },
      parsed_decision: parsedDecision,
      final_decision: finalDecision
    });
  });

  it('saves AI decision audit trail into journal events', () => {
    const journal = createJournal({
      now: () => new Date('2026-05-04T12:01:00.000Z')
    });
    const aiInput = buildAiRiskInput({
      signal: buildSampleSignal(),
      indicators: {
        bb_width_pct: 2.6,
        adx_15m: 36
      }
    });
    const parsedDecision = parseAiRiskDecision(JSON.stringify({
      market_type: 'MEAN_REVERSION',
      risk_level: 'LOW',
      action: 'ALLOW',
      size_multiplier: 1,
      reason: 'AI allows.'
    }));
    const finalDecision = applyHardRuleOverride({
      aiDecision: parsedDecision,
      hardRules: aiInput.hard_rules
    });

    const result = saveAiDecisionToJournal({
      aiInput,
      finalDecision,
      journal,
      parsedDecision,
      rawResponse: {
        choices: [
          {
            message: {
              content: '{"action":"ALLOW"}'
            }
          }
        ]
      },
      recordedAt: '2026-05-04T12:02:00.000Z'
    });
    const savedPayload = JSON.parse(journal.listEvents()[0].payload_json);

    assert.equal(result.inserted, true);
    assert.equal(journal.listEvents().length, 1);
    assert.equal(journal.listEvents()[0].event_type, AI_DECISION_EVENT);
    assert.equal(savedPayload.final_decision.final_action, 'BLOCK');
    assert.equal(savedPayload.parsed_decision.action, 'ALLOW');
    assert.equal(savedPayload.ai_input.hard_rules.anti_band_walk_block, true);
  });

  it('dedupes AI decision events with the same timestamp', () => {
    const journal = createJournal();
    const aiInput = buildAiRiskInput({
      signal: buildSampleSignal()
    });
    const parsedDecision = parseAiRiskDecision(JSON.stringify({
      market_type: 'NOISE',
      risk_level: 'HIGH',
      action: 'BLOCK',
      size_multiplier: 0,
      reason: 'Fallback block.'
    }));
    const finalDecision = applyHardRuleOverride({
      aiDecision: parsedDecision,
      hardRules: aiInput.hard_rules
    });
    const payload = {
      aiInput,
      finalDecision,
      journal,
      parsedDecision,
      recordedAt: '2026-05-04T12:02:00.000Z'
    };

    const first = saveAiDecisionToJournal(payload);
    const second = saveAiDecisionToJournal(payload);

    assert.equal(first.inserted, true);
    assert.equal(second.inserted, false);
    assert.equal(second.duplicate, true);
    assert.equal(journal.listEvents().length, 1);
  });

  it('rejects invalid AI decision journal input', () => {
    assert.throws(
      () => saveAiDecisionToJournal({}),
      (error) => error instanceof ValidationError
    );

    assert.throws(
      () => buildAiDecisionEvent({
        aiInput: {},
        parsedDecision: {},
        finalDecision: {}
      }),
      (error) => error instanceof ValidationError
    );
  });
});
