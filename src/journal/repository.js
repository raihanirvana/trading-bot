const { DependencyError, ValidationError } = require('../errors');
const { validateSignal } = require('../signals/schema');

function createMemoryJournalAdapter(initialState = {}) {
  const signals = new Map(initialState.signals || []);
  const events = new Map(initialState.events || []);

  return {
    insertSignal(record) {
      if (signals.has(record.signal_id)) {
        return {
          inserted: false,
          duplicate: true,
          signal: signals.get(record.signal_id)
        };
      }

      signals.set(record.signal_id, record);

      return {
        inserted: true,
        duplicate: false,
        signal: record
      };
    },
    getSignal(signalId) {
      return signals.get(signalId) || null;
    },
    listSignals() {
      return Array.from(signals.values());
    },
    insertEvent(record) {
      if (events.has(record.event_id)) {
        return {
          inserted: false,
          duplicate: true,
          event: events.get(record.event_id)
        };
      }

      events.set(record.event_id, record);

      return {
        inserted: true,
        duplicate: false,
        event: record
      };
    },
    listEvents() {
      return Array.from(events.values());
    }
  };
}

function createJournalRepository(options = {}) {
  const adapter = options.adapter || createMemoryJournalAdapter();
  const now = options.now || (() => new Date());

  if (typeof adapter.insertSignal !== 'function') {
    throw new DependencyError('Journal adapter must implement insertSignal');
  }

  return {
    saveSignal(signal) {
      const record = toSignalJournalRecord(signal, now());

      try {
        return adapter.insertSignal(record);
      } catch (error) {
        throw new DependencyError('Failed to save signal to journal', {
          cause: error.message,
          signalId: record.signal_id
        });
      }
    },
    saveEvent(event) {
      if (typeof adapter.insertEvent !== 'function') {
        throw new DependencyError('Journal adapter must implement insertEvent');
      }

      const record = toEventJournalRecord(event, now());

      try {
        return adapter.insertEvent(record);
      } catch (error) {
        throw new DependencyError('Failed to save event to journal', {
          cause: error.message,
          eventId: record.event_id,
          signalId: record.signal_id
        });
      }
    },
    getSignal(signalId) {
      if (typeof adapter.getSignal !== 'function') {
        return null;
      }

      return adapter.getSignal(signalId);
    },
    listSignals() {
      if (typeof adapter.listSignals !== 'function') {
        return [];
      }

      return adapter.listSignals();
    },
    listEvents() {
      if (typeof adapter.listEvents !== 'function') {
        return [];
      }

      return adapter.listEvents();
    }
  };
}

function toSignalJournalRecord(signal, timestamp = new Date()) {
  const validation = validateSignal(signal);

  if (!validation.valid) {
    throw new ValidationError('Cannot save invalid signal to journal', {
      errors: validation.errors
    });
  }

  const savedAt = normalizeTimestamp(timestamp);

  return {
    signal_id: signal.signal_id,
    symbol: signal.symbol,
    timeframe: signal.timeframe,
    side: signal.side,
    entry_price: signal.entry_price,
    tp_price: signal.tp_price,
    sl_price: signal.sl_price,
    margin_usd: signal.margin_usd,
    leverage: signal.leverage,
    notional_usd: signal.notional_usd,
    qty: signal.qty,
    bb_width_pct: signal.bb_width_pct,
    adx_15m: signal.adx_15m,
    status: signal.status,
    reasons_json: JSON.stringify(signal.reasons),
    created_at: savedAt,
    updated_at: savedAt
  };
}

function toEventJournalRecord(event, timestamp = new Date()) {
  if (!event || typeof event !== 'object') {
    throw new ValidationError('Journal event is required');
  }

  const eventId = normalizeRequiredString(event.event_id, 'event_id');
  const eventType = normalizeRequiredString(event.event_type, 'event_type');
  const savedAt = normalizeTimestamp(event.created_at || timestamp);

  return {
    event_id: eventId,
    signal_id: event.signal_id ? String(event.signal_id) : null,
    event_type: eventType,
    payload_json: JSON.stringify(event.payload || {}),
    created_at: savedAt
  };
}

function normalizeTimestamp(timestamp) {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    throw new ValidationError('Journal timestamp is invalid');
  }

  return date.toISOString();
}

function normalizeRequiredString(value, label) {
  if (value === undefined || value === null || String(value).trim() === '') {
    throw new ValidationError(`${label} is required`);
  }

  return String(value).trim();
}

module.exports = {
  createJournalRepository,
  createMemoryJournalAdapter,
  normalizeTimestamp,
  toEventJournalRecord,
  toSignalJournalRecord
};
