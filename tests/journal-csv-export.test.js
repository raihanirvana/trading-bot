const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const { ValidationError } = require('../src/errors');
const { buildSignal } = require('../src/signals/schema');
const {
  EVENT_CSV_HEADERS,
  SIGNAL_CSV_HEADERS,
  countCsvRows,
  createJournalRepository,
  escapeCsvValue,
  exportJournalCsv,
  recordsToCsv
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

describe('journal CSV export', () => {
  it('exports signals and outcomes with CSV headers and row counts', () => {
    const journal = createJournalRepository({
      now: () => new Date('2026-05-04T12:01:00.000Z')
    });
    const signal = buildSampleSignal();

    journal.saveSignal(signal);
    journal.saveEvent({
      event_id: 'event-1',
      signal_id: signal.signal_id,
      event_type: 'VIRTUAL_TP',
      created_at: '2026-05-04T12:15:00.000Z',
      payload: {
        signal_id: signal.signal_id,
        status: 'TP'
      }
    });

    const exported = exportJournalCsv(journal);

    assert.equal(exported.signalsCsv.split('\n')[0], SIGNAL_CSV_HEADERS.join(','));
    assert.equal(exported.eventsCsv.split('\n')[0], EVENT_CSV_HEADERS.join(','));
    assert.equal(countCsvRows(exported.signalsCsv), 1);
    assert.equal(countCsvRows(exported.eventsCsv), 1);
    assert.match(exported.signalsCsv, /ETHUSDT-15m-20260504T120000Z-BUY/);
    assert.match(exported.eventsCsv, /VIRTUAL_TP/);
  });

  it('exports headers only when journal is empty', () => {
    const exported = exportJournalCsv(createJournalRepository());

    assert.equal(exported.signalsCsv, `${SIGNAL_CSV_HEADERS.join(',')}\n`);
    assert.equal(exported.eventsCsv, `${EVENT_CSV_HEADERS.join(',')}\n`);
    assert.equal(countCsvRows(exported.signalsCsv), 0);
    assert.equal(countCsvRows(exported.eventsCsv), 0);
  });

  it('escapes commas, quotes, and newlines in CSV values', () => {
    const csv = recordsToCsv([
      {
        id: 'row-1',
        note: 'hello, "world"\nnext'
      }
    ], ['id', 'note']);

    assert.equal(csv, 'id,note\nrow-1,"hello, ""world""\nnext"\n');
    assert.equal(escapeCsvValue('plain'), 'plain');
    assert.equal(escapeCsvValue('a,b'), '"a,b"');
    assert.equal(escapeCsvValue('a"b'), '"a""b"');
    assert.equal(escapeCsvValue(null), '');
  });

  it('keeps missing fields as empty cells', () => {
    const csv = recordsToCsv([
      {
        id: 'row-1'
      }
    ], ['id', 'missing']);

    assert.equal(csv, 'id,missing\nrow-1,\n');
  });

  it('rejects invalid CSV export inputs', () => {
    assert.throws(
      () => exportJournalCsv({}),
      (error) => error instanceof ValidationError
    );

    assert.throws(
      () => recordsToCsv({}, ['id']),
      (error) => error instanceof ValidationError
    );

    assert.throws(
      () => recordsToCsv([], []),
      (error) => error instanceof ValidationError
    );
  });
});
