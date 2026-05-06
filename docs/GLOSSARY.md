# Glossary

## Batch

Milestone besar pengembangan.

Contoh:

```text
B1 = Market Data + Indicator Engine
```

## Ticket

Pekerjaan kecil di dalam batch.

Contoh:

```text
B1-T03 = Calculate Bollinger Band
```

## UAC

User Acceptance Criteria. Definisi kondisi benar/salah untuk ticket.

## Previous Band

Upper/lower Bollinger Band dari candle sebelumnya yang sudah close.

## BB Width

```text
((upper - lower) / basis) * 100
```

## Anti-Band-Walk

Filter untuk menghindari entry mean-reversion saat market sangat trending.

Rule:

```text
BLOCK jika BB Width > 2.5 dan ADX > 35
```
