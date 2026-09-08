# Android Play Release Procedure

Both Android applications fail a release build unless an upload keystore is
configured. This prevents accidentally publishing a debug-signed bundle.

## One-time upload-key setup

Create or retrieve the organisation's Play upload keystore. Store the keystore
and its passwords in the approved password manager or secret store, not in this
repository.

For each app, create a local-only file at `android/key.properties`:

```properties
storePassword=<upload-keystore-password>
keyPassword=<upload-key-password>
keyAlias=<upload-key-alias>
storeFile=<absolute-path-to-upload-keystore>
```

The customer app and barista app must use the upload keys registered for their
respective Play Console package names. Do not regenerate a key if a registered
upload key already exists; recover it from the organisation's secure storage.

## Build and upload

From the appropriate app directory:

```bash
flutter pub get
flutter analyze
flutter test
flutter build appbundle --release
```

Upload the generated `.aab` in `build/app/outputs/bundle/release/` to the
correct Play Console app. Increase the build number in `pubspec.yaml` before
each new Play upload.

## Release checks

- Confirm the bundle package name matches the intended Play Console listing.
- Run the internal-test track on a physical Android device before production.
- Verify sign-in, checkout, order status, notification permission, and a ready
  order notification after FCM delivery is enabled on the API.
- Verify receipt printing only with the deployed print bridge and real target
  printer. A configured printer route alone is not evidence of printing.
