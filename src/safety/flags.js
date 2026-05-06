class SafetyError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'SafetyError';
    this.details = details;
  }
}

function getSafetyFlags(config) {
  return Object.freeze({
    dryRun: config.dryRun === true,
    liveTradingEnabled: config.liveTradingEnabled === true,
    autoTradeEnabled: config.autoTradeEnabled === true
  });
}

function getSafetyStatus(config) {
  const flags = getSafetyFlags(config);
  const blockers = [];

  if (flags.dryRun) {
    blockers.push('DRY_RUN_ENABLED');
  }

  if (!flags.liveTradingEnabled) {
    blockers.push('LIVE_TRADING_DISABLED');
  }

  return {
    ...flags,
    tradingAllowed: blockers.length === 0,
    blockers
  };
}

function assertTradingAllowed(config) {
  const status = getSafetyStatus(config);

  if (!status.tradingAllowed) {
    throw new SafetyError('Trading is blocked by global safety flags', {
      blockers: status.blockers
    });
  }

  return status;
}

module.exports = {
  SafetyError,
  assertTradingAllowed,
  getSafetyFlags,
  getSafetyStatus
};
