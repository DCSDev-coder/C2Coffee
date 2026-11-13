import 'package:counter_app/barista/widgets/order_card.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('active orders expose a print receipt action', (tester) async {
    var pressed = false;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: OrderCard(
            timeDate: '10:00 AM - Nov 4, 2026',
            status: OrderStatus.newOrder,
            orderId: 'C2-TEST-1',
            customerDetails: 'Guest - 1 item',
            items: [OrderItem(title: '1x Latte', tags: const [])],
            onPrintPressed: () => pressed = true,
          ),
        ),
      ),
    );

    expect(find.text('Print receipt'), findsOneWidget);
    await tester.tap(find.text('Print receipt'));
    expect(pressed, isTrue);
  });

  testWidgets('completed orders expose a reprint receipt action', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: OrderCard(
            timeDate: '10:00 AM - Nov 4, 2026',
            status: OrderStatus.completed,
            orderId: 'C2-TEST-2',
            customerDetails: 'Guest - 1 item',
            items: [OrderItem(title: '1x Latte', tags: const [])],
            onPrintPressed: () {},
          ),
        ),
      ),
    );

    expect(find.text('Reprint receipt'), findsOneWidget);
  });

  testWidgets('ready orders stay printable with the correct status', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: OrderCard(
            timeDate: '10:00 AM - Nov 4, 2026',
            status: OrderStatus.readyForPickup,
            orderId: 'C2-TEST-3',
            customerDetails: 'Guest - 1 item',
            items: [OrderItem(title: '1x Latte', tags: const [])],
            onPrintPressed: () {},
          ),
        ),
      ),
    );

    expect(find.text('Ready for pickup'), findsOneWidget);
    expect(find.text('Print receipt'), findsOneWidget);
  });

  testWidgets('pending pay-at-counter orders expose payment confirmation', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: OrderCard(
            timeDate: '10:00 AM - Nov 13, 2026',
            status: OrderStatus.newOrder,
            orderId: 'C2-TEST-MANUAL',
            customerDetails: 'Guest - 1 item',
            items: [OrderItem(title: '1x Latte', tags: const [])],
            paymentMethod: 'manual_counter',
            paymentStatus: 'pending',
          ),
        ),
      ),
    );

    expect(find.text('Payment Received'), findsOneWidget);
  });
}
