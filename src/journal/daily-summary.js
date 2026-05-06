const { ValidationError } = require('../errors');
const { MISSED_TRADE_EVENT } = require('./missed-trade');

const DAILY_SUMMARY_EVENT_TYPES = Object.freeze({
  MISSED_TRADE: MISSED_TRADE_EVENT,
  VIRTUAL_SL: 'VIRTUAL_SL',
  VIRTUAL_TP: 'VIRTUAL_TP'
});

function buildDailySummary(input = {}) {
  const {
    date,
    events = [],
    signals = []
  } = input;
  const dayKey = normalizeDayKey(date);
  const daySignals = signals.filter((signal) => getDayKey(signal.created_at) === dayKey);
  const dayEvents = events.filter((event) => getDayKey(event.created_at) === dayKey);
  const missedTrades = dayEvents
    .filter((event) => event.event_type === DAILY_SUMMARY_EVENT_TYPES.MISSED_TRADE)
    .map((event) => parseEventPayload(event));

  return {
    date: dayKey,
    total_signals: daySignals.length,
    virtual_tp: countEvents(dayEvents, DAILY_SUMMARY_EVENT_TYPES.VIRTUAL_TP),
    virtual_sl: countEvents(dayEvents, DAILY_SUMMARY_EVENT_TYPES.VIRTUAL_SL),
    missed_trades: missedTrades.length,
    missed_profit_usd: roundMoney(sumPayloadField(missedTrades, 'missed_profit_usd')),
    avoided_loss_usd: roundMoney(sumPayloadField(missedTrades, 'avoided_loss_usd')),
    missed_pnl_usd: roundMoney(sumPayloadField(missedTrades, 'missed_pnl_usd'))
  };
}

function buildDailySummaryFromJournal(journal, options = {}) {
  if (!journal || typeof journal.listSignals !== 'function' || typeof journal.listEvents !== 'function') {
    throw new ValidationError('Journal with listSignals and listEvents is required for daily summary');
  }

  return buildDailySummary({
    date: options.date || new Date(),
    events: journal.listEvents(),
    signals: journal.listSignals()
  });
}

function formatDailySummary(summary) {
  return [
    `Daily Summary ${summary.date}`,
    `Total signals: ${summary.total_signals}`,
    `Virtual TP: ${summary.virtual_tp}`,
    `Virtual SL: ${summary.virtual_sl}`,
    `Missed trades: ${summary.missed_trades}`,
    `Missed profit: ${formatMoney(summary.missed_profit_usd)} USDT`,
    `Avoided loss: ${formatMoney(summary.avoided_loss_usd)} USDT`,
    `Missed PnL: ${formatMoney(summary.missed_pnl_usd)} USDT`
  ].join('\n');
}

function countEvents(events, eventType) {
  return events.filter((event) => event.event_type === eventType).length;
}

function parseEventPayload(event) {
  if (!event || typeof event.payload_json !== 'string') {
    return {};
  }

  try {
    return JSON.parse(event.payload_json);
  } catch (_error) {
    return {};
  }
}

function sumPayloadField(payloads, field) {
  return payloads.reduce((sum, payload) => {
    const value = payload[field];

    return Number.isFinite(value) ? sum + value : sum;
  }, 0);
}

function normalizeDayKey(date) {
  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    throw new ValidationError('Daily summary date is invalid');
  }

  return parsed.toISOString().slice(0, 10);
}

function getDayKey(timestamp) {
  if (!timestamp) {
    return null;
  }

  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString().slice(0, 10);
}

function formatMoney(value) {
  return Number(value.toFixed(2)).toString();
}

function roundMoney(value) {
  return Number(value.toFixed(8));
}

module.exports = {
  DAILY_SUMMARY_EVENT_TYPES,
  buildDailySummary,
  buildDailySummaryFromJournal,
  formatDailySummary,
  getDayKey,
  normalizeDayKey
};
