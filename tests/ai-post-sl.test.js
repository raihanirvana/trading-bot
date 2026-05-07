const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { describe, it } = require('node:test');

const {
  LOSS_TYPES,
  POST_SL_ANALYSIS_EVENT,
  buildPostSlAnalysisEvent,
  buildPostSlPayload,
  fallbackPostSlLabel,
  parsePostSlLossLabel,
  savePostSlAnalysisToJournal
} = require('../src/ai');
const { ValidationError } = require('../src/errors');
const { createJournalRepository } = require('../src/journal');
const { buildSignal } = require('../src/signals/schema');

function buildSampleSignal(overrides = {}) {
  return buildSignal({
    symbol: 'ETHUSDT',
    timeframe: '15m',
    timestamp: '2026-05-04T12:00:00.000Z',
    side: 'BUY',
    entryPrice: 100,
    marginUsd: 25,
    leverage: 100,
    bbWidthPct: 1.2,
    adx15m: 24,
    reasons: ['Touched lower previous band'],
    ...overrides
  });
}

function buildSlOutcome(overrides = {}) {
  return {
    status: 'SL',
    exit_reason: 'VIRTUAL_SL',
    exit_price: 99.6,
    exit_at: '2026-05-04T12:15:00.000Z',
    candle: candle('2026-05-04T12:15:00.000Z', 100.1, 99.6, 99.8),
    ...overrides
  };
}

describe('AI post-SL reasoning', () => {
  it('builds post-SL payload without leaking secrets', () => {
    const signal = buildSampleSignal();
    const payload = buildPostSlPayload({
      signal,
      outcome: buildSlOutcome(),
      indicators: {
        adx_15m: 38,
        bb_width_pct: 2.7,
        openRouterApiKey: 'secret'
      },
      beforeCandles: [
        candle('2026-05-04T11:45:00.000Z', 100.3, 99.9, 100.1),
        candle('2026-05-04T12:00:00.000Z', 100.2, 99.8, 100)
      ],
      afterCandles: [
        candle('2026-05-04T12:15:00.000Z', 100.1, 99.6, 99.7)
      ],
      state: {
        consecutive_losses: 1,
        apiToken: 'hidden'
      }
    });

    assert.equal(payload.schema_version, 'ai-post-sl-input-v1');
    assert.equal(payload.task, 'POST_SL_REASONING');
    assert.equal(payload.signal.signal_id, signal.signal_id);
    assert.equal(payload.sl_outcome.status, 'SL');
    assert.equal(payload.sl_outcome.exit_reason, 'VIRTUAL_SL');
    assert.equal(payload.market_context.before_candles.length, 2);
    assert.equal(payload.market_context.after_candles.length, 1);
    assert.equal(payload.indicators.openRouterApiKey, undefined);
    assert.equal(payload.state.apiToken, undefined);
    assert.deepEqual(payload.output_contract.loss_type, LOSS_TYPES);
  });

  it('parses valid loss type label from OpenRouter response shape', () => {
    const label = parsePostSlLossLabel({
      choices: [
        {
          message: {
            content: JSON.stringify({
              loss_type: 'TREND_CONTINUATION',
              confidence: 'HIGH',
              reason: 'ADX expanded after entry.'
            })
          }
        }
      ]
    });

    assert.deepEqual(label, {
      loss_type: 'TREND_CONTINUATION',
      confidence: 'HIGH',
      reason: 'ADX expanded after entry.',
      fallback: false
    });
  });

  it('keeps post-SL prompt contract aligned with parser', () => {
    const prompt = readFileSync(path.join(__dirname, '../prompts/POST_SL_REASONING_PROMPT.md'), 'utf8');

    assert.equal(prompt.includes('TREND_CONTINUATION'), true);
    assert.equal(prompt.includes('BAD_ENTRY'), true);
    assert.equal(prompt.includes('"confidence": "LOW" | "MEDIUM" | "HIGH"'), true);
    assert.equal(prompt.includes('"reason": "short explanation"'), true);
    assert.equal(prompt.includes('NORMAL_LOSS'), false);
    assert.equal(prompt.includes('main_reason'), false);
    assert.equal(prompt.includes('"confidence": 0.0'), false);
  });

  it('falls back for invalid loss type output', () => {
    assert.deepEqual(parsePostSlLossLabel('{bad-json'), {
      loss_type: 'UNKNOWN',
      confidence: 'LOW',
      reason: 'Post-SL AI output was not valid JSON',
      fallback: true
    });
    assert.equal(parsePostSlLossLabel(JSON.stringify({
      loss_type: 'MARTINGALE',
      confidence: 'HIGH',
      reason: 'bad'
    })).fallback, true);
    assert.equal(parsePostSlLossLabel(JSON.stringify({
      loss_type: 'NOISE',
      confidence: 'EXTREME',
      reason: 'bad'
    })).fallback, true);
    assert.equal(parsePostSlLossLabel(JSON.stringify({
      loss_type: 'NOISE',
      confidence: 'LOW',
      reason: ''
    })).fallback, true);
    assert.equal(fallbackPostSlLabel('manual').loss_type, 'UNKNOWN');
  });

  it('saves post-SL label into journal event', () => {
    const journal = createJournalRepository();
    const signal = buildSampleSignal();
    const payload = buildPostSlPayload({
      signal,
      outcome: buildSlOutcome()
    });
    const label = parsePostSlLossLabel(JSON.stringify({
      loss_type: 'BAD_ENTRY',
      confidence: 'MEDIUM',
      reason: 'Entry was too close to SL.'
    }));

    const result = savePostSlAnalysisToJournal({
      journal,
      label,
      payload,
      rawResponse: {
        id: 'chatcmpl-post-sl'
      },
      recordedAt: '2026-05-04T12:16:00.000Z'
    });
    const saved = journal.listEvents()[0];
    const savedPayload = JSON.parse(saved.payload_json);

    assert.equal(result.inserted, true);
    assert.equal(saved.event_type, POST_SL_ANALYSIS_EVENT);
    assert.equal(saved.event_id, 'ETHUSDT-15m-20260504T120000Z-BUY-POST_SL_ANALYSIS-20260504T121600Z');
    assert.equal(savedPayload.loss_label.loss_type, 'BAD_ENTRY');
    assert.equal(savedPayload.post_sl_payload.sl_outcome.exit_reason, 'VIRTUAL_SL');
    assert.equal(savedPayload.raw_response.id, 'chatcmpl-post-sl');
  });

  it('builds deterministic post-SL analysis events', () => {
    const signal = buildSampleSignal();
    const payload = buildPostSlPayload({
      signal,
      outcome: buildSlOutcome()
    });
    const event = buildPostSlAnalysisEvent({
      payload,
      label: {
        loss_type: 'NOISE',
        confidence: 'LOW',
        reason: 'Choppy candle.',
        fallback: false
      },
      recordedAt: '2026-05-04T12:16:00.000Z'
    });

    assert.equal(event.event_type, POST_SL_ANALYSIS_EVENT);
    assert.equal(event.signal_id, signal.signal_id);
    assert.equal(event.payload.loss_label.loss_type, 'NOISE');
  });

  it('rejects non-SL outcome or invalid journal input', () => {
    assert.throws(
      () => buildPostSlPayload({
        signal: buildSampleSignal(),
        outcome: {
          status: 'TP',
          exit_reason: 'VIRTUAL_TP',
          exit_at: '2026-05-04T12:15:00.000Z'
        }
      }),
      ValidationError
    );
    assert.throws(
      () => savePostSlAnalysisToJournal({
        journal: {},
        label: {
          loss_type: 'NOISE'
        },
        payload: {}
      }),
      ValidationError
    );
  });
});

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
