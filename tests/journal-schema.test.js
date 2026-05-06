const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const { MIGRATIONS } = require('../src/db');
const {
  EVENTS_TABLE,
  EVENT_COLUMNS,
  JOURNAL_MIGRATION,
  SIGNALS_TABLE,
  SIGNAL_COLUMNS,
  buildCreateTableStatement,
  formatColumnDefinition,
  getColumnNames,
  hasRequiredColumns
} = require('../src/journal');

describe('journal schema', () => {
  it('defines required signal table fields', () => {
    assert.equal(SIGNALS_TABLE, 'signals');
    assert.equal(hasRequiredColumns(SIGNAL_COLUMNS, [
      'signal_id',
      'symbol',
      'timeframe',
      'side',
      'entry_price',
      'tp_price',
      'sl_price',
      'margin_usd',
      'leverage',
      'notional_usd',
      'qty',
      'bb_width_pct',
      'adx_15m',
      'status',
      'reasons_json',
      'created_at',
      'updated_at'
    ]), true);
  });

  it('defines required event table fields', () => {
    assert.equal(EVENTS_TABLE, 'events');
    assert.deepEqual(getColumnNames(EVENT_COLUMNS), [
      'event_id',
      'signal_id',
      'event_type',
      'payload_json',
      'created_at'
    ]);
  });

  it('builds SQL column definitions with primary key and references', () => {
    assert.equal(formatColumnDefinition({
      name: 'signal_id',
      type: 'TEXT',
      required: true,
      primaryKey: true
    }), 'signal_id TEXT PRIMARY KEY NOT NULL');

    assert.equal(formatColumnDefinition({
      name: 'signal_id',
      type: 'TEXT',
      references: 'signals(signal_id)'
    }), 'signal_id TEXT REFERENCES signals(signal_id)');
  });

  it('creates migration-ready SQL for signals and events tables', () => {
    const signalTableSql = buildCreateTableStatement(SIGNALS_TABLE, SIGNAL_COLUMNS);
    const eventTableSql = buildCreateTableStatement(EVENTS_TABLE, EVENT_COLUMNS);

    assert.match(signalTableSql, /CREATE TABLE IF NOT EXISTS signals/);
    assert.match(signalTableSql, /signal_id TEXT PRIMARY KEY NOT NULL/);
    assert.match(signalTableSql, /reasons_json TEXT NOT NULL/);
    assert.match(eventTableSql, /CREATE TABLE IF NOT EXISTS events/);
    assert.match(eventTableSql, /event_id TEXT PRIMARY KEY NOT NULL/);
    assert.match(eventTableSql, /signal_id TEXT REFERENCES signals\(signal_id\)/);
  });

  it('registers journal schema migration in database migrations', () => {
    assert.equal(JOURNAL_MIGRATION.id, '001_journal_schema');
    assert.equal(JOURNAL_MIGRATION.statements.length, 5);
    assert.equal(MIGRATIONS.some((migration) => migration.id === JOURNAL_MIGRATION.id), true);
  });
});
