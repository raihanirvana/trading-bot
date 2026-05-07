const { ValidationError } = require('../errors');
const {
  calculateNetPnl,
  calculateOrderFees,
  normalizePaperFeeConfig
} = require('./fees');
const {
  VIRTUAL_ORDER_STATUS,
  transitionVirtualOrder,
  validateVirtualOrder
} = require('./order');
const { calculateGrossPnl } = require('./exit');

const DEFAULT_MAX_HOLD_BARS = 8;

function simulateMaxHoldExit(options = {}) {
  const {
    candles,
    feeConfig,
    maxHoldBars = DEFAULT_MAX_HOLD_BARS,
    order
  } = options;

  validateVirtualOrder(order);
  validateMaxHoldBars(maxHoldBars);
  validateMaxHoldCandles(candles);

  if (order.status !== VIRTUAL_ORDER_STATUS.FILLED) {
    return {
      bars_held: 0,
      exited: false,
      order,
      reason: 'ORDER_NOT_FILLED'
    };
  }

  const heldCandles = getHeldCandles({
    candles,
    filledAt: order.filled_at
  });

  if (heldCandles.length < maxHoldBars) {
    return {
      bars_held: heldCandles.length,
      exited: false,
      order,
      reason: 'MAX_HOLD_NOT_REACHED'
    };
  }

  const exitCandle = heldCandles[maxHoldBars - 1];
  const exitPrice = exitCandle.close;
  const grossPnl = calculateGrossPnl({
    exitPrice,
    order
  });
  const fees = calculateOrderFees({
    entryPrice: order.entry_price,
    exitPrice,
    feeConfig: normalizePaperFeeConfig(feeConfig),
    qty: order.qty
  });
  const netPnl = calculateNetPnl({
    feesUsd: fees.fees_usd,
    grossPnl
  });

  return {
    bars_held: maxHoldBars,
    exit_price: exitPrice,
    exited: true,
    fees,
    order: transitionVirtualOrder({
      exitReason: 'PAPER_TIME_EXIT',
      feesUsd: fees.fees_usd,
      nextStatus: VIRTUAL_ORDER_STATUS.TIME_EXIT,
      order,
      pnlGross: grossPnl,
      pnlNet: netPnl,
      timestamp: exitCandle.timestamp
    }),
    reason: 'PAPER_TIME_EXIT'
  };
}

function getHeldCandles({ candles, filledAt }) {
  const filledAtMs = new Date(filledAt).getTime();

  if (Number.isNaN(filledAtMs)) {
    throw new ValidationError('Filled timestamp is required for max-hold simulation');
  }

  return candles
    .filter((candle) => new Date(candle.timestamp).getTime() > filledAtMs)
    .sort((left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime());
}

function validateMaxHoldCandles(candles) {
  if (!Array.isArray(candles)) {
    throw new ValidationError('Candles array is required for max-hold simulation');
  }

  for (const candle of candles) {
    if (
      !candle ||
      Number.isNaN(new Date(candle.timestamp).getTime()) ||
      !Number.isFinite(candle.close)
    ) {
      throw new ValidationError('Invalid candle for max-hold simulation');
    }
  }
}

function validateMaxHoldBars(maxHoldBars) {
  if (!Number.isInteger(maxHoldBars) || maxHoldBars <= 0) {
    throw new ValidationError('maxHoldBars must be a positive integer');
  }
}

module.exports = {
  DEFAULT_MAX_HOLD_BARS,
  getHeldCandles,
  simulateMaxHoldExit
};
