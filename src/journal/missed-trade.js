const { ValidationError } = require('../errors');
const { validateSignal } = require('../signals/schema');
const {
  VIRTUAL_OUTCOME,
  evaluateVirtualOutcome
} = require('./virtual-outcome');

const MISSED_TRADE_EVENT = 'MISSED_TRADE';

function trackMissedTrade(options = {}) {
  const {
    candles,
    journal,
    markedAt,
    signal,
    skippedReason = 'USER_SKIPPED'
  } = options;

  const missedTrade = evaluateMissedTrade({
    candles,
    markedAt,
    signal,
    skippedReason
  });

  if (!journal) {
    return {
      missedTrade,
      eventResult: null
    };
  }

  return {
    missedTrade,
    eventResult: journal.saveEvent(buildMissedTradeEvent(signal, missedTrade))
  };
}

function evaluateMissedTrade(options = {}) {
  const {
    candles,
    markedAt,
    signal,
    skippedReason = 'USER_SKIPPED'
  } = options;

  validateMissedTradeInput(signal, candles);

  const outcome = evaluateVirtualOutcome({
    candles,
    signal
  });
  const skippedAt = markedAt ? normalizeTimestamp(markedAt) : signal.timestamp;
  const pnl = calculateMissedPnl(signal, outcome);

  return {
    signal_id: signal.signal_id,
    skipped: true,
    skipped_reason: skippedReason,
    skipped_at: skippedAt,
    virtual_status: outcome.status,
    virtual_exit_reason: outcome.exit_reason,
    virtual_exit_price: outcome.exit_price,
    virtual_exit_at: outcome.exit_at,
    missed_profit_usd: pnl.missedProfitUsd,
    avoided_loss_usd: pnl.avoidedLossUsd,
    missed_pnl_usd: pnl.missedPnlUsd
  };
}

function calculateMissedPnl(signal, outcome) {
  if (outcome.status === VIRTUAL_OUTCOME.OPEN) {
    return {
      missedProfitUsd: 0,
      avoidedLossUsd: 0,
      missedPnlUsd: 0
    };
  }

  const rawPnl = calculateRawPnlUsd({
    entryPrice: signal.entry_price,
    exitPrice: outcome.exit_price,
    notionalUsd: signal.notional_usd,
    side: signal.side
  });

  if (outcome.status === VIRTUAL_OUTCOME.TP) {
    return {
      missedProfitUsd: roundMoney(rawPnl),
      avoidedLossUsd: 0,
      missedPnlUsd: roundMoney(rawPnl)
    };
  }

  return {
    missedProfitUsd: 0,
    avoidedLossUsd: roundMoney(Math.abs(rawPnl)),
    missedPnlUsd: roundMoney(rawPnl)
  };
}

function calculateRawPnlUsd({ entryPrice, exitPrice, notionalUsd, side }) {
  if (
    !['BUY', 'SELL'].includes(side) ||
    !Number.isFinite(entryPrice) ||
    entryPrice <= 0 ||
    !Number.isFinite(exitPrice) ||
    !Number.isFinite(notionalUsd)
  ) {
    throw new ValidationError('Invalid missed trade PnL input');
  }

  const priceMovePct = side === 'BUY'
    ? (exitPrice - entryPrice) / entryPrice
    : (entryPrice - exitPrice) / entryPrice;

  return notionalUsd * priceMovePct;
}

function buildMissedTradeEvent(signal, missedTrade) {
  return {
    event_id: `${signal.signal_id}-${MISSED_TRADE_EVENT}-${formatEventTimestamp(missedTrade.skipped_at)}`,
    signal_id: signal.signal_id,
    event_type: MISSED_TRADE_EVENT,
    created_at: missedTrade.skipped_at,
    payload: missedTrade
  };
}

function validateMissedTradeInput(signal, candles) {
  const validation = validateSignal(signal);

  if (!validation.valid) {
    throw new ValidationError('Cannot track missed trade for invalid signal', {
      errors: validation.errors
    });
  }

  if (!signal.timestamp || Number.isNaN(new Date(signal.timestamp).getTime())) {
    throw new ValidationError('Signal timestamp is required for missed trade tracking');
  }

  if (!Array.isArray(candles)) {
    throw new ValidationError('Candles array is required for missed trade tracking');
  }
}

function normalizeTimestamp(timestamp) {
  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    throw new ValidationError('Missed trade timestamp is invalid');
  }

  return date.toISOString();
}

function formatEventTimestamp(timestamp) {
  return normalizeTimestamp(timestamp)
    .replaceAll('-', '')
    .replaceAll(':', '')
    .replace('.000', '');
}

function roundMoney(value) {
  return Number(value.toFixed(8));
}

module.exports = {
  MISSED_TRADE_EVENT,
  buildMissedTradeEvent,
  calculateMissedPnl,
  calculateRawPnlUsd,
  evaluateMissedTrade,
  trackMissedTrade
};
