import 'package:counter_app/barista/services/api_service.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('order cards prefer the outlet-timezone labels from the API', () {
    final orderedAt = DateTime.utc(2026, 11, 9, 5);
    expect(
      resolveOrderDisplayDateTime(
        createdAt: orderedAt,
        serverTime: '1:00 PM',
        serverDate: 'Nov 9, 2026',
      ),
      '1:00 PM - Nov 9, 2026',
    );
  });

  test('order cards fall back to the local ISO instant for older APIs', () {
    final orderedAt = DateTime.utc(2026, 11, 9, 5);
    expect(resolveOrderDisplayDateTime(createdAt: orderedAt), isNotEmpty);
  });
}
