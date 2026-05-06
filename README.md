# Trading Robot Full Development Process Pack

Paket ini adalah blueprint lengkap untuk mengembangkan robot trading BB Mean-Reversion secara bertahap, rapi, dan minim bug.

Target strategi:

```text
Market: ETHUSDT, SOLUSDT, XRPUSDT
Exchange: MEXC
AI provider: OpenRouter
Timeframe utama: 15m
Timeframe pendukung: 5m
Indikator utama: Bollinger Band 20 deviasi 3.5
Entry level: upper/lower Bollinger Band candle sebelumnya
BUY: low candle sekarang menyentuh lower previous band
SELL: high candle sekarang menyentuh upper previous band
TP: 0.40%
SL: 0.40%
Max hold: 8 candle 15m
Daily target: +$6 setelah minimal 3 trade
Daily loss stop: default -$18
```

## Cara Pakai

1. Baca `docs/DEVELOPMENT_PROCESS.md`.
2. Baca `docs/BATCH_PLAN.md`.
3. Kerjakan ticket berurutan mulai dari `tickets/B0/B0-T01_setup_repository_structure.md`.
4. Untuk setiap ticket:
   - Ikuti scope.
   - Jangan kerjakan out of scope.
   - Wajib tambah/update unit test.
   - Jalankan test.
   - Update log/dokumen jika perlu.
5. Jangan lanjut batch berikutnya sebelum batch checkpoint lolos.

## Struktur Paket

```text
docs/
  PRD.md
  BATCH_PLAN.md
  DEVELOPMENT_PROCESS.md
  TESTING_POLICY.md
  DECISIONS.md
  BUG_LOG.md
  RUNBOOK.md
  ARCHITECTURE.md
  AI_POLICY.md
  SAFETY_POLICY.md
  DATA_SCHEMA.md
  GLOSSARY.md

tickets/
  TICKET_TEMPLATE.md
  B0/... semua ticket foundation
  B1/... semua ticket market data dan indikator
  B2/... semua ticket signal engine
  B3/... semua ticket Telegram dan journal
  B4/... semua ticket AI risk classifier
  B5/... semua ticket paper trading
  B6/... semua ticket semi-auto
  B7/... semua ticket auto A+ only

checklists/
  PRE_LIVE_CHECKLIST.md
  BATCH_EXIT_CHECKLIST.md
  CODE_REVIEW_CHECKLIST.md
  TESTNET_CHECKLIST.md

prompts/
  VIBE_CODING_PROMPT.md
  AI_RISK_CLASSIFIER_PROMPT.md
  POST_SL_REASONING_PROMPT.md
```

## Rule Terpenting

```text
No unit test = not done.
```

AI tidak boleh menjadi otak utama. AI hanya risk classifier:

```text
ALLOW / REDUCE_SIZE / BLOCK
```
