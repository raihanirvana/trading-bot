const { redactValue } = require('./logger');

class AppError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = options.name || this.constructor.name;
    this.code = options.code || 'APP_ERROR';
    this.statusCode = options.statusCode || 500;
    this.details = options.details || {};
    this.isOperational = options.isOperational !== false;
  }
}

class ValidationError extends AppError {
  constructor(message, details = {}) {
    super(message, {
      code: 'VALIDATION_ERROR',
      statusCode: 400,
      details
    });
  }
}

class DependencyError extends AppError {
  constructor(message, details = {}) {
    super(message, {
      code: 'DEPENDENCY_ERROR',
      statusCode: 503,
      details
    });
  }
}

function normalizeError(error) {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof Error) {
    return new AppError('Unexpected error', {
      code: 'UNEXPECTED_ERROR',
      statusCode: 500,
      details: {
        cause: error.message
      },
      isOperational: false
    });
  }

  return new AppError('Unknown error', {
    code: 'UNKNOWN_ERROR',
    statusCode: 500,
    details: {
      cause: String(error)
    },
    isOperational: false
  });
}

function toSafeErrorResponse(error) {
  const normalized = normalizeError(error);

  return {
    ok: false,
    error: {
      code: normalized.code,
      message: normalized.message,
      statusCode: normalized.statusCode
    }
  };
}

function logError(logger, error, context = {}) {
  const normalized = normalizeError(error);

  return logger.error(normalized.message, redactValue({
    ...context,
    error: {
      name: normalized.name,
      code: normalized.code,
      statusCode: normalized.statusCode,
      isOperational: normalized.isOperational,
      details: normalized.details
    }
  }));
}

module.exports = {
  AppError,
  DependencyError,
  ValidationError,
  logError,
  normalizeError,
  toSafeErrorResponse
};
