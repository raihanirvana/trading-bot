const { ValidationError } = require('../errors');
const {
  DEFAULT_DAILY_LOSS_STOP_USD,
  DEFAULT_DAILY_TARGET_USD,
  DEFAULT_MIN_TRADES_FOR_TARGET
} = require('../signals/daily-rules');
const { buildPaperPnlReport } = require('./report');

function buildPaperDailySummary(options = {}) {
  const {
    dailyLossStopUsd = DEFAULT_DAILY_LOSS_STOP_USD,
    dailyTargetUsd = DEFAULT_DAILY_TARGET_USD,
    date,
    minTradesForTarget = DEFAULT_MIN_TRADES_FOR_TARGET,
    orders
  } = options;

  const dayKey = normalizeDayKey(date);
  validateDailySummaryOptions({
    dailyLossStopUsd,
    dailyTargetUsd,
    minTradesForTarget,
    orders
  });

  const report = buildPaperPnlReport({
    fromDate: `${dayKey}T00:00:00.000Z`,
    orders,
    toDate: `${dayKey}T23:59:59.999Z`
  });
  const stats = report.daily[0] || createEmptyDailyStats(dayKey);

  return finalizePaperDailySummary({
    dailyLossStopUsd,
    dailyTargetUsd,
    minTradesForTarget,
    stats
  });
}

function buildPaperDailySummaries(options = {}) {
  const {
    dailyLossStopUsd = DEFAULT_DAILY_LOSS_STOP_USD,
    dailyTargetUsd = DEFAULT_DAILY_TARGET_USD,
    minTradesForTarget = DEFAULT_MIN_TRADES_FOR_TARGET,
    orders
  } = options;

  validateDailySummaryOptions({
    dailyLossStopUsd,
    dailyTargetUsd,
    minTradesForTarget,
    orders
  });

  return buildPaperPnlReport({ orders }).daily.map((stats) => finalizePaperDailySummary({
    dailyLossStopUsd,
    dailyTargetUsd,
    minTradesForTarget,
    stats
  }));
}

function finalizePaperDailySummary({
  dailyLossStopUsd,
  dailyTargetUsd,
  minTradesForTarget,
  stats
}) {
  const dailyTargetHit = stats.trade_count >= minTradesForTarget && stats.pnl_net_usd >= dailyTargetUsd;
  const dailyLossHit = stats.pnl_net_usd <= dailyLossStopUsd;

  return {
    ...stats,
    daily_target_usd: dailyTargetUsd,
    daily_loss_stop_usd: dailyLossStopUsd,
    min_trades_for_target: minTradesForTarget,
    daily_target_hit: dailyTargetHit,
    daily_loss_hit: dailyLossHit,
    allowed_next_entry: !dailyTargetHit && !dailyLossHit
  };
}

function createEmptyDailyStats(date) {
  return {
    date,
    trade_count: 0,
    win_count: 0,
    loss_count: 0,
    breakeven_count: 0,
    winrate_pct: 0,
    profit_factor: null,
    gross_profit_usd: 0,
    gross_loss_usd: 0,
    pnl_gross_usd: 0,
    pnl_net_usd: 0,
    fees_usd: 0
  };
}

function normalizeDayKey(value) {
  if (!value) {
    throw new ValidationError('Paper daily summary date is required');
  }

  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new ValidationError('Invalid paper daily summary date');
  }

  return date.toISOString().slice(0, 10);
}

function validateDailySummaryOptions({
  dailyLossStopUsd,
  dailyTargetUsd,
  minTradesForTarget,
  orders
}) {
  if (!Array.isArray(orders)) {
    throw new ValidationError('Paper daily summary orders must be an array');
  }

  if (!Number.isFinite(dailyTargetUsd)) {
    throw new ValidationError('Paper daily summary dailyTargetUsd must be finite');
  }

  if (!Number.isFinite(dailyLossStopUsd)) {
    throw new ValidationError('Paper daily summary dailyLossStopUsd must be finite');
  }

  if (!Number.isInteger(minTradesForTarget) || minTradesForTarget <= 0) {
    throw new ValidationError('Paper daily summary minTradesForTarget must be a positive integer');
  }
}

module.exports = {
  buildPaperDailySummaries,
  buildPaperDailySummary
};
