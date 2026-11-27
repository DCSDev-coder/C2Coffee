import 'package:counter_app/barista/services/api_service.dart';
import 'package:counter_app/barista/widgets/stock_alert_dialogs.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

BaristaStockAlert _buildAlert({
  int id = 1,
  String name = 'STOCK SHAVEICEPLUS PEACH 750ML',
  String unitCode = 'millilitre',
  String alertLevel = 'low',
  String baristaAction = 'pending',
  String availableQuantity = '500.000',
  String reorderLevel = '750.000',
  List<BaristaStockAlertMenuItem> menuItems = const [],
  List<BaristaStockAlertOption> options = const [],
}) {
  return BaristaStockAlert(
    id: id,
    inventoryItemId: 10 + id,
    inventoryItemName: name,
    unitCode: unitCode,
    alertLevel: alertLevel,
    baristaAction: baristaAction,
    availableQuantity: availableQuantity,
    reorderLevel: reorderLevel,
    affectedMenuItems: menuItems,
    affectedOptions: options,
  );
}

void main() {
  test('formatStockQuantity strips trailing zeros cleanly', () {
    expect(formatStockQuantity('500.000'), '500');
    expect(formatStockQuantity('5500.000'), '5500');
    expect(formatStockQuantity('12.500'), '12.5');
    expect(formatStockQuantity('0.000'), '0');
  });

  testWidgets('StockAlertListDialog renders alerts and empty state', (
    tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(home: Scaffold(body: StockAlertListDialog(alerts: []))),
    );
    expect(find.text('No open stock alerts'), findsOneWidget);
    expect(find.text('Open stock alerts'), findsOneWidget);

    final alerts = [
      _buildAlert(
        id: 1,
        name: 'STOCK SHAVEICEPLUS PEACH 750ML',
        baristaAction: 'keep_available',
        availableQuantity: '500.000',
      ),
      _buildAlert(
        id: 2,
        name: 'OAT MILK 1L',
        alertLevel: 'empty',
        baristaAction: 'pending',
        availableQuantity: '0.000',
      ),
    ];

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(body: StockAlertListDialog(alerts: alerts)),
      ),
    );
    expect(find.text('STOCK SHAVEICEPLUS PEACH 750ML'), findsOneWidget);
    expect(find.text('500 ml available'), findsOneWidget);
    expect(find.text('Kept available'), findsOneWidget);
    expect(find.text('OAT MILK 1L'), findsOneWidget);
    expect(find.text('0 ml available'), findsOneWidget);
    expect(find.text('Awaiting response'), findsOneWidget);
  });

  testWidgets(
    'StockAlertActionDialog toggles selections and submits actions',
    (tester) async {
      String? submittedAction;
      List<int> submittedMenuIds = [];
      List<int> submittedOptionIds = [];

      final alert = _buildAlert(
        name: 'Peach Syrup',
        availableQuantity: '500.000',
        reorderLevel: '750.000',
        menuItems: const [
          BaristaStockAlertMenuItem(
            id: 101,
            name: 'Peach Shave Ice',
            isAvailable: true,
          ),
          BaristaStockAlertMenuItem(
            id: 102,
            name: 'Peach Tea',
            isAvailable: false,
          ),
        ],
        options: const [
          BaristaStockAlertOption(
            id: 201,
            groupName: 'Syrup',
            optionName: 'Extra Peach',
            isAvailable: true,
          ),
        ],
      );

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: StockAlertActionDialog(
              alert: alert,
              onSubmit: (action, menuIds, optionIds) async {
                submittedAction = action;
                submittedMenuIds = menuIds;
                submittedOptionIds = optionIds;
              },
            ),
          ),
        ),
      );

      expect(find.text('LOW STOCK WARNING'), findsOneWidget);
      expect(find.text('Peach Syrup'), findsOneWidget);
      expect(find.text('500 ml'), findsOneWidget);
      expect(find.text('750 ml'), findsOneWidget);
      expect(find.text('Out of stock'), findsOneWidget);
      // 1 available menu item + 1 available option preselected = 2
      expect(find.text('Mark out of stock (2)'), findsOneWidget);

      await tester.tap(find.text('Mark out of stock (2)'));
      await tester.pumpAndSettle();

      expect(submittedAction, 'mark_out_of_stock');
      expect(submittedMenuIds, [101]);
      expect(submittedOptionIds, [201]);

      await tester.tap(find.text('Keep available'));
      await tester.pumpAndSettle();
      expect(submittedAction, 'keep_available');
    },
  );
}
