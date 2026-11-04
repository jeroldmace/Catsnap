import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.catsnap.fieldtest',
  appName: 'Cat Snap',
  webDir: 'dist',
  server: { androidScheme: 'https' },
  android: {
    // Identify the app to OpenStreetMap's tile servers (their usage policy asks for this).
    appendUserAgent: 'CatSnap/0.7.0 (field test)',
    // MainActivity handles system bar and keyboard insets itself.
    adjustMarginsForEdgeToEdge: 'disable',
  },
};

export default config;
