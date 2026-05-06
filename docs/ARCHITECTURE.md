# Architecture

## High-Level Flow

```text
Scheduler
  -> Market Data Client
  -> Indicator Engine
  -> Signal Engine
  -> Risk Filter
  -> AI Risk Classifier optional
  -> Journal
  -> Telegram
  -> Paper Trading / Semi-Auto / Auto
```

## Modules

```text
src/config
src/logger
src/db
src/market_data
src/indicators
src/signals
src/risk
src/ai
src/telegram
src/journal
src/paper
src/exchange
src/safety
```

## Important Boundaries

### Indicator Engine

Input:

```text
normalized candles
```

Output:

```text
indicator values
```

Tidak boleh:

```text
- Kirim Telegram
- Panggil AI
- Order
```

### Signal Engine

Input:

```text
candles + indicators + state
```

Output:

```text
Signal object or no signal
```

Tidak boleh:

```text
- Order live
- Panggil AI langsung
```

### AI Risk Classifier

Provider:

```text
OpenRouter
```

Input:

```text
summary JSON
```

Output:

```text
ALLOW / REDUCE_SIZE / BLOCK
```

Tidak boleh:

```text
- Mengubah entry
- Mengubah TP/SL
- Mengubah side
```

### Exchange Client

Provider:

```text
MEXC
```

Semua order harus melewati safety guard.

## Safety Guard Position

```text
Signal/AI decision
  -> Safety Guard
  -> Exchange Client
```

Safety guard harus cek:

```text
DRY_RUN
LIVE_TRADING_ENABLED
Max position
Daily loss
Consecutive loss
Idempotency
```
