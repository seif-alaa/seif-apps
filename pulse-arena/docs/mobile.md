# iOS and Android Apps (Capacitor)

The native apps are Capacitor 7 shells around the same React client and connect to the same game server as the web version. They are full apps with native haptics, share sheet, invite deep links, status bar and splash, safe areas, and pause and resume handling.

Projects live in `apps/client/android` and `apps/client/ios`.

## What is configured

| Area | Android | iOS |
|---|---|---|
| App id | `com.seifapps.pulsearena` (**provisional**) | same |
| Icons | Generated mipmaps (legacy, round, adaptive foreground on #07090D) | 1024 px AppIcon |
| Splash | Original splash in all densities and orientations | Universal 2732 px splash |
| Theme | Dark, no action bar, matching status and navigation bars | Dark interface style, light status bar text |
| Deep links | `pulsearena://room/CODE` plus verified `https://HOST/r/CODE` (`deepLinkHost` in `app/build.gradle`) | `pulsearena://` URL scheme in `Info.plist`. Universal links need the Associated Domains capability (below). |
| Haptics | `@capacitor/haptics`, VIBRATE permission | Taptic Engine through the same plugin |
| Share | `@capacitor/share` (invite links, result image via `@capacitor/filesystem` cache) | same |
| Lifecycle | Audio suspends on background. `game:sync` runs on resume. Android back button handled per screen. | Audio suspends on background, resyncs on resume |
| Safe areas | `viewport-fit=cover` + `env(safe-area-inset-*)` in CSS | same |
| Export compliance | n/a | `ITSAppUsesNonExemptEncryption = false` (TLS only) |

## Prerequisites (human steps)

- **Android:** Android Studio (latest stable), Android SDK 35, JDK 21.
- **iOS:** a Mac with Xcode 16+, CocoaPods (`sudo gem install cocoapods`), and an Apple Developer Program membership ($99/year) for device testing beyond 7-day free provisioning and for App Store distribution.
- A deployed game server reachable over **HTTPS** (see `deployment.md`). Native builds cannot use the Vite dev proxy.

## Build steps

From the repository's `pulse-arena/` directory.

1. Point the app at your server:

```bash
cp apps/client/.env.example apps/client/.env.production
```

Then set `VITE_SERVER_URL=https://play.example.com` and `VITE_PUBLIC_URL=https://play.example.com` in that file.

2. Add the native origins to the server's `CORS_ORIGINS`: `capacitor://localhost,https://localhost`.

3. Build the web bundle and copy it into both native projects:

```bash
npm run cap:sync
```

4. Android: open in Android Studio, then Run on a device or emulator.

```bash
cd apps/client && npx cap open android
```

Or build a debug APK from the command line:

```bash
cd apps/client/android && ./gradlew assembleDebug
```

5. iOS (on a Mac): install pods and open Xcode.

```bash
cd apps/client/ios/App && pod install
```

```bash
cd apps/client && npx cap open ios
```

In Xcode select the App target, choose your Team under Signing & Capabilities, then Run.

### Local testing against a dev server on your LAN

For quick device testing without deploying, set `VITE_SERVER_URL=http://<your-computer-LAN-IP>:8787`. Then allow cleartext traffic for that IP only: Android `network_security_config`, and on iOS an `NSAppTransportSecurity` exception. **Do not ship those exceptions.**

## Release signing

### Android

1. Create an upload key (store it safely; losing it requires a Play support process):

```bash
keytool -genkeypair -v -keystore upload.keystore -alias upload -keyalg RSA -keysize 2048 -validity 10000
```

2. Add a `signingConfigs.release` block to `android/app/build.gradle` that reads the passwords from `~/.gradle/gradle.properties`. Never commit them.
3. Build an App Bundle:

```bash
cd apps/client/android && ./gradlew bundleRelease
```

4. Enroll in Play App Signing when creating the app in Play Console.

### iOS

1. In App Store Connect, create the app with the final bundle id.
2. In Xcode: Product, then Archive, then Distribute App, then App Store Connect.
3. Test through TestFlight before submitting for review.

## Verified invite links (recommended before launch)

- **Android App Links:** set `deepLinkHost` in `android/app/build.gradle`, then serve `https://HOST/.well-known/assetlinks.json` with your signing certificate's SHA-256 fingerprint.
- **iOS Universal Links:** enable Associated Domains (`applinks:HOST`) in Xcode, then serve `https://HOST/.well-known/apple-app-site-association` listing the `/r/*` path.

The game server's static handler can serve both files from `apps/client/public/.well-known/`.

## Status and blockers

- The Capacitor projects were generated and configured in this repository, and the web bundle syncs into both (`npx cap sync` succeeded).
- **Not yet built or run on devices.** The build environment had no Android SDK: downloads from `dl.google.com` were blocked by its network policy. It also had no macOS or Xcode. No APK, AAB or IPA has been produced, and nothing has been tested on physical devices.
- No store submission has been made. It requires developer accounts, signing keys, a cleared product name, privacy policy and store assets (see `launch-checklists.md`).
