# Decisions

## D001 — AI is not allowed to decide entry level

Entry selalu rule-based:

```text
BUY = lower previous band
SELL = upper previous band
```

## D002 — AI can only classify risk

Allowed output:

```text
ALLOW
REDUCE_SIZE
BLOCK
```

## D003 — TP/SL fixed by strategy

Default:

```text
TP = 0.40%
SL = 0.40%
Max hold = 8 candle 15m
```

## D004 — Hard rules override AI

Hard rule BLOCK selalu menang.

## D005 — Default mode is dry-run

```env
DRY_RUN=true
LIVE_TRADING_ENABLED=false
AUTO_TRADE_ENABLED=false
```

## D006 — No full auto before paper trading and testnet

Auto tidak boleh aktif sebelum paper trading + testnet + safety tests lolos.

## D007 — Unit test mandatory

```text
No unit test = not done.
```

## D008 — Context in database, not AI memory

OpenRouter stateless. Context dikirim setiap call dari database.

## D009 — No martingale

Tidak boleh increase size setelah loss.

## D010 — MVP max one active position

MVP hanya satu posisi aktif untuk mengurangi kompleksitas.

## D011 — AI provider is OpenRouter

AI integration wajib menggunakan OpenRouter.

```env
AI_PROVIDER=openrouter
OPENROUTER_API_KEY=
```

## D012 — Exchange provider is MEXC

Exchange target untuk market data, testnet, dan order execution adalah MEXC.

```env
EXCHANGE_NAME=mexc
MEXC_BASE_URL=https://api.mexc.fm
MEXC_API_KEY=
MEXC_API_SECRET=
```

Tidak menggunakan Binance kecuali ada keputusan baru yang eksplisit di dokumen ini.
