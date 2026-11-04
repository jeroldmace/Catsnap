# Android app (APK)

The Android app is the same web app wrapped with [Capacitor](https://capacitorjs.com). Everything in `src/` runs unchanged inside it.

## Install on your phone
1. Download `releases/catsnap-<version>.apk` to the phone. On GitHub, open the file and tap **View raw**, or use the copy sent to you.
2. Open it. If Android asks, allow **Install unknown apps** for your browser or file manager.
3. Open **Cat Snap**. Allow **location** (for the radar and snap pins) and **camera** when asked.

## Updating to a newer APK
Each field-test APK is signed with a new key, so Android won't install it over the old one. To update without losing anything:
1. In the old app: **Catdex → Settings → Save backup**, and save the file somewhere outside the app (Drive, Files, email).
2. Uninstall Cat Snap. This deletes the snaps stored inside the app, which is why step 1 matters.
3. Install the new APK and open it.
4. **Catdex → Settings → Restore backup** and pick the file from step 1. Your snaps, photos, likes, comments and settings come back.

## Location on Android
The app uses its own small native module (`CatLocationPlugin.java`) that reads Android's satellite GPS and Wi-Fi/mobile-network positions directly. It doesn't depend on Google Play services, so it also works where Google's location service doesn't (for example in mainland China). Google's fused location runs alongside when available, and the first good fix wins. If no fix arrives, you can set the spot on a map when posting.

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
Field-test APKs aren't signed with a kept key; each build gets a fresh one (see *Updating* above).
If you later want updates to install in place, create a private key, keep it out of git, and point a git-ignored `android/keystore.properties` at it (`storeFile`, `storePassword`, `keyAlias`, `keyPassword`). `android/app/build.gradle` picks it up automatically. Use a separate private upload key for the Play Store.
