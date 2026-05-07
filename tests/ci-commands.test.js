const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const packageJson = require('../package.json');

describe('ci commands', () => {
  it('defines local test, AI test, indicator test, signal test, journal test, paper test, telegram test, lint, typecheck, and ci scripts', () => {
    assert.equal(packageJson.scripts.test, 'node --test');
    assert.equal(packageJson.scripts['test:ai'], 'node --test tests/ai-calibration-log.test.js tests/ai-decision-journal.test.js tests/ai-fallback.test.js tests/ai-hard-rule-override.test.js tests/ai-input-builder.test.js tests/ai-integration.test.js tests/ai-output-parser.test.js tests/ai-post-sl.test.js tests/ai-prompt.test.js tests/openrouter-client.test.js');
    assert.equal(packageJson.scripts['test:indicators'], 'node --test tests/adx.test.js tests/atr.test.js tests/bollinger.test.js tests/ema.test.js tests/indicator-compare.test.js tests/relative-volume.test.js');
    assert.equal(packageJson.scripts['test:journal'], 'node --test tests/daily-summary.test.js tests/journal-csv-export.test.js tests/journal-schema.test.js tests/journal-repository.test.js tests/missed-trade.test.js tests/virtual-outcome.test.js');
    assert.equal(packageJson.scripts['test:paper'], 'node --test tests/paper-daily-summary.test.js tests/paper-exit.test.js tests/paper-fees.test.js tests/paper-fill.test.js tests/paper-max-hold.test.js tests/paper-order.test.js tests/paper-report.test.js tests/paper-replay.test.js tests/paper-state-machine.test.js tests/paper-trading-suite.test.js');
    assert.equal(packageJson.scripts['test:signals'], 'node --test tests/buy-signal.test.js tests/daily-rules.test.js tests/position-sizing.test.js tests/previous-band.test.js tests/sell-signal.test.js tests/signal-evaluator.test.js tests/signal-filters.test.js tests/signal-idempotency.test.js tests/signal-schema.test.js tests/tp-sl.test.js');
    assert.equal(packageJson.scripts['test:telegram'], 'node --test tests/telegram-client.test.js tests/telegram-formatter.test.js tests/telegram-journal-integration.test.js tests/telegram-signal-notifier.test.js tests/telegram-status-command.test.js');
    assert.equal(packageJson.scripts['telegram:test-message'], 'node scripts/send-telegram-test-message.js');
    assert.equal(packageJson.scripts.lint, 'node scripts/check-js-syntax.js');
    assert.equal(packageJson.scripts.typecheck, 'node scripts/typecheck-placeholder.js');
    assert.equal(packageJson.scripts.ci, 'npm run lint && npm run typecheck && npm test');
  });
});
