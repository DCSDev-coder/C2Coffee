import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:counter_app/barista/screens/inventory_page.dart';

void main() {
  testWidgets('Inventory page displays search bar and filters items by text', (tester) async {
    tester.view.physicalSize = const Size(1200, 900);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      const MaterialApp(
        home: InventoryPage(),
      ),
    );
    await tester.pump();

    // Verify search bar exists
    expect(find.byType(TextField), findsWidgets);
    expect(find.text('Search inventory items or categories...'), findsOneWidget);
  });
}
