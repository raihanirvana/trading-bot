const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const {
  DEFAULT_BB_DEVIATION,
  DEFAULT_BB_LENGTH,
  calculateBbWidthPct,
  calculateBollingerBand,
  calculateBollingerBands,
  calculateSma
} = require('../src/indicators/bollinger');

function round(value, precision = 10) {
  return Number(value.toFixed(precision));
}

describe('Bollinger Band indicator', () => {
  it('returns null with less than length candles and does not crash', () => {
    assert.equal(calculateBollingerBand([100, 101, 102]), null);
  });

  it('returns null for invalid numeric values instead of NaN bands', () => {
    assert.equal(calculateBollingerBand([
      ...Array.from({ length: 19 }, () => 100),
      Number.NaN
    ]), null);
  });

  it('flat price bands are equal to basis', () => {
    const band = calculateBollingerBand(Array.from({ length: DEFAULT_BB_LENGTH }, () => 100));

    assert.equal(band.basis, 100);
    assert.equal(band.upper, 100);
    assert.equal(band.lower, 100);
    assert.equal(band.deviation, DEFAULT_BB_DEVIATION);
  });

  it('basis equals SMA of the configured window', () => {
    const values = Array.from({ length: DEFAULT_BB_LENGTH }, (_, index) => index + 1);
    const band = calculateBollingerBand(values);

    assert.equal(band.basis, calculateSma(values));
    assert.equal(band.basis, 10.5);
  });

  it('calculates upper and lower bands from population standard deviation', () => {
    const band = calculateBollingerBand([1, 2, 3, 4, 5], {
      length: 5,
      deviation: 2
    });

    assert.equal(band.basis, 3);
    assert.equal(round(band.upper), round(3 + (Math.sqrt(2) * 2)));
    assert.equal(round(band.lower), round(3 - (Math.sqrt(2) * 2)));
  });

  it('calculates a series with nulls until enough candles exist', () => {
    const bands = calculateBollingerBands([100, 101, 102], {
      length: 2,
      deviation: 2
    });

    assert.equal(bands[0], null);
    assert.equal(bands[1].basis, 100.5);
    assert.equal(bands[2].basis, 101.5);
  });

  it('calculates BB width percent', () => {
    assert.equal(calculateBbWidthPct({
      upper: 101,
      lower: 99,
      basis: 100
    }), 2);
  });

  it('returns null for BB width when basis is zero', () => {
    assert.equal(calculateBbWidthPct({
      upper: 101,
      lower: 99,
      basis: 0
    }), null);
  });

  it('returns null for BB width with invalid inputs', () => {
    assert.equal(calculateBbWidthPct({
      upper: 101,
      lower: Number.NaN,
      basis: 100
    }), null);
  });
});
