# Data Schema

## Candle

```json
{
  "symbol": "ETHUSDT",
  "timeframe": "15m",
  "timestamp": "2026-05-04T12:00:00Z",
  "open": 3000.0,
  "high": 3010.0,
  "low": 2990.0,
  "close": 3005.0,
  "volume": 12345.0
}
```

## IndicatorSnapshot

```json
{
  "symbol": "ETHUSDT",
  "timeframe": "15m",
  "timestamp": "2026-05-04T12:00:00Z",
  "bb_basis": 3000.0,
  "bb_upper": 3030.0,
  "bb_lower": 2970.0,
  "bb_width_pct": 2.0,
  "adx_14": 25.0,
  "ema200": 2980.0,
  "atr_14": 12.0,
  "atr_pct": 0.4,
  "relative_volume": 1.2
}
```

## Signal

```json
{
  "signal_id": "ETHUSDT-15m-20260504T120000Z-SELL",
  "symbol": "ETHUSDT",
  "side": "SELL",
  "entry_price": 3030.0,
  "tp_price": 3017.88,
  "sl_price": 3042.12,
  "margin_usd": 25.0,
  "leverage": 100,
  "notional_usd": 2500.0,
  "bb_width_pct": 1.2,
  "adx_15m": 24.0,
  "status": "NEW",
  "reasons": ["Touched upper previous band"]
}
```

## Journal Tables

### signals

```text
signal_id TEXT PRIMARY KEY
symbol TEXT
timeframe TEXT
side TEXT
entry_price REAL
tp_price REAL
sl_price REAL
margin_usd REAL
leverage INTEGER
notional_usd REAL
qty REAL
bb_width_pct REAL
adx_15m REAL
status TEXT
reasons_json TEXT
created_at TEXT
updated_at TEXT
```

`reasons_json` menyimpan array `Signal.reasons` sebagai JSON string.
Duplicate signal diabaikan berdasarkan primary key `signal_id`.

### events

```text
event_id TEXT PRIMARY KEY
signal_id TEXT REFERENCES signals(signal_id)
event_type TEXT
payload_json TEXT
created_at TEXT
```

Virtual outcome dicatat sebagai event `VIRTUAL_TP` atau `VIRTUAL_SL`.
Jika TP dan SL sama-sama tersentuh dalam candle yang sama, replay memakai asumsi konservatif `VIRTUAL_SL`.
Skipped signal dicatat sebagai event `MISSED_TRADE` dengan `missed_profit_usd`, `avoided_loss_usd`, dan `missed_pnl_usd`.

## DailySummary

```json
{
  "date": "2026-05-04",
  "total_signals": 2,
  "virtual_tp": 1,
  "virtual_sl": 1,
  "missed_trades": 2,
  "missed_profit_usd": 10.0,
  "avoided_loss_usd": 10.0,
  "missed_pnl_usd": 0.0
}
```

## Journal CSV Export

Export menghasilkan dua CSV:

```text
signalsCsv
eventsCsv
```

Header mengikuti kolom `signals` dan `events`. Nilai comma, quote, dan newline di-escape sesuai CSV standar.

## AIDecision

```json
{
  "signal_id": "ETHUSDT-15m-20260504T120000Z-SELL",
  "market_type": "MEAN_REVERSION",
  "risk_level": "MEDIUM",
  "action": "REDUCE_SIZE",
  "size_multiplier": 0.5,
  "reason": "Short is against EMA200 trend."
}
```

AI decision audit trail disimpan sebagai event `AI_DECISION` dengan payload:

```json
{
  "signal_id": "ETHUSDT-15m-20260504T120000Z-SELL",
  "ai_input": {},
  "raw_response": {},
  "parsed_decision": {},
  "final_decision": {}
}
```

## PostSLAnalysis

Post-SL reasoning memakai payload `ai-post-sl-input-v1` dan hanya berjalan setelah event `VIRTUAL_SL`.

AI post-SL label disimpan sebagai event `POST_SL_ANALYSIS` dengan payload:

```json
{
  "signal_id": "ETHUSDT-15m-20260504T120000Z-BUY",
  "post_sl_payload": {},
  "raw_response": {},
  "loss_label": {
    "loss_type": "BAD_ENTRY",
    "confidence": "MEDIUM",
    "reason": "Entry was too close to SL.",
    "fallback": false
  }
}
```

Allowed `loss_type`: `TREND_CONTINUATION`, `VOLATILITY_SPIKE`, `BAD_ENTRY`, `NOISE`, `UNKNOWN`.

## AIConfidenceCalibration

AI confidence calibration disimpan sebagai event `AI_CONFIDENCE_CALIBRATION`. Data ini hanya untuk audit akurasi confidence, bukan untuk model training otomatis.

```json
{
  "signal_id": "ETHUSDT-15m-20260504T120000Z-BUY",
  "source_event_type": "POST_SL_ANALYSIS",
  "source_event_id": "ETHUSDT-15m-20260504T120000Z-BUY-POST_SL_ANALYSIS-20260504T121600Z",
  "confidence": "MEDIUM",
  "confidence_score": 0.66,
  "predicted_label": "BAD_ENTRY",
  "actual_label": "BAD_ENTRY",
  "correct": true,
  "outcome": {
    "status": "SL",
    "exit_reason": "VIRTUAL_SL"
  },
  "observed_at": "2026-05-04T12:30:00.000Z",
  "metadata": {}
}
```

Jika belum ada label aktual/manual review, `actual_label` dan `correct` boleh `null` sementara outcome tetap tersimpan.

## AIRiskInput

```json
{
  "schema_version": "ai-risk-input-v1",
  "task": "RISK_CLASSIFICATION",
  "signal": {
    "signal_id": "ETHUSDT-15m-20260504T120000Z-SELL",
    "symbol": "ETHUSDT",
    "side": "SELL",
    "entry_price": 3030.0,
    "tp_price": 3017.88,
    "sl_price": 3042.12,
    "margin_usd": 25.0,
    "leverage": 100
  },
  "indicators": {
    "bb_width_pct": 1.2,
    "adx_15m": 24.0,
    "ema200": 2980.0,
    "atr_pct": 0.4,
    "relative_volume": 1.2,
    "setup_against_ema200": true
  },
  "state": {
    "daily_pnl_usd": 12.0,
    "daily_target_hit": false,
    "daily_loss_hit": false,
    "has_active_position": false
  },
  "hard_rules": {
    "bb_width_minimum_block": false,
    "anti_band_walk_block": false,
    "daily_target_block": false,
    "daily_loss_block": false
  }
}
```

Payload AI tidak boleh membawa secret seperti token, API key, atau private key.

## VirtualOrder

```json
{
  "order_id": "paper-001",
  "signal_id": "ETHUSDT-15m-20260504T120000Z-SELL",
  "status": "FILLED",
  "entry_price": 3030.0,
  "tp_price": 3017.88,
  "sl_price": 3042.12,
  "filled_at": "2026-05-04T12:03:00Z",
  "exit_at": null,
  "exit_reason": null,
  "pnl_gross": null,
  "pnl_net": null
}
```
