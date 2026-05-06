const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const { loadConfig } = require('../src/config');
const {
  SafetyError,
  assertTradingAllowed,
  getSafetyFlags,
  getSafetyStatus
} = require('../src/safety/flags');

describe('global safety flags', () => {
  it('defaults to dry run enabled', () => {
    assert.equal(getSafetyFlags(loadConfig({})).dryRun, true);
  });

  it('defaults to live trading disabled', () => {
    assert.equal(getSafetyFlags(loadConfig({})).liveTradingEnabled, false);
  });

  it('defaults to auto trade disabled', () => {
    assert.equal(getSafetyFlags(loadConfig({})).autoTradeEnabled, false);
  });

  it('blocks trading by default', () => {
    const status = getSafetyStatus(loadConfig({}));

    assert.equal(status.tradingAllowed, false);
    assert.deepEqual(status.blockers, [
      'DRY_RUN_ENABLED',
      'LIVE_TRADING_DISABLED'
    ]);
  });

  it('throws a readable safety error when trading is blocked', () => {
    assert.throws(
      () => assertTradingAllowed(loadConfig({})),
      (error) => {
        assert.equal(error instanceof SafetyError, true);
        assert.deepEqual(error.details.blockers, [
          'DRY_RUN_ENABLED',
          'LIVE_TRADING_DISABLED'
        ]);
        return true;
      }
    );
  });

  it('allows trading only when dry run is false and live trading is enabled', () => {
    const status = assertTradingAllowed(loadConfig({
      DRY_RUN: 'false',
      LIVE_TRADING_ENABLED: 'true'
    }));

    assert.equal(status.tradingAllowed, true);
    assert.deepEqual(status.blockers, []);
  });
});
