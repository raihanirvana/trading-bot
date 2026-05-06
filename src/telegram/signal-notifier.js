const { ValidationError } = require('../errors');
const { formatSignalMessage } = require('./formatter');

async function notifySignal(options = {}) {
  const {
    chatId,
    journal,
    signal,
    telegramClient
  } = options;

  validateNotifySignalInput({
    chatId,
    signal,
    telegramClient
  });

  const journalResult = journal && typeof journal.saveSignal === 'function'
    ? journal.saveSignal(signal)
    : null;
  const text = formatSignalMessage(signal);
  const result = await telegramClient.sendMessage({
    chatId,
    text
  });

  return {
    journalResult,
    result,
    text
  };
}

function validateNotifySignalInput({ chatId, signal, telegramClient }) {
  if (chatId === undefined || chatId === null || String(chatId).trim() === '') {
    throw new ValidationError('Telegram chat id is required for signal notification');
  }

  if (!signal || typeof signal !== 'object') {
    throw new ValidationError('Signal is required for Telegram notification');
  }

  if (!telegramClient || typeof telegramClient.sendMessage !== 'function') {
    throw new ValidationError('Telegram client with sendMessage is required for signal notification');
  }
}

module.exports = {
  notifySignal
};
