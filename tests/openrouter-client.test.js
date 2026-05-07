const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const {
  buildOpenRouterChatCompletionsUrl,
  createOpenRouterChatCompletion,
  createOpenRouterClient,
  createOpenRouterClientFromConfig
} = require('../src/ai');
const { DependencyError, ValidationError } = require('../src/errors');

const VALID_MESSAGES = Object.freeze([
  {
    role: 'system',
    content: 'You are a risk classifier.'
  },
  {
    role: 'user',
    content: '{"signal_id":"signal-1"}'
  }
]);

describe('OpenRouter client', () => {
  it('builds chat completions URL from official base endpoint', () => {
    assert.equal(
      buildOpenRouterChatCompletionsUrl('https://openrouter.ai/api/v1'),
      'https://openrouter.ai/api/v1/chat/completions'
    );
  });

  it('sends a successful mock chat completion request', async () => {
    const calls = [];
    const client = createOpenRouterClient({
      apiKey: 'openrouter-key',
      fetchImpl: async (url, request) => {
        calls.push({ url, request });

        return jsonResponse(200, {
          id: 'chatcmpl-1',
          choices: [
            {
              message: {
                role: 'assistant',
                content: '{"action":"ALLOW"}'
              }
            }
          ]
        });
      },
      model: 'openai/gpt-4o-mini'
    });

    const result = await client.createChatCompletion({
      messages: VALID_MESSAGES,
      temperature: 0
    });

    assert.equal(result.id, 'chatcmpl-1');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://openrouter.ai/api/v1/chat/completions');
    assert.equal(calls[0].request.method, 'POST');
    assert.equal(calls[0].request.headers.authorization, 'Bearer openrouter-key');
    assert.equal(calls[0].request.headers['content-type'], 'application/json');
    assert.deepEqual(JSON.parse(calls[0].request.body), {
      model: 'openai/gpt-4o-mini',
      stream: false,
      messages: VALID_MESSAGES,
      temperature: 0
    });
  });

  it('creates client from config', async () => {
    const client = createOpenRouterClientFromConfig({
      openRouterApiKey: 'openrouter-key',
      openRouterBaseUrl: 'https://openrouter.test/api/v1',
      openRouterModel: 'test/model'
    }, {
      fetchImpl: async () => jsonResponse(200, {
        choices: []
      })
    });

    const result = await client.createChatCompletion({
      messages: VALID_MESSAGES
    });

    assert.deepEqual(result, {
      choices: []
    });
  });

  it('retries limited retryable failures then succeeds', async () => {
    let calls = 0;

    const result = await createOpenRouterChatCompletion({
      apiKey: 'openrouter-key',
      fetchImpl: async () => {
        calls += 1;

        if (calls === 1) {
          return jsonResponse(503, {
            error: {
              message: 'temporarily unavailable'
            }
          });
        }

        return jsonResponse(200, {
          choices: [
            {
              message: {
                content: '{"action":"ALLOW"}'
              }
            }
          ]
        });
      },
      maxRetries: 1,
      request: {
        messages: VALID_MESSAGES
      }
    });

    assert.equal(calls, 2);
    assert.equal(result.choices.length, 1);
  });

  it('wraps timeout as retryable dependency error', async () => {
    await assert.rejects(
      () => createOpenRouterChatCompletion({
        apiKey: 'openrouter-key',
        fetchImpl: async (_url, request) => new Promise((_resolve, reject) => {
          request.signal.addEventListener('abort', () => {
            const error = new Error('aborted');
            error.name = 'AbortError';
            reject(error);
          });
        }),
        maxRetries: 0,
        request: {
          messages: VALID_MESSAGES
        },
        timeoutMs: 1
      }),
      (error) => {
        assert.equal(error instanceof DependencyError, true);
        assert.equal(error.message, 'OpenRouter request timed out');
        assert.equal(error.details.retryable, true);
        assert.equal(error.details.timeoutMs, 1);
        return true;
      }
    );
  });

  it('does not retry non-retryable HTTP failures', async () => {
    let calls = 0;

    await assert.rejects(
      () => createOpenRouterChatCompletion({
        apiKey: 'openrouter-key',
        fetchImpl: async () => {
          calls += 1;

          return jsonResponse(400, {
            error: {
              message: 'bad request'
            }
          });
        },
        maxRetries: 2,
        request: {
          messages: VALID_MESSAGES
        }
      }),
      (error) => {
        assert.equal(error instanceof DependencyError, true);
        assert.equal(error.details.statusCode, 400);
        assert.equal(error.details.retryable, false);
        return true;
      }
    );
    assert.equal(calls, 1);
  });

  it('rejects invalid client inputs', async () => {
    assert.throws(
      () => createOpenRouterClient({ apiKey: '' }),
      (error) => error instanceof ValidationError
    );

    await assert.rejects(
      () => createOpenRouterChatCompletion({
        apiKey: 'openrouter-key',
        fetchImpl: async () => jsonResponse(200, {}),
        request: {
          messages: []
        }
      }),
      (error) => error instanceof ValidationError
    );
  });
});

function jsonResponse(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload
  };
}
