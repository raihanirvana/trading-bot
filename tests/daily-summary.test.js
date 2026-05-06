const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const { ValidationError } = require('../src/errors');
const { buildSignal } = require('../src/signals/schema');
const {
  buildDailySummary,
  buildDailySummaryFromJournal,
  createJournalRepository,
  formatDailySummary,
  getDayKey,
  normalizeDayKey
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

describe('daily summary', () => {
  it('aggregates total signals, TP, SL, and missed pnl for one day', () => {
    const summary = buildDailySummary({
      date: '2026-05-04T23:00:00.000Z',
      signals: [
        signalRecord('signal-1', '2026-05-04T01:00:00.000Z'),
        signalRecord('signal-2', '2026-05-04T02:00:00.000Z'),
        signalRecord('signal-3', '2026-05-05T01:00:00.000Z')
      ],
      events: [
        eventRecord('event-1', 'VIRTUAL_TP', '2026-05-04T02:15:00.000Z'),
        eventRecord('event-2', 'VIRTUAL_SL', '2026-05-04T03:15:00.000Z'),
        eventRecord('event-3', 'MISSED_TRADE', '2026-05-04T04:00:00.000Z', {
          missed_profit_usd: 10,
          avoided_loss_usd: 0,
          missed_pnl_usd: 10
        }),
        eventRecord('event-4', 'MISSED_TRADE', '2026-05-04T05:00:00.000Z', {
          missed_profit_usd: 0,
          avoided_loss_usd: 10,
          missed_pnl_usd: -10
        }),
        eventRecord('event-5', 'VIRTUAL_TP', '2026-05-05T02:15:00.000Z')
      ]
    });

    assert.deepEqual(summary, {
      date: '2026-05-04',
      total_signals: 2,
      virtual_tp: 1,
      virtual_sl: 1,
      missed_trades: 2,
      missed_profit_usd: 10,
      avoided_loss_usd: 10,
      missed_pnl_usd: 0
    });
  });

  it('builds summary from journal repository', () => {
    const journal = createJournalRepository({
      now: () => new Date('2026-05-04T12:01:00.000Z')
    });
    const signal = buildSampleSignal();

    journal.saveSignal(signal);
    journal.saveEvent({
      event_id: 'virtual-tp-1',
      signal_id: signal.signal_id,
      event_type: 'VIRTUAL_TP',
      created_at: '2026-05-04T12:15:00.000Z',
      payload: {
        signal_id: signal.signal_id
      }
    });
    journal.saveEvent({
      event_id: 'missed-1',
      signal_id: signal.signal_id,
      event_type: 'MISSED_TRADE',
      created_at: '2026-05-04T12:02:00.000Z',
      payload: {
        missed_profit_usd: 10,
        avoided_loss_usd: 0,
        missed_pnl_usd: 10
      }
    });

    assert.deepEqual(buildDailySummaryFromJournal(journal, {
      date: '2026-05-04T20:00:00.000Z'
    }), {
      date: '2026-05-04',
      total_signals: 1,
      virtual_tp: 1,
      virtual_sl: 0,
      missed_trades: 1,
      missed_profit_usd: 10,
      avoided_loss_usd: 0,
      missed_pnl_usd: 10
    });
  });

  it('formats daily summary for readable Telegram or logs later', () => {
    const message = formatDailySummary({
      date: '2026-05-04',
      total_signals: 2,
      virtual_tp: 1,
      virtual_sl: 1,
      missed_trades: 2,
      missed_profit_usd: 10,
      avoided_loss_usd: 10,
      missed_pnl_usd: 0
    });

    assert.match(message, /Daily Summary 2026-05-04/);
    assert.match(message, /Total signals: 2/);
    assert.match(message, /Virtual TP: 1/);
    assert.match(message, /Virtual SL: 1/);
    assert.match(message, /Missed trades: 2/);
    assert.match(message, /Missed profit: 10 USDT/);
    assert.match(message, /Avoided loss: 10 USDT/);
    assert.match(message, /Missed PnL: 0 USDT/);
  });

  it('handles invalid payload json as zero missed pnl', () => {
    const summary = buildDailySummary({
      date: '2026-05-04T00:00:00.000Z',
      events: [
        {
          event_id: 'bad-payload',
          event_type: 'MISSED_TRADE',
          created_at: '2026-05-04T04:00:00.000Z',
          payload_json: '{bad-json'
        }
      ],
      signals: []
    });

    assert.equal(summary.missed_trades, 1);
    assert.equal(summary.missed_profit_usd, 0);
    assert.equal(summary.avoided_loss_usd, 0);
    assert.equal(summary.missed_pnl_usd, 0);
  });

  it('normalizes UTC day keys and rejects invalid dates', () => {
    assert.equal(normalizeDayKey('2026-05-04T23:59:59.000Z'), '2026-05-04');
    assert.equal(getDayKey('2026-05-04T01:00:00.000Z'), '2026-05-04');
    assert.equal(getDayKey('bad-date'), null);
    assert.throws(
      () => normalizeDayKey('bad-date'),
      (error) => error instanceof ValidationError
    );
  });

  it('requires a journal-like object for journal summary helper', () => {
    assert.throws(
      () => buildDailySummaryFromJournal({}),
      (error) => error instanceof ValidationError
    );
  });
});

function signalRecord(signalId, createdAt) {
  return {
    signal_id: signalId,
    created_at: createdAt
  };
}

function eventRecord(eventId, eventType, createdAt, payload = {}) {
  return {
    event_id: eventId,
    event_type: eventType,
    created_at: createdAt,
    payload_json: JSON.stringify(payload)
  };
}
