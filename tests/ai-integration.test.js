const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const {
  AI_CONFIDENCE_CALIBRATION_EVENT,
  AI_DECISION_EVENT,
  POST_SL_ANALYSIS_EVENT,
  buildAiRiskInput,
  buildCalibrationFromPostSlAnalysis,
  buildPostSlPayload,
  classifyAiRiskWithFallback,
  createOpenRouterClient,
  parsePostSlLossLabel,
  saveAiConfidenceCalibrationToJournal,
  saveAiDecisionToJournal,
  savePostSlAnalysisToJournal
} = require('../src/ai');
const { loadConfig } = require('../src/config');
const { createJournalRepository } = require('../src/journal');
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
    bbWidthPct: 2.6,
    adx15m: 36,
    reasons: ['Touched upper previous band'],
    ...overrides
  });
}

describe('AI unit integration', () => {
  it('runs mocked pre-trade AI flow through parser, hard-rule override, and journal', async () => {
    const calls = [];
    const signal = buildSampleSignal();
    const aiInput = buildAiRiskInput({
      signal,
      indicators: {
        bb_width_pct: 2.6,
        adx_15m: 36
      }
    });
    const aiClient = createOpenRouterClient({
      apiKey: 'openrouter-key',
      fetchImpl: async (url, request) => {
        calls.push({
          body: JSON.parse(request.body),
          url
        });

        return jsonResponse(200, {
          id: 'chatcmpl-ai-integration',
          choices: [
            {
              message: {
                role: 'assistant',
                content: JSON.stringify({
                  market_type: 'MEAN_REVERSION',
                  risk_level: 'LOW',
                  action: 'ALLOW',
                  size_multiplier: 1,
                  reason: 'Mean reversion is acceptable.'
                })
              }
            }
          ]
        });
      },
      model: 'openai/gpt-4o-mini'
    });

    const decision = await classifyAiRiskWithFallback({
      aiClient,
      aiInput,
      config: loadConfig({})
    });
    const journal = createJournalRepository();
    const journalResult = saveAiDecisionToJournal({
      aiInput: decision.ai_input,
      finalDecision: decision.final_decision,
      journal,
      parsedDecision: decision.parsed_decision,
      rawResponse: decision.raw_response,
      recordedAt: '2026-05-04T12:02:00.000Z'
    });
    const savedPayload = JSON.parse(journal.listEvents()[0].payload_json);

    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://openrouter.ai/api/v1/chat/completions');
    assert.equal(calls[0].body.stream, false);
    assert.equal(calls[0].body.messages.length, 2);
    assert.equal(JSON.parse(calls[0].body.messages[1].content).signal.signal_id, signal.signal_id);
    assert.equal(decision.fallback_used, false);
    assert.equal(decision.parsed_decision.action, 'ALLOW');
    assert.equal(decision.final_decision.final_action, 'BLOCK');
    assert.equal(decision.final_decision.hard_rule_override, true);
    assert.equal(journalResult.inserted, true);
    assert.equal(journal.listEvents()[0].event_type, AI_DECISION_EVENT);
    assert.equal(savedPayload.final_decision.final_action, 'BLOCK');
  });

  it('runs mocked invalid AI response through safe fallback and journal', async () => {
    const aiInput = buildAiRiskInput({
      signal: buildSampleSignal({
        adx15m: 24,
        bbWidthPct: 1.2
      }),
      indicators: {
        adx_15m: 24,
        bb_width_pct: 1.2
      }
    });
    const aiClient = createOpenRouterClient({
      apiKey: 'openrouter-key',
      fetchImpl: async () => jsonResponse(200, {
        choices: [
          {
            message: {
              content: '{"action":"BUY"}'
            }
          }
        ]
      })
    });
    const decision = await classifyAiRiskWithFallback({
      aiClient,
      aiInput,
      config: loadConfig({
        AI_FALLBACK_MODE: 'skip'
      })
    });

    assert.equal(decision.fallback_used, true);
    assert.equal(decision.fallback_mode, 'skip');
    assert.equal(decision.parsed_decision.fallback, true);
    assert.equal(decision.final_decision.final_action, 'BLOCK');
    assert.equal(decision.final_decision.final_size_multiplier, 0);
  });

  it('enforces risk-floor hard rules after valid LOW AI response', async () => {
    const aiInput = buildAiRiskInput({
      signal: buildSampleSignal({
        adx15m: 24,
        bbWidthPct: 1.2
      }),
      indicators: {
        adx_15m: 24,
        bb_width_pct: 1.2,
        setup_against_ema200: true
      }
    });
    const aiClient = createOpenRouterClient({
      apiKey: 'openrouter-key',
      fetchImpl: async () => jsonResponse(200, {
        choices: [
          {
            message: {
              content: JSON.stringify({
                market_type: 'MEAN_REVERSION',
                risk_level: 'LOW',
                action: 'ALLOW',
                size_multiplier: 1,
                reason: 'AI underestimates risk.'
              })
            }
          }
        ]
      })
    });

    const decision = await classifyAiRiskWithFallback({
      aiClient,
      aiInput,
      config: loadConfig({})
    });

    assert.equal(decision.fallback_used, false);
    assert.equal(decision.parsed_decision.risk_level, 'LOW');
    assert.equal(decision.final_decision.action, 'ALLOW');
    assert.equal(decision.final_decision.risk_level, 'MEDIUM');
    assert.equal(decision.final_decision.hard_rule_override, true);
    assert.deepEqual(decision.final_decision.hard_rule_reasons, ['Setup against EMA200 risk floor']);
  });

  it('runs mocked post-SL label through parser, journal, and confidence calibration', () => {
    const journal = createJournalRepository();
    const signal = buildSampleSignal({
      side: 'BUY',
      entryPrice: 100,
      adx15m: 24,
      bbWidthPct: 1.2,
      reasons: ['Touched lower previous band']
    });
    const postSlPayload = buildPostSlPayload({
      afterCandles: [
        candle('2026-05-04T12:15:00.000Z', 100.1, 99.6, 99.7)
      ],
      beforeCandles: [
        candle('2026-05-04T12:00:00.000Z', 100.2, 99.8, 100)
      ],
      outcome: {
        status: 'SL',
        exit_reason: 'VIRTUAL_SL',
        exit_price: 99.6,
        exit_at: '2026-05-04T12:15:00.000Z',
        candle: candle('2026-05-04T12:15:00.000Z', 100.1, 99.6, 99.7)
      },
      signal
    });
    const rawResponse = {
      choices: [
        {
          message: {
            content: JSON.stringify({
              loss_type: 'BAD_ENTRY',
              confidence: 'MEDIUM',
              reason: 'Entry was too close to stop.'
            })
          }
        }
      ]
    };
    const label = parsePostSlLossLabel(rawResponse);
    const postSlResult = savePostSlAnalysisToJournal({
      journal,
      label,
      payload: postSlPayload,
      rawResponse,
      recordedAt: '2026-05-04T12:16:00.000Z'
    });
    const calibrationEvent = buildCalibrationFromPostSlAnalysis({
      actualLabel: 'BAD_ENTRY',
      outcome: postSlPayload.sl_outcome,
      postSlEvent: {
        ...postSlResult.event,
        payload: JSON.parse(postSlResult.event.payload_json)
      },
      recordedAt: '2026-05-04T12:30:00.000Z'
    });
    const calibrationResult = saveAiConfidenceCalibrationToJournal({
      actualLabel: calibrationEvent.payload.actual_label,
      confidence: calibrationEvent.payload.confidence,
      journal,
      metadata: calibrationEvent.payload.metadata,
      observedAt: calibrationEvent.payload.observed_at,
      outcome: calibrationEvent.payload.outcome,
      predictedLabel: calibrationEvent.payload.predicted_label,
      recordedAt: calibrationEvent.created_at,
      signalId: calibrationEvent.payload.signal_id,
      sourceEventId: calibrationEvent.payload.source_event_id,
      sourceEventType: calibrationEvent.payload.source_event_type
    });

    assert.equal(label.fallback, false);
    assert.equal(postSlResult.inserted, true);
    assert.equal(calibrationResult.inserted, true);
    assert.deepEqual(journal.listEvents().map((event) => event.event_type), [
      POST_SL_ANALYSIS_EVENT,
      AI_CONFIDENCE_CALIBRATION_EVENT
    ]);
    assert.equal(JSON.parse(journal.listEvents()[1].payload_json).correct, true);
  });
});

function jsonResponse(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload
  };
}

function candle(timestamp, high, low, close) {
  return {
    timestamp,
    open: close,
    high,
    low,
    close,
    volume: 1000
  };
}
