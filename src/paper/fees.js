const { ValidationError } = require('../errors');

const DEFAULT_PAPER_FEE_CONFIG = Object.freeze({
  makerFeeRate: 0.0002,
  takerFeeRate: 0.0006
});

function calculateOrderFees(options = {}) {
  const {
    entryPrice,
    exitPrice,
    feeConfig = DEFAULT_PAPER_FEE_CONFIG,
    qty
  } = options;

  validateFeeInput({ entryPrice, exitPrice, feeConfig, qty });

  const entryFee = entryPrice * qty * feeConfig.makerFeeRate;
  const exitFee = exitPrice * qty * feeConfig.takerFeeRate;

  return {
    entry_fee_usd: entryFee,
    exit_fee_usd: exitFee,
    fees_usd: entryFee + exitFee,
    maker_fee_rate: feeConfig.makerFeeRate,
    taker_fee_rate: feeConfig.takerFeeRate
  };
}

function calculateNetPnl({ feesUsd, grossPnl }) {
  if (!Number.isFinite(grossPnl) || !Number.isFinite(feesUsd) || feesUsd < 0) {
    throw new ValidationError('Invalid PnL or fee input for net PnL calculation');
  }

  return grossPnl - feesUsd;
}

function normalizePaperFeeConfig(config = {}) {
  const feeConfig = {
    makerFeeRate: config.makerFeeRate ?? DEFAULT_PAPER_FEE_CONFIG.makerFeeRate,
    takerFeeRate: config.takerFeeRate ?? DEFAULT_PAPER_FEE_CONFIG.takerFeeRate
  };

  validateFeeRates(feeConfig);

  return feeConfig;
}

function validateFeeInput({ entryPrice, exitPrice, feeConfig, qty }) {
  if (!Number.isFinite(entryPrice) || entryPrice <= 0) {
    throw new ValidationError('Invalid entry price for fee calculation');
  }

  if (!Number.isFinite(exitPrice) || exitPrice <= 0) {
    throw new ValidationError('Invalid exit price for fee calculation');
  }

  if (!Number.isFinite(qty) || qty <= 0) {
    throw new ValidationError('Invalid qty for fee calculation');
  }

  validateFeeRates(feeConfig);
}

function validateFeeRates(feeConfig) {
  if (
    !feeConfig ||
    !Number.isFinite(feeConfig.makerFeeRate) ||
    !Number.isFinite(feeConfig.takerFeeRate) ||
    feeConfig.makerFeeRate < 0 ||
    feeConfig.takerFeeRate < 0
  ) {
    throw new ValidationError('Invalid paper fee config');
  }
}

module.exports = {
  DEFAULT_PAPER_FEE_CONFIG,
  calculateNetPnl,
  calculateOrderFees,
  normalizePaperFeeConfig
};
