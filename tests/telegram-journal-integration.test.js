const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const { buildSignal } = require('../src/signals/schema');
const {
  countCsvRows,
  createJournalRepository,
  exportJournalCsv,
  trackMissedTrade,
  trackVirtualOutcome
} = require('../src/journal');
const {
  formatSignalMessage,
  handleStatusCommand,
  notifySignal
} = require('../src/telegram');

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

describe('telegram and journal integration', () => {
  it('runs signal journal, outcome, export, and status reply with mocks only', async () => {
    const sentMessages = [];
    const telegramClient = {
      sendMessage: async (message) => {
        sentMessages.push(message);

        return {
          message_id: sentMessages.length
        };
      }
    };
    const journal = createJournalRepository({
      now: () => new Date('2026-05-04T12:01:00.000Z')
    });
    const signal = buildSampleSignal();

    const signalNotification = await notifySignal({
      chatId: 'chat-1',
      journal,
      signal,
      telegramClient
    });
    const signalMessage = formatSignalMessage(signal);
    const statusResponseBefore = await handleStatusCommand({
      chatId: 'chat-1',
      config: {
        dryRun: true,
        paperTrading: true
      },
      date: '2026-05-04T20:00:00.000Z',
      journal,
      positionsProvider: () => [],
      telegramClient
    });
    const outcomeResult = trackVirtualOutcome({
      journal,
      signal,
      candles: [
        candle('2026-05-04T12:15:00.000Z', 100.4, 99.9)
      ]
    });
    const missedResult = trackMissedTrade({
      journal,
      signal,
      markedAt: '2026-05-04T12:02:00.000Z',
      candles: [
        candle('2026-05-04T12:15:00.000Z', 100.4, 99.9)
      ]
    });
    const exported = exportJournalCsv(journal);
    const statusResponseAfter = await handleStatusCommand({
      chatId: 'chat-1',
      config: {
        dryRun: true,
        paperTrading: true
      },
      date: '2026-05-04T20:00:00.000Z',
      journal,
      positionsProvider: () => [
        {
          symbol: 'ETHUSDT',
          side: 'BUY',
          qty: 1,
          entry_price: 100,
          pnl_usd: 10
        }
      ],
      telegramClient
    });

    assert.equal(signalNotification.journalResult.inserted, true);
    assert.match(signalMessage, /Signal BUY ETHUSDT/);
    assert.match(signalNotification.text, /Signal BUY ETHUSDT/);
    assert.equal(statusResponseBefore.status.today.total_signals, 1);
    assert.equal(statusResponseBefore.status.today.virtual_tp, 0);
    assert.equal(outcomeResult.eventResult.inserted, true);
    assert.equal(missedResult.eventResult.inserted, true);
    assert.equal(countCsvRows(exported.signalsCsv), 1);
    assert.equal(countCsvRows(exported.eventsCsv), 2);
    assert.match(exported.eventsCsv, /VIRTUAL_TP/);
    assert.match(exported.eventsCsv, /MISSED_TRADE/);
    assert.equal(statusResponseAfter.status.today.virtual_tp, 1);
    assert.equal(statusResponseAfter.status.today.missed_pnl_usd, 10);
    assert.match(statusResponseAfter.text, /Mode: PAPER_TRADING/);
    assert.match(statusResponseAfter.text, /Missed PnL: 10 USDT/);
    assert.match(statusResponseAfter.text, /Positions: 1/);
    assert.equal(sentMessages.length, 3);
    assert.equal(sentMessages[0].chatId, 'chat-1');
    assert.match(sentMessages[0].text, /Signal BUY ETHUSDT/);
    assert.equal(sentMessages[1].chatId, 'chat-1');
    assert.match(sentMessages[1].text, /Mode: PAPER_TRADING/);
    assert.equal(sentMessages[2].chatId, 'chat-1');
    assert.match(sentMessages[2].text, /Positions: 1/);
  });

  it('keeps integration idempotent for duplicate journal events', async () => {
    const journal = createJournalRepository({
      now: () => new Date('2026-05-04T12:01:00.000Z')
    });
    const signal = buildSampleSignal();
    const candles = [
      candle('2026-05-04T12:15:00.000Z', 100.4, 99.9)
    ];

    journal.saveSignal(signal);
    trackVirtualOutcome({ journal, signal, candles });
    trackVirtualOutcome({ journal, signal, candles });
    trackMissedTrade({
      journal,
      signal,
      markedAt: '2026-05-04T12:02:00.000Z',
      candles
    });
    trackMissedTrade({
      journal,
      signal,
      markedAt: '2026-05-04T12:02:00.000Z',
      candles
    });

    const exported = exportJournalCsv(journal);
    const status = await handleStatusCommand({
      chatId: 'chat-1',
      config: {
        dryRun: true
      },
      date: '2026-05-04T20:00:00.000Z',
      journal,
      telegramClient: {
        sendMessage: async () => ({ message_id: 1 })
      }
    });

    assert.equal(countCsvRows(exported.signalsCsv), 1);
    assert.equal(countCsvRows(exported.eventsCsv), 2);
    assert.equal(status.status.today.virtual_tp, 1);
    assert.equal(status.status.today.missed_trades, 1);
  });
});

function candle(timestamp, high, low) {
  return {
    timestamp,
    high,
    low
  };
}
