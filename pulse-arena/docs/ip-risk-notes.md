# Preliminary IP Risk Notes

**Status: preliminary engineering notes, not legal advice.** A limited automated search of public sources was run on 2026-10-28. It does not establish freedom to operate. Every item marked **Open** needs review by qualified counsel before commercial publication.

## 1. Name and trademark

### Finding: "PULSE ARENA" is already registered (HIGH RISK, Open)

A public trademark search found:

- **PULSE ARENA**, U.S. Reg. No. 5019908 (Serial 79181332), owned by **Interblock d.o.o.** (a casino gaming company). Filed 2015-09-24, registered 2016-08-16. Classes **9, 28, 41**, including software for gaming machines; "ARENA" is disclaimed.
- A tracker listed a Section 71 renewal deadline of 2016-08-16 + 10 years, that is **2026-08-16**. We could not confirm from public snapshots whether it was renewed. Even if it lapses, the owner may hold common-law rights or registrations elsewhere.
- Related marks exist: PULSE GAMING SOLUTIONS (pending, casino software), RUSH ARENA, and others containing "PULSE".

**Consequence:** "Pulse Arena" must stay an internal working title. Do not use it in store metadata, domains, marketing or app ids for a public release until counsel clears it, which is unlikely given the above.

Mitigations already in the code:
- The display name lives in one file (`apps/client/src/brand.ts`). The native app name and id are in `apps/client/capacitor.config.ts`, the manifest is `apps/client/public/manifest.webmanifest`, and the page title is in `apps/client/index.html`.
- The app id `com.seifapps.pulsearena` is provisional. Choose the final id **before** the first store upload, because store app ids cannot be changed afterwards.

Searches still to run (see `brand-clearance-checklist.md`): USPTO (TESS successor), EUIPO, WIPO Global Brand Database, UKIPO, and national registers in launch markets. Also check app store titles, domain availability and social handles.

### Competitor marks (Open, low risk if followed)

- Never use "Block Blast", "1010", "Woodoku" or similar product names in the product, store title, keywords or ads. Comparative advertising rules vary by country, and app stores frequently reject keyword stuffing with competitor names.
- Generic descriptive terms ("block puzzle") are widely used. Combining them with a distinctive brand is normal practice, but descriptive-only titles are weak marks.

## 2. Copyright

| Area | Status | Notes |
|---|---|---|
| Source code | Low | Written for this project. No competitor code consulted or copied. Dependencies are permissively licensed (MIT/ISC/Apache-2.0); see section 6. |
| Block artwork | Low | "Cored tile" style drawn procedurally in `game/theme.ts`. No textures or sprites from other games. |
| Icons | Low | Original SVG icons in `ui/icons.tsx`. App icon generated from `assets/icon.svg`. |
| Fonts | Low | Oxanium and Manrope, both under the SIL Open Font License 1.1 (bundled via @fontsource). Keep the OFL notice in distributions. |
| Sound and music | Low | Synthesized at runtime with Web Audio (`audio/audio.ts`). No samples, recordings or third-party sound libraries. |
| Copy and text | Low | Written for this project. |
| Overall look and feel | Medium, Open | The genre shares conventions (grid, tray of three, colored blocks). Our presentation differs deliberately, but counsel should review final screenshots side by side with leading titles before launch. |

Game mechanics as such are generally not protected by copyright in the US (idea/expression distinction), but specific expression is: art, audio, text, distinctive layouts and "total concept and feel" in some decisions (for example *Tetris Holding v. Xio Interactive*, 2012). That case is the main reason we avoid trade-dress similarity with any single competitor.

## 3. Patents (Open)

A brief public search (Google Patents and USPTO full text, keywords "block puzzle", "drag", "grid", "row column clear") found:
- US 2014/0077454 A1, "Block Puzzle with Row and Column Rotations": a different mechanic (rotating rows and columns). Its claims should still be read.
- US 8,721,413: falling pieces in a triangular grid (Tetris-like). Not our mechanic.
- Older physical block-puzzle patents (for example US 4,583,742), long expired.

We found no patent clearly covering drag-to-place grid line clearing, which has been widely practised since at least 2014 (*1010!*). However:
- **Multiplayer elements are less explored:** synchronized survival boards, shared-seed fairness, spectator mini boards, and resource-based piece swaps (Pulse). These should be checked specifically, including against published applications.
- **Open:** a professional freedom-to-operate search covering A63F13 and A63F9 and the multiplayer and matchmaking claims, in the US, EU and other launch markets.

## 4. App store copycat risk (Medium, Open)

Apple App Review Guideline 4.1 (Copycats) and 4.3 (Spam), and Google Play's impersonation and repetitive-content policies, reject apps that look like clones of popular titles.

Mitigations in place:
- Differentiated core rules: place two of three, Pulse, Surge, Static, live multiplayer survival.
- Distinct visual identity: graphite and midnight UI, cored tiles, competitive HUD with opponent boards.
- Original icon, without a block arrangement or palette resembling a specific competitor icon.

Still to do: write store screenshots and descriptions that lead with multiplayer, never mention competitors, and avoid "Blast"-style naming.

## 5. Other legal areas to review

- **Privacy:** guest ids are random tokens, and nicknames are user-chosen and shown to other players. There is no email or analytics yet. Before launch: a privacy policy, App Store privacy "nutrition labels", Google Play data safety form, COPPA and GDPR-K assessment (casual puzzle games attract minors), and nickname moderation (a profanity filter is on the roadmap).
- **User-generated content:** nicknames are UGC. Both stores expect a report and block mechanism once players can see each other's names.
- **Terms of service:** needed before public launch.
- **Accessibility:** not a legal certification. WCAG review recommended.

## 6. Third-party licenses (runtime)

React (MIT), Socket.IO (MIT), Capacitor and its plugins (MIT), pg (MIT), Vite (MIT; build only), @fontsource fonts (OFL-1.1). Run `npx license-checker --production --summary` before each release and ship the notices with the app.

## 7. Summary of open items for counsel

1. Product name: "Pulse Arena" conflicts with an existing registration. Choose and clear a new name.
2. Final app ids and bundle ids, tied to the cleared name.
3. Look-and-feel review of final store screenshots against leading titles.
4. Patent freedom-to-operate search focused on the multiplayer mechanics.
5. Privacy policy, terms of service, minors, and UGC moderation obligations.
