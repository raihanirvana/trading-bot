const fs = require('node:fs');

const { shouldRedactKey } = require('./config');

const LEVELS = Object.freeze({
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
});

function redactValue(value) {
  if (Array.isArray(value)) {
    return value.map(redactValue);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        shouldRedactKey(key) && nestedValue ? '[REDACTED]' : redactValue(nestedValue)
      ])
    );
  }

  return value;
}

function normalizeLevel(level) {
  if (!Object.hasOwn(LEVELS, level)) {
    return 'info';
  }

  return level;
}

function formatLogEntry({ level, message, context = {}, timestamp = new Date() }) {
  return JSON.stringify({
    timestamp: timestamp.toISOString(),
    level,
    message,
    context: redactValue(context)
  });
}

function createLogger(options = {}) {
  const minLevel = normalizeLevel(options.level || 'info');
  const sink = options.sink || console;
  const filePath = options.filePath;
  const now = options.now || (() => new Date());

  function shouldLog(level) {
    return LEVELS[level] >= LEVELS[minLevel];
  }

  function write(level, message, context = {}) {
    const normalizedLevel = normalizeLevel(level);

    if (!shouldLog(normalizedLevel)) {
      return null;
    }

    const line = formatLogEntry({
      level: normalizedLevel,
      message,
      context,
      timestamp: now()
    });

    const writer = normalizedLevel === 'error' ? sink.error : sink.log;
    writer.call(sink, line);

    if (filePath) {
      fs.appendFileSync(filePath, `${line}\n`, 'utf8');
    }

    return line;
  }

  return {
    debug: (message, context) => write('debug', message, context),
    info: (message, context) => write('info', message, context),
    warn: (message, context) => write('warn', message, context),
    error: (message, context) => write('error', message, context)
  };
}

module.exports = {
  LEVELS,
  createLogger,
  formatLogEntry,
  redactValue
};
