# Batch Plan

## Ringkasan Batch

```text
B0 — Foundation
B1 — Market Data + Indicator Engine
B2 — Signal Engine Rule-Based
B3 — Telegram Signal + Journal
B4 — AI Risk Classifier
B5 — Paper Trading
B6 — Semi-Auto Telegram Approval
B7 — Auto A+ Only
```

## B0 — Foundation

Goal: pondasi project aman.

Tickets:

```text
B0-T01 Setup repository structure
B0-T02 Environment config
B0-T03 Logger
B0-T04 Database connection
B0-T05 Global safety flags
B0-T06 Health check
B0-T07 CI test commands
B0-T08 Error handling base
```

Exit criteria:

```text
[ ] App start tanpa error
[ ] Config terbaca
[ ] DRY_RUN default true
[ ] Logger aktif
[ ] DB connect
[ ] Test command jalan
```

## B1 — Market Data + Indicator Engine

Goal: fetch candle dan hitung indikator.

Tickets:

```text
B1-T01 Fetch OHLCV
B1-T02 Normalize candle format
B1-T03 Calculate Bollinger Band
B1-T04 Calculate BB Width
B1-T05 Calculate ADX
B1-T06 Calculate EMA200
B1-T07 Calculate ATR
B1-T08 Calculate Relative Volume
B1-T09 Indicator comparison utility
B1-T10 Indicator unit test suite
```

Exit criteria:

```text
[ ] Bisa fetch candle 15m dan 5m
[ ] Candle format standar
[ ] Indicator valid
[ ] Unit test indikator pass
```

## B2 — Signal Engine Rule-Based

Goal: sinyal BUY/SELL mekanis.

Tickets:

```text
B2-T01 Previous band level
B2-T02 BUY signal lower previous band
B2-T03 SELL signal upper previous band
B2-T04 BB Width minimum filter
B2-T05 Anti-band-walk filter
B2-T06 Daily rules
B2-T07 TP/SL calculator
B2-T08 Position sizing calculator
B2-T09 Signal object schema
B2-T10 Signal idempotency key
B2-T11 Signal unit test suite
```

Exit criteria:

```text
[ ] Sinyal berdasarkan previous band
[ ] Filter berjalan
[ ] TP/SL benar
[ ] No duplicate signal
[ ] Unit tests pass
```

## B3 — Telegram Signal + Journal

Goal: signal-only dengan pencatatan.

Tickets:

```text
B3-T01 Telegram bot setup
B3-T02 Signal message formatter
B3-T03 Journal schema
B3-T04 Save signal to journal
B3-T05 Virtual outcome tracker
B3-T06 Missed trade tracker
B3-T07 Daily summary
B3-T08 Telegram command status
B3-T09 Journal export CSV
B3-T10 Telegram/journal tests
```

Exit criteria:

```text
[ ] Signal masuk Telegram
[ ] Semua signal tersimpan
[ ] Virtual TP/SL outcome terlacak
[ ] Missed trade report ada
```

## B4 — AI Risk Classifier

Goal: AI hanya risk label.

Tickets:

```text
B4-T01 AI input JSON builder
B4-T02 Fixed system prompt
B4-T03 OpenRouter client
B4-T04 AI JSON output parser
B4-T05 Hard-rule override
B4-T06 AI decision journal
B4-T07 AI fallback behavior
B4-T08 Post-SL reasoning
B4-T09 AI confidence calibration log
B4-T10 AI unit/integration tests
```

Exit criteria:

```text
[ ] Output AI JSON valid
[ ] Invalid output fallback
[ ] Hard rules selalu menang
[ ] AI tidak bisa override entry/TP/SL
```

## B5 — Paper Trading

Goal: simulasi order lengkap tanpa uang.

Tickets:

```text
B5-T01 Virtual order model
B5-T02 Pending limit fill simulation
B5-T03 TP/SL simulation
B5-T04 Fee calculation
B5-T05 Max hold simulation
B5-T06 Order state machine
B5-T07 Paper PnL report
B5-T08 Replay historical candles
B5-T09 Paper daily summary
B5-T10 Paper trading tests
```

Exit criteria:

```text
[ ] Virtual order states benar
[ ] Fee dan PnL benar
[ ] Replay test berjalan
[ ] Tidak ada live order
```

## B6 — Semi-Auto Telegram Approval

Goal: user klik approve sebelum order testnet/live.

Tickets:

```text
B6-T01 Telegram inline buttons
B6-T02 Approve 100 percent
B6-T03 Approve 50 percent
B6-T04 Skip action
B6-T05 Exchange client testnet
B6-T06 Set leverage and margin mode
B6-T07 Place entry order
B6-T08 Place TP/SL after fill
B6-T09 Cancel expired order
B6-T10 Order idempotency
B6-T11 Emergency SL failure handling
B6-T12 Semi-auto safety tests
```

Exit criteria:

```text
[ ] Tidak ada order tanpa klik user
[ ] ENTRY 50% benar
[ ] TP/SL dibuat setelah fill
[ ] Idempotency mencegah double order
[ ] Testnet pass
```

## B7 — Auto A+ Only

Goal: auto terbatas untuk setup terbaik.

Tickets:

```text
B7-T01 Setup quality scoring
B7-T02 Auto-open A+ only
B7-T03 B setup approval only
B7-T04 C setup auto skip
B7-T05 Kill switch
B7-T06 Consecutive loss stop
B7-T07 Max daily loss hard stop
B7-T08 Heartbeat monitoring
B7-T09 Error alerting
B7-T10 Auto trading safety tests
```

Exit criteria:

```text
[ ] Auto hanya A+
[ ] B approval
[ ] C skip
[ ] Kill switch bekerja
[ ] Daily loss stop bekerja
[ ] Consecutive loss stop bekerja
```
