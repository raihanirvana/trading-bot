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
    assert.equal(config.nodeEnv, 'development');
    assert.equal(config.logLevel, 'info');
    assert.equal(config.databaseUrl, 'memory://local');
    assert.equal(config.aiProvider, 'openrouter');
    assert.equal(config.exchangeName, 'mexc');
  });

  it('loads explicit environment values', () => {
    const config = loadConfig({
      DRY_RUN: 'false',
      LIVE_TRADING_ENABLED: 'true',
      AUTO_TRADE_ENABLED: 'false',
      NODE_ENV: 'test',
      LOG_LEVEL: 'debug',
      DATABASE_URL: 'memory://test',
      AI_PROVIDER: 'openrouter',
      EXCHANGE_NAME: 'mexc'
    });

    assert.equal(config.dryRun, false);
    assert.equal(config.liveTradingEnabled, true);
    assert.equal(config.autoTradeEnabled, false);
    assert.equal(config.nodeEnv, 'test');
    assert.equal(config.logLevel, 'debug');
    assert.equal(config.databaseUrl, 'memory://test');
    assert.equal(config.aiProvider, 'openrouter');
    assert.equal(config.exchangeName, 'mexc');
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

  it('redacts secrets before logging', () => {
    const sanitized = sanitizeConfigForLogs(loadConfig({
      OPENROUTER_API_KEY: 'openrouter-secret',
      TELEGRAM_BOT_TOKEN: 'telegram-secret',
      MEXC_API_KEY: 'mexc-key',
      MEXC_API_SECRET: 'mexc-secret',
      LOG_LEVEL: 'debug'
    }));

    assert.equal(sanitized.openRouterApiKey, '[REDACTED]');
    assert.equal(sanitized.telegramBotToken, '[REDACTED]');
    assert.equal(sanitized.exchangeApiKey, '[REDACTED]');
    assert.equal(sanitized.exchangeApiSecret, '[REDACTED]');
    assert.equal(sanitized.logLevel, 'debug');
  });
});
