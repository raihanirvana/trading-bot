const SIGNALS_TABLE = 'signals';
const EVENTS_TABLE = 'events';

const SIGNAL_COLUMNS = Object.freeze([
  { name: 'signal_id', type: 'TEXT', required: true, primaryKey: true },
  { name: 'symbol', type: 'TEXT', required: true },
  { name: 'timeframe', type: 'TEXT', required: true },
  { name: 'side', type: 'TEXT', required: true },
  { name: 'entry_price', type: 'REAL', required: true },
  { name: 'tp_price', type: 'REAL', required: true },
  { name: 'sl_price', type: 'REAL', required: true },
  { name: 'margin_usd', type: 'REAL', required: true },
  { name: 'leverage', type: 'INTEGER', required: true },
  { name: 'notional_usd', type: 'REAL', required: true },
  { name: 'qty', type: 'REAL', required: true },
  { name: 'bb_width_pct', type: 'REAL', required: true },
  { name: 'adx_15m', type: 'REAL', required: true },
  { name: 'status', type: 'TEXT', required: true },
  { name: 'reasons_json', type: 'TEXT', required: true },
  { name: 'created_at', type: 'TEXT', required: true },
  { name: 'updated_at', type: 'TEXT', required: true }
]);

const EVENT_COLUMNS = Object.freeze([
  { name: 'event_id', type: 'TEXT', required: true, primaryKey: true },
  { name: 'signal_id', type: 'TEXT', required: false, references: 'signals(signal_id)' },
  { name: 'event_type', type: 'TEXT', required: true },
  { name: 'payload_json', type: 'TEXT', required: true },
  { name: 'created_at', type: 'TEXT', required: true }
]);

const JOURNAL_MIGRATION = Object.freeze({
  id: '001_journal_schema',
  description: 'Create journal tables for emitted signals and signal events.',
  statements: Object.freeze([
    buildCreateTableStatement(SIGNALS_TABLE, SIGNAL_COLUMNS),
    buildCreateTableStatement(EVENTS_TABLE, EVENT_COLUMNS),
    `CREATE INDEX IF NOT EXISTS idx_${SIGNALS_TABLE}_created_at ON ${SIGNALS_TABLE} (created_at);`,
    `CREATE INDEX IF NOT EXISTS idx_${EVENTS_TABLE}_signal_id ON ${EVENTS_TABLE} (signal_id);`,
    `CREATE INDEX IF NOT EXISTS idx_${EVENTS_TABLE}_created_at ON ${EVENTS_TABLE} (created_at);`
  ])
});

function buildCreateTableStatement(tableName, columns) {
  const definitions = columns.map(formatColumnDefinition);

  return [
    `CREATE TABLE IF NOT EXISTS ${tableName} (`,
    `  ${definitions.join(',\n  ')}`,
    ');'
  ].join('\n');
}

function formatColumnDefinition(column) {
  const parts = [
    column.name,
    column.type
  ];

  if (column.primaryKey) {
    parts.push('PRIMARY KEY');
  }

  if (column.required) {
    parts.push('NOT NULL');
  }

  if (column.references) {
    parts.push(`REFERENCES ${column.references}`);
  }

  return parts.join(' ');
}

function getColumnNames(columns) {
  return columns.map((column) => column.name);
}

function hasRequiredColumns(columns, requiredColumnNames) {
  const columnNames = new Set(getColumnNames(columns));

  return requiredColumnNames.every((columnName) => columnNames.has(columnName));
}

module.exports = {
  EVENTS_TABLE,
  EVENT_COLUMNS,
  JOURNAL_MIGRATION,
  SIGNALS_TABLE,
  SIGNAL_COLUMNS,
  buildCreateTableStatement,
  formatColumnDefinition,
  getColumnNames,
  hasRequiredColumns
};
