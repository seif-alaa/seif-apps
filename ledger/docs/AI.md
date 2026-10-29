# AI reporting architecture

Ledger never needs AI for numbers. Every figure is computed deterministically
on-device by `engine/ledger.ts` and `ai/report.ts`. An AI model may only
**explain** a report the user already sees.

## Pieces

| File | Role |
|---|---|
| `ai/report.ts` | `FinancialReport` contract + `buildReport()` / `monthlyReport()`: totals, previous-period comparison, category changes, budget performance, recurring charges, unusual transactions (>3× category median), top merchants, data-quality flags (unreviewed amounts, sample data). |
| `ai/ask.ts` | “Ask Ledger” — deterministic answers for: top category, spend on a category in a period, compare months, income from a source, why overspent. Unknown questions return `unsupported`; nothing is approximated. |
| `ai/privacy.ts` | `minimizeReport()` — what may leave the device: aggregated figures and transaction ids for citations. Merchant names are pseudonymised unless the user opts in. Never notes, references, account numbers or message text. |
| `ai/provider.ts` | `AIProvider` interface. `getAIProvider()` returns `null` unless `VITE_LEDGER_AI_ENDPOINT` is set. |

## Configuration

```
VITE_LEDGER_AI_ENDPOINT=https://your-server.example.com/ledger/explain
```

The browser never sees a model API key. Your server holds it.

### Endpoint contract

`POST` JSON:
```json
{ "version": 1, "locale": "en" | "ar", "question": "optional, ≤500 chars", "report": FinancialReport }
```
Response:
```json
{ "text": "…", "citations": ["<transaction id>"], "model": "<model name>" }
```
Citations are filtered client-side to ids present in the report.

### Server requirements
- Authenticate the caller; rate-limit per user.
- Validate size and shape; reject anything that isn't a `FinancialReport`.
- System prompt: explain only the provided figures, never compute new totals,
  say “I don't know” when the report doesn't contain the answer.
- Don't log request bodies.

## UX states
- **Not configured** (default): reports and Ask Ledger work; the AI panel says
  it isn't configured.
- **Configured, no consent:** the user must enable “Allow sending this summary”
  (and optionally “Include merchant names”).
- **Configured + consent:** “Explain this month” returns text labelled
  “Written by AI (<model>) from the figures above”.
