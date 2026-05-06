const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const { getDefaultConfig } = require('../src/config');

const projectRoot = path.join(__dirname, '..');

describe('project scaffold', () => {
  it('has required top-level folders', () => {
    for (const folderName of ['src', 'tests', 'docs', 'tickets', 'logs']) {
      const folderPath = path.join(projectRoot, folderName);

      assert.equal(fs.existsSync(folderPath), true, `${folderName} should exist`);
      assert.equal(fs.statSync(folderPath).isDirectory(), true, `${folderName} should be a directory`);
    }
  });

  it('has an env example file', () => {
    assert.equal(fs.existsSync(path.join(projectRoot, '.env.example')), true);
  });

  it('keeps DRY_RUN true by default', () => {
    assert.equal(getDefaultConfig().dryRun, true);
  });
});
