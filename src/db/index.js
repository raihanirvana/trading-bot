class DatabaseError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'DatabaseError';
    this.details = details;
  }
}

const MIGRATIONS = Object.freeze([
  {
    id: '000_placeholder',
    description: 'Migration placeholder. Trading schemas are intentionally out of scope for B0-T04.'
  }
]);

function validateDatabaseConfig(config) {
  if (!config || typeof config.databaseUrl !== 'string' || config.databaseUrl.trim() === '') {
    throw new DatabaseError('DATABASE_URL is required');
  }

  return {
    databaseUrl: config.databaseUrl
  };
}

function createMemoryAdapter(options = {}) {
  let connected = false;

  return {
    connect() {
      if (options.failConnect) {
        throw new Error('mock connect failure');
      }

      connected = true;
      return { connected };
    },
    health() {
      if (options.failHealth) {
        throw new Error('mock health failure');
      }

      return { ok: connected };
    },
    migrate(migrations = MIGRATIONS) {
      return {
        applied: migrations.map((migration) => migration.id)
      };
    }
  };
}

function createDatabaseClient(config, options = {}) {
  const dbConfig = validateDatabaseConfig(config);
  const adapter = options.adapter || createMemoryAdapter();

  return {
    config: dbConfig,
    connect() {
      try {
        return adapter.connect(dbConfig);
      } catch (error) {
        throw new DatabaseError('Database connection failed', { cause: error.message });
      }
    },
    migrate() {
      try {
        return adapter.migrate(MIGRATIONS);
      } catch (error) {
        throw new DatabaseError('Database migration failed', { cause: error.message });
      }
    },
    health() {
      try {
        return adapter.health(dbConfig);
      } catch (error) {
        throw new DatabaseError('Database health check failed', { cause: error.message });
      }
    }
  };
}

function initDatabase(config, options = {}) {
  const client = createDatabaseClient(config, options);
  const connection = client.connect();
  const migration = client.migrate();

  return {
    client,
    connection,
    migration
  };
}

module.exports = {
  DatabaseError,
  MIGRATIONS,
  createDatabaseClient,
  createMemoryAdapter,
  initDatabase,
  validateDatabaseConfig
};
