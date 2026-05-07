const { ValidationError } = require('../errors');
const {
  VIRTUAL_ORDER_STATUS,
  transitionVirtualOrder,
  validateVirtualOrder
} = require('./order');
const {
  calculateNetPnl,
  calculateOrderFees,
  normalizePaperFeeConfig
} = require('./fees');

function simulateTpSlExit(options = {}) {
  const {
    candle,
    feeConfig,
    order
  } = options;

  validateVirtualOrder(order);
  validateExitCandle(candle);

  if (order.status !== VIRTUAL_ORDER_STATUS.FILLED) {
    return {
      exited: false,
      order,
      reason: 'ORDER_NOT_FILLED'
    };
  }

  const touch = getTpSlTouch(order, candle);

  if (!touch.touched) {
    return {
      exited: false,
      order,
      reason: 'TP_SL_NOT_TOUCHED'
    };
  }

  const grossPnl = calculateGrossPnl({
    exitPrice: touch.exit_price,
    order
  });
  const fees = calculateOrderFees({
    entryPrice: order.entry_price,
    exitPrice: touch.exit_price,
    feeConfig: normalizePaperFeeConfig(feeConfig),
    qty: order.qty
  });
  const netPnl = calculateNetPnl({
    feesUsd: fees.fees_usd,
    grossPnl
  });

  return {
    exit_price: touch.exit_price,
    exited: true,
    fees,
    order: transitionVirtualOrder({
      exitReason: touch.exit_reason,
      feesUsd: fees.fees_usd,
      nextStatus: touch.status,
      order,
      pnlGross: grossPnl,
      pnlNet: netPnl,
      timestamp: candle.timestamp
    }),
    reason: touch.exit_reason
  };
}

function getTpSlTouch(order, candle) {
  if (order.side === 'BUY') {
    return resolveTouch({
      slHit: candle.low <= order.sl_price,
      slPrice: order.sl_price,
      tpHit: candle.high >= order.tp_price,
      tpPrice: order.tp_price
    });
  }

  if (order.side === 'SELL') {
    return resolveTouch({
      slHit: candle.high >= order.sl_price,
      slPrice: order.sl_price,
      tpHit: candle.low <= order.tp_price,
      tpPrice: order.tp_price
    });
  }

  throw new ValidationError('Invalid virtual order side', {
    side: order.side
  });
}

function resolveTouch({ slHit, slPrice, tpHit, tpPrice }) {
  if (slHit) {
    return {
      exit_price: slPrice,
      exit_reason: 'PAPER_SL',
      status: VIRTUAL_ORDER_STATUS.SL,
      touched: true
    };
  }

  if (tpHit) {
    return {
      exit_price: tpPrice,
      exit_reason: 'PAPER_TP',
      status: VIRTUAL_ORDER_STATUS.TP,
      touched: true
    };
  }

  return {
    exit_price: null,
    exit_reason: null,
    status: null,
    touched: false
  };
}

function calculateGrossPnl({ exitPrice, order }) {
  if (order.side === 'BUY') {
    return (exitPrice - order.entry_price) * order.qty;
  }

  if (order.side === 'SELL') {
    return (order.entry_price - exitPrice) * order.qty;
  }

  throw new ValidationError('Invalid virtual order side', {
    side: order.side
  });
}

function validateExitCandle(candle) {
  if (
    !candle ||
    Number.isNaN(new Date(candle.timestamp).getTime()) ||
    !Number.isFinite(candle.high) ||
    !Number.isFinite(candle.low)
  ) {
    throw new ValidationError('Invalid candle for TP/SL exit simulation');
  }
}

module.exports = {
  calculateGrossPnl,
  getTpSlTouch,
  simulateTpSlExit
};
