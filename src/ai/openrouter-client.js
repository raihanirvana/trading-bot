const { DependencyError, ValidationError } = require('../errors');

const DEFAULT_OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const DEFAULT_OPENROUTER_MODEL = 'openai/gpt-4o-mini';
const DEFAULT_OPENROUTER_TIMEOUT_MS = 15000;
const DEFAULT_OPENROUTER_MAX_RETRIES = 1;

function createOpenRouterClient(options = {}) {
  const apiKey = normalizeRequiredString(options.apiKey, 'OpenRouter API key');
  const baseUrl = options.baseUrl || DEFAULT_OPENROUTER_BASE_URL;
  const model = options.model || DEFAULT_OPENROUTER_MODEL;
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const timeoutMs = options.timeoutMs || DEFAULT_OPENROUTER_TIMEOUT_MS;
  const maxRetries = Number.isInteger(options.maxRetries)
    ? options.maxRetries
    : DEFAULT_OPENROUTER_MAX_RETRIES;

  if (typeof fetchImpl !== 'function') {
    throw new DependencyError('OpenRouter fetch implementation is unavailable');
  }

  return {
    createChatCompletion: (request) => createOpenRouterChatCompletion({
      apiKey,
      baseUrl,
      fetchImpl,
      maxRetries,
      model,
      request,
      timeoutMs
    })
  };
}

function createOpenRouterClientFromConfig(config, options = {}) {
  return createOpenRouterClient({
    apiKey: config.openRouterApiKey,
    baseUrl: options.baseUrl || config.openRouterBaseUrl,
    fetchImpl: options.fetchImpl,
    maxRetries: options.maxRetries,
    model: options.model || config.openRouterModel,
    timeoutMs: options.timeoutMs
  });
}

async function createOpenRouterChatCompletion(options = {}) {
  const {
    apiKey,
    baseUrl = DEFAULT_OPENROUTER_BASE_URL,
    fetchImpl = globalThis.fetch,
    maxRetries = DEFAULT_OPENROUTER_MAX_RETRIES,
    model = DEFAULT_OPENROUTER_MODEL,
    request = {},
    timeoutMs = DEFAULT_OPENROUTER_TIMEOUT_MS
  } = options;

  normalizeRequiredString(apiKey, 'OpenRouter API key');
  validateMessages(request.messages);

  const url = buildOpenRouterChatCompletionsUrl(baseUrl);
  const body = {
    model,
    stream: false,
    ...request,
    messages: request.messages
  };
  const attempts = Math.max(0, maxRetries) + 1;
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await sendOpenRouterRequest({
        apiKey,
        body,
        fetchImpl,
        timeoutMs,
        url
      });
    } catch (error) {
      lastError = error;

      if (!isRetryableOpenRouterError(error) || attempt === attempts) {
        throw error;
      }
    }
  }

  throw lastError;
}

async function sendOpenRouterRequest({ apiKey, body, fetchImpl, timeoutMs, url }) {
  if (typeof fetchImpl !== 'function') {
    throw new DependencyError('OpenRouter fetch implementation is unavailable');
  }

  const controller = createAbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  let response;

  try {
    response = await fetchImpl(url, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new DependencyError('OpenRouter request timed out', {
        retryable: true,
        timeoutMs
      });
    }

    throw new DependencyError('OpenRouter request failed', {
      cause: error.message,
      retryable: true
    });
  } finally {
    clearTimeout(timeout);
  }

  const payload = await readOpenRouterJson(response);

  if (!response.ok) {
    throw new DependencyError('OpenRouter response was not OK', {
      statusCode: response.status,
      retryable: response.status === 408 || response.status === 429 || response.status >= 500,
      error: payload.error || null
    });
  }

  return payload;
}

function buildOpenRouterChatCompletionsUrl(baseUrl) {
  try {
    const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;

    return new URL('chat/completions', normalizedBaseUrl).toString();
  } catch (error) {
    throw new DependencyError('Invalid OpenRouter base URL', {
      cause: error.message
    });
  }
}

async function readOpenRouterJson(response) {
  if (!response || typeof response.json !== 'function') {
    throw new DependencyError('Invalid OpenRouter response object');
  }

  try {
    return await response.json();
  } catch (error) {
    throw new DependencyError('OpenRouter response was not valid JSON', {
      statusCode: response.status,
      retryable: false,
      cause: error.message
    });
  }
}

function isRetryableOpenRouterError(error) {
  return error instanceof DependencyError && error.details.retryable === true;
}

function validateMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new ValidationError('OpenRouter messages are required');
  }

  for (const message of messages) {
    if (!message || !['system', 'user', 'assistant'].includes(message.role) || typeof message.content !== 'string') {
      throw new ValidationError('OpenRouter messages must contain role and string content');
    }
  }
}

function normalizeRequiredString(value, label) {
  if (value === undefined || value === null || String(value).trim() === '') {
    throw new ValidationError(`${label} is required`);
  }

  return String(value).trim();
}

function createAbortController() {
  if (typeof AbortController === 'undefined') {
    throw new DependencyError('AbortController is unavailable');
  }

  return new AbortController();
}

module.exports = {
  DEFAULT_OPENROUTER_BASE_URL,
  DEFAULT_OPENROUTER_MAX_RETRIES,
  DEFAULT_OPENROUTER_MODEL,
  DEFAULT_OPENROUTER_TIMEOUT_MS,
  buildOpenRouterChatCompletionsUrl,
  createOpenRouterChatCompletion,
  createOpenRouterClient,
  createOpenRouterClientFromConfig
};
