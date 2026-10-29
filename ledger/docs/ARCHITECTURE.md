# Ledger architecture

Ledger is an offline-first PWA (Vite + React + TypeScript). All financial data
lives in IndexedDB on the device (Dexie). There is no Ledger backend and no
account; the only optional network dependency is a user-supplied AI proxy.

```
src/
  engine/          Transaction intelligence — pure TS, no React
    model.ts         Vocabulary + state machines
    sms.ts           Alert parser (EN/AR, OTP rejection)
    csv.ts           Statement import
    merchants.ts     Merchant normalisation + Egyptian brand hints
    classify.ts      Deterministic classification + confidence
    pipeline.ts      ingest(): dedupe → status → account → transfer/refund → classify → persist
    actions.ts       User operations (confirm, reopen, merge, delete/undo, manual, reconcile)
    ledger.ts        THE calculations (balances, summaries, budgets) used by every screen
    recurring.ts     Recurring-charge detection
    sources.ts       Honest capability registry for every source
    bridge.ts        Native-shell contract + capture URL params
    simulator.ts     Dev-only event generator (origin: "simulated")
  ai/              Deterministic reports, Ask Ledger, provider boundary, privacy
  db/              Dexie schema (v1 → v2 migration), defaults, sample data, backup
  i18n/            en / ar dictionaries, money/number/date formatting
  components/ pages/  UI
```

## The pipeline

```
Financial event (SMS paste · share sheet · iOS Shortcut · CSV row · native bridge · simulator)
  │  adapter → IncomingEvent { sourceKind, externalId?, parsed: ParsedFields }
  ▼
Sanitise ─ OTP / password / auth-code messages are rejected before parsing and never stored
  ▼
Idempotency ─ event id = sourceKind + externalId (or hash of parsed facts). Seen → "duplicate"
  ▼
Status changes ─ failed (no effect) · reversed (marks original) · pending → posted (merge)
  ▼
Dedupe ─ same reference → merge; different senders / statement vs alert in window → merge;
         same sender, no reference, minutes apart → new txn flagged "possible duplicate"
  ▼
Account matching ─ last-4 digits, else the only account at that institution, else ask
  ▼
Classification ─ merchant memory (user's own history) › built-in brand hint › unknown
  ▼
Refund matching ─ inflow + same merchant + purchase ≥ amount within 90 days
Transfer matching ─ opposite legs in two owned accounts, ±72h, out ≥ in ≤ in + max(1%, EGP 20)
ATM ─ bank out → derived cash-wallet in leg
  ▼
Confidence ─ auto-file only if user enabled it AND confidence ≥ threshold (0.85 / 0.95)
             AND the evidence is the user's own history (rules alone never auto-file)
  ▼
Persist txn + event in ONE IndexedDB transaction → optional review / notification
```

## Four independent states

| Question | Field | Values |
|---|---|---|
| Was it observed? | `source`, `sourceEventIds` | which sources reported it |
| Is it classified? | `classification`, `method`, `confidence` | unclassified → suggested → classified |
| Did the user confirm? | `review` | needs_review · auto_accepted · confirmed · not_required |
| Did it post? | `posting` | pending → posted → reversed; pending → failed |

Transitions are enforced in `model.ts` (`assertPosting`, `assertReview`).

**Balances depend only on amount, direction, account and posting.** Confirming
or recategorising can't double-count. Skipping a review never deletes a
transaction.

## Money rules (`engine/ledger.ts`)

- Balance = opening + Σ posted signed amounts. Pending is shown, not counted.
- Spending = expenses − refunds + transfer fees (pending purchases included).
- Income = only transactions classified as income. Unclassified inflows are
  reported separately — a balance going up is never assumed to be income.
- Own transfers and balance adjustments are neither spending nor income.
- Net worth sums one currency; other currencies are listed, never converted.

Home, Activity, Budgets, Insights, reports and Ask Ledger all call these
functions, so no two screens can disagree.

## Data model (Dexie v2)

| Table | Key | Notes |
|---|---|---|
| `transactions` | id | normalized model, indexes on date, occurredAt, kind, review, accountId, transferGroupId, merchantKey, reference |
| `events` | idempotency id | one row per observation; parsed fields only; redacted evidence opt-in |
| `accounts` | id | kind, institution, last4, currency, opening balance, archived |
| `categories` | id | built-ins have a `key` (translation + rules); icon name |
| `budgets` | categoryId | monthly amount |
| `merchants` | merchantKey | counts of the user's confirmations per category / kind |
| `reconciliations` | id | expected vs verified, resolution |
| `sources` | id | which sources the user set up, status, last activity |

**Migration v1 → v2** upgrades every existing row in place (`db.ts`,
`upgradeV1*`): expense/income → direction + kind, posted, confirmed, manual,
origin real; currency from the user's v1 preference; categories mapped to keys
and icons. Covered by a test that builds a real v1 database and opens it with v2.
v1 backup files are upgraded the same way on import.

## Reconciliation

The user enters a verified balance → Ledger records expected vs verified and
the difference. It never fabricates a transaction. Options: review queue, add
missing transactions, re-check, or book an explicit `adjustment` (excluded from
income and spending).

## Security & privacy

- No credentials, PINs or OTPs are ever requested. OTP-like text is rejected
  before parsing, in the shared parser that native shells will also use.
- Stored per event: parsed fields only. Message text is stored only if the user
  enables “Keep alert text”, and then redacted (long digit runs masked) and
  capped at 240 chars. One tap deletes it.
- No analytics, no third-party requests. Fonts are bundled.
- Native payloads are validated (`fromNativePayload`) and capped in size.
- `postMessage` events are accepted only from the app's own origin.
- Backups exclude message evidence.
- At-rest encryption: IndexedDB is protected by the OS sandbox but not
  encrypted by Ledger. An app-level passcode / WebAuthn lock with an encrypted
  store is a recommended next step before a public launch.
- There are no Ledger server endpoints. The optional AI proxy is the user's own
  server (see AI.md) and must authenticate, rate-limit and avoid logging bodies.
