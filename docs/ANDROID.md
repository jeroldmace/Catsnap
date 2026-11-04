# Android app (APK)

The Android app is the same web app wrapped with [Capacitor](https://capacitorjs.com). Everything in `src/` runs unchanged inside it.

## Install on your phone
1. Download `releases/catsnap-<version>.apk` to the phone. On GitHub, open the file and tap **View raw**, or use the copy sent to you.
2. Open it. If Android asks, allow **Install unknown apps** for your browser or file manager.
3. Open **Cat Snap**. Allow **location** (for the radar and snap pins) and **camera** when asked.

To update later, install the newer APK over the old one. Your snaps are kept as long as the new APK is signed with the same key (see Signing below). Save a backup first anyway (Catdex → Settings → Save backup).

## Differences from the web version
- **Save backup** opens Android's share sheet, so you can save the file to Drive or Files or email it.
- Map tiles need a connection. Areas you've already viewed are cached by the system WebView.
- No home-screen install step is needed; it's a normal app.

## Rebuild the APK
Needs Node 22, JDK 21 and the Android SDK (platform 35, build-tools 35). Set `ANDROID_HOME`, then run:

```bash
npm run android:apk   # builds the web app, syncs it into android/, builds and copies the APK into releases/
```

## Signing
APKs must be signed with the **same key** to install over each other without losing data.
- The key isn't stored in git. Put it anywhere safe and point `android/keystore.properties` at it (that file is git-ignored):
  ```
  storeFile=/absolute/path/to/catsnap-fieldtest.jks
  storePassword=…
  keyAlias=catsnap
  keyPassword=…
  ```
- Without `keystore.properties`, release builds are signed with the debug key. They install fine, but can't update an APK signed with a different key: you'd uninstall first, so back up before doing that.
- For the Play Store, create a separate private upload key.
