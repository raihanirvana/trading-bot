const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const {
  evaluateAntiBandWalk,
  evaluateBbWidthMinimum
} = require('../src/signals/filters');

describe('signal filters', () => {
  it('blocks when BB width is 0.59', () => {
    assert.deepEqual(evaluateBbWidthMinimum(0.59), {
      allowed: false,
      reason: 'BB width below minimum'
    });
  });

  it('allows when BB width is 0.60', () => {
    assert.deepEqual(evaluateBbWidthMinimum(0.6), {
      allowed: true,
      reason: 'BB width allowed'
    });
  });

  it('blocks unavailable BB width', () => {
    assert.deepEqual(evaluateBbWidthMinimum(null), {
      allowed: false,
      reason: 'BB width unavailable'
    });
  });

  it('anti-band-walk blocks when BB width is 2.6 and ADX is 36', () => {
    assert.deepEqual(evaluateAntiBandWalk({
      bbWidthPct: 2.6,
      adx: 36
    }), {
      allowed: false,
      reason: 'Anti-band-walk blocked trending market'
    });
  });

  it('anti-band-walk allows when BB width is 2.6 and ADX is 34', () => {
    assert.deepEqual(evaluateAntiBandWalk({
      bbWidthPct: 2.6,
      adx: 34
    }), {
      allowed: true,
      reason: 'Anti-band-walk allowed'
    });
  });

  it('anti-band-walk allows when BB width is 2.4 and ADX is 36', () => {
    assert.deepEqual(evaluateAntiBandWalk({
      bbWidthPct: 2.4,
      adx: 36
    }), {
      allowed: true,
      reason: 'Anti-band-walk allowed'
    });
  });

  it('anti-band-walk blocks unavailable inputs', () => {
    assert.deepEqual(evaluateAntiBandWalk({
      bbWidthPct: null,
      adx: 36
    }), {
      allowed: false,
      reason: 'Anti-band-walk inputs unavailable'
    });
  });
});
