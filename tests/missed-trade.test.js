const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const { ValidationError } = require('../src/errors');
const { buildSignal } = require('../src/signals/schema');
const {
  MISSED_TRADE_EVENT,
  buildMissedTradeEvent,
  calculateRawPnlUsd,
  createJournalRepository,
  evaluateMissedTrade,
  trackMissedTrade
} = require('../src/journal');

function buildSampleSignal(overrides = {}) {
  return buildSignal({
    symbol: 'ETHUSDT',
    timeframe: '15m',
    timestamp: '2026-05-04T12:00:00.000Z',
    side: 'BUY',
    entryPrice: 100,
    marginUsd: 25,
    leverage: 100,
    bbWidthPct: 1.2,
    adx15m: 24,
    reasons: ['Touched lower previous band'],
    ...overrides
  });
}

describe('missed trade tracker', () => {
  it('records skipped TP as missed profit', () => {
    const signal = buildSampleSignal();
    const missedTrade = evaluateMissedTrade({
      signal,
      markedAt: '2026-05-04T12:02:00.000Z',
      candles: [
        candle('2026-05-04T12:15:00.000Z', 100.4, 99.9)
      ]
    });

    assert.equal(missedTrade.skipped, true);
    assert.equal(missedTrade.skipped_reason, 'USER_SKIPPED');
    assert.equal(missedTrade.skipped_at, '2026-05-04T12:02:00.000Z');
    assert.equal(missedTrade.virtual_status, 'TP');
    assert.equal(missedTrade.virtual_exit_reason, 'VIRTUAL_TP');
    assert.equal(missedTrade.virtual_exit_price, 100.4);
    assert.equal(missedTrade.missed_profit_usd, 10);
    assert.equal(missedTrade.avoided_loss_usd, 0);
    assert.equal(missedTrade.missed_pnl_usd, 10);
  });

  it('records skipped SL as avoided loss', () => {
    const missedTrade = evaluateMissedTrade({
      signal: buildSampleSignal(),
      candles: [
        candle('2026-05-04T12:15:00.000Z', 100.1, 99.6)
      ]
    });

    assert.equal(missedTrade.virtual_status, 'SL');
    assert.equal(missedTrade.virtual_exit_reason, 'VIRTUAL_SL');
    assert.equal(missedTrade.missed_profit_usd, 0);
    assert.equal(missedTrade.avoided_loss_usd, 10);
    assert.equal(missedTrade.missed_pnl_usd, -10);
  });

  it('calculates SELL skipped TP as missed profit', () => {
    const missedTrade = evaluateMissedTrade({
      signal: buildSampleSignal({
        side: 'SELL',
        entryPrice: 100,
        reasons: ['Touched upper previous band']
      }),
      candles: [
        candle('2026-05-04T12:15:00.000Z', 100.1, 99.6)
      ]
    });

    assert.equal(missedTrade.virtual_status, 'TP');
    assert.equal(missedTrade.missed_profit_usd, 10);
    assert.equal(missedTrade.avoided_loss_usd, 0);
  });

  it('keeps pnl zero when skipped signal remains open', () => {
    const missedTrade = evaluateMissedTrade({
      signal: buildSampleSignal(),
      candles: [
        candle('2026-05-04T12:15:00.000Z', 100.2, 99.8)
      ]
    });

    assert.equal(missedTrade.virtual_status, 'OPEN');
    assert.equal(missedTrade.missed_profit_usd, 0);
    assert.equal(missedTrade.avoided_loss_usd, 0);
    assert.equal(missedTrade.missed_pnl_usd, 0);
  });

  it('records missed trade event in journal', () => {
    const journal = createJournalRepository();
    const signal = buildSampleSignal();
    const result = trackMissedTrade({
      journal,
      signal,
      markedAt: '2026-05-04T12:02:00.000Z',
      candles: [
        candle('2026-05-04T12:15:00.000Z', 100.4, 99.9)
      ]
    });

    assert.equal(result.eventResult.inserted, true);
    assert.equal(journal.listEvents().length, 1);
    assert.equal(journal.listEvents()[0].event_type, MISSED_TRADE_EVENT);
    assert.deepEqual(JSON.parse(journal.listEvents()[0].payload_json), result.missedTrade);
  });

  it('ignores duplicate missed trade events for the same marked timestamp', () => {
    const journal = createJournalRepository();
    const signal = buildSampleSignal();
    const input = {
      journal,
      signal,
      markedAt: '2026-05-04T12:02:00.000Z',
      candles: [
        candle('2026-05-04T12:15:00.000Z', 100.4, 99.9)
      ]
    };

    const first = trackMissedTrade(input);
    const second = trackMissedTrade(input);

    assert.equal(first.eventResult.inserted, true);
    assert.equal(second.eventResult.inserted, false);
    assert.equal(second.eventResult.duplicate, true);
    assert.equal(journal.listEvents().length, 1);
  });

  it('builds deterministic missed trade event ids', () => {
    const signal = buildSampleSignal();
    const missedTrade = evaluateMissedTrade({
      signal,
      markedAt: '2026-05-04T12:02:00.000Z',
      candles: [
        candle('2026-05-04T12:15:00.000Z', 100.4, 99.9)
      ]
    });
    const event = buildMissedTradeEvent(signal, missedTrade);

    assert.equal(event.event_id, 'ETHUSDT-15m-20260504T120000Z-BUY-MISSED_TRADE-20260504T120200Z');
    assert.equal(event.signal_id, signal.signal_id);
    assert.equal(event.event_type, MISSED_TRADE_EVENT);
  });

  it('calculates raw PnL for BUY and SELL directions', () => {
    assert.ok(Math.abs(calculateRawPnlUsd({
      side: 'BUY',
      entryPrice: 100,
      exitPrice: 100.4,
      notionalUsd: 2500
    }) - 10) < 0.000001);
    assert.ok(Math.abs(calculateRawPnlUsd({
      side: 'SELL',
      entryPrice: 100,
      exitPrice: 99.6,
      notionalUsd: 2500
    }) - 10) < 0.000001);
  });

  it('rejects invalid missed trade input', () => {
    assert.throws(
      () => evaluateMissedTrade({ signal: { symbol: 'ETHUSDT' }, candles: [] }),
      (error) => error instanceof ValidationError
    );

    assert.throws(
      () => evaluateMissedTrade({ signal: buildSampleSignal(), candles: {} }),
      (error) => error instanceof ValidationError
    );
  });
});

function candle(timestamp, high, low) {
  return {
    timestamp,
    high,
    low
  };
}
