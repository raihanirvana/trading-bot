# Vibe Coding Prompt

Gunakan prompt ini setiap mengerjakan ticket.

```text
You are working on Ticket <TICKET_ID> only.

Read the ticket carefully.

Rules:
- Do not modify unrelated files.
- Do not implement features outside the ticket scope.
- Do not add Telegram, AI, exchange order, or auto trading unless this ticket explicitly asks for it.
- Add or update unit tests.
- Keep existing architecture.
- No live trading side effects.
- Default mode must remain dry-run.
- After coding, summarize:
  1. Changed files
  2. Tests added/updated
  3. How to run tests
  4. Assumptions
  5. Anything intentionally left out because out of scope
```
