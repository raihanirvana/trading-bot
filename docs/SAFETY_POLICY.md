# Safety Policy

## Default Safety

```env
DRY_RUN=true
LIVE_TRADING_ENABLED=false
AUTO_TRADE_ENABLED=false
```

## Hard Stops

Bot harus stop entry jika:

```text
- Daily target hit setelah minimal trade
- Daily loss stop hit
- Consecutive loss stop hit
- Kill switch aktif
- Exchange API error kritis
- Gagal pasang SL
- Posisi aktif sudah ada
```

## Order Safety

```text
- Max one active position in MVP
- Idempotency key wajib
- TP/SL wajib setelah fill
- Jika SL gagal dibuat, emergency alert
- Tidak boleh order saat DRY_RUN=true
```

## Telegram Safety Commands

```text
/kill
/pause
/resume
/status
/positions
/today
```

## No Martingale

Bot tidak boleh meningkatkan size karena loss sebelumnya.

## Live Trading Gate

Live trading hanya boleh aktif setelah:

```text
- Unit tests pass
- Replay tests pass
- Paper trading stabil
- Testnet pass
- Kill switch pass
- Failed SL handling pass
```
