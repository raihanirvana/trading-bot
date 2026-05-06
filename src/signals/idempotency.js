const { buildSignalId } = require('./schema');

function buildSignalIdempotencyKey({ symbol, timeframe, timestamp, side }) {
  return buildSignalId({
    symbol,
    timeframe,
    timestamp,
    side
  });
}

function createSignalIdempotencyRegistry(initialKeys = []) {
  const seenKeys = new Set(initialKeys);

  return {
    has(key) {
      return seenKeys.has(key);
    },
    remember(key) {
      if (!key) {
        return {
          accepted: false,
          duplicate: false,
          reason: 'Invalid idempotency key'
        };
      }

      if (seenKeys.has(key)) {
        return {
          accepted: false,
          duplicate: true,
          reason: 'Duplicate signal'
        };
      }

      seenKeys.add(key);

      return {
        accepted: true,
        duplicate: false,
        reason: 'Signal accepted'
      };
    },
    checkAndRemember(input) {
      return this.remember(buildSignalIdempotencyKey(input));
    },
    size() {
      return seenKeys.size;
    }
  };
}

module.exports = {
  buildSignalIdempotencyKey,
  createSignalIdempotencyRegistry
};
