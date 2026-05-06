const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const { loadConfig } = require('../src/config');
const {
  DatabaseError,
  MIGRATIONS,
  createDatabaseClient,
  createMemoryAdapter,
  initDatabase,
  validateDatabaseConfig
} = require('../src/db');

describe('database foundation', () => {
  it('validates database config', () => {
    assert.deepEqual(validateDatabaseConfig(loadConfig({})), {
      databaseUrl: 'memory://local'
    });
  });

  it('throws when database url is missing', () => {
    assert.throws(
      () => validateDatabaseConfig({ databaseUrl: '' }),
      DatabaseError
    );
  });

  it('connects and applies migration placeholder', () => {
    const result = initDatabase(loadConfig({}));

    assert.deepEqual(result.connection, { connected: true });
    assert.deepEqual(result.migration, {
      applied: MIGRATIONS.map((migration) => migration.id)
    });
  });

  it('handles connection failure', () => {
    assert.throws(
      () => initDatabase(loadConfig({}), {
        adapter: createMemoryAdapter({ failConnect: true })
      }),
      (error) => {
        assert.equal(error instanceof DatabaseError, true);
        assert.equal(error.message, 'Database connection failed');
        return true;
      }
    );
  });

  it('supports health check with a mock adapter', () => {
    const client = createDatabaseClient(loadConfig({}));

    client.connect();

    assert.deepEqual(client.health(), { ok: true });
  });

  it('handles health check failure', () => {
    const client = createDatabaseClient(loadConfig({}), {
      adapter: createMemoryAdapter({ failHealth: true })
    });

    client.connect();

    assert.throws(
      () => client.health(),
      (error) => {
        assert.equal(error instanceof DatabaseError, true);
        assert.equal(error.message, 'Database health check failed');
        return true;
      }
    );
  });
});
