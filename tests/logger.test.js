const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const {
  createLogger,
  formatLogEntry
} = require('../src/logger');

describe('logger', () => {
  it('formats messages consistently', () => {
    const line = formatLogEntry({
      level: 'info',
      message: 'app started',
      context: { mode: 'DRY_RUN' },
      timestamp: new Date('2026-05-06T00:00:00.000Z')
    });

    assert.deepEqual(JSON.parse(line), {
      timestamp: '2026-05-06T00:00:00.000Z',
      level: 'info',
      message: 'app started',
      context: { mode: 'DRY_RUN' }
    });
  });

  it('redacts secrets from context', () => {
    const line = formatLogEntry({
      level: 'error',
      message: 'request failed',
      context: {
        openRouterApiKey: 'secret-key',
        nested: {
          telegramBotToken: 'secret-token'
        },
        symbol: 'ETHUSDT'
      },
      timestamp: new Date('2026-05-06T00:00:00.000Z')
    });

    assert.deepEqual(JSON.parse(line).context, {
      openRouterApiKey: '[REDACTED]',
      nested: {
        telegramBotToken: '[REDACTED]'
      },
      symbol: 'ETHUSDT'
    });
  });

  it('respects configured log level', () => {
    const lines = [];
    const logger = createLogger({
      level: 'warn',
      sink: {
        log: (line) => lines.push(line),
        error: (line) => lines.push(line)
      },
      now: () => new Date('2026-05-06T00:00:00.000Z')
    });

    assert.equal(logger.info('hidden'), null);
    assert.notEqual(logger.warn('visible'), null);
    assert.equal(lines.length, 1);
    assert.equal(JSON.parse(lines[0]).level, 'warn');
  });
});
