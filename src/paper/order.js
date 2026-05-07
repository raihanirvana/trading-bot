const { ValidationError } = require('../errors');
const { validateSignal } = require('../signals/schema');

const VIRTUAL_ORDER_STATUS = Object.freeze({
  PENDING: 'PENDING',
  FILLED: 'FILLED',
  TP: 'TP',
  SL: 'SL',
  TIME_EXIT: 'TIME_EXIT',
  CANCELLED: 'CANCELLED',
  EXPIRED: 'EXPIRED'
});

const TERMINAL_VIRTUAL_ORDER_STATUSES = Object.freeze([
  VIRTUAL_ORDER_STATUS.TP,
  VIRTUAL_ORDER_STATUS.SL,
  VIRTUAL_ORDER_STATUS.TIME_EXIT,
  VIRTUAL_ORDER_STATUS.CANCELLED,
  VIRTUAL_ORDER_STATUS.EXPIRED
]);

const VIRTUAL_ORDER_TRANSITIONS = Object.freeze({
  [VIRTUAL_ORDER_STATUS.PENDING]: Object.freeze([
    VIRTUAL_ORDER_STATUS.FILLED,
    VIRTUAL_ORDER_STATUS.CANCELLED,
    VIRTUAL_ORDER_STATUS.EXPIRED
  ]),
  [VIRTUAL_ORDER_STATUS.FILLED]: Object.freeze([
    VIRTUAL_ORDER_STATUS.TP,
    VIRTUAL_ORDER_STATUS.SL,
    VIRTUAL_ORDER_STATUS.TIME_EXIT
  ]),
  [VIRTUAL_ORDER_STATUS.TP]: Object.freeze([]),
  [VIRTUAL_ORDER_STATUS.SL]: Object.freeze([]),
  [VIRTUAL_ORDER_STATUS.TIME_EXIT]: Object.freeze([]),
  [VIRTUAL_ORDER_STATUS.CANCELLED]: Object.freeze([]),
  [VIRTUAL_ORDER_STATUS.EXPIRED]: Object.freeze([])
});

function buildVirtualOrderFromSignal(options = {}) {
  const {
    createdAt = new Date(),
    expiresAt = null,
    signal
  } = options;

  validateVirtualOrderSignal(signal);

  const createdAtIso = normalizeTimestamp(createdAt, 'createdAt');

  return {
    order_id: buildVirtualOrderId(signal),
    signal_id: signal.signal_id,
    symbol: signal.symbol,
    timeframe: signal.timeframe,
    side: signal.side,
    status: VIRTUAL_ORDER_STATUS.PENDING,
    entry_price: signal.entry_price,
    tp_price: signal.tp_price,
    sl_price: signal.sl_price,
    margin_usd: signal.margin_usd,
    leverage: signal.leverage,
    notional_usd: signal.notional_usd,
    qty: signal.qty,
    created_at: createdAtIso,
    updated_at: createdAtIso,
    expires_at: expiresAt ? normalizeTimestamp(expiresAt, 'expiresAt') : null,
    filled_at: null,
    exit_at: null,
    exit_reason: null,
    pnl_gross: null,
    pnl_net: null,
    fees_usd: null
  };
}

function transitionVirtualOrder(options = {}) {
  const {
    exitReason = null,
    nextStatus,
    order,
    pnlGross = null,
    pnlNet = null,
    feesUsd = null,
    timestamp = new Date()
  } = options;

  validateVirtualOrder(order);
  validateVirtualOrderStatus(nextStatus);

  assertCanTransitionVirtualOrder(order.status, nextStatus);

  const timestampIso = normalizeTimestamp(timestamp, 'timestamp');
  assertValidTransitionTimestamp({
    nextStatus,
    order,
    timestampIso
  });
  const nextOrder = {
    ...order,
    status: nextStatus,
    updated_at: timestampIso
  };

  if (nextStatus === VIRTUAL_ORDER_STATUS.FILLED) {
    nextOrder.filled_at = timestampIso;
  }

  if (isTerminalVirtualOrderStatus(nextStatus)) {
    nextOrder.exit_at = timestampIso;
    nextOrder.exit_reason = exitReason || nextStatus;
    nextOrder.pnl_gross = Number.isFinite(pnlGross) ? pnlGross : order.pnl_gross;
    nextOrder.pnl_net = Number.isFinite(pnlNet) ? pnlNet : order.pnl_net;
    nextOrder.fees_usd = Number.isFinite(feesUsd) ? feesUsd : order.fees_usd;
  }

  return nextOrder;
}

function canTransitionVirtualOrder(fromStatus, toStatus) {
  validateVirtualOrderStatus(fromStatus);
  validateVirtualOrderStatus(toStatus);

  return VIRTUAL_ORDER_TRANSITIONS[fromStatus].includes(toStatus);
}

function assertCanTransitionVirtualOrder(fromStatus, toStatus) {
  if (!canTransitionVirtualOrder(fromStatus, toStatus)) {
    throw new ValidationError('Invalid virtual order state transition', {
      from: fromStatus,
      to: toStatus
    });
  }

  return true;
}

function getAllowedVirtualOrderTransitions(status) {
  validateVirtualOrderStatus(status);

  return [...VIRTUAL_ORDER_TRANSITIONS[status]];
}

function assertValidTransitionTimestamp({ nextStatus, order, timestampIso }) {
  const timestampMs = parseOrderTimestamp(timestampIso, 'timestamp');
  const createdAtMs = parseOrderTimestamp(order.created_at, 'created_at');

  if (timestampMs < createdAtMs) {
    throw new ValidationError('Virtual order transition timestamp is before created_at', {
      created_at: order.created_at,
      timestamp: timestampIso
    });
  }

  if (nextStatus === VIRTUAL_ORDER_STATUS.FILLED && order.expires_at) {
    const expiresAtMs = parseOrderTimestamp(order.expires_at, 'expires_at');

    if (timestampMs >= expiresAtMs) {
      throw new ValidationError('Virtual order cannot fill after expires_at', {
        expires_at: order.expires_at,
        timestamp: timestampIso
      });
    }
  }

  if ([VIRTUAL_ORDER_STATUS.TP, VIRTUAL_ORDER_STATUS.SL, VIRTUAL_ORDER_STATUS.TIME_EXIT].includes(nextStatus)) {
    const filledAtMs = parseOrderTimestamp(order.filled_at, 'filled_at');

    if (timestampMs < filledAtMs) {
      throw new ValidationError('Virtual order exit timestamp is before filled_at', {
        filled_at: order.filled_at,
        timestamp: timestampIso
      });
    }
  }
}

function validateVirtualOrder(order) {
  if (!order || typeof order !== 'object') {
    throw new ValidationError('Virtual order is required');
  }

  validateVirtualOrderStatus(order.status);

  for (const field of ['order_id', 'signal_id', 'symbol', 'side']) {
    if (!order[field]) {
      throw new ValidationError(`Virtual order missing ${field}`);
    }
  }

  for (const field of ['entry_price', 'tp_price', 'sl_price', 'margin_usd', 'leverage', 'notional_usd', 'qty']) {
    if (!Number.isFinite(order[field]) || order[field] <= 0) {
      throw new ValidationError(`Virtual order invalid positive number: ${field}`);
    }
  }

  return {
    valid: true,
    errors: []
  };
}

function buildVirtualOrderId(signal) {
  return `paper-${signal.signal_id}`;
}

function isTerminalVirtualOrderStatus(status) {
  validateVirtualOrderStatus(status);

  return TERMINAL_VIRTUAL_ORDER_STATUSES.includes(status);
}

function validateVirtualOrderStatus(status) {
  if (!Object.values(VIRTUAL_ORDER_STATUS).includes(status)) {
    throw new ValidationError('Invalid virtual order status', {
      status
    });
  }
}

function validateVirtualOrderSignal(signal) {
  const validation = validateSignal(signal);

  if (!validation.valid) {
    throw new ValidationError('Cannot build virtual order from invalid signal', {
      errors: validation.errors
    });
  }
}

function normalizeTimestamp(timestamp, label) {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    throw new ValidationError(`Invalid virtual order timestamp: ${label}`);
  }

  return date.toISOString();
}

function parseOrderTimestamp(timestamp, label) {
  const time = new Date(timestamp).getTime();

  if (Number.isNaN(time)) {
    throw new ValidationError(`Invalid virtual order timestamp: ${label}`);
  }

  return time;
}

module.exports = {
  TERMINAL_VIRTUAL_ORDER_STATUSES,
  VIRTUAL_ORDER_STATUS,
  VIRTUAL_ORDER_TRANSITIONS,
  assertCanTransitionVirtualOrder,
  assertValidTransitionTimestamp,
  buildVirtualOrderFromSignal,
  buildVirtualOrderId,
  canTransitionVirtualOrder,
  getAllowedVirtualOrderTransitions,
  isTerminalVirtualOrderStatus,
  transitionVirtualOrder,
  validateVirtualOrder
};
