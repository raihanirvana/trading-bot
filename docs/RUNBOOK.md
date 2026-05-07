# Runbook

## Start Modes

Provider default:

```env
AI_PROVIDER=openrouter
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_MODEL=openai/gpt-4o-mini
EXCHANGE_NAME=mexc
```

### Dry Run

```env
DRY_RUN=true
LIVE_TRADING_ENABLED=false
AUTO_TRADE_ENABLED=false
```

### Signal Only

```env
DRY_RUN=true
SIGNAL_ONLY=true
```

### Paper Trading

```env
DRY_RUN=true
PAPER_TRADING=true
```

### Testnet Semi-Auto

```env
DRY_RUN=false
USE_TESTNET=true
SEMI_AUTO_ENABLED=true
LIVE_TRADING_ENABLED=false
```

### Live Auto A+ Only

Hanya setelah semua checklist lolos.

```env
DRY_RUN=false
USE_TESTNET=false
AUTO_TRADE_ENABLED=true
AUTO_A_PLUS_ONLY=true
```

## Emergency

Jika ada error:

```text
1. Kirim /kill
2. Cek posisi exchange manual
3. Pastikan SL ada
4. Jika SL tidak ada, close manual atau pasang SL manual
5. Simpan log
6. Catat BUG_LOG
7. Jangan restart sebelum root cause jelas
```

## Commands

```text
/status
/pause
/resume
/kill
/positions
/today
/config
```

`/status` menampilkan mode runtime, ringkasan hari ini, missed PnL, dan posisi/paper position jika provider tersedia.

## Telegram Test Message

Isi env berikut hanya saat ingin test manual:

```env
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
```

Kirim pesan test:

```sh
npm run telegram:test-message
```
