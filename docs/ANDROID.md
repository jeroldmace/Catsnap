# Android app (APK)

The Android app is the same web app wrapped with [Capacitor](https://capacitorjs.com). Everything in `src/` runs unchanged inside it.

## Install on your phone
1. Download `releases/catsnap-<version>.apk` to the phone. On GitHub, open the file and tap **View raw**, or use the copy sent to you.
2. Open it. If Android asks, allow **Install unknown apps** for your browser or file manager.
3. Open **Cat Snap**. Allow **location** (for the radar and snap pins) and **camera** when asked.

## Updating
From 0.9.1 every release is signed with the same permanent key, so new versions install **over** the old one and keep your data.
- In the app: when a newer version is published, a **"Cat Snap x.y.z is ready"** banner appears on the feed and in Account & settings. Tap **Update**, open the download, and tap **Update** in Android's installer.
- Or open your invite link again and install over the top.
- Coming from 0.9.0 or older (signed with throwaway keys): uninstall once, then install 0.9.1. Snaps synced to your account come back after signing in.

Release key fingerprint (SHA-256): `3F:98:9E:34:A6:11:E3:15:6C:47:4B:FB:3B:AF:30:E9:1F:02:63:F0:DC:8C:EF:34:A0:33:66:A6:A2:00:F6:6A`

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
- The permanent release key is stored in a private Supabase bucket (`build-secrets`), served only by the `build-key` function to a caller presenting `CATSNAP_BUILD_SECRET`.
- The owner sets that passphrase in two places: Supabase → Edge Functions → Secrets (`CATSNAP_BUILD_SECRET`), and this cloud environment's settings (environment variable `CATSNAP_BUILD_SECRET`).
- A build session runs `scripts/fetch-signing-key.sh`, which writes the git-ignored `android/keystore.properties`. Release builds refuse to run without it, so a wrongly signed APK can't be published by accident.
- Never commit the keystore or its passwords.
