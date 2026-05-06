# AI Policy

## Role AI

AI adalah risk classifier dan post-trade analyst.

AI bukan trader utama.

Provider AI yang digunakan adalah OpenRouter.

```env
AI_PROVIDER=openrouter
OPENROUTER_API_KEY=
```

## Allowed Pre-Trade Actions

```text
ALLOW
REDUCE_SIZE
BLOCK
```

## Forbidden

AI tidak boleh:

```text
- Menentukan arah BUY/SELL
- Menentukan entry price
- Mengubah TP
- Mengubah SL
- Mengubah leverage
- Mengubah margin
- Menyarankan martingale
- Menambah size setelah loss
- Override hard rules
```

## Required AI Output

Output wajib JSON valid:

```json
{
  "market_type": "MEAN_REVERSION",
  "risk_level": "LOW",
  "action": "ALLOW",
  "size_multiplier": 1.0,
  "reason": "short reason"
}
```

Allowed values:

```text
market_type: MEAN_REVERSION | TRENDING_RISK | NOISE
risk_level: LOW | MEDIUM | HIGH
action: ALLOW | REDUCE_SIZE | BLOCK
size_multiplier: 1.0 | 0.5 | 0.0
```

## Fallback

Jika output invalid:

```text
fallback ke rule-based decision
```

Jika AI timeout:

```text
fallback ke rule-based decision atau skip, tergantung config
```

## Context

OpenRouter/API call dianggap stateless. Semua konteks penting harus dikirim setiap request.

History disimpan di database, bukan di memory AI.
