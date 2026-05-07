const { ValidationError } = require('../errors');
const {
  VIRTUAL_ORDER_STATUS,
  transitionVirtualOrder,
  validateVirtualOrder
} = require('./order');

function simulatePendingLimitFill(options = {}) {
  const {
    candle,
    order
  } = options;

  validateVirtualOrder(order);
  validateFillCandle(candle);

  if (order.status !== VIRTUAL_ORDER_STATUS.PENDING) {
    return {
      filled: false,
      order,
      reason: 'ORDER_NOT_PENDING'
    };
  }

  if (isExpiredAtCandle(order, candle)) {
    return {
      filled: false,
      order: transitionVirtualOrder({
        exitReason: 'PAPER_EXPIRED',
        nextStatus: VIRTUAL_ORDER_STATUS.EXPIRED,
        order,
        timestamp: candle.timestamp
      }),
      reason: 'ORDER_EXPIRED'
    };
  }

  if (!isLimitTouched(order, candle)) {
    return {
      filled: false,
      order,
      reason: 'LIMIT_NOT_TOUCHED'
    };
  }

  return {
    filled: true,
    fill_price: order.entry_price,
    order: transitionVirtualOrder({
      nextStatus: VIRTUAL_ORDER_STATUS.FILLED,
      order,
      timestamp: candle.timestamp
    }),
    reason: 'LIMIT_TOUCHED'
  };
}

function isExpiredAtCandle(order, candle) {
  if (!order.expires_at) {
    return false;
  }

  return new Date(candle.timestamp).getTime() >= new Date(order.expires_at).getTime();
}

function isLimitTouched(order, candle) {
  if (order.side === 'BUY') {
    return candle.low <= order.entry_price;
  }

  if (order.side === 'SELL') {
    return candle.high >= order.entry_price;
  }

  throw new ValidationError('Invalid virtual order side', {
    side: order.side
  });
}

function validateFillCandle(candle) {
  if (
    !candle ||
    Number.isNaN(new Date(candle.timestamp).getTime()) ||
    !Number.isFinite(candle.high) ||
    !Number.isFinite(candle.low)
  ) {
    throw new ValidationError('Invalid candle for pending limit fill simulation');
  }
}

module.exports = {
  isLimitTouched,
  isExpiredAtCandle,
  simulatePendingLimitFill
};
