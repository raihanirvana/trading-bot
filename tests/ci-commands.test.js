const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const packageJson = require('../package.json');

describe('ci commands', () => {
  it('defines local test, indicator test, lint, typecheck, and ci scripts', () => {
    assert.equal(packageJson.scripts.test, 'node --test');
    assert.equal(packageJson.scripts['test:indicators'], 'node --test tests/adx.test.js tests/atr.test.js tests/bollinger.test.js tests/ema.test.js tests/indicator-compare.test.js tests/relative-volume.test.js');
    assert.equal(packageJson.scripts.lint, 'node scripts/check-js-syntax.js');
    assert.equal(packageJson.scripts.typecheck, 'node scripts/typecheck-placeholder.js');
    assert.equal(packageJson.scripts.ci, 'npm run lint && npm run typecheck && npm test');
  });
});
