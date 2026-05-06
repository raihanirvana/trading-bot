const { loadConfig } = require('../src/config');
const { createLogger } = require('../src/logger');
const { createTelegramClientFromConfig } = require('../src/telegram');

async function main() {
  const config = loadConfig(process.env, {
    requiredEnv: ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID']
  });
  const logger = createLogger({ level: config.logLevel });
  const client = createTelegramClientFromConfig(config);

  const result = await client.sendMessage({
    chatId: config.telegramChatId,
    text: 'Trading robot Telegram test message'
  });

  logger.info('telegram test message sent', {
    chatId: config.telegramChatId,
    messageId: result.message_id
  });
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  main
};
