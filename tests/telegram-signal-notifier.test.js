const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const { ValidationError } = require('../src/errors');
const { createJournalRepository } = require('../src/journal');
const { buildSignal } = require('../src/signals/schema');
const { notifySignal } = require('../src/telegram');

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

describe('telegram signal notifier', () => {
  it('saves signal to journal and sends formatted signal to Telegram mock', async () => {
    const calls = [];
    const journal = createJournalRepository({
      now: () => new Date('2026-05-04T12:01:00.000Z')
    });
    const response = await notifySignal({
      chatId: 'chat-1',
      journal,
      signal: buildSampleSignal(),
      telegramClient: {
        sendMessage: async (message) => {
          calls.push(message);

          return {
            message_id: 1
          };
        }
      }
    });

    assert.equal(response.journalResult.inserted, true);
    assert.equal(response.result.message_id, 1);
    assert.equal(journal.listSignals().length, 1);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].chatId, 'chat-1');
    assert.match(calls[0].text, /Signal BUY ETHUSDT/);
    assert.match(calls[0].text, /Entry: 100/);
    assert.match(calls[0].text, /TP: 100.4/);
    assert.match(calls[0].text, /SL: 99.6/);
  });

  it('still sends signal when no journal is provided', async () => {
    const calls = [];
    const response = await notifySignal({
      chatId: 'chat-1',
      signal: buildSampleSignal(),
      telegramClient: {
        sendMessage: async (message) => {
          calls.push(message);

          return {
            message_id: 2
          };
        }
      }
    });

    assert.equal(response.journalResult, null);
    assert.equal(response.result.message_id, 2);
    assert.equal(calls.length, 1);
  });

  it('rejects missing chat id, signal, or Telegram client', async () => {
    await assert.rejects(
      () => notifySignal({
        chatId: '',
        signal: buildSampleSignal(),
        telegramClient: {
          sendMessage: async () => ({})
        }
      }),
      (error) => error instanceof ValidationError
    );

    await assert.rejects(
      () => notifySignal({
        chatId: 'chat-1',
        telegramClient: {
          sendMessage: async () => ({})
        }
      }),
      (error) => error instanceof ValidationError
    );

    await assert.rejects(
      () => notifySignal({
        chatId: 'chat-1',
        signal: buildSampleSignal()
      }),
      (error) => error instanceof ValidationError
    );
  });
});
