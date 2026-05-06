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
