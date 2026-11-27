import 'package:counter_app/barista/services/api_service.dart';
import 'package:counter_app/barista/widgets/stock_alert_indicator.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  final alert = BaristaStockAlert.fromJson({
    'id': 1,
    'inventory_item_id': 7,
    'inventory_item_name': 'Peach syrup',
    'unit_code': 'millilitre',
    'alert_level': 'low',
    'barista_action': 'keep_available',
    'available_quantity': '500',
    'reorder_level': '750',
    'affected_menu_items': [
      {'id': 11, 'name': 'Peach drink', 'is_available': true},
    ],
    'affected_options': [
      {
        'id': 12,
        'group_name': 'Milk',
        'option_name': 'Oat',
        'is_available': true,
        'customization_type': 'milk',
        'customization_value': 'oat',
      },
    ],
  });
  test('matches only linked items and matching option type and value', () {
    expect(stockAlertsForMenuItem([alert], 11), [alert]);
    expect(stockAlertsForMenuItem([alert], 99), isEmpty);
    expect(stockAlertsForOption([alert], 'milk', 'oat'), [alert]);
    expect(stockAlertsForOption([alert], 'bean', 'oat'), isEmpty);
  });
  testWidgets(
    'indicator opens ingredient explanation and hides without alerts',
    (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Column(
              children: [
                StockAlertIndicator(name: 'Peach drink', alerts: [alert]),
                const StockAlertIndicator(name: 'Unrelated', alerts: []),
              ],
            ),
          ),
        ),
      );
      expect(find.byIcon(Icons.circle), findsOneWidget);
      await tester.tap(find.byTooltip('Show stock alerts for Peach drink'));
      await tester.pumpAndSettle();
      expect(find.text('Peach syrup'), findsOneWidget);
      expect(find.textContaining('500 ml available'), findsOneWidget);
    },
  );
}
