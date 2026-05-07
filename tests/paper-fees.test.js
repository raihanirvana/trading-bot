const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const { ValidationError } = require('../src/errors');
const {
  DEFAULT_PAPER_FEE_CONFIG,
  calculateNetPnl,
  calculateOrderFees,
  normalizePaperFeeConfig
} = require('../src/paper');

describe('paper fee calculation', () => {
  it('calculates maker entry fee, taker exit fee, and total fees', () => {
    assert.deepEqual(calculateOrderFees({
      entryPrice: 100,
      exitPrice: 101,
      feeConfig: {
        makerFeeRate: 0.0002,
        takerFeeRate: 0.0006
      },
      qty: 25
    }), {
      entry_fee_usd: 0.5,
      exit_fee_usd: 1.515,
      fees_usd: 2.0149999999999997,
      maker_fee_rate: 0.0002,
      taker_fee_rate: 0.0006
    });
  });

  it('calculates net PnL from gross PnL and fees', () => {
    assert.equal(calculateNetPnl({
      feesUsd: 2.015,
      grossPnl: 25
    }), 22.985);
  });

  it('normalizes default and explicit fee config', () => {
    assert.deepEqual(normalizePaperFeeConfig({}), DEFAULT_PAPER_FEE_CONFIG);
    assert.deepEqual(normalizePaperFeeConfig({
      makerFeeRate: 0,
      takerFeeRate: 0.001
    }), {
      makerFeeRate: 0,
      takerFeeRate: 0.001
    });
  });

  it('rejects invalid fee inputs', () => {
    assert.throws(
      () => calculateOrderFees({
        entryPrice: 0,
        exitPrice: 101,
        qty: 25
      }),
      ValidationError
    );
    assert.throws(
      () => calculateOrderFees({
        entryPrice: 100,
        exitPrice: 101,
        feeConfig: {
          makerFeeRate: -0.1,
          takerFeeRate: 0.001
        },
        qty: 25
      }),
      ValidationError
    );
    assert.throws(
      () => calculateNetPnl({
        feesUsd: -1,
        grossPnl: 10
      }),
      ValidationError
    );
  });
});
