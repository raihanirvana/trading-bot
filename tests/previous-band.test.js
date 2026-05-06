const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const {
  getLatestPreviousBandLevel,
  getPreviousBandLevel
} = require('../src/signals/previous-band');

function band({ upper, lower, basis = 100 }) {
  return {
    upper,
    lower,
    basis
  };
}

describe('previous band level', () => {
  it('uses the previous index for upper/lower and BB width', () => {
    const level = getPreviousBandLevel([
      band({ upper: 101, lower: 99 }),
      band({ upper: 111, lower: 89 }),
      band({ upper: 999, lower: 1 })
    ], 2);

    assert.deepEqual(level, {
      upperPrev: 111,
      lowerPrev: 89,
      bbWidthPrev: 22,
      sourceIndex: 1
    });
  });

  it('does not use current band while candle is running', () => {
    const level = getPreviousBandLevel([
      band({ upper: 101, lower: 99 }),
      band({ upper: 111, lower: 89 }),
      band({ upper: 200, lower: 50 })
    ], 2);

    assert.equal(level.upperPrev, 111);
    assert.equal(level.lowerPrev, 89);
  });

  it('returns latest previous band level using the final item as current candle', () => {
    const level = getLatestPreviousBandLevel([
      band({ upper: 101, lower: 99 }),
      band({ upper: 111, lower: 89 }),
      band({ upper: 200, lower: 50 })
    ]);

    assert.equal(level.sourceIndex, 1);
    assert.equal(level.upperPrev, 111);
  });

  it('returns null when previous band is unavailable', () => {
    assert.equal(getPreviousBandLevel([], 0), null);
    assert.equal(getPreviousBandLevel([null], 0), null);
    assert.equal(getPreviousBandLevel([null, band({ upper: 101, lower: 99 })], 1), null);
  });

  it('returns null when previous BB width is invalid', () => {
    assert.equal(getPreviousBandLevel([
      band({ upper: 101, lower: 99, basis: 0 }),
      band({ upper: 111, lower: 89 })
    ], 1), null);
  });
});
