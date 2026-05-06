# Testing Policy

## Rule Utama

```text
No unit test = not done.
```

Semua ticket yang mengubah logic wajib punya unit test.

## Commands

```sh
npm test
npm run test:indicators
npm run ci
```

`npm run test:indicators` wajib hijau sebelum keluar dari B1.

## Wajib Unit Test Untuk

```text
- Config loader
- Safety flags
- Candle normalization
- Bollinger Band
- BB Width
- ADX
- EMA200
- ATR
- Relative volume
- Signal engine
- Risk filter
- Daily rules
- TP/SL calculation
- Position sizing
- Idempotency key
- AI output parser
- Hard-rule override
- Fee calculation
- Order state machine
- Paper PnL
```

## Minimum Test Cases

### BB Width

```text
upper=101, lower=99, basis=100 => width=2.0
basis=0 => no crash
```

### BUY Signal

```text
lower_prev=100, low_current=99.9 => BUY true
lower_prev=100, low_current=100.1 => BUY false
bb_width < 0.6 => BUY false
active_position=true => BUY false
```

### SELL Signal

```text
upper_prev=100, high_current=100.1 => SELL true
upper_prev=100, high_current=99.9 => SELL false
bb_width < 0.6 => SELL false
active_position=true => SELL false
```

### Anti-Band-Walk

```text
bb_width=2.6, adx=36 => BLOCK
bb_width=2.6, adx=34 => not blocked by this rule
bb_width=2.4, adx=36 => not blocked by this rule
```

### TP/SL

```text
long entry 100 TP 0.4 => 100.4
long entry 100 SL 0.4 => 99.6
short entry 100 TP 0.4 => 99.6
short entry 100 SL 0.4 => 100.4
```

### Position Size

```text
margin=25, leverage=100 => notional=2500
notional=2500, price=2500 => qty=1
```

### AI Parser

```text
valid ALLOW => parsed
invalid JSON => fallback
invalid action => fallback
AI tries tp override => ignored
hard rule BLOCK + AI ALLOW => final BLOCK
```

### Order State

```text
PENDING -> FILLED
FILLED -> TP
FILLED -> SL
FILLED -> TIME_EXIT
PENDING -> EXPIRED
```

## Integration Tests

Wajib untuk:

```text
- Telegram sender
- OpenRouter client
- MEXC market data
- MEXC testnet order
- Database persistence
```

## Replay Test

Sebelum semi-auto, wajib replay candle historis untuk memastikan:

```text
- Tidak ada duplicate signal
- Outcome virtual benar
- Daily reset benar
- Max hold benar
```

## Pre-Live Required Tests

```text
[ ] Unit tests pass
[ ] Replay tests pass
[ ] Telegram integration pass
[ ] OpenRouter fallback pass
[ ] MEXC testnet pass
[ ] Kill switch pass
[ ] Failed SL scenario pass
[ ] Idempotency pass
```
