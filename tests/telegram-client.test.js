const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const { DependencyError, ValidationError } = require('../src/errors');
const {
  buildTelegramMethodUrl,
  createTelegramClient,
  createTelegramClientFromConfig,
  sendTelegramMessage
} = require('../src/telegram');

describe('telegram client', () => {
  it('builds method URLs without exposing setup to callers', () => {
    const url = buildTelegramMethodUrl('https://api.telegram.org', 'token-123', 'sendMessage');

    assert.equal(url, 'https://api.telegram.org/bottoken-123/sendMessage');
  });

  it('sends a message through a mock fetch implementation', async () => {
    const calls = [];
    const fetchImpl = async (url, request) => {
      calls.push({ url, request });

      return {
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          result: {
            message_id: 42,
            chat: { id: 'chat-1' },
            text: 'hello'
          }
        })
      };
    };

    const result = await sendTelegramMessage({
      token: 'token-123',
      chatId: 'chat-1',
      text: 'hello',
      fetchImpl
    });

    assert.equal(result.message_id, 42);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://api.telegram.org/bottoken-123/sendMessage');
    assert.equal(calls[0].request.method, 'POST');
    assert.deepEqual(JSON.parse(calls[0].request.body), {
      chat_id: 'chat-1',
      text: 'hello'
    });
  });

  it('creates a client from config and sends a mock message', async () => {
    const client = createTelegramClientFromConfig({
      telegramBotToken: 'token-from-config'
    }, {
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          result: { message_id: 7 }
        })
      })
    });

    const result = await client.sendMessage({
      chatId: 'chat-1',
      text: 'config message'
    });

    assert.equal(result.message_id, 7);
  });

  it('rejects missing token, chat id, or text before network calls', async () => {
    assert.throws(
      () => createTelegramClient({ token: '' }),
      (error) => error instanceof ValidationError
    );

    await assert.rejects(
      () => sendTelegramMessage({ token: 'token', chatId: '', text: 'hello', fetchImpl: async () => ({}) }),
      (error) => error instanceof ValidationError
    );

    await assert.rejects(
      () => sendTelegramMessage({ token: 'token', chatId: 'chat-1', text: '', fetchImpl: async () => ({}) }),
      (error) => error instanceof ValidationError
    );
  });

  it('wraps Telegram API failures in dependency errors', async () => {
    await assert.rejects(
      () => sendTelegramMessage({
        token: 'token',
        chatId: 'chat-1',
        text: 'hello',
        fetchImpl: async () => ({
          ok: false,
          status: 401,
          json: async () => ({
            ok: false,
            error_code: 401,
            description: 'Unauthorized'
          })
        })
      }),
      (error) => {
        assert.equal(error instanceof DependencyError, true);
        assert.equal(error.details.statusCode, 401);
        assert.equal(error.details.errorCode, 401);
        return true;
      }
    );
  });
});
