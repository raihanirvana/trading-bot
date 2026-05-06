const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const {
  buildSignalIdempotencyKey,
  createSignalIdempotencyRegistry
} = require('../src/signals/idempotency');

function keyInput(overrides = {}) {
  return {
    symbol: 'ETHUSDT',
    timeframe: '15m',
    timestamp: '2026-05-04T12:00:00.000Z',
    side: 'BUY',
    ...overrides
  };
}

describe('signal idempotency key', () => {
  it('builds key from symbol, timeframe, timestamp, and side', () => {
    assert.equal(
      buildSignalIdempotencyKey(keyInput()),
      'ETHUSDT-15m-20260504T120000Z-BUY'
    );
  });

  it('marks the same key as duplicate', () => {
    const registry = createSignalIdempotencyRegistry();

    assert.deepEqual(registry.checkAndRemember(keyInput()), {
      accepted: true,
      duplicate: false,
      reason: 'Signal accepted'
    });
    assert.deepEqual(registry.checkAndRemember(keyInput()), {
      accepted: false,
      duplicate: true,
      reason: 'Duplicate signal'
    });
    assert.equal(registry.size(), 1);
  });

  it('treats different side as distinct', () => {
    const registry = createSignalIdempotencyRegistry();

    assert.equal(registry.checkAndRemember(keyInput({ side: 'BUY' })).accepted, true);
    assert.equal(registry.checkAndRemember(keyInput({ side: 'SELL' })).accepted, true);
    assert.equal(registry.size(), 2);
  });

  it('treats different timestamp as distinct', () => {
    const registry = createSignalIdempotencyRegistry();

    assert.equal(registry.checkAndRemember(keyInput({
      timestamp: '2026-05-04T12:00:00.000Z'
    })).accepted, true);
    assert.equal(registry.checkAndRemember(keyInput({
      timestamp: '2026-05-04T12:15:00.000Z'
    })).accepted, true);
    assert.equal(registry.size(), 2);
  });

  it('rejects invalid key input', () => {
    const registry = createSignalIdempotencyRegistry();

    assert.deepEqual(registry.checkAndRemember(keyInput({
      side: 'HOLD'
    })), {
      accepted: false,
      duplicate: false,
      reason: 'Invalid idempotency key'
    });
  });
});
