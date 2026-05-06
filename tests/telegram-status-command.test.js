const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const { ValidationError } = require('../src/errors');
const { loadConfig } = require('../src/config');
const { buildSignal } = require('../src/signals/schema');
const { createJournalRepository } = require('../src/journal');
const {
  buildStatusPayload,
  formatPositions,
  formatStatusMessage,
  handleStatusCommand,
  resolveMode
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

describe('telegram /status command', () => {
  it('resolves status modes from config', () => {
    assert.equal(resolveMode({ dryRun: true }), 'DRY_RUN');
    assert.equal(resolveMode({ dryRun: true, signalOnly: true }), 'SIGNAL_ONLY');
    assert.equal(resolveMode({ dryRun: true, paperTrading: true }), 'PAPER_TRADING');
    assert.equal(resolveMode({ dryRun: false, liveTradingEnabled: true, autoTradeEnabled: true }), 'LIVE_AUTO');
    assert.equal(resolveMode({ dryRun: false, liveTradingEnabled: false, semiAutoEnabled: true }), 'TESTNET_SEMI_AUTO');
  });

  it('resolves status modes from loaded environment config', () => {
    assert.equal(resolveMode(loadConfig({
      SIGNAL_ONLY: 'true'
    })), 'SIGNAL_ONLY');
    assert.equal(resolveMode(loadConfig({
      PAPER_TRADING: 'true'
    })), 'PAPER_TRADING');
    assert.equal(resolveMode(loadConfig({
      DRY_RUN: 'false',
      LIVE_TRADING_ENABLED: 'false',
      SEMI_AUTO_ENABLED: 'true'
    })), 'TESTNET_SEMI_AUTO');
  });

  it('builds status payload with today summary and positions', async () => {
    const journal = buildJournalWithTodayData();
    const status = await buildStatusPayload({
      config: {
        dryRun: true,
        paperTrading: true
      },
      date: '2026-05-04T20:00:00.000Z',
      journal,
      positionsProvider: async () => [
        {
          symbol: 'ETHUSDT',
          side: 'BUY',
          qty: 1,
          entry_price: 100,
          pnl_usd: 4.5
        }
      ]
    });

    assert.equal(status.mode, 'PAPER_TRADING');
    assert.equal(status.today.total_signals, 1);
    assert.equal(status.today.virtual_tp, 1);
    assert.equal(status.today.missed_pnl_usd, 10);
    assert.deepEqual(status.positions, [
      {
        symbol: 'ETHUSDT',
        side: 'BUY',
        qty: 1,
        entry_price: 100,
        pnl_usd: 4.5
      }
    ]);
  });

  it('formats status message with mode, today pnl, and positions', () => {
    const text = formatStatusMessage({
      mode: 'PAPER_TRADING',
      dry_run: true,
      live_trading_enabled: false,
      auto_trade_enabled: false,
      paper_trading_enabled: true,
      signal_only: false,
      today: {
        date: '2026-05-04',
        total_signals: 1,
        virtual_tp: 1,
        virtual_sl: 0,
        missed_trades: 1,
        missed_profit_usd: 10,
        avoided_loss_usd: 0,
        missed_pnl_usd: 10
      },
      positions: [
        {
          symbol: 'ETHUSDT',
          side: 'BUY',
          qty: 1,
          entry_price: 100,
          pnl_usd: 4.5
        }
      ]
    });

    assert.match(text, /Status/);
    assert.match(text, /Mode: PAPER_TRADING/);
    assert.match(text, /Dry run: ON/);
    assert.match(text, /Daily Summary 2026-05-04/);
    assert.match(text, /Missed PnL: 10 USDT/);
    assert.match(text, /Positions: 1/);
    assert.match(text, /ETHUSDT BUY qty=1 entry=100 pnl=4.5 USDT/);
  });

  it('replies to /status using a mock Telegram client', async () => {
    const calls = [];
    const telegramClient = {
      sendMessage: async (message) => {
        calls.push(message);

        return {
          message_id: 99
        };
      }
    };
    const response = await handleStatusCommand({
      chatId: 'chat-1',
      config: {
        dryRun: true
      },
      date: '2026-05-04T20:00:00.000Z',
      journal: buildJournalWithTodayData(),
      telegramClient
    });

    assert.equal(response.result.message_id, 99);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].chatId, 'chat-1');
    assert.match(calls[0].text, /Mode: DRY_RUN/);
    assert.match(calls[0].text, /Total signals: 1/);
    assert.match(calls[0].text, /Positions: none/);
  });

  it('formats empty positions safely', () => {
    assert.equal(formatPositions([]), 'Positions: none');
  });

  it('rejects missing chat id or telegram client', async () => {
    await assert.rejects(
      () => handleStatusCommand({
        chatId: '',
        telegramClient: {
          sendMessage: async () => ({})
        }
      }),
      (error) => error instanceof ValidationError
    );

    await assert.rejects(
      () => handleStatusCommand({
        chatId: 'chat-1'
      }),
      (error) => error instanceof ValidationError
    );
  });
});

function buildJournalWithTodayData() {
  const journal = createJournalRepository({
    now: () => new Date('2026-05-04T12:01:00.000Z')
  });
  const signal = buildSampleSignal();

  journal.saveSignal(signal);
  journal.saveEvent({
    event_id: 'virtual-tp-1',
    signal_id: signal.signal_id,
    event_type: 'VIRTUAL_TP',
    created_at: '2026-05-04T12:15:00.000Z',
    payload: {
      signal_id: signal.signal_id
    }
  });
  journal.saveEvent({
    event_id: 'missed-1',
    signal_id: signal.signal_id,
    event_type: 'MISSED_TRADE',
    created_at: '2026-05-04T12:02:00.000Z',
    payload: {
      missed_profit_usd: 10,
      avoided_loss_usd: 0,
      missed_pnl_usd: 10
    }
  });

  return journal;
}
