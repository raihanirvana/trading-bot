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
