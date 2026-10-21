# C2 Store Android update on cPanel

The app and the unlisted staff page use one release folder:

`public_html/download/counterdownload/`

Its public URLs are:

- Page: `https://www.c2coffeeandcandle.com/download/counterdownload`
- Manifest: `https://www.c2coffeeandcandle.com/download/counterdownload/latest.json`
- APK: a versioned name such as `c2-store-1.2.0-3.apk`

## Publish a new version

1. Increase both values in `counter_app/pubspec.yaml`. For example, change
   `version: 1.1.0+2` to `version: 1.2.0+3`. Android requires every new build
   number (the number after `+`) to be greater than the installed one.
2. Build the signed release on Windows from the `counter_app` folder:

   ```powershell
   flutter clean
   flutter pub get
   flutter build apk --release
   ```

3. Prepare the cPanel files and release manifest:

   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts\prepare_cpanel_update.ps1 -ReleaseNotes "Describe the changes here."
   ```

4. In cPanel File Manager, open `public_html/download/counterdownload/`.
5. Upload the newly generated versioned APK from
   `counter_app/build/cpanel-update/` first.
6. Upload `.htaccess` if it is missing or changed.
7. Upload `latest.json` last. Overwrite the previous `latest.json`.
8. Open `latest.json` in a private browser window and confirm the version,
   APK URL and 64-character SHA-256 are the new values.
9. On the Android C2 Store device, open **Choose workspace > Settings >
   Update**. Allow installation from C2 Store when Android asks, then run the
   update check again.

Do not rename the generated APK after the manifest is created. Keep the same
Android signing key for every release. Uploading `latest.json` before the APK
can advertise a version that devices cannot download.

## Deploy the download page

Build C2Landing, upload the complete contents of its `dist` folder to
`public_html`, and preserve the generated
`download/counterdownload/index.html`. Deploy the website page before uploading
the release APK and `latest.json`, because a clean website deployment may
replace the page folder.
