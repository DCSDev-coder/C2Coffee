import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

void main() {
  test('notification writes refresh an expired access token before failing', () {
    final source = File('lib/services/notification_service.dart').readAsStringSync();
    final writeMethod = source.substring(source.indexOf('Future<void> _write('));
    expect(writeMethod, contains('response.statusCode == 401'));
    expect(writeMethod, contains('refreshTokenSilently()'));
    expect(writeMethod, contains('response = await send(refreshed)'));
  });

  test('iOS requests foreground location only', () {
    final infoPlist = File('ios/Runner/Info.plist').readAsStringSync();
    final podfile = File('ios/Podfile').readAsStringSync();
    final pubspec = File('pubspec.yaml').readAsStringSync();

    expect(infoPlist, contains('NSLocationWhenInUseUsageDescription'));
    expect(infoPlist, isNot(contains('NSLocationAlwaysUsageDescription')));
    expect(
      infoPlist,
      isNot(contains('NSLocationAlwaysAndWhenInUseUsageDescription')),
    );
    expect(podfile, contains('BYPASS_PERMISSION_LOCATION_ALWAYS=1'));
    expect(pubspec, contains('enable-swift-package-manager: false'));
  });
}
