const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const {
  createEmptyDailyState,
  evaluateDailyRules,
  getUtcDayKey,
  recordClosedTrade,
  resetDailyStateIfNeeded
} = require('../src/signals/daily-rules');

describe('daily rules', () => {
  it('creates a UTC day key', () => {
    assert.equal(getUtcDayKey('2026-05-06T23:59:59.000Z'), '2026-05-06');
  });

  it('resets state on a new UTC day', () => {
    assert.deepEqual(resetDailyStateIfNeeded({
      dayKey: '2026-05-05',
      tradesToday: 3,
      dailyPnl: 6
    }, '2026-05-06T00:00:00.000Z'), {
      dayKey: '2026-05-06',
      tradesToday: 0,
      dailyPnl: 0
    });
  });

  it('keeps state on the same UTC day', () => {
    assert.deepEqual(resetDailyStateIfNeeded({
      dayKey: '2026-05-06',
      tradesToday: 2,
      dailyPnl: 4
    }, '2026-05-06T12:00:00.000Z'), {
      dayKey: '2026-05-06',
      tradesToday: 2,
      dailyPnl: 4
    });
  });

  it('blocks when daily target is hit after minimum trades', () => {
    assert.deepEqual(evaluateDailyRules({
      tradesToday: 3,
      dailyPnl: 6
    }), {
      allowed: false,
      reason: 'Daily target hit',
      dailyTargetHit: true,
      dailyLossHit: false
    });
  });

  it('allows target pnl before minimum trades', () => {
    assert.deepEqual(evaluateDailyRules({
      tradesToday: 2,
      dailyPnl: 6
    }), {
      allowed: true,
      reason: 'Daily rules allowed',
      dailyTargetHit: false,
      dailyLossHit: false
    });
  });

  it('blocks when daily loss stop is hit', () => {
    assert.deepEqual(evaluateDailyRules({
      tradesToday: 1,
      dailyPnl: -18
    }), {
      allowed: false,
      reason: 'Daily loss stop hit',
      dailyTargetHit: false,
      dailyLossHit: true
    });
  });

  it('records closed trades into the correct daily state', () => {
    assert.deepEqual(recordClosedTrade(createEmptyDailyState('2026-05-06'), {
      pnl: 2.5,
      closedAt: '2026-05-06T10:00:00.000Z'
    }), {
      dayKey: '2026-05-06',
      tradesToday: 1,
      dailyPnl: 2.5
    });
  });

  it('records closed trade after resetting to a new day', () => {
    assert.deepEqual(recordClosedTrade({
      dayKey: '2026-05-05',
      tradesToday: 4,
      dailyPnl: -3
    }, {
      pnl: 1,
      closedAt: '2026-05-06T01:00:00.000Z'
    }), {
      dayKey: '2026-05-06',
      tradesToday: 1,
      dailyPnl: 1
    });
  });
});
