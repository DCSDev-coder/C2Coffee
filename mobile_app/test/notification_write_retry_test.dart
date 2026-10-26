import 'dart:io';

import 'package:c2_coffee/services/notification_service.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('notification writes refresh an expired access token before failing',
      () {
    final source =
        File('lib/services/notification_service.dart').readAsStringSync();
    final writeMethod =
        source.substring(source.indexOf('Future<void> _write('));
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

  test('clearing latest updates preserves the warning indicator', () {
    final service = NotificationService.instance;
    service.indicator.value = const NotificationIndicatorState(
      hasUnreadUpdates: true,
      hasActiveWarnings: true,
    );

    service.markLatestUpdatesCleared();

    expect(service.indicator.value.hasUnreadUpdates, isFalse);
    expect(service.indicator.value.hasActiveWarnings, isTrue);
  });

  test('inbox revision changes when a push update arrives', () {
    final service = NotificationService.instance;
    final previousRevision = service.inboxRevision.value;

    service.notifyInboxChanged();

    expect(service.inboxRevision.value, previousRevision + 1);
  });

  test('customer messages refresh and open the notification inbox', () {
    final source =
        File('lib/services/push_notification_service.dart').readAsStringSync();

    expect(source, contains("case 'customer_message':"));
    expect(source, contains("'customer_message' => 'New C2 Coffee message'"));
    expect(source, contains('_refreshNotificationInbox();'));
    expect(
      source,
      contains('_openNotificationDestination(const NotificationPage())'),
    );
  });

  test('iOS waits for APNs before obtaining and registering an FCM token', () {
    final source =
        File('lib/services/push_notification_service.dart').readAsStringSync();
    final syncMethod = source.substring(
      source.indexOf('Future<void> _syncRegistrationToken()'),
      source.indexOf('Future<bool> _apnsTokenIsAvailable'),
    );

    expect(syncMethod, contains('_apnsTokenIsAvailable(wait: true)'));
    expect(syncMethod, contains('FirebaseMessaging.instance.getToken()'));
    expect(
      syncMethod.indexOf('_apnsTokenIsAvailable(wait: true)'),
      lessThan(syncMethod.indexOf('FirebaseMessaging.instance.getToken()')),
    );
    expect(source, contains('FirebaseMessaging.instance.getAPNSToken()'));
    expect(source, contains('_scheduleRegistrationRetry();'));
  });
}
