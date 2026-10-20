import 'package:counter_app/barista/services/api_service.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('parses a due side-work task without a completion', () {
    final task = BaristaSideWorkTask.fromJson({
      'id': 41,
      'title': 'Clean espresso machine',
      'instructions': 'Run the cleaning cycle.',
      'scheduled_date': '2026-10-19',
      'scheduled_time': '18:30',
      'is_due': 1,
      'completed_at': null,
      'completed_by_barista_id': null,
      'completed_by_barista_name': null,
    });

    expect(task.id, 41);
    expect(task.isDue, isTrue);
    expect(task.isCompleted, isFalse);
    expect(task.completedByBaristaName, isNull);
  });

  test('parses a completed side-work task and its barista', () {
    final task = BaristaSideWorkTask.fromJson({
      'id': 42,
      'title': 'Restock cups',
      'instructions': '',
      'scheduled_date': '2026-10-19',
      'scheduled_time': '19:00',
      'is_due': true,
      'completed_at': '2026-10-19T11:05:00.000Z',
      'completed_by_barista_id': 7,
      'completed_by_barista_name': 'Aina',
    });

    expect(task.isCompleted, isTrue);
    expect(task.completedByBaristaId, 7);
    expect(task.completedByBaristaName, 'Aina');
  });
}
