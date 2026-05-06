const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const { DependencyError, ValidationError } = require('../src/errors');
const { buildSignal } = require('../src/signals/schema');
const {
  createJournalRepository,
  createMemoryJournalAdapter,
  normalizeTimestamp,
  toSignalJournalRecord
} = require('../src/journal');

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

describe('journal repository', () => {
  it('converts a signal into a journal record with timestamps and JSON reasons', () => {
    const record = toSignalJournalRecord(
      buildSampleSignal(),
      '2026-05-04T12:01:00.000Z'
    );

    assert.equal(record.signal_id, 'ETHUSDT-15m-20260504T120000Z-SELL');
    assert.equal(record.symbol, 'ETHUSDT');
    assert.equal(record.timeframe, '15m');
    assert.equal(record.side, 'SELL');
    assert.equal(record.entry_price, 3030);
    assert.equal(record.tp_price, 3017.88);
    assert.equal(record.sl_price, 3042.12);
    assert.equal(record.margin_usd, 25);
    assert.equal(record.leverage, 100);
    assert.equal(record.notional_usd, 2500);
    assert.equal(record.qty, 2500 / 3030);
    assert.equal(record.bb_width_pct, 1.2);
    assert.equal(record.adx_15m, 24);
    assert.equal(record.status, 'NEW');
    assert.equal(record.reasons_json, '["Touched upper previous band"]');
    assert.equal(record.created_at, '2026-05-04T12:01:00.000Z');
    assert.equal(record.updated_at, '2026-05-04T12:01:00.000Z');
  });

  it('inserts a signal into the journal', () => {
    const repository = createJournalRepository({
      now: () => new Date('2026-05-04T12:01:00.000Z')
    });
    const signal = buildSampleSignal();

    const result = repository.saveSignal(signal);

    assert.equal(result.inserted, true);
    assert.equal(result.duplicate, false);
    assert.equal(repository.getSignal(signal.signal_id).signal_id, signal.signal_id);
    assert.equal(repository.listSignals().length, 1);
  });

  it('ignores duplicate signals by signal_id', () => {
    const repository = createJournalRepository({
      now: () => new Date('2026-05-04T12:01:00.000Z')
    });
    const signal = buildSampleSignal();

    const first = repository.saveSignal(signal);
    const second = repository.saveSignal(signal);

    assert.equal(first.inserted, true);
    assert.equal(second.inserted, false);
    assert.equal(second.duplicate, true);
    assert.equal(second.signal.signal_id, signal.signal_id);
    assert.equal(repository.listSignals().length, 1);
  });

  it('rejects invalid signals before inserting', () => {
    const repository = createJournalRepository();

    assert.throws(
      () => repository.saveSignal({ symbol: 'ETHUSDT' }),
      (error) => {
        assert.equal(error instanceof ValidationError, true);
        assert.equal(error.details.errors.includes('Missing required field: signal_id'), true);
        return true;
      }
    );
  });

  it('wraps adapter insert failures', () => {
    const repository = createJournalRepository({
      adapter: {
        insertSignal() {
          throw new Error('disk full');
        }
      }
    });

    assert.throws(
      () => repository.saveSignal(buildSampleSignal()),
      (error) => {
        assert.equal(error instanceof DependencyError, true);
        assert.equal(error.details.cause, 'disk full');
        return true;
      }
    );
  });

  it('requires insertSignal on custom adapters', () => {
    assert.throws(
      () => createJournalRepository({ adapter: {} }),
      (error) => error instanceof DependencyError
    );
  });

  it('normalizes valid timestamps and rejects invalid timestamps', () => {
    assert.equal(normalizeTimestamp('2026-05-04T12:01:00.000Z'), '2026-05-04T12:01:00.000Z');
    assert.throws(
      () => normalizeTimestamp('not-a-date'),
      (error) => error instanceof ValidationError
    );
  });

  it('memory adapter can store events for later B3 journal flow', () => {
    const adapter = createMemoryJournalAdapter();

    const result = adapter.insertEvent({
      event_id: 'event-1',
      signal_id: 'signal-1',
      event_type: 'SIGNAL_CREATED',
      payload_json: '{}',
      created_at: '2026-05-04T12:01:00.000Z'
    });
    const duplicate = adapter.insertEvent({
      event_id: 'event-1',
      signal_id: 'signal-1',
      event_type: 'SIGNAL_CREATED',
      payload_json: '{}',
      created_at: '2026-05-04T12:01:00.000Z'
    });

    assert.equal(result.inserted, true);
    assert.equal(duplicate.duplicate, true);
    assert.equal(adapter.listEvents().length, 1);
  });
});
