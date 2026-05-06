const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const {
  calculateNotionalUsd,
  calculatePositionSize,
  calculateQty
} = require('../src/signals/position-sizing');

describe('position sizing calculator', () => {
  it('calculates notional from margin and leverage', () => {
    assert.equal(calculateNotionalUsd({
      marginUsd: 25,
      leverage: 100
    }), 2500);
  });

  it('calculates qty from notional and price', () => {
    assert.equal(calculateQty({
      notionalUsd: 2500,
      price: 2500
    }), 1);
  });

  it('calculates full position size', () => {
    assert.deepEqual(calculatePositionSize({
      marginUsd: 25,
      leverage: 100,
      price: 2500
    }), {
      marginUsd: 25,
      leverage: 100,
      notionalUsd: 2500,
      price: 2500,
      qty: 1
    });
  });

  it('returns null for invalid margin or leverage', () => {
    assert.equal(calculateNotionalUsd({
      marginUsd: 0,
      leverage: 100
    }), null);
    assert.equal(calculateNotionalUsd({
      marginUsd: 25,
      leverage: Number.NaN
    }), null);
  });

  it('returns null for invalid price', () => {
    assert.equal(calculateQty({
      notionalUsd: 2500,
      price: 0
    }), null);
    assert.equal(calculatePositionSize({
      marginUsd: 25,
      leverage: 100,
      price: 0
    }), null);
  });
});
