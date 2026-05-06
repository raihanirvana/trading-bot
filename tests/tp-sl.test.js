const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const {
  DEFAULT_TP_SL_PCT,
  calculateTpSl
} = require('../src/signals/tp-sl');

describe('TP/SL calculator', () => {
  it('calculates long TP at 0.4 percent', () => {
    assert.equal(calculateTpSl({
      side: 'BUY',
      entryPrice: 100
    }).tpPrice, 100.4);
  });

  it('calculates long SL at 0.4 percent', () => {
    assert.equal(calculateTpSl({
      side: 'BUY',
      entryPrice: 100
    }).slPrice, 99.6);
  });

  it('calculates short TP at 0.4 percent', () => {
    assert.equal(calculateTpSl({
      side: 'SELL',
      entryPrice: 100
    }).tpPrice, 99.6);
  });

  it('calculates short SL at 0.4 percent', () => {
    assert.equal(calculateTpSl({
      side: 'SELL',
      entryPrice: 100
    }).slPrice, 100.4);
  });

  it('supports custom percent', () => {
    assert.deepEqual(calculateTpSl({
      side: 'BUY',
      entryPrice: 100,
      percent: 1
    }), {
      tpPrice: 101,
      slPrice: 99
    });
  });

  it('returns null for invalid inputs', () => {
    assert.equal(calculateTpSl({
      side: 'HOLD',
      entryPrice: 100
    }), null);
    assert.equal(calculateTpSl({
      side: 'BUY',
      entryPrice: 0
    }), null);
    assert.equal(DEFAULT_TP_SL_PCT, 0.4);
  });
});
