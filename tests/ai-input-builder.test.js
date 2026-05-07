const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const { buildAiRiskInput, sanitizeForAi } = require('../src/ai');
const { ValidationError } = require('../src/errors');
const { buildSignal } = require('../src/signals/schema');

function buildSampleSignal(overrides = {}) {
  return buildSignal({
    symbol: 'ETHUSDT',
    timeframe: '15m',
    timestamp: '2026-05-04T12:00:00.000Z',
    side: 'SELL',
    entryPrice: 3030,
    marginUsd: 25,
    leverage: 100,
    bbWidthPct: 1.2,
    adx15m: 24,
    reasons: ['Touched upper previous band'],
    ...overrides
  });
}

describe('AI risk input builder', () => {
  it('builds complete payload from signal, indicators, and state', () => {
    const payload = buildAiRiskInput({
      signal: buildSampleSignal(),
      indicators: {
        bb_width_pct: 1.2,
        adx_15m: 24,
        ema200: 2980,
        atr_pct: 0.4,
        relative_volume: 1.3,
        setup_against_ema200: true
      },
      state: {
        has_active_position: false,
        daily_pnl_usd: 12,
        daily_target_hit: false,
        daily_loss_hit: false,
        consecutive_losses: 1,
        open_positions_count: 0,
        recent_outcomes: [
          {
            signal_id: 'old-signal',
            outcome: 'TP'
          }
        ]
      }
    });

    assert.deepEqual(payload, {
      schema_version: 'ai-risk-input-v1',
      task: 'RISK_CLASSIFICATION',
      signal: {
        signal_id: 'ETHUSDT-15m-20260504T120000Z-SELL',
        symbol: 'ETHUSDT',
        timeframe: '15m',
        timestamp: '2026-05-04T12:00:00.000Z',
        side: 'SELL',
        entry_price: 3030,
        tp_price: 3017.88,
        sl_price: 3042.12,
        margin_usd: 25,
        leverage: 100,
        notional_usd: 2500,
        qty: 2500 / 3030,
        reasons: ['Touched upper previous band']
      },
      indicators: {
        bb_width_pct: 1.2,
        adx_15m: 24,
        ema200: 2980,
        atr_pct: 0.4,
        relative_volume: 1.3,
        setup_against_ema200: true
      },
      state: {
        has_active_position: false,
        daily_pnl_usd: 12,
        daily_target_hit: false,
        daily_loss_hit: false,
        consecutive_losses: 1,
        open_positions_count: 0,
        recent_outcomes: [
          {
            signal_id: 'old-signal',
            outcome: 'TP'
          }
        ]
      },
      hard_rules: {
        bb_width_minimum_block: false,
        anti_band_walk_block: false,
        daily_target_block: false,
        daily_loss_block: false,
        active_position_block: false,
        setup_against_ema200_risk_floor: true,
        adx_15m_risk_floor: false,
        immutable_trade_terms: {
          side: 'SELL',
          entry_price: 3030,
          tp_price: 3017.88,
          sl_price: 3042.12,
          margin_usd: 25,
          leverage: 100
        }
      },
      output_contract: {
        market_type: ['MEAN_REVERSION', 'TRENDING_RISK', 'NOISE'],
        risk_level: ['LOW', 'MEDIUM', 'HIGH'],
        action: ['ALLOW', 'REDUCE_SIZE', 'BLOCK'],
        size_multiplier: [1, 0.5, 0],
        reason: 'short explanation'
      }
    });
  });

  it('sets hard-rule flags for blocked contexts', () => {
    const payload = buildAiRiskInput({
      signal: buildSampleSignal(),
      indicators: {
        bb_width_pct: 2.6,
        adx_15m: 36
      },
      state: {
        daily_target_hit: true,
        daily_loss_hit: true,
        has_active_position: true
      }
    });

    assert.equal(payload.hard_rules.anti_band_walk_block, true);
    assert.equal(payload.hard_rules.daily_target_block, true);
    assert.equal(payload.hard_rules.daily_loss_block, true);
    assert.equal(payload.hard_rules.active_position_block, true);
    assert.equal(payload.hard_rules.adx_15m_risk_floor, true);
  });

  it('marks BB width minimum block separately', () => {
    const payload = buildAiRiskInput({
      signal: buildSampleSignal(),
      indicators: {
        bb_width_pct: 0.59,
        adx_15m: 10
      }
    });

    assert.equal(payload.hard_rules.bb_width_minimum_block, true);
  });

  it('does not leak secrets from indicators or state', () => {
    const payload = buildAiRiskInput({
      signal: buildSampleSignal(),
      indicators: {
        bb_width_pct: 1.2,
        openRouterApiKey: 'secret-key',
        nested: {
          token: 'secret-token'
        }
      },
      state: {
        telegramBotToken: 'telegram-secret',
        recent_outcomes: [
          {
            signal_id: 'old-signal',
            api_secret: 'mexc-secret'
          }
        ]
      }
    });
    const serialized = JSON.stringify(payload);

    assert.equal(serialized.includes('secret-key'), false);
    assert.equal(serialized.includes('secret-token'), false);
    assert.equal(serialized.includes('telegram-secret'), false);
    assert.equal(serialized.includes('mexc-secret'), false);
  });

  it('sanitizes arbitrary nested secret fields', () => {
    assert.deepEqual(sanitizeForAi({
      keep: 'ok',
      apiKey: 'remove',
      nested: {
        private_key: 'remove',
        keep: 'still-ok'
      }
    }), {
      keep: 'ok',
      nested: {
        keep: 'still-ok'
      }
    });
  });

  it('rejects invalid signal input', () => {
    assert.throws(
      () => buildAiRiskInput({
        signal: {
          symbol: 'ETHUSDT'
        }
      }),
      (error) => error instanceof ValidationError
    );
  });
});
