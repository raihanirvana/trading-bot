const { ValidationError } = require('../errors');
const {
  buildDailySummaryFromJournal,
  formatDailySummary
} = require('../journal');

async function handleStatusCommand(options = {}) {
  const {
    chatId,
    config = {},
    date = new Date(),
    journal,
    positionsProvider,
    telegramClient
  } = options;

  validateStatusCommandInput({
    chatId,
    telegramClient
  });

  const status = await buildStatusPayload({
    config,
    date,
    journal,
    positionsProvider
  });
  const text = formatStatusMessage(status);
  const result = await telegramClient.sendMessage({
    chatId,
    text
  });

  return {
    result,
    status,
    text
  };
}

async function buildStatusPayload(options = {}) {
  const {
    config = {},
    date = new Date(),
    journal,
    positionsProvider
  } = options;
  const summary = journal
    ? buildDailySummaryFromJournal(journal, { date })
    : emptyDailySummary(date);
  const positions = await resolvePositions(positionsProvider);

  return {
    mode: resolveMode(config),
    dry_run: config.dryRun !== false,
    live_trading_enabled: config.liveTradingEnabled === true,
    auto_trade_enabled: config.autoTradeEnabled === true,
    paper_trading_enabled: config.paperTrading === true,
    signal_only: config.signalOnly === true,
    today: summary,
    positions
  };
}

function formatStatusMessage(status) {
  return [
    'Status',
    `Mode: ${status.mode}`,
    `Dry run: ${status.dry_run ? 'ON' : 'OFF'}`,
    `Live trading: ${status.live_trading_enabled ? 'ON' : 'OFF'}`,
    `Auto trade: ${status.auto_trade_enabled ? 'ON' : 'OFF'}`,
    `Paper trading: ${status.paper_trading_enabled ? 'ON' : 'OFF'}`,
    `Signal only: ${status.signal_only ? 'ON' : 'OFF'}`,
    '',
    formatDailySummary(status.today),
    '',
    formatPositions(status.positions)
  ].join('\n');
}

function resolveMode(config = {}) {
  if (config.dryRun !== false) {
    if (config.signalOnly === true) {
      return 'SIGNAL_ONLY';
    }

    if (config.paperTrading === true) {
      return 'PAPER_TRADING';
    }

    return 'DRY_RUN';
  }

  if (config.liveTradingEnabled === true && config.autoTradeEnabled === true) {
    return 'LIVE_AUTO';
  }

  if (config.liveTradingEnabled === false && config.semiAutoEnabled === true) {
    return 'TESTNET_SEMI_AUTO';
  }

  return 'ACTIVE_MANUAL';
}

async function resolvePositions(positionsProvider) {
  if (!positionsProvider) {
    return [];
  }

  if (typeof positionsProvider === 'function') {
    const result = await positionsProvider();

    return Array.isArray(result) ? result : [];
  }

  if (typeof positionsProvider.listPositions === 'function') {
    const result = await positionsProvider.listPositions();

    return Array.isArray(result) ? result : [];
  }

  return [];
}

function formatPositions(positions) {
  if (!positions || positions.length === 0) {
    return 'Positions: none';
  }

  return [
    `Positions: ${positions.length}`,
    ...positions.map(formatPosition)
  ].join('\n');
}

function formatPosition(position) {
  const symbol = position.symbol || 'UNKNOWN';
  const side = position.side || 'n/a';
  const qty = Number.isFinite(position.qty) ? position.qty : 'n/a';
  const entry = Number.isFinite(position.entry_price) ? position.entry_price : 'n/a';
  const pnl = Number.isFinite(position.pnl_usd) ? `${Number(position.pnl_usd.toFixed(4))} USDT` : 'n/a';

  return `- ${symbol} ${side} qty=${qty} entry=${entry} pnl=${pnl}`;
}

function emptyDailySummary(date) {
  const dayKey = new Date(date);

  if (Number.isNaN(dayKey.getTime())) {
    throw new ValidationError('Status date is invalid');
  }

  return {
    date: dayKey.toISOString().slice(0, 10),
    total_signals: 0,
    virtual_tp: 0,
    virtual_sl: 0,
    missed_trades: 0,
    missed_profit_usd: 0,
    avoided_loss_usd: 0,
    missed_pnl_usd: 0
  };
}

function validateStatusCommandInput({ chatId, telegramClient }) {
  if (chatId === undefined || chatId === null || String(chatId).trim() === '') {
    throw new ValidationError('Telegram chat id is required for /status');
  }

  if (!telegramClient || typeof telegramClient.sendMessage !== 'function') {
    throw new ValidationError('Telegram client with sendMessage is required for /status');
  }
}

module.exports = {
  buildStatusPayload,
  emptyDailySummary,
  formatPositions,
  formatStatusMessage,
  handleStatusCommand,
  resolveMode
};
