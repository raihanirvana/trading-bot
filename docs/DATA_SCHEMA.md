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
  "symbol": "ETHUSDT",
  "timeframe": "15m",
  "side": "SELL",
  "status": "PENDING",
  "entry_price": 3030.0,
  "tp_price": 3017.88,
  "sl_price": 3042.12,
  "margin_usd": 25.0,
  "leverage": 100,
  "notional_usd": 2500.0,
  "qty": 0.825,
  "created_at": "2026-05-04T12:01:00Z",
  "updated_at": "2026-05-04T12:01:00Z",
  "expires_at": "2026-05-04T12:16:00Z",
  "filled_at": null,
  "exit_at": null,
  "exit_reason": null,
  "pnl_gross": null,
  "pnl_net": null,
  "fees_usd": null
}
```

Allowed status: `PENDING`, `FILLED`, `TP`, `SL`, `TIME_EXIT`, `CANCELLED`, `EXPIRED`.

Valid transitions:

```text
PENDING -> FILLED | CANCELLED | EXPIRED
FILLED -> TP | SL | TIME_EXIT
TP/SL/TIME_EXIT/CANCELLED/EXPIRED -> terminal
```

Virtual order hanya untuk paper trading dan tidak boleh membuat live order.

Pending limit fill simulation:

```text
BUY  PENDING fills when candle.low <= entry_price
SELL PENDING fills when candle.high >= entry_price
```

Fill simulation hanya mengubah `PENDING -> FILLED`; TP/SL diproses oleh tahap simulasi berikutnya.
Jika `expires_at` sudah tercapai pada timestamp candle, pending order berubah menjadi `EXPIRED` dan tidak boleh fill.
Transition timestamp tidak boleh sebelum `created_at`; exit `TP/SL/TIME_EXIT` tidak boleh sebelum `filled_at`.

TP/SL simulation:

```text
BUY  FILLED exits TP when candle.high >= tp_price
BUY  FILLED exits SL when candle.low <= sl_price
SELL FILLED exits TP when candle.low <= tp_price
SELL FILLED exits SL when candle.high >= sl_price
```

Jika TP dan SL tersentuh dalam candle yang sama, simulasi paper memakai asumsi konservatif `SL`.

Fee calculation:

```text
entry_fee_usd = entry_price * qty * maker_fee_rate
exit_fee_usd = exit_price * qty * taker_fee_rate
fees_usd = entry_fee_usd + exit_fee_usd
pnl_net = pnl_gross - fees_usd
```

Default paper fee config: maker `0.0002`, taker `0.0006`. Funding belum dihitung pada tahap ini.

Max hold simulation:

```text
FILLED order exits TIME_EXIT after 8 candles held by default.
Only candles after filled_at are counted.
Exit price uses the 8th held candle close.
```

Max hold tidak menerapkan trailing stop.

## PaperPnlReport

```json
{
  "daily": [
    {
      "date": "2026-05-04",
      "trade_count": 2,
      "win_count": 1,
      "loss_count": 1,
      "breakeven_count": 0,
      "winrate_pct": 50.0,
      "profit_factor": 0.67,
      "gross_profit_usd": 8.0,
      "gross_loss_usd": 12.0,
      "pnl_gross_usd": 0.0,
      "pnl_net_usd": -4.0,
      "fees_usd": 4.0
    }
  ],
  "total": {
    "date": null,
    "trade_count": 2,
    "win_count": 1,
    "loss_count": 1,
    "breakeven_count": 0,
    "winrate_pct": 50.0,
    "profit_factor": 0.67,
    "gross_profit_usd": 8.0,
    "gross_loss_usd": 12.0,
    "pnl_gross_usd": 0.0,
    "pnl_net_usd": -4.0,
    "fees_usd": 4.0
  }
}
```

Paper PnL report hanya menghitung virtual order terminal yang punya `exit_at` dan `pnl_net` finite.
Daily bucket memakai tanggal UTC dari `exit_at`.
`profit_factor` memakai `gross_profit_usd / gross_loss_usd`; nilainya `null` jika tidak ada loss.

## PaperHistoricalReplay

Historical replay memproses candle secara deterministic:

```text
1. Candles disort ascending berdasarkan timestamp.
2. Order aktif diproses lebih dulu: pending fill, TP/SL, lalu max hold.
3. Jika tidak ada order aktif, candle dievaluasi untuk signal baru.
4. Signal yang tersentuh bisa membuat PENDING order dan fill pada candle yang sama.
5. TP/SL untuk order baru dievaluasi mulai candle berikutnya.
```

Output replay:

```json
{
  "signals": [],
  "orders": [],
  "events": [
    {
      "event_id": "paper-001-PAPER_FILL-20260504T123000Z",
      "order_id": "paper-001",
      "signal_id": "ETHUSDT-15m-20260504T123000Z-BUY",
      "type": "PAPER_FILL",
      "timestamp": "2026-05-04T12:30:00.000Z",
      "order_status": "FILLED",
      "pnl_net": null,
      "signal_side": null
    }
  ]
}
```

Replay historical hanya memakai simulasi paper dan tidak boleh membuat live order.

## PaperDailySummary

Paper daily summary adalah ringkasan satu hari UTC dari virtual order terminal.

```json
{
  "date": "2026-05-04",
  "trade_count": 3,
  "win_count": 2,
  "loss_count": 1,
  "breakeven_count": 0,
  "winrate_pct": 66.67,
  "profit_factor": 1.5,
  "gross_profit_usd": 18.0,
  "gross_loss_usd": 12.0,
  "pnl_gross_usd": 12.0,
  "pnl_net_usd": 6.0,
  "fees_usd": 6.0,
  "daily_target_usd": 6.0,
  "daily_loss_stop_usd": -18.0,
  "min_trades_for_target": 3,
  "daily_target_hit": true,
  "daily_loss_hit": false,
  "allowed_next_entry": false
}
```

`daily_target_hit` mengikuti rule: `trade_count >= min_trades_for_target` dan `pnl_net_usd >= daily_target_usd`.
`daily_loss_hit` true jika `pnl_net_usd <= daily_loss_stop_usd`.
Jika salah satu true, `allowed_next_entry` menjadi false untuk paper daily summary.
