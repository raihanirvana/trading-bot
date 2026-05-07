const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const {
  ConfigError,
  loadConfig,
  sanitizeConfigForLogs
} = require('../src/config');

describe('environment config', () => {
  it('loads safe defaults', () => {
    const config = loadConfig({});

    assert.equal(config.dryRun, true);
    assert.equal(config.liveTradingEnabled, false);
    assert.equal(config.autoTradeEnabled, false);
    assert.equal(config.signalOnly, false);
    assert.equal(config.paperTrading, false);
    assert.equal(config.semiAutoEnabled, false);
    assert.equal(config.nodeEnv, 'development');
    assert.equal(config.logLevel, 'info');
    assert.equal(config.databaseUrl, 'memory://local');
    assert.equal(config.aiProvider, 'openrouter');
    assert.equal(config.aiFallbackMode, 'rule_based');
    assert.equal(config.openRouterBaseUrl, 'https://openrouter.ai/api/v1');
    assert.equal(config.openRouterModel, 'openai/gpt-4o-mini');
    assert.equal(config.exchangeName, 'mexc');
    assert.equal(config.mexcBaseUrl, 'https://api.mexc.fm');
  });

  it('loads explicit environment values', () => {
    const config = loadConfig({
      DRY_RUN: 'false',
      LIVE_TRADING_ENABLED: 'true',
      AUTO_TRADE_ENABLED: 'false',
      SIGNAL_ONLY: 'true',
      PAPER_TRADING: 'true',
      SEMI_AUTO_ENABLED: 'true',
      NODE_ENV: 'test',
      LOG_LEVEL: 'debug',
      DATABASE_URL: 'memory://test',
      AI_PROVIDER: 'openrouter',
      AI_FALLBACK_MODE: 'skip',
      OPENROUTER_BASE_URL: 'https://openrouter.test/api/v1',
      OPENROUTER_MODEL: 'anthropic/claude-test',
      EXCHANGE_NAME: 'mexc',
      MEXC_BASE_URL: 'https://example.test',
      TELEGRAM_BOT_TOKEN: 'telegram-token',
      TELEGRAM_CHAT_ID: 'telegram-chat'
    });

    assert.equal(config.dryRun, false);
    assert.equal(config.liveTradingEnabled, true);
    assert.equal(config.autoTradeEnabled, false);
    assert.equal(config.signalOnly, true);
    assert.equal(config.paperTrading, true);
    assert.equal(config.semiAutoEnabled, true);
    assert.equal(config.nodeEnv, 'test');
    assert.equal(config.logLevel, 'debug');
    assert.equal(config.databaseUrl, 'memory://test');
    assert.equal(config.aiProvider, 'openrouter');
    assert.equal(config.aiFallbackMode, 'skip');
    assert.equal(config.openRouterBaseUrl, 'https://openrouter.test/api/v1');
    assert.equal(config.openRouterModel, 'anthropic/claude-test');
    assert.equal(config.exchangeName, 'mexc');
    assert.equal(config.mexcBaseUrl, 'https://example.test');
    assert.equal(config.telegramBotToken, 'telegram-token');
    assert.equal(config.telegramChatId, 'telegram-chat');
  });

  it('throws a config error when required env is missing', () => {
    assert.throws(
      () => loadConfig({}, { requiredEnv: ['TELEGRAM_BOT_TOKEN'] }),
      (error) => {
        assert.equal(error instanceof ConfigError, true);
        assert.deepEqual(error.details.missing, ['TELEGRAM_BOT_TOKEN']);
        return true;
      }
    );
  });

  it('throws a config error when AI fallback mode is invalid', () => {
    assert.throws(
      () => loadConfig({
        AI_FALLBACK_MODE: 'panic'
      }),
      (error) => {
        assert.equal(error instanceof ConfigError, true);
        assert.deepEqual(error.details.allowed, ['rule_based', 'skip']);
        return true;
      }
    );
  });

  it('redacts secrets before logging', () => {
    const sanitized = sanitizeConfigForLogs(loadConfig({
      OPENROUTER_API_KEY: 'openrouter-secret',
      TELEGRAM_BOT_TOKEN: 'telegram-secret',
      TELEGRAM_CHAT_ID: 'telegram-chat',
      MEXC_API_KEY: 'mexc-key',
      MEXC_API_SECRET: 'mexc-secret',
      LOG_LEVEL: 'debug'
    }));

    assert.equal(sanitized.openRouterApiKey, '[REDACTED]');
    assert.equal(sanitized.telegramBotToken, '[REDACTED]');
    assert.equal(sanitized.telegramChatId, 'telegram-chat');
    assert.equal(sanitized.exchangeApiKey, '[REDACTED]');
    assert.equal(sanitized.exchangeApiSecret, '[REDACTED]');
    assert.equal(sanitized.logLevel, 'debug');
  });
});
