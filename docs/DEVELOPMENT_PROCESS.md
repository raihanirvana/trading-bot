# Development Process

## Prinsip Utama

```text
Batch = milestone besar
Ticket = pekerjaan kecil
UAC = definisi benar/salah
Unit test = wajib
```

Jangan membuat banyak fitur sekaligus. Kerjakan satu ticket sampai selesai, test pass, lalu commit.

## Alur Kerja

```text
1. Pilih ticket paling awal yang belum selesai.
2. Baca Goal, Scope, Out of Scope, UAC.
3. Implement hanya scope ticket.
4. Tambah/update unit test.
5. Jalankan test.
6. Review diff.
7. Update BUG_LOG / DECISIONS jika perlu.
8. Commit.
9. Lanjut ticket berikutnya.
```

## Prompt Vibe Coding Default

Lihat `prompts/VIBE_CODING_PROMPT.md`.

Inti prompt:

```text
Work on this ticket only.
Do not modify unrelated files.
Do not implement out-of-scope features.
Add/update unit tests.
No live trading side effect.
```

## Branching

```text
main       = stabil
develop    = integrasi
feature/*  = satu ticket
```

Contoh:

```text
feature/b1-t03-calculate-bollinger-band
```

## Commit Format

```text
B1-T03: calculate Bollinger Band
```

## Definition of Done Global

Ticket dianggap selesai hanya jika:

```text
[ ] Scope completed
[ ] Out of scope tidak disentuh
[ ] Unit tests added/updated
[ ] All tests pass
[ ] Tidak ada live trading side effect
[ ] Logs readable
[ ] UAC satisfied
[ ] Docs updated jika perlu
```

## Stop Criteria

Stop develop dan fix dulu jika:

```text
- Unit test gagal
- Signal dobel
- Timezone daily reset salah
- Candle timestamp tidak konsisten
- AI output invalid tidak ditangani
- Ada kemungkinan live order saat DRY_RUN=true
- Order tidak idempotent
- SL gagal dibuat tanpa emergency handling
```
