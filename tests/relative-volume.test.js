const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const {
  DEFAULT_RELATIVE_VOLUME_LOOKBACK,
  calculateRelativeVolume,
  calculateRelativeVolumeSeries
} = require('../src/indicators/relative-volume');

describe('relative volume indicator', () => {
  it('calculates volume ratio correctly', () => {
    assert.equal(calculateRelativeVolume([10, 20, 30], {
      lookback: 2
    }), 2);
  });

  it('handles zero average volume without crashing', () => {
    assert.equal(calculateRelativeVolume([0, 0, 10], {
      lookback: 2
    }), null);
  });

  it('returns null until enough lookback exists', () => {
    assert.equal(calculateRelativeVolume([10, 20], {
      lookback: 2
    }), null);
  });

  it('output series length is the same as input length', () => {
    const volumes = Array.from({ length: DEFAULT_RELATIVE_VOLUME_LOOKBACK + 2 }, (_, index) => index + 1);

    assert.equal(calculateRelativeVolumeSeries(volumes).length, volumes.length);
  });

  it('series returns null until current plus lookback volumes exist', () => {
    assert.deepEqual(calculateRelativeVolumeSeries([10, 20, 30], {
      lookback: 2
    }), [
      null,
      null,
      2
    ]);
  });

  it('is NaN safe', () => {
    assert.equal(calculateRelativeVolume([10, Number.NaN, 30], {
      lookback: 2
    }), null);
  });
});
