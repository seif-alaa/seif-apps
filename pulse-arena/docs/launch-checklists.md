# Launch Checklists

## Production readiness

### Product and legal
- [ ] Final name chosen and cleared (`brand-clearance-checklist.md`). **Blocking: the working title conflicts with a registered mark.**
- [ ] Look-and-feel and patent review by counsel (`ip-risk-notes.md`, section 7).
- [ ] Privacy policy and terms of service published, and linked from Settings and the store listings.
- [ ] Minors and age rating assessment (COPPA, GDPR-K). Nickname filter and report flow in place.
- [ ] Third-party license notices bundled (OFL fonts, MIT libraries).

### Gameplay
- [ ] Human playtests: at least 30 matches across 2 to 5 players and mixed devices. Tune `ESCALATION_CYCLES`, `IDLE_GRACE_MS`, `PULSE_COST` and Surge timing from data.
- [ ] First-session funnel checked: tutorial completion, first match, rematch rate.

### Infrastructure
- [ ] `SESSION_SECRET` generated and stored in the host's secret manager.
- [ ] `CORS_ORIGINS` restricted to the production web origin plus the Capacitor origins.
- [ ] TLS with WebSocket upgrades verified through the edge or proxy.
- [ ] `TRUST_PROXY=true` behind a proxy.
- [ ] At least one instance always on (no sleeping hosts).
- [ ] Postgres (optional) with automated backups.
- [ ] Health check and uptime alerting on `/healthz`. Log shipping and alerts on `handler.failed` and `room.tick_failed`.
- [ ] `docker build` verified in CI. Image scanned.
- [ ] Load test against the deployed environment from a separate machine.
- [ ] Deploy runbook: drain rooms before restarting (`deployment.md`).

### Quality
- [ ] `npm run typecheck`, `npm test` and `npm run test:e2e` green in CI on every commit.
- [ ] Manual pass on Safari iOS, Chrome Android, desktop Chrome, Firefox, Safari and Edge.
- [ ] Screen reader pass (VoiceOver, TalkBack). Keyboard-only pass on desktop.
- [ ] 60 FPS check on a mid-range Android phone (for example a 2022 Galaxy A-series) during multi-clears.

## Store submission readiness

### Accounts and identity
- [ ] Apple Developer Program enrollment (individual or organization; D-U-N-S number for organizations).
- [ ] Google Play Console account. Identity verification complete. New personal accounts must run closed testing with testers for a period before production access.
- [ ] Final bundle and application id set in Capacitor, Xcode and Gradle (permanent after the first upload).

### Builds
- [ ] `VITE_SERVER_URL` and `VITE_PUBLIC_URL` point to production in `.env.production`.
- [ ] Android: release keystore created and backed up. `bundleRelease` AAB built. Play App Signing enrolled.
- [ ] iOS: signing team set. Archive uploaded to App Store Connect. TestFlight tested on at least 2 devices.
- [ ] Version and build numbers incremented (`versionCode` and `versionName`, `CFBundleShortVersionString` and `CFBundleVersion`).
- [ ] App Links (`assetlinks.json`) and Universal Links (`apple-app-site-association`) published and verified.

### Store listing
- [ ] Title, subtitle and short description that lead with live multiplayer, with no competitor names.
- [ ] Screenshots: phone (6.7" and 6.5" iPhone, plus Android phone) and tablet if supported, all from real gameplay.
- [ ] Preview video (optional) recorded from a real match.
- [ ] Icon 1024 px (`assets/icon-1024.png`) after brand finalization.
- [ ] Privacy nutrition labels (App Store) and Data safety form (Play): guest id, nickname, gameplay data, no tracking.
- [ ] Content rating questionnaires (IARC, App Store age rating).
- [ ] Support URL and marketing URL live.
- [ ] Review notes explaining that multiplayer needs two devices, with a test room code or a note that Practice works solo.

### Policies
- [ ] Apple 4.1 and 4.3 (copycats, spam): differentiation evident in screenshots.
- [ ] Apple 1.2 (UGC): report and block mechanism for nicknames, or nicknames limited to a preset list.
- [ ] Google Play impersonation and repetitive-content policies reviewed.
- [ ] No claims of being "the number one" anything, and no fake player counts (the online count comes from `/api/stats`).
