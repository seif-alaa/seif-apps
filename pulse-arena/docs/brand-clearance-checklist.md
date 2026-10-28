# Brand Clearance Checklist

Complete every item before the name appears in any store listing, domain, or marketing. The working title "Pulse Arena" already **fails** item 2 (see `ip-risk-notes.md`).

## Candidate shortlist

- [ ] Generate 10 to 20 candidates. Avoid "Block", "Blast", "1010", "Wood" and "Puzzle" as the main element. Avoid "Pulse" (crowded in gaming classes).
- [ ] Prefer coined or arbitrary words. They make stronger marks than descriptive ones.
- [ ] Check pronunciation and meaning in the top 10 launch languages.

## Trademark searches (per candidate)

- [ ] USPTO search, classes 9 (software, apps), 28 (games), 41 (entertainment, online games).
- [ ] EUIPO eSearch plus TMview.
- [ ] WIPO Global Brand Database (Madrid filings).
- [ ] UKIPO, and national offices in other launch markets.
- [ ] Common-law use: App Store, Google Play, Steam, itch.io, web search, social networks.
- [ ] Similar marks (sound-alike, look-alike) in the same classes, not only exact matches.
- [ ] Counsel opinion obtained in writing.

## Availability

- [ ] App Store name (30 characters) and subtitle.
- [ ] Google Play title (30 characters).
- [ ] Domain (.com plus a game TLD), redirect domains.
- [ ] Social handles: X, Instagram, TikTok, YouTube, Discord.

## Filing

- [ ] File the trademark application(s) before the public announcement.
- [ ] Decide on a logo mark filing once the final logo is ready.

## Code changes once a name is chosen

- [ ] `apps/client/src/brand.ts`: name, short name, tagline.
- [ ] `apps/client/index.html`: title and description.
- [ ] `apps/client/public/manifest.webmanifest`: name and short_name.
- [ ] `apps/client/capacitor.config.ts`: `appId`, `appName`. **The app id is permanent after the first store upload.**
- [ ] Android: `applicationId` and `namespace` in `android/app/build.gradle`, the package directory under `java/`, and `strings.xml`.
- [ ] iOS: bundle identifier in Xcode, `CFBundleDisplayName`, and the URL scheme name in `Info.plist`.
- [ ] Deep-link scheme `pulsearena://`: rename in `AndroidManifest.xml`, `Info.plist` and `native/platform.ts`.
- [ ] Share copy in `screens/Results.tsx` (image footer) and `native/platform.ts`.
- [ ] Root `package.json` name, README, docs.
- [ ] Regenerate icons and splash screens if the mark changes: `npm run icons`.
