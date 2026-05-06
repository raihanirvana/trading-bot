const DEFAULT_DAILY_TARGET_USD = 6;
const DEFAULT_DAILY_LOSS_STOP_USD = -18;
const DEFAULT_MIN_TRADES_FOR_TARGET = 3;

function getUtcDayKey(timestamp) {
  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString().slice(0, 10);
}

function createEmptyDailyState(dayKey) {
  return {
    dayKey,
    tradesToday: 0,
    dailyPnl: 0
  };
}

function resetDailyStateIfNeeded(state, timestamp) {
  const dayKey = getUtcDayKey(timestamp);

  if (!dayKey) {
    return {
      ...state
    };
  }

  if (!state || state.dayKey !== dayKey) {
    return createEmptyDailyState(dayKey);
  }

  return {
    dayKey: state.dayKey,
    tradesToday: state.tradesToday || 0,
    dailyPnl: state.dailyPnl || 0
  };
}

function recordClosedTrade(state, { pnl, closedAt }) {
  const nextState = resetDailyStateIfNeeded(state, closedAt);

  return {
    ...nextState,
    tradesToday: nextState.tradesToday + 1,
    dailyPnl: nextState.dailyPnl + pnl
  };
}

function evaluateDailyRules(state, options = {}) {
  const dailyTargetUsd = options.dailyTargetUsd ?? DEFAULT_DAILY_TARGET_USD;
  const dailyLossStopUsd = options.dailyLossStopUsd ?? DEFAULT_DAILY_LOSS_STOP_USD;
  const minTradesForTarget = options.minTradesForTarget ?? DEFAULT_MIN_TRADES_FOR_TARGET;
  const tradesToday = state && Number.isFinite(state.tradesToday) ? state.tradesToday : 0;
  const dailyPnl = state && Number.isFinite(state.dailyPnl) ? state.dailyPnl : 0;

  if (dailyPnl <= dailyLossStopUsd) {
    return {
      allowed: false,
      reason: 'Daily loss stop hit',
      dailyTargetHit: false,
      dailyLossHit: true
    };
  }

  if (tradesToday >= minTradesForTarget && dailyPnl >= dailyTargetUsd) {
    return {
      allowed: false,
      reason: 'Daily target hit',
      dailyTargetHit: true,
      dailyLossHit: false
    };
  }

  return {
    allowed: true,
    reason: 'Daily rules allowed',
    dailyTargetHit: false,
    dailyLossHit: false
  };
}

module.exports = {
  DEFAULT_DAILY_LOSS_STOP_USD,
  DEFAULT_DAILY_TARGET_USD,
  DEFAULT_MIN_TRADES_FOR_TARGET,
  createEmptyDailyState,
  evaluateDailyRules,
  getUtcDayKey,
  recordClosedTrade,
  resetDailyStateIfNeeded
};
