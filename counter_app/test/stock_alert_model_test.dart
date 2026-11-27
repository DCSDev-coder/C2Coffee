import 'package:counter_app/barista/services/api_service.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test(
    'stock alert preserves a recorded response and affected availability',
    () {
      final alert = BaristaStockAlert.fromJson({
        'id': 3,
        'inventory_item_id': 7,
        'inventory_item_name': 'Peach',
        'unit_code': 'millilitre',
        'alert_level': 'low',
        'barista_action': 'keep_available',
        'available_quantity': '500.000',
        'reorder_level': '750.000',
        'affected_menu_items': [
          {'id': 9, 'name': 'Peach drink', 'is_available': false},
        ],
        'affected_options': [],
      });
      expect(alert.baristaAction, 'keep_available');
      expect(alert.unitLabel, 'ml');
      expect(alert.affectedMenuItems.single.isAvailable, isFalse);
    },
  );
}
