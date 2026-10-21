import 'package:counter_app/barista/services/api_service.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('accepts an empty published dated schedule', () {
    final context = OperationsContext.fromJson({
      'integrations': const [],
      'printers': const [],
      'scheduled_shifts': const [],
    });

    expect(context.scheduledShifts, isEmpty);
  });

  test('parses every barista assigned to the same dated shift day', () {
    final context = OperationsContext.fromJson({
      'integrations': const [],
      'printers': const [],
      'scheduled_shifts': [
        {
          'barista_id': 1,
          'barista_name': 'Aina',
          'shift_date': '2026-10-21',
          'starts_at': '09:00',
          'ends_at': '17:00',
        },
        {
          'barista_id': 2,
          'barista_name': 'Mira',
          'shift_date': '2026-10-21',
          'starts_at': '14:00',
          'ends_at': '22:00',
        },
      ],
    });

    expect(context.scheduledShifts.map((shift) => shift.baristaName), [
      'Aina',
      'Mira',
    ]);
  });

  test('rejects a response that omits the dated timetable', () {
    expect(
      () => OperationsContext.fromJson({
        'integrations': const [],
        'printers': const [],
      }),
      throwsFormatException,
    );
  });
}
