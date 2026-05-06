const { DependencyError, ValidationError } = require('../errors');

const DEFAULT_TELEGRAM_BASE_URL = 'https://api.telegram.org';

function createTelegramClient(options = {}) {
  const token = normalizeRequiredString(options.token, 'Telegram bot token');
  const baseUrl = options.baseUrl || DEFAULT_TELEGRAM_BASE_URL;
  const fetchImpl = options.fetchImpl || globalThis.fetch;

  if (typeof fetchImpl !== 'function') {
    throw new DependencyError('Telegram fetch implementation is unavailable');
  }

  return {
    sendMessage: (message) => sendTelegramMessage({
      baseUrl,
      fetchImpl,
      token,
      ...message
    })
  };
}

function createTelegramClientFromConfig(config, options = {}) {
  return createTelegramClient({
    token: config.telegramBotToken,
    baseUrl: options.baseUrl,
    fetchImpl: options.fetchImpl
  });
}

async function sendTelegramMessage(options = {}) {
  const token = normalizeRequiredString(options.token, 'Telegram bot token');
  const chatId = normalizeRequiredString(options.chatId, 'Telegram chat id');
  const text = normalizeRequiredString(options.text, 'Telegram message text');
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const url = buildTelegramMethodUrl(options.baseUrl || DEFAULT_TELEGRAM_BASE_URL, token, 'sendMessage');

  if (typeof fetchImpl !== 'function') {
    throw new DependencyError('Telegram fetch implementation is unavailable');
  }

  const body = {
    chat_id: chatId,
    text
  };

  if (options.parseMode) {
    body.parse_mode = options.parseMode;
  }

  if (options.disableWebPagePreview !== undefined) {
    body.disable_web_page_preview = Boolean(options.disableWebPagePreview);
  }

  let response;

  try {
    response = await fetchImpl(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify(body)
    });
  } catch (error) {
    throw new DependencyError('Telegram sendMessage request failed', {
      cause: error.message
    });
  }

  const payload = await readTelegramResponse(response);

  if (!response.ok || payload.ok === false) {
    throw new DependencyError('Telegram sendMessage failed', {
      statusCode: response.status,
      errorCode: payload.error_code,
      description: payload.description
    });
  }

  return payload.result || payload;
}

function buildTelegramMethodUrl(baseUrl, token, method) {
  try {
    const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    return new URL(`bot${token}/${method}`, normalizedBaseUrl).toString();
  } catch (error) {
    throw new DependencyError('Invalid Telegram base URL', {
      cause: error.message
    });
  }
}

async function readTelegramResponse(response) {
  if (!response || typeof response.json !== 'function') {
    throw new DependencyError('Invalid Telegram response object');
  }

  try {
    return await response.json();
  } catch (error) {
    throw new DependencyError('Telegram response was not valid JSON', {
      statusCode: response.status,
      cause: error.message
    });
  }
}

function normalizeRequiredString(value, label) {
  if (value === undefined || value === null || String(value).trim() === '') {
    throw new ValidationError(`${label} is required`);
  }

  return String(value).trim();
}

module.exports = {
  DEFAULT_TELEGRAM_BASE_URL,
  buildTelegramMethodUrl,
  createTelegramClient,
  createTelegramClientFromConfig,
  sendTelegramMessage
};
