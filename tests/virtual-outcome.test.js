const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const { ValidationError } = require('../src/errors');
const { buildSignal } = require('../src/signals/schema');
const {
  VIRTUAL_OUTCOME,
  buildVirtualOutcomeEvent,
  createJournalRepository,
  evaluateCandleOutcome,
  evaluateVirtualOutcome,
  trackVirtualOutcome
} = require('../src/journal');

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

describe('virtual outcome tracker', () => {
  it('marks BUY signal as TP when a subsequent candle reaches tp_price', () => {
    const signal = buildSampleSignal();
    const outcome = evaluateVirtualOutcome({
      signal,
      candles: [
        candle('2026-05-04T12:00:00.000Z', 100.2, 99.8),
        candle('2026-05-04T12:15:00.000Z', 100.4, 99.9)
      ]
    });

    assert.deepEqual(outcome, {
      status: VIRTUAL_OUTCOME.TP,
      exit_reason: 'VIRTUAL_TP',
      exit_price: 100.4,
      exit_at: '2026-05-04T12:15:00.000Z',
      candle: candle('2026-05-04T12:15:00.000Z', 100.4, 99.9)
    });
  });

  it('marks BUY signal as SL when a subsequent candle reaches sl_price', () => {
    const signal = buildSampleSignal();
    const outcome = evaluateVirtualOutcome({
      signal,
      candles: [
        candle('2026-05-04T12:15:00.000Z', 100.1, 99.6)
      ]
    });

    assert.equal(outcome.status, VIRTUAL_OUTCOME.SL);
    assert.equal(outcome.exit_reason, 'VIRTUAL_SL');
    assert.equal(outcome.exit_price, 99.6);
  });

  it('marks SELL signal as TP when price moves down to tp_price', () => {
    const signal = buildSampleSignal({
      side: 'SELL',
      entryPrice: 100,
      reasons: ['Touched upper previous band']
    });
    const outcome = evaluateVirtualOutcome({
      signal,
      candles: [
        candle('2026-05-04T12:15:00.000Z', 100.1, 99.6)
      ]
    });

    assert.equal(outcome.status, VIRTUAL_OUTCOME.TP);
    assert.equal(outcome.exit_reason, 'VIRTUAL_TP');
    assert.equal(outcome.exit_price, 99.6);
  });

  it('marks SELL signal as SL when price moves up to sl_price', () => {
    const signal = buildSampleSignal({
      side: 'SELL',
      entryPrice: 100,
      reasons: ['Touched upper previous band']
    });
    const outcome = evaluateVirtualOutcome({
      signal,
      candles: [
        candle('2026-05-04T12:15:00.000Z', 100.4, 99.9)
      ]
    });

    assert.equal(outcome.status, VIRTUAL_OUTCOME.SL);
    assert.equal(outcome.exit_reason, 'VIRTUAL_SL');
    assert.equal(outcome.exit_price, 100.4);
  });

  it('uses SL when TP and SL are both touched in the same candle', () => {
    const outcome = evaluateCandleOutcome(
      buildSampleSignal(),
      candle('2026-05-04T12:15:00.000Z', 100.5, 99.5)
    );

    assert.equal(outcome.status, VIRTUAL_OUTCOME.SL);
    assert.equal(outcome.exit_reason, 'VIRTUAL_SL');
  });

  it('keeps outcome open when no subsequent candle hits TP or SL', () => {
    const outcome = evaluateVirtualOutcome({
      signal: buildSampleSignal(),
      candles: [
        candle('2026-05-04T12:15:00.000Z', 100.2, 99.8)
      ]
    });

    assert.deepEqual(outcome, {
      status: VIRTUAL_OUTCOME.OPEN,
      exit_reason: null,
      exit_price: null,
      exit_at: null,
      candle: null
    });
  });

  it('records virtual outcome events in journal', () => {
    const journal = createJournalRepository();
    const signal = buildSampleSignal();
    const result = trackVirtualOutcome({
      journal,
      signal,
      candles: [
        candle('2026-05-04T12:15:00.000Z', 100.4, 99.9)
      ]
    });

    assert.equal(result.outcome.status, VIRTUAL_OUTCOME.TP);
    assert.equal(result.eventResult.inserted, true);
    assert.equal(journal.listEvents().length, 1);
    assert.equal(journal.listEvents()[0].event_type, 'VIRTUAL_TP');
    assert.deepEqual(JSON.parse(journal.listEvents()[0].payload_json), {
      signal_id: signal.signal_id,
      status: 'TP',
      exit_reason: 'VIRTUAL_TP',
      exit_price: 100.4,
      exit_at: '2026-05-04T12:15:00.000Z'
    });
  });

  it('ignores duplicate virtual outcome events', () => {
    const journal = createJournalRepository();
    const signal = buildSampleSignal();
    const candles = [
      candle('2026-05-04T12:15:00.000Z', 100.4, 99.9)
    ];

    const first = trackVirtualOutcome({ journal, signal, candles });
    const second = trackVirtualOutcome({ journal, signal, candles });

    assert.equal(first.eventResult.inserted, true);
    assert.equal(second.eventResult.inserted, false);
    assert.equal(second.eventResult.duplicate, true);
    assert.equal(journal.listEvents().length, 1);
  });

  it('does not record an event when outcome is still open', () => {
    const journal = createJournalRepository();
    const result = trackVirtualOutcome({
      journal,
      signal: buildSampleSignal(),
      candles: [
        candle('2026-05-04T12:15:00.000Z', 100.2, 99.8)
      ]
    });

    assert.equal(result.outcome.status, VIRTUAL_OUTCOME.OPEN);
    assert.equal(result.eventResult, null);
    assert.equal(journal.listEvents().length, 0);
  });

  it('builds deterministic virtual outcome event ids', () => {
    const signal = buildSampleSignal();
    const event = buildVirtualOutcomeEvent(signal, {
      status: VIRTUAL_OUTCOME.TP,
      exit_reason: 'VIRTUAL_TP',
      exit_price: 100.4,
      exit_at: '2026-05-04T12:15:00.000Z'
    });

    assert.equal(event.event_id, 'ETHUSDT-15m-20260504T120000Z-BUY-VIRTUAL_TP-20260504T121500Z');
    assert.equal(event.signal_id, signal.signal_id);
    assert.equal(event.event_type, 'VIRTUAL_TP');
  });

  it('rejects invalid input', () => {
    assert.throws(
      () => evaluateVirtualOutcome({ signal: { symbol: 'ETHUSDT' }, candles: [] }),
      (error) => error instanceof ValidationError
    );

    assert.throws(
      () => evaluateVirtualOutcome({ signal: buildSampleSignal(), candles: {} }),
      (error) => error instanceof ValidationError
    );
  });
});

function candle(timestamp, high, low) {
  return {
    timestamp,
    high,
    low
  };
}
