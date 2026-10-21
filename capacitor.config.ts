import type { CapacitorConfig } from '@capacitor/cli';

// The Android app: the built game from dist/ inside a WebView, served from https://localhost
// without a network. Built by `npm run android:apk`; see docs/ANDROID.md.
const config: CapacitorConfig = {
  appId: 'com.utreys.survivors',
  appName: 'Utrace Survivors',
  webDir: 'dist',
  android: {
    // Firebase is reached over https only; nothing in the game needs plain http.
    allowMixedContent: false,
  },
};

export default config;
