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

Parser hanya menerima field kontrak output AI. Field tambahan seperti side, entry, TP, SL, leverage, atau margin diabaikan.

Final decision merge wajib menerapkan hard-rule override. Jika hard rule block aktif, final action menjadi `BLOCK` dan size multiplier menjadi `0` walaupun AI mengembalikan `ALLOW`.

Risk-floor hard rules juga wajib diterapkan deterministic. Jika `setup_against_ema200=true` atau `adx_15m >= 30`, final `risk_level` minimal `MEDIUM` walaupun AI mengembalikan `LOW`.

Jika AI timeout:

```text
fallback ke rule-based decision atau skip, tergantung config
```

Config fallback:

```env
AI_FALLBACK_MODE=rule_based
```

Allowed values:

```text
rule_based: gunakan keputusan deterministik dari hard rules dan indikator risiko
skip: paksa BLOCK agar signal dilewati
```

## Context

OpenRouter/API call dianggap stateless. Semua konteks penting harus dikirim setiap request.

History disimpan di database, bukan di memory AI.

## Post-SL Reasoning

Setelah virtual outcome `VIRTUAL_SL`, AI boleh memberi label penyebab loss untuk audit dan pembelajaran manual.

Output wajib JSON valid:

```json
{
  "loss_type": "TREND_CONTINUATION",
  "confidence": "HIGH",
  "reason": "ADX expanded after entry."
}
```

Allowed values:

```text
loss_type: TREND_CONTINUATION | VOLATILITY_SPIKE | BAD_ENTRY | NOISE | UNKNOWN
confidence: LOW | MEDIUM | HIGH
```

Post-SL label tidak boleh mengubah strategi otomatis, entry, TP, SL, leverage, atau margin.

## Confidence Calibration

Confidence AI boleh dicatat bersama outcome sebagai event audit `AI_CONFIDENCE_CALIBRATION`.

Calibration log hanya menyimpan data evaluasi seperti `confidence`, `predicted_label`, `actual_label`, `correct`, dan `outcome`.

Calibration log tidak boleh melakukan model training otomatis atau mengubah strategi trading.
