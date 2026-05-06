const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { describe, it } = require('node:test');
const path = require('node:path');

const { loadConfig } = require('../src/config');
const { createMemoryAdapter } = require('../src/db');
const {
  checkRuntime,
  runHealthCheck
} = require('../src/health');

describe('health check', () => {
  it('returns ok when config, database, and runtime are healthy', () => {
    const health = runHealthCheck({
      env: {},
      runtime: {
        version: 'v20.0.0',
        platform: 'test'
      }
    });

    assert.equal(health.ok, true);
    assert.deepEqual(health.checks.map((check) => [check.name, check.ok]), [
      ['config', true],
      ['database', true],
      ['runtime', true]
    ]);
  });

  it('returns failed health when database health fails', () => {
    const health = runHealthCheck({
      env: {},
      dbOptions: {
        adapter: createMemoryAdapter({ failHealth: true })
      },
      runtime: {
        version: 'v20.0.0',
        platform: 'test'
      }
    });

    assert.equal(health.ok, false);
    assert.equal(health.checks[1].name, 'database');
    assert.equal(health.checks[1].ok, false);
    assert.equal(health.checks[1].error, 'Database health check failed');
  });

  it('returns failed health when config loading fails', () => {
    const health = runHealthCheck({
      loadConfig: () => {
        throw new Error('missing config');
      },
      runtime: {
        version: 'v20.0.0',
        platform: 'test'
      }
    });

    assert.equal(health.ok, false);
    assert.equal(health.checks[0].name, 'config');
    assert.equal(health.checks[0].ok, false);
    assert.equal(health.checks[1].error, 'Config unavailable');
  });

  it('reports runtime details', () => {
    assert.deepEqual(checkRuntime({
      version: 'v20.1.0',
      platform: 'darwin'
    }), {
      node: 'v20.1.0',
      platform: 'darwin'
    });
  });

  it('can use a mocked database client', () => {
    let connected = false;
    const health = runHealthCheck({
      loadConfig: () => loadConfig({}),
      createDatabaseClient: () => ({
        connect: () => {
          connected = true;
        },
        health: () => ({ ok: connected })
      }),
      runtime: {
        version: 'v20.0.0',
        platform: 'test'
      }
    });

    assert.equal(health.ok, true);
    assert.equal(health.checks[1].details.ok, true);
  });

  it('treats dependency details ok false as failed health', () => {
    const health = runHealthCheck({
      loadConfig: () => loadConfig({}),
      createDatabaseClient: () => ({
        connect: () => {},
        health: () => ({ ok: false, reason: 'not connected' })
      }),
      runtime: {
        version: 'v20.0.0',
        platform: 'test'
      }
    });

    assert.equal(health.ok, false);
    assert.equal(health.checks[1].name, 'database');
    assert.equal(health.checks[1].ok, false);
    assert.deepEqual(health.checks[1].details, {
      ok: false,
      reason: 'not connected'
    });
  });

  it('prints structured failed health for invalid env values', () => {
    const result = spawnSync(process.execPath, [path.join(__dirname, '..', 'src', 'health.js')], {
      encoding: 'utf8',
      env: {
        ...process.env,
        DRY_RUN: 'maybe'
      }
    });
    const logLine = JSON.parse(result.stdout.trim());

    assert.equal(result.status, 1);
    assert.equal(result.stderr, '');
    assert.equal(logLine.message, 'health check completed');
    assert.equal(logLine.context.ok, false);
    assert.equal(logLine.context.checks[0].name, 'config');
    assert.equal(logLine.context.checks[0].ok, false);
    assert.match(logLine.context.checks[0].error, /Invalid boolean value/);
  });
});
