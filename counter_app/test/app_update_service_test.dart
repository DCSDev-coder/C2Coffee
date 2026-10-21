import 'package:counter_app/app_update_service.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('parses a secure cPanel release manifest', () {
    final release = AppRelease.fromJson({
      'version_name': '1.2.0',
      'version_code': 12,
      'apk_url':
          'https://www.c2coffeeandcandle.com/download/counterdownload/c2-store-1.2.0.apk',
      'sha256': 'a' * 64,
      'release_notes': 'Improved printer reliability.',
    });

    expect(release.versionName, '1.2.0');
    expect(release.versionCode, 12);
    expect(release.apkUrl.scheme, 'https');
    expect(release.releaseNotes, 'Improved printer reliability.');
  });

  test('rejects an insecure APK URL', () {
    expect(
      () => AppRelease.fromJson({
        'version_name': '1.2.0',
        'version_code': 12,
        'apk_url': 'http://example.com/c2-store.apk',
        'sha256': 'a' * 64,
      }),
      throwsFormatException,
    );
  });

  test('rejects a version name that could escape the update folder', () {
    expect(
      () => AppRelease.fromJson({
        'version_name': '../malicious',
        'version_code': 12,
        'apk_url': 'https://example.com/c2-store.apk',
        'sha256': 'a' * 64,
      }),
      throwsFormatException,
    );
  });

  test(
    'compares releases by monotonically increasing Android version code',
    () {
      final release = AppRelease.fromJson({
        'version_name': '1.1.0',
        'version_code': 2,
        'apk_url': 'https://example.com/c2-store.apk',
        'sha256': 'b' * 64,
      });

      expect(
        AppUpdateCheck(
          installedVersionName: '1.0.0',
          installedVersionCode: 1,
          release: release,
        ).updateAvailable,
        isTrue,
      );
      expect(
        AppUpdateCheck(
          installedVersionName: '1.1.0',
          installedVersionCode: 2,
          release: release,
        ).updateAvailable,
        isFalse,
      );
    },
  );
}
