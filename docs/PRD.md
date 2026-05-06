# PRD — BB Mean-Reversion Trading Robot

## 1. Objective

Membangun robot trading semi-auto/auto bertahap untuk strategi BB Mean-Reversion 15m dengan fokus:

- Eksekusi konsisten.
- Minim bug.
- Bisa diaudit.
- Bisa dikembangkan dengan vibe coding tanpa scope melebar.
- Default aman: signal-only/dry-run.

## 2. Problem

Trader sering ragu saat harga menyentuh upper/lower Bollinger Band karena takut harga lanjut trending. Akibatnya sinyal valid sering tidak diambil dan profit terlewat.

Robot ini membantu:

- Mendeteksi sinyal secara mekanis.
- Memberi risk label.
- Mengirim sinyal ke Telegram.
- Mencatat hasil trade dan missed trade.
- Melakukan paper trading.
- Lalu bertahap ke semi-auto dan auto terbatas.

## 3. Strategy

```text
Timeframe utama: 15m
BB: length 20, deviation 3.5
Entry level: previous band, bukan current band
BUY: low current <= lower_band_previous
SELL: high current >= upper_band_previous
Filter valid: bb_width_previous >= 0.6
Anti-trend filter: block jika bb_width_previous > 2.5 dan adx_15m > 35
TP: 0.40%
SL: 0.40%
Max hold: 8 candle 15m
```

## 4. Markets

MVP:

```text
ETHUSDT
SOLUSDT
XRPUSDT
```

Exchange:

```text
MEXC
```

## 5. Modes

```text
DRY_RUN
SIGNAL_ONLY
PAPER_TRADING
TESTNET_SEMI_AUTO
LIVE_SEMI_AUTO
AUTO_A_PLUS_ONLY
```

Default mode wajib `DRY_RUN`.

## 6. AI Scope

AI hanya boleh:

```text
ALLOW
REDUCE_SIZE
BLOCK
```

AI tidak boleh:

```text
- Menentukan arah trade
- Menentukan entry
- Mengubah TP
- Mengubah SL
- Mengubah leverage
- Menyarankan martingale
- Menambah size setelah loss
```

## 7. Core Features

### MVP 1 — Signal Only

- Fetch candle.
- Hitung indikator.
- Deteksi sinyal.
- Kirim Telegram.
- Simpan journal.
- Track virtual outcome.

### MVP 2 — AI Risk Filter

- Kirim summary JSON ke OpenRouter.
- Parse output JSON.
- Simpan AI label.
- Hard-rule override.

### MVP 3 — Paper Trading

- Virtual order.
- Virtual fill.
- Virtual TP/SL.
- Fee simulation.
- Daily summary.

### MVP 4 — Semi-Auto

- Telegram button.
- User approve.
- MEXC testnet/exchange client.
- TP/SL setelah fill.
- Kill switch.

### MVP 5 — Auto A+ Only

- Auto hanya setup A+.
- B setup minta approve.
- C setup skip.
- Daily loss dan consecutive loss stop.

## 8. Non-Goals

Tidak dikerjakan di awal:

```text
- Full auto semua setup
- Martingale
- Grid trading
- Averaging loss
- AI bebas mengubah strategi
- Multi-position kompleks
- Cross-exchange arbitrage
```

## 9. Success Metrics

Signal-only:

```text
- Sinyal tidak dobel
- Semua sinyal tercatat
- Virtual outcome tercatat
```

Paper trading:

```text
- PnL calculation benar
- TP/SL simulation benar
- Max hold benar
```

Semi-auto:

```text
- Tidak ada order tanpa approval
- Tidak ada double order
- TP/SL selalu dipasang setelah fill
```

Auto:

```text
- Auto hanya A+
- Kill switch bekerja
- Daily loss stop bekerja
```
