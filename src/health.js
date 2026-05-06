const { loadConfig } = require('./config');
const { createDatabaseClient } = require('./db');
const { createLogger } = require('./logger');

function buildCheck(name, fn) {
  try {
    const details = fn();

    return {
      name,
      ok: !(details && details.ok === false),
      details
    };
  } catch (error) {
    return {
      name,
      ok: false,
      error: error.message
    };
  }
}

function checkRuntime(runtime = process) {
  return {
    node: runtime.version,
    platform: runtime.platform
  };
}

function runHealthCheck(options = {}) {
  const loadConfigFn = options.loadConfig || loadConfig;
  const createDatabaseClientFn = options.createDatabaseClient || createDatabaseClient;
  const runtime = options.runtime || process;
  let config;
  let dbClient;

  const checks = [
    buildCheck('config', () => {
      config = loadConfigFn(options.env || process.env);
      return {
        dryRun: config.dryRun,
        liveTradingEnabled: config.liveTradingEnabled,
        autoTradeEnabled: config.autoTradeEnabled
      };
    }),
    buildCheck('database', () => {
      if (!config) {
        throw new Error('Config unavailable');
      }

      dbClient = createDatabaseClientFn(config, options.dbOptions || {});
      dbClient.connect();
      return dbClient.health();
    }),
    buildCheck('runtime', () => checkRuntime(runtime))
  ];

  return {
    ok: checks.every((check) => check.ok),
    checks
  };
}

function main() {
  const logger = createLogger({ level: process.env.LOG_LEVEL || 'info' });
  const health = runHealthCheck();

  logger.info('health check completed', health);

  if (!health.ok) {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  buildCheck,
  checkRuntime,
  main,
  runHealthCheck
};
