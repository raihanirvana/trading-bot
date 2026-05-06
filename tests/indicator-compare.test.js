const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const {
  compareIndicatorSnapshot,
  compareNumber,
  getLastValues
} = require('../src/indicators/compare');

describe('indicator comparison utility', () => {
  it('passes when numeric difference is within tolerance', () => {
    assert.equal(compareNumber({
      actual: 100.00001,
      expected: 100,
      tolerance: 0.0001
    }).pass, true);
  });

  it('fails when numeric difference is outside tolerance', () => {
    const comparison = compareNumber({
      actual: 100.1,
      expected: 100,
      tolerance: 0.0001
    });

    assert.equal(comparison.pass, false);
    assert.equal(comparison.diff > comparison.tolerance, true);
  });

  it('compares indicator snapshots field by field', () => {
    const result = compareIndicatorSnapshot(
      {
        bb_basis: 100.00001,
        adx_14: 25
      },
      {
        bb_basis: 100,
        adx_14: 25
      },
      {
        tolerance: 0.0001
      }
    );

    assert.equal(result.pass, true);
    assert.equal(result.comparisons.bb_basis.pass, true);
    assert.equal(result.comparisons.adx_14.pass, true);
  });

  it('prints last values for selected fields', () => {
    assert.deepEqual(getLastValues([
      { bb_basis: 99, adx_14: 20 },
      { bb_basis: 100, adx_14: 25 }
    ], ['bb_basis']), {
      bb_basis: 100
    });
  });
});
