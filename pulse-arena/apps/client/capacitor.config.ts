import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Native shell configuration. The app id and name are provisional and must be
 * replaced once the brand is cleared (see docs/brand-clearance-checklist.md).
 */
const config: CapacitorConfig = {
  appId: 'com.seifapps.pulsearena',
  appName: 'Pulse Arena',
  webDir: 'dist',
  backgroundColor: '#07090d',
  ios: {
    contentInset: 'never',
    backgroundColor: '#07090d',
    // Allow the WKWebView to play Web Audio without a gesture after the first unlock.
    allowsLinkPreview: false,
  },
  android: {
    backgroundColor: '#07090d',
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 600,
      launchAutoHide: true,
      backgroundColor: '#07090d',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#07090d',
      overlaysWebView: false,
    },
  },
};

export default config;
