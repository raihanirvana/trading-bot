const { ValidationError } = require('../errors');
const {
  EVENT_COLUMNS,
  SIGNAL_COLUMNS,
  getColumnNames
} = require('./schema');

const SIGNAL_CSV_HEADERS = Object.freeze(getColumnNames(SIGNAL_COLUMNS));
const EVENT_CSV_HEADERS = Object.freeze(getColumnNames(EVENT_COLUMNS));

function exportJournalCsv(journal) {
  if (!journal || typeof journal.listSignals !== 'function' || typeof journal.listEvents !== 'function') {
    throw new ValidationError('Journal with listSignals and listEvents is required for CSV export');
  }

  return {
    signalsCsv: recordsToCsv(journal.listSignals(), SIGNAL_CSV_HEADERS),
    eventsCsv: recordsToCsv(journal.listEvents(), EVENT_CSV_HEADERS)
  };
}

function recordsToCsv(records, headers) {
  if (!Array.isArray(records)) {
    throw new ValidationError('CSV records must be an array');
  }

  if (!Array.isArray(headers) || headers.length === 0) {
    throw new ValidationError('CSV headers are required');
  }

  const lines = [
    headers.map(escapeCsvValue).join(',')
  ];

  for (const record of records) {
    lines.push(headers.map((header) => escapeCsvValue(record ? record[header] : '')).join(','));
  }

  return `${lines.join('\n')}\n`;
}

function escapeCsvValue(value) {
  if (value === undefined || value === null) {
    return '';
  }

  const text = typeof value === 'string' ? value : String(value);

  if (/[",\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}

function countCsvRows(csv) {
  if (typeof csv !== 'string' || csv.trim() === '') {
    return 0;
  }

  return csv.trimEnd().split('\n').length - 1;
}

module.exports = {
  EVENT_CSV_HEADERS,
  SIGNAL_CSV_HEADERS,
  countCsvRows,
  escapeCsvValue,
  exportJournalCsv,
  recordsToCsv
};
