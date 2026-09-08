import 'package:barista_app/services/api_service.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('operations context preserves printer and schedule readiness', () {
    final context = OperationsContext.fromJson({
      'integrations': const [],
      'printers': [
        {
          'name': 'Counter printer',
          'delivery_mode': 'local_print_bridge',
          'status': 'connected',
          'is_default': true,
        }
      ],
      'weekly_schedule': [
        {
          'barista_id': 7,
          'weekday': 1,
          'starts_at': '09:00:00',
          'ends_at': '17:00:00',
          'barista_name': 'Morning team',
        }
      ]
    });

    expect(context.printers.single.isDefault, isTrue);
    expect(context.printers.single.status, 'connected');
    expect(context.weeklySchedule.single.baristaName, 'Morning team');
  });
}
