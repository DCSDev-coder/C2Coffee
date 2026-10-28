import 'package:c2_coffee/services/app_update_service.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('parses a secure customer store update manifest', () {
    final release = MobileAppRelease.fromJson({
      'version_name': '1.0.2',
      'build_number': 28,
      'ios_store_url': 'https://apps.apple.com/app/id6809305739',
      'android_store_url':
          'https://play.google.com/store/apps/details?id=com.c2coffeeandcandle.customer',
      'release_notes': 'Improved notifications.',
    });

    expect(release.versionName, '1.0.2');
    expect(release.buildNumber, 28);
    expect(release.storeUrl.scheme, 'https');
    expect(release.releaseNotes, 'Improved notifications.');
  });

  test('rejects an insecure store URL', () {
    expect(
      () => MobileAppRelease.fromJson({
        'version_name': '1.0.2',
        'build_number': 28,
        'ios_store_url': 'http://example.com/app',
        'android_store_url': 'http://example.com/app',
      }),
      throwsFormatException,
    );
  });

  test('requires a newer build before reporting an update', () {
    final release = MobileAppRelease.fromJson({
      'version_name': '1.0.2',
      'build_number': 28,
      'ios_store_url': 'https://apps.apple.com/app/id6809305739',
      'android_store_url':
          'https://play.google.com/store/apps/details?id=com.c2coffeeandcandle.customer',
    });

    final check = MobileAppUpdateCheck(
      installedVersionName: '1.0.1',
      installedBuildNumber: 27,
      release: release,
    );
    expect(check.updateAvailable, isTrue);
    expect(check.mandatory, isFalse);
  });

  test('uses the current platform store URL', () {
    final release = MobileAppRelease.fromJson({
      'version_name': '1.0.2',
      'build_number': 28,
      'ios_store_url': 'https://apps.apple.com/app/id6809305739',
      'android_store_url':
          'https://play.google.com/store/apps/details?id=com.c2coffeeandcandle.customer',
    });
    expect(release.storeUrl.host, isNotEmpty);
    expect(
        defaultTargetPlatform,
        anyOf(TargetPlatform.iOS, TargetPlatform.android, TargetPlatform.linux,
            TargetPlatform.macOS, TargetPlatform.windows));
  });
}
