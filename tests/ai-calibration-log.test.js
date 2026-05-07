const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const {
  AI_CONFIDENCE_CALIBRATION_EVENT,
  buildAiConfidenceCalibrationEvent,
  buildAiConfidenceCalibrationRecord,
  buildCalibrationFromPostSlAnalysis,
  saveAiConfidenceCalibrationToJournal
} = require('../src/ai');
const { ValidationError } = require('../src/errors');
const { createJournalRepository } = require('../src/journal');

describe('AI confidence calibration log', () => {
  it('builds confidence calibration record with confidence vs outcome', () => {
    const record = buildAiConfidenceCalibrationRecord({
      actualLabel: 'TREND_CONTINUATION',
      confidence: 'HIGH',
      observedAt: '2026-05-04T12:30:00.000Z',
      outcome: {
        status: 'SL',
        exit_reason: 'VIRTUAL_SL',
        pnl_usd: -10
      },
      predictedLabel: 'TREND_CONTINUATION',
      signalId: 'ETHUSDT-15m-20260504T120000Z-BUY',
      sourceEventId: 'post-sl-event-1',
      sourceEventType: 'POST_SL_ANALYSIS'
    });

    assert.deepEqual(record, {
      signal_id: 'ETHUSDT-15m-20260504T120000Z-BUY',
      source_event_type: 'POST_SL_ANALYSIS',
      source_event_id: 'post-sl-event-1',
      confidence: 'HIGH',
      confidence_score: 1,
      predicted_label: 'TREND_CONTINUATION',
      actual_label: 'TREND_CONTINUATION',
      correct: true,
      outcome: {
        status: 'SL',
        exit_reason: 'VIRTUAL_SL',
        pnl_usd: -10
      },
      observed_at: '2026-05-04T12:30:00.000Z',
      metadata: {}
    });
  });

  it('marks calibration as incorrect when actual label differs', () => {
    const record = buildAiConfidenceCalibrationRecord({
      actualLabel: 'VOLATILITY_SPIKE',
      confidence: 'MEDIUM',
      observedAt: '2026-05-04T12:30:00.000Z',
      outcome: {
        status: 'SL'
      },
      predictedLabel: 'BAD_ENTRY',
      signalId: 'ETHUSDT-15m-20260504T120000Z-BUY',
      sourceEventType: 'POST_SL_ANALYSIS'
    });

    assert.equal(record.confidence_score, 0.66);
    assert.equal(record.correct, false);
  });

  it('allows pending actual label while keeping outcome data available', () => {
    const record = buildAiConfidenceCalibrationRecord({
      confidence: 'LOW',
      observedAt: '2026-05-04T12:30:00.000Z',
      outcome: {
        status: 'SL'
      },
      predictedLabel: 'UNKNOWN',
      signalId: 'ETHUSDT-15m-20260504T120000Z-BUY',
      sourceEventType: 'POST_SL_ANALYSIS'
    });

    assert.equal(record.actual_label, null);
    assert.equal(record.correct, null);
    assert.equal(record.confidence_score, 0.33);
  });

  it('saves confidence calibration data to journal', () => {
    const journal = createJournalRepository();
    const result = saveAiConfidenceCalibrationToJournal({
      actualLabel: 'NOISE',
      confidence: 'LOW',
      journal,
      observedAt: '2026-05-04T12:30:00.000Z',
      outcome: {
        status: 'SL',
        exit_reason: 'VIRTUAL_SL'
      },
      predictedLabel: 'NOISE',
      signalId: 'ETHUSDT-15m-20260504T120000Z-BUY',
      sourceEventId: 'post-sl-event-1',
      sourceEventType: 'POST_SL_ANALYSIS'
    });
    const saved = journal.listEvents()[0];
    const payload = JSON.parse(saved.payload_json);

    assert.equal(result.inserted, true);
    assert.equal(saved.event_id, 'ETHUSDT-15m-20260504T120000Z-BUY-AI_CONFIDENCE_CALIBRATION-20260504T123000Z');
    assert.equal(saved.event_type, AI_CONFIDENCE_CALIBRATION_EVENT);
    assert.equal(payload.confidence, 'LOW');
    assert.equal(payload.predicted_label, 'NOISE');
    assert.equal(payload.actual_label, 'NOISE');
    assert.equal(payload.correct, true);
    assert.equal(payload.outcome.exit_reason, 'VIRTUAL_SL');
  });

  it('builds calibration event from post-SL analysis event payload', () => {
    const event = buildCalibrationFromPostSlAnalysis({
      actualLabel: 'BAD_ENTRY',
      outcome: {
        status: 'SL',
        exit_reason: 'VIRTUAL_SL'
      },
      postSlEvent: {
        event_id: 'ETHUSDT-POST_SL_ANALYSIS-1',
        signal_id: 'ETHUSDT-15m-20260504T120000Z-BUY',
        event_type: 'POST_SL_ANALYSIS',
        created_at: '2026-05-04T12:16:00.000Z',
        payload: {
          signal_id: 'ETHUSDT-15m-20260504T120000Z-BUY',
          loss_label: {
            loss_type: 'BAD_ENTRY',
            confidence: 'MEDIUM',
            reason: 'Entry too close to SL.',
            fallback: false
          }
        }
      },
      recordedAt: '2026-05-04T12:30:00.000Z'
    });

    assert.equal(event.event_type, AI_CONFIDENCE_CALIBRATION_EVENT);
    assert.equal(event.payload.source_event_id, 'ETHUSDT-POST_SL_ANALYSIS-1');
    assert.equal(event.payload.predicted_label, 'BAD_ENTRY');
    assert.equal(event.payload.actual_label, 'BAD_ENTRY');
    assert.equal(event.payload.correct, true);
    assert.equal(event.payload.metadata.loss_reason, 'Entry too close to SL.');
  });

  it('rejects invalid confidence calibration input', () => {
    assert.throws(
      () => buildAiConfidenceCalibrationEvent({
        confidence: 'EXTREME',
        outcome: {
          status: 'SL'
        },
        predictedLabel: 'NOISE',
        signalId: 'ETHUSDT',
        sourceEventType: 'POST_SL_ANALYSIS'
      }),
      ValidationError
    );
    assert.throws(
      () => saveAiConfidenceCalibrationToJournal({
        journal: {},
        confidence: 'LOW',
        outcome: {
          status: 'SL'
        },
        predictedLabel: 'NOISE',
        signalId: 'ETHUSDT',
        sourceEventType: 'POST_SL_ANALYSIS'
      }),
      ValidationError
    );
    assert.throws(
      () => buildCalibrationFromPostSlAnalysis({
        postSlEvent: {
          payload: {}
        },
        outcome: {
          status: 'SL'
        }
      }),
      ValidationError
    );
  });
});
