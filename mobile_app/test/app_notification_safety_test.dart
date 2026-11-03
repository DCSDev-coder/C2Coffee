import 'package:c2_coffee/utils/app_notification.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('sanitizeUserNotificationMessage', () {
    test('hides exception details from error notifications', () {
      expect(
        sanitizeUserNotificationMessage(
          'SocketException: Failed host lookup: api.example.test',
          type: NotificationType.error,
        ),
        'Something went wrong. Please try again.',
      );
    });

    test('hides SQL and stack details from error notifications', () {
      expect(
        sanitizeUserNotificationMessage(
          'SQLSTATE[42S22] #0 query failed',
          type: NotificationType.error,
        ),
        'Something went wrong. Please try again.',
      );
    });

    test('keeps curated customer-facing messages', () {
      expect(
        sanitizeUserNotificationMessage(
          'Unable to complete purchase. Please check your payment details.',
          type: NotificationType.error,
        ),
        'Unable to complete purchase. Please check your payment details.',
      );
    });

    test('uses a safe success fallback for technical text', () {
      expect(
        sanitizeUserNotificationMessage(
          'FormatException: invalid response',
          type: NotificationType.success,
        ),
        'Completed successfully.',
      );
    });
  });
}
