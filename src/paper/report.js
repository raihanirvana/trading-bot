const { ValidationError } = require('../errors');
const {
  isTerminalVirtualOrderStatus,
  validateVirtualOrder
} = require('./order');

function buildPaperPnlReport(options = {}) {
  const {
    fromDate = null,
    orders,
    toDate = null
  } = options;

  if (!Array.isArray(orders)) {
    throw new ValidationError('Paper PnL report orders must be an array');
  }

  const from = fromDate ? normalizeDateBoundary(fromDate, 'fromDate') : null;
  const to = toDate ? normalizeDateBoundary(toDate, 'toDate') : null;

  if (from && to && from.getTime() > to.getTime()) {
    throw new ValidationError('Paper PnL report fromDate must be before toDate');
  }

  const closedOrders = orders
    .filter((order) => isReportablePaperOrder(order))
    .filter((order) => isWithinDateRange(order.exit_at, from, to));

  const dailyMap = new Map();

  for (const order of closedOrders) {
    const dayKey = toUtcDayKey(order.exit_at);

    if (!dailyMap.has(dayKey)) {
      dailyMap.set(dayKey, createEmptyPaperPnlStats({ date: dayKey }));
    }

    addOrderToStats(dailyMap.get(dayKey), order);
  }

  const daily = [...dailyMap.values()]
    .map(finalizePaperPnlStats)
    .sort((left, right) => left.date.localeCompare(right.date));

  const total = finalizePaperPnlStats(closedOrders.reduce(
    (stats, order) => addOrderToStats(stats, order),
    createEmptyPaperPnlStats({ date: null })
  ));

  return {
    daily,
    total
  };
}

function isReportablePaperOrder(order) {
  validateVirtualOrder(order);

  return (
    isTerminalVirtualOrderStatus(order.status)
    && order.exit_at
    && Number.isFinite(order.pnl_net)
  );
}

function addOrderToStats(stats, order) {
  const pnlGross = Number.isFinite(order.pnl_gross) ? order.pnl_gross : 0;
  const pnlNet = order.pnl_net;
  const feesUsd = Number.isFinite(order.fees_usd) ? order.fees_usd : 0;

  stats.trade_count += 1;
  stats.pnl_gross_usd += pnlGross;
  stats.pnl_net_usd += pnlNet;
  stats.fees_usd += feesUsd;

  if (pnlNet > 0) {
    stats.win_count += 1;
    stats.gross_profit_usd += pnlNet;
  } else if (pnlNet < 0) {
    stats.loss_count += 1;
    stats.gross_loss_usd += Math.abs(pnlNet);
  } else {
    stats.breakeven_count += 1;
  }

  return stats;
}

function finalizePaperPnlStats(stats) {
  return {
    date: stats.date,
    trade_count: stats.trade_count,
    win_count: stats.win_count,
    loss_count: stats.loss_count,
    breakeven_count: stats.breakeven_count,
    winrate_pct: stats.trade_count > 0 ? (stats.win_count / stats.trade_count) * 100 : 0,
    profit_factor: stats.gross_loss_usd > 0 ? stats.gross_profit_usd / stats.gross_loss_usd : null,
    gross_profit_usd: stats.gross_profit_usd,
    gross_loss_usd: stats.gross_loss_usd,
    pnl_gross_usd: stats.pnl_gross_usd,
    pnl_net_usd: stats.pnl_net_usd,
    fees_usd: stats.fees_usd
  };
}

function createEmptyPaperPnlStats({ date }) {
  return {
    date,
    breakeven_count: 0,
    fees_usd: 0,
    gross_loss_usd: 0,
    gross_profit_usd: 0,
    loss_count: 0,
    pnl_gross_usd: 0,
    pnl_net_usd: 0,
    trade_count: 0,
    win_count: 0
  };
}

function isWithinDateRange(timestamp, from, to) {
  const date = normalizeDateBoundary(timestamp, 'exit_at');

  if (from && date.getTime() < from.getTime()) {
    return false;
  }

  if (to && date.getTime() > to.getTime()) {
    return false;
  }

  return true;
}

function toUtcDayKey(timestamp) {
  return normalizeDateBoundary(timestamp, 'exit_at').toISOString().slice(0, 10);
}

function normalizeDateBoundary(value, label) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new ValidationError(`Invalid paper PnL report date: ${label}`);
  }

  return date;
}

module.exports = {
  buildPaperPnlReport,
  isReportablePaperOrder
};
