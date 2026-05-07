const { calculateBollingerBands } = require('../indicators/bollinger');
const { ValidationError } = require('../errors');
const { evaluateSignalCandidate } = require('../signals/evaluator');
const { createSignalIdempotencyRegistry } = require('../signals/idempotency');
const { getPreviousBandLevel } = require('../signals/previous-band');
const {
  recordClosedTrade,
  resetDailyStateIfNeeded
} = require('../signals/daily-rules');
const { buildVirtualOrderFromSignal, isTerminalVirtualOrderStatus } = require('./order');
const { simulateMaxHoldExit } = require('./max-hold');
const { simulatePendingLimitFill } = require('./fill');
const { simulateTpSlExit } = require('./exit');

const DEFAULT_REPLAY_ADX_15M = 24;

function replayHistoricalCandles(options = {}) {
  const {
    adxSeries = [],
    bollingerOptions,
    candles,
    dailyOptions,
    feeConfig,
    initialDailyState = {
      dailyPnl: 0,
      dayKey: null,
      tradesToday: 0
    },
    leverage,
    marginUsd,
    maxHoldBars,
    symbol,
    timeframe
  } = options;

  validateReplayInput({
    adxSeries,
    candles,
    leverage,
    marginUsd,
    symbol,
    timeframe
  });

  const sortedCandles = normalizeReplayCandles(candles);
  const closeValues = sortedCandles.map((candle) => candle.close);
  const bollingerBands = calculateBollingerBands(closeValues, bollingerOptions);
  const idempotencyRegistry = createSignalIdempotencyRegistry();
  const signals = [];
  const events = [];
  const orders = [];
  const dailyState = {
    ...initialDailyState
  };
  let activeOrder = null;

  for (let index = 0; index < sortedCandles.length; index += 1) {
    const candle = sortedCandles[index];
    let closedOrderThisCandle = false;

    if (activeOrder) {
      const processed = processActiveOrder({
        candle,
        candlesSoFar: sortedCandles.slice(0, index + 1),
        feeConfig,
        maxHoldBars,
        order: activeOrder
      });
      activeOrder = processed.order;
      replaceOrder(orders, activeOrder);

      for (const event of processed.events) {
        events.push(event);
      }

      if (isTerminalVirtualOrderStatus(activeOrder.status)) {
        recordDailyClosedOrder(dailyState, activeOrder);
        activeOrder = null;
        closedOrderThisCandle = true;
      }
    }

    if (!activeOrder && !closedOrderThisCandle) {
      resetReplayDailyState(dailyState, candle.timestamp);
      const signalResult = evaluateSignalCandidate({
        adx15m: resolveAdxValue({
          adxSeries,
          candle,
          index
        }),
        currentCandle: candle,
        dailyOptions,
        dailyState,
        hasActivePosition: false,
        idempotencyRegistry,
        leverage,
        marginUsd,
        previousBandLevel: getPreviousBandLevel(bollingerBands, index),
        symbol,
        timeframe,
        timestamp: candle.timestamp
      });

      if (signalResult.signal) {
        signals.push(signalResult.signal);
        const pendingOrder = buildVirtualOrderFromSignal({
          createdAt: candle.timestamp,
          signal: signalResult.signal
        });
        orders.push(pendingOrder);
        events.push(buildReplayEvent({
          candle,
          order: pendingOrder,
          signal: signalResult.signal,
          type: 'PAPER_SIGNAL'
        }));

        const fillResult = simulatePendingLimitFill({
          candle,
          order: pendingOrder
        });
        activeOrder = fillResult.order;

        if (fillResult.filled) {
          replaceOrder(orders, activeOrder);
          events.push(buildReplayEvent({
            candle,
            order: activeOrder,
            signal: signalResult.signal,
            type: 'PAPER_FILL'
          }));
        }
      }
    }
  }

  return {
    events,
    orders,
    signals
  };
}

function processActiveOrder({ candle, candlesSoFar, feeConfig, maxHoldBars, order }) {
  const events = [];

  if (order.status === 'PENDING') {
    const fillResult = simulatePendingLimitFill({
      candle,
      order
    });

    if (fillResult.filled) {
      events.push(buildReplayEvent({
        candle,
        order: fillResult.order,
        signal: null,
        type: 'PAPER_FILL'
      }));
    }

    return {
      events,
      order: fillResult.order
    };
  }

  if (order.status === 'FILLED') {
    const tpSlResult = simulateTpSlExit({
      candle,
      feeConfig,
      order
    });

    if (tpSlResult.exited) {
      events.push(buildReplayEvent({
        candle,
        order: tpSlResult.order,
        signal: null,
        type: tpSlResult.order.status === 'TP' ? 'PAPER_TP' : 'PAPER_SL'
      }));

      return {
        events,
        order: tpSlResult.order
      };
    }

    const maxHoldResult = simulateMaxHoldExit({
      candles: candlesSoFar,
      feeConfig,
      maxHoldBars,
      order
    });

    if (maxHoldResult.exited) {
      events.push(buildReplayEvent({
        candle,
        order: maxHoldResult.order,
        signal: null,
        type: 'PAPER_TIME_EXIT'
      }));
    }

    return {
      events,
      order: maxHoldResult.order
    };
  }

  return {
    events,
    order
  };
}

function buildReplayEvent({ candle, order, signal, type }) {
  return {
    event_id: `${order.order_id}-${type}-${formatReplayTimestamp(candle.timestamp)}`,
    order_id: order.order_id,
    signal_id: order.signal_id,
    type,
    timestamp: new Date(candle.timestamp).toISOString(),
    order_status: order.status,
    pnl_net: order.pnl_net,
    signal_side: signal ? signal.side : null
  };
}

function recordDailyClosedOrder(dailyState, order) {
  const nextState = recordClosedTrade(dailyState, {
    closedAt: order.exit_at,
    pnl: Number.isFinite(order.pnl_net) ? order.pnl_net : 0
  });

  Object.assign(dailyState, nextState);
}

function resetReplayDailyState(dailyState, timestamp) {
  Object.assign(dailyState, resetDailyStateIfNeeded(dailyState, timestamp));
}

function replaceOrder(orders, nextOrder) {
  const index = orders.findIndex((order) => order.order_id === nextOrder.order_id);

  if (index >= 0) {
    orders[index] = nextOrder;
  }
}

function resolveAdxValue({ adxSeries, candle, index }) {
  if (Number.isFinite(adxSeries[index])) {
    return adxSeries[index];
  }

  if (Number.isFinite(candle.adx_15m)) {
    return candle.adx_15m;
  }

  return DEFAULT_REPLAY_ADX_15M;
}

function normalizeReplayCandles(candles) {
  return candles
    .map((candle) => ({
      ...candle,
      timestamp: new Date(candle.timestamp).toISOString()
    }))
    .sort((left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime());
}

function formatReplayTimestamp(timestamp) {
  return new Date(timestamp).toISOString()
    .replaceAll('-', '')
    .replaceAll(':', '')
    .replace('.000', '');
}

function validateReplayInput({ adxSeries, candles, leverage, marginUsd, symbol, timeframe }) {
  if (!symbol || !timeframe) {
    throw new ValidationError('Replay symbol and timeframe are required');
  }

  if (!Number.isFinite(marginUsd) || marginUsd <= 0 || !Number.isFinite(leverage) || leverage <= 0) {
    throw new ValidationError('Replay marginUsd and leverage must be positive numbers');
  }

  if (!Array.isArray(candles)) {
    throw new ValidationError('Replay candles must be an array');
  }

  if (!Array.isArray(adxSeries)) {
    throw new ValidationError('Replay adxSeries must be an array');
  }

  for (const candle of candles) {
    if (
      !candle ||
      Number.isNaN(new Date(candle.timestamp).getTime()) ||
      !Number.isFinite(candle.open) ||
      !Number.isFinite(candle.high) ||
      !Number.isFinite(candle.low) ||
      !Number.isFinite(candle.close)
    ) {
      throw new ValidationError('Invalid candle for historical replay');
    }
  }
}

module.exports = {
  DEFAULT_REPLAY_ADX_15M,
  replayHistoricalCandles
};
