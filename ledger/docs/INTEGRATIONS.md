# Transaction sources — what works today, what's next

Status legend: ✅ works in this build · 🧪 implemented, needs real-device validation · 🔧 interface ready, native/partner work required · 📝 planned

| Source | Status | How |
|---|---|---|
| Paste alerts | ✅ | Settings → Sources → Paste. Parsed on-device. |
| Statement CSV | ✅ | Column auto-detect (EN/AR headers), manual mapping fallback, idempotent re-import, merges with live alerts. |
| Manual / cash | ✅ | Add sheet with keypad; cash wallet default. |
| Simulator | ✅ (dev) | Developer tools. Data marked SIMULATED. |
| Android share sheet | 🧪 | Web Share Target in the manifest (`?text=`). Works for installed PWAs in Chrome on Android; not yet tested on a device. |
| iOS Shortcut automation | 🧪 | Personal automation “When I receive a message from <bank>” → open `…/?via=shortcut&capture=<message>`. Opens Ledger each time; not yet validated on device. |
| Android bank SMS | 🔧 | `window.ledgerNative.receive(payload)` contract in `engine/bridge.ts`. |
| Android notification listener | 🔧 | Same contract, `source: "android_notification"`. |
| Open banking / bank APIs | 🔧 | Needs a licensed provider / bank partnership. |
| InstaPay, Telda, Vodafone Cash APIs | — | No public APIs. Ledger reads the alerts these services already send. |
| Email receipts | 📝 | Needs a server component + inbox consent. |

## Notifications by platform

| Platform | What Ledger does |
|---|---|
| Android Chrome (installed PWA) | Background capture is not possible from the web, but when an event is ingested while Ledger is backgrounded, it shows one notification with up to two actions: the suggested category (files it in one tap) and “Something else” (opens Quick Capture). Several at once collapse into a summary. |
| iOS / iPadOS (Home Screen web app, 16.4+) | Notifications have no action buttons on iOS web. A tap opens Quick Capture on that transaction. |
| Desktop browsers | Same as Android where supported. |
| In-app (all) | Review banner on Home, review badge on Activity, toasts; Quick Capture sheet over any screen. |

Settings → Automation → Review notifications: Off / When needed / Everything.

## Next steps to connect real Egyptian providers

### 1. Validate parsing on real alerts (week 1–2)
- Collect consented, redacted alert samples per institution (CIB, NBE, Banque
  Misr, QNB, HSBC, AAIB, Telda, InstaPay, Vodafone Cash, e& cash, Orange Cash,
  valU) in English and Arabic.
- Add each as a fixture in `engine/__tests__/sms.test.ts` with expected fields.
- Track a per-institution parse-accuracy metric; only list an institution as
  “supported” above a threshold.

### 2. Android companion (weeks 2–8)
- Wrap this PWA with Capacitor (or a TWA + native module) so the UI and engine
  are shared; implement a small native plugin that calls
  `window.ledgerNative.receive()`.
- **SMS:** `RECEIVE_SMS` broadcast receiver with an allow-list of bank sender
  IDs chosen by the user. Google Play restricts SMS permissions; apply under the
  *SMS-based money management* exception with a Permissions Declaration. Drop
  OTP-like messages natively before they reach JS. Never read the inbox history
  without an explicit one-time import consent.
- **Notifications:** `NotificationListenerService` limited to user-selected
  banking-app packages; the user grants access in system settings. Do not use
  notification access as a workaround for SMS permissions.
- **Background:** the receiver hands the payload to a `WorkManager` job that
  starts the WebView-less engine (run the engine in a JS runtime such as
  Hermes/QuickJS, or port `sms.ts`/`pipeline.ts` to Kotlin with the same
  fixtures) and writes to the same store.
- **Notification actions:** `NotificationCompat.Action` for the top 2–3
  categories plus `RemoteInput` for a note; the action calls the same
  `confirmClassification` logic.

### 3. iOS
- Ordinary apps cannot read SMS or other apps' notifications. Supported routes:
  the Shortcuts automation (already wired), App Intents in a native wrapper so
  the automation can run “Add transaction” without opening the app, and statement
  imports.
- FinanceKit exists but currently covers Apple Card/Cash/Savings and requires an
  entitlement; it is not a route to Egyptian bank data today.

### 4. Direct connections
- Engage the Central Bank of Egypt's open-banking / fintech sandbox programme
  and licensed aggregators. Implement each as an adapter that emits
  `IncomingEvent`s with `sourceKind: "open_banking"` and stable `externalId`s —
  no other engine changes are needed.
- Store tokens server-side (requires introducing a Ledger backend with auth,
  per-user isolation and encrypted token storage — out of scope of this build).

### 5. Before launch
- App lock (passcode / biometrics via WebAuthn) and encrypted local store.
- Privacy policy covering each source's data access.
- Crash/diagnostic logging that never includes message bodies or amounts.
