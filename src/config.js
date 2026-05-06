const DEFAULT_CONFIG = Object.freeze({
  dryRun: true,
  liveTradingEnabled: false,
  autoTradeEnabled: false,
  nodeEnv: 'development',
  logLevel: 'info',
  databaseUrl: 'memory://local',
  aiProvider: 'openrouter',
  exchangeName: 'mexc',
  mexcBaseUrl: 'https://api.mexc.fm'
});

const DEFAULT_REQUIRED_ENV = Object.freeze([]);
const SECRET_KEY_PATTERN = /(secret|token|password|api_?key|private_?key)/i;

class ConfigError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'ConfigError';
    this.details = details;
  }
}

function parseBoolean(value, defaultValue) {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  const normalized = String(value).trim().toLowerCase();

  if (['true', '1', 'yes', 'y'].includes(normalized)) {
    return true;
  }

  if (['false', '0', 'no', 'n'].includes(normalized)) {
    return false;
  }

  throw new ConfigError(`Invalid boolean value: ${value}`);
}

function getDefaultConfig() {
  return { ...DEFAULT_CONFIG };
}

function validateRequiredEnv(env, requiredEnv = DEFAULT_REQUIRED_ENV) {
  const missing = requiredEnv.filter((key) => env[key] === undefined || env[key] === '');

  if (missing.length > 0) {
    throw new ConfigError('Missing required environment variables', { missing });
  }
}

function loadConfig(env = process.env, options = {}) {
  const requiredEnv = options.requiredEnv || DEFAULT_REQUIRED_ENV;

  validateRequiredEnv(env, requiredEnv);

  return {
    dryRun: parseBoolean(env.DRY_RUN, DEFAULT_CONFIG.dryRun),
    liveTradingEnabled: parseBoolean(env.LIVE_TRADING_ENABLED, DEFAULT_CONFIG.liveTradingEnabled),
    autoTradeEnabled: parseBoolean(env.AUTO_TRADE_ENABLED, DEFAULT_CONFIG.autoTradeEnabled),
    nodeEnv: env.NODE_ENV || DEFAULT_CONFIG.nodeEnv,
    logLevel: env.LOG_LEVEL || DEFAULT_CONFIG.logLevel,
    databaseUrl: env.DATABASE_URL || DEFAULT_CONFIG.databaseUrl,
    aiProvider: env.AI_PROVIDER || DEFAULT_CONFIG.aiProvider,
    exchangeName: env.EXCHANGE_NAME || DEFAULT_CONFIG.exchangeName,
    mexcBaseUrl: env.MEXC_BASE_URL || DEFAULT_CONFIG.mexcBaseUrl,
    openRouterApiKey: env.OPENROUTER_API_KEY || '',
    telegramBotToken: env.TELEGRAM_BOT_TOKEN || '',
    exchangeApiKey: env.MEXC_API_KEY || env.EXCHANGE_API_KEY || '',
    exchangeApiSecret: env.MEXC_API_SECRET || env.EXCHANGE_API_SECRET || ''
  };
}

function sanitizeConfigForLogs(config) {
  return Object.fromEntries(
    Object.entries(config).map(([key, value]) => [
      key,
      shouldRedactKey(key) && value ? '[REDACTED]' : value
    ])
  );
}

function shouldRedactKey(key) {
  return SECRET_KEY_PATTERN.test(key);
}

module.exports = {
  ConfigError,
  DEFAULT_CONFIG,
  getDefaultConfig,
  loadConfig,
  sanitizeConfigForLogs,
  shouldRedactKey,
  validateRequiredEnv
};
