const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const {
  AppError,
  DependencyError,
  ValidationError,
  logError,
  normalizeError,
  toSafeErrorResponse
} = require('../src/errors');

describe('error handling base', () => {
  it('supports custom app errors', () => {
    const error = new ValidationError('Invalid candle', { field: 'timestamp' });

    assert.equal(error instanceof AppError, true);
    assert.equal(error.code, 'VALIDATION_ERROR');
    assert.equal(error.statusCode, 400);
    assert.deepEqual(error.details, { field: 'timestamp' });
  });

  it('creates safe responses without exposing details', () => {
    const response = toSafeErrorResponse(
      new DependencyError('Database unavailable', {
        databasePassword: 'secret'
      })
    );

    assert.deepEqual(response, {
      ok: false,
      error: {
        code: 'DEPENDENCY_ERROR',
        message: 'Database unavailable',
        statusCode: 503
      }
    });
  });

  it('normalizes unknown Error instances', () => {
    const normalized = normalizeError(new Error('raw secret stack detail'));

    assert.equal(normalized.code, 'UNEXPECTED_ERROR');
    assert.equal(normalized.message, 'Unexpected error');
    assert.equal(normalized.statusCode, 500);
    assert.equal(normalized.isOperational, false);
    assert.deepEqual(normalized.details, {
      cause: 'raw secret stack detail'
    });
  });

  it('normalizes non-error throws', () => {
    const response = toSafeErrorResponse('boom');

    assert.deepEqual(response, {
      ok: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: 'Unknown error',
        statusCode: 500
      }
    });
  });

  it('logs errors with redacted context', () => {
    const lines = [];
    const logger = {
      error: (message, context) => {
        const line = JSON.stringify({ message, context });
        lines.push(line);
        return line;
      }
    };

    const line = logError(
      logger,
      new DependencyError('OpenRouter failed', {
        openRouterApiKey: 'secret-key'
      }),
      {
        telegramBotToken: 'secret-token'
      }
    );
    const parsed = JSON.parse(line);

    assert.equal(parsed.message, 'OpenRouter failed');
    assert.equal(parsed.context.telegramBotToken, '[REDACTED]');
    assert.equal(parsed.context.error.details.openRouterApiKey, '[REDACTED]');
    assert.equal(lines.length, 1);
  });
});
