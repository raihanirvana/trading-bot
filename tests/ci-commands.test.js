const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const packageJson = require('../package.json');

describe('ci commands', () => {
  it('defines local test, lint, typecheck, and ci scripts', () => {
    assert.equal(packageJson.scripts.test, 'node --test');
    assert.equal(packageJson.scripts.lint, 'node scripts/check-js-syntax.js');
    assert.equal(packageJson.scripts.typecheck, 'node scripts/typecheck-placeholder.js');
    assert.equal(packageJson.scripts.ci, 'npm run lint && npm run typecheck && npm test');
  });
});
