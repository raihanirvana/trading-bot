const { loadConfig, sanitizeConfigForLogs } = require('./config');
const { createLogger } = require('./logger');

function main() {
  const config = loadConfig();
  const logger = createLogger({ level: config.logLevel });

  logger.info('app started', {
    status: 'ok',
    mode: config.dryRun ? 'DRY_RUN' : 'ACTIVE',
    config: sanitizeConfigForLogs(config)
  });
}

if (require.main === module) {
  main();
}

module.exports = {
  main
};
