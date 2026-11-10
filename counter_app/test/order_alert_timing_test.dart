import 'package:flutter_test/flutter_test.dart';
import 'package:counter_app/barista/order_alert_timing.dart';

void main() {
  test('preparing alert age starts when preparation starts', () {
    final now = DateTime.utc(2026, 11, 10, 5);
    final createdAt = DateTime.utc(2026, 11, 10, 4);
    final preparingAt = DateTime.utc(2026, 11, 10, 4, 55);

    expect(orderAlertAgeMinutes(now: now, fallbackCreatedAt: createdAt, statusStartedAt: preparingAt), 5);
  });

  test('falls back to creation time for older API responses', () {
    final now = DateTime.utc(2026, 11, 10, 5);
    final createdAt = DateTime.utc(2026, 11, 10, 4, 45);

    expect(orderAlertAgeMinutes(now: now, fallbackCreatedAt: createdAt), 15);
  });
}
