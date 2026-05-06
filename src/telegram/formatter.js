const { ValidationError } = require('../errors');
const { validateSignal } = require('../signals/schema');

function formatSignalMessage(signal, options = {}) {
  const validation = validateSignal(signal);

  if (!validation.valid) {
    throw new ValidationError('Cannot format invalid signal', {
      errors: validation.errors
    });
  }

  const precision = options.precision || {};
  const reasons = signal.reasons.length > 0
    ? signal.reasons.map((reason) => `- ${reason}`).join('\n')
    : '- No reason provided';

  return [
    `Signal ${signal.side} ${signal.symbol}`,
    `Timeframe: ${signal.timeframe || 'n/a'}`,
    `Entry: ${formatNumber(signal.entry_price, precision.price)}`,
    `TP: ${formatNumber(signal.tp_price, precision.price)}`,
    `SL: ${formatNumber(signal.sl_price, precision.price)}`,
    `Margin: ${formatNumber(signal.margin_usd, precision.money)} USDT`,
    `Leverage: ${signal.leverage}x`,
    `Notional: ${formatNumber(signal.notional_usd, precision.money)} USDT`,
    `Qty: ${formatNumber(signal.qty, precision.qty)}`,
    `BB Width: ${formatNumber(signal.bb_width_pct, precision.indicator)}%`,
    `ADX 15m: ${formatNumber(signal.adx_15m, precision.indicator)}`,
    `Signal ID: ${signal.signal_id}`,
    'Reasons:',
    reasons
  ].join('\n');
}

function formatNumber(value, precision = 4) {
  if (!Number.isFinite(value)) {
    return 'n/a';
  }

  return Number(value.toFixed(precision)).toString();
}

module.exports = {
  formatNumber,
  formatSignalMessage
};
