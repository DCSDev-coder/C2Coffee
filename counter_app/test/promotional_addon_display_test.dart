import 'package:counter_app/barista/services/api_service.dart';
import 'package:counter_app/barista/services/direct_printer_service.dart';
import 'package:counter_app/barista/widgets/order_card.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test(
    'parses promotional add-on metadata without treating it as a sale line',
    () {
      final items = parseOrderItems([
        {'qty': 1, 'name': 'Latte', 'menuItemId': 10},
        {
          'qty': 1,
          'name': 'Purple C2 Bear',
          'menu_item_id': 99,
          'line_type': 'promotional_addon',
          'campaign_name': 'Collect C2 Bears',
          'assignment_mode': 'server_random',
        },
      ]);

      expect(items, hasLength(2));
      expect(items.first.isPromotionalAddon, isFalse);
      expect(items.last.isPromotionalAddon, isTrue);
      expect(items.last.campaignName, 'Collect C2 Bears');
      expect(items.last.assignmentLabel, 'Randomly assigned');
    },
  );

  testWidgets('shows gifts in a prominent bag reminder separate from drinks', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: OrderCard(
            timeDate: '10:00 AM - Nov 18, 2026',
            status: OrderStatus.newOrder,
            orderId: 'C2-GIFT-1',
            customerDetails: 'Guest - 2 items',
            items: [
              OrderItem(title: '1x Latte', tags: const []),
              OrderItem(
                title: '1x Purple C2 Bear',
                tags: const [],
                lineType: 'promotional_addon',
                campaignName: 'Collect C2 Bears',
                assignmentMode: 'customer_choice',
              ),
            ],
          ),
        ),
      ),
    );

    expect(find.text('PROMOTIONAL GIFT — INCLUDE IN BAG'), findsOneWidget);
    expect(find.text('1x Purple C2 Bear'), findsOneWidget);
    expect(find.text('Campaign: Collect C2 Bears'), findsOneWidget);
    expect(find.text('Customer selected'), findsOneWidget);
    expect(
      find.descendant(
        of: find.byKey(const Key('standard-order-items')),
        matching: find.text('1x Purple C2 Bear'),
      ),
      findsNothing,
    );
  });

  test('prints a promotional gift as an explicit bag instruction', () {
    final item = parseDirectPrintItem({
      'name': 'Purple C2 Bear',
      'quantity': 1,
      'line_type': 'promotional_addon',
      'campaign_name': 'Collect C2 Bears',
      'assignment_mode': 'server_random',
    });

    expect(item.isPromotionalAddon, isTrue);
    expect(receiptLinesForItem(item), [
      'PROMOTIONAL GIFT — INCLUDE IN BAG',
      '1x Purple C2 Bear',
      'Campaign: Collect C2 Bears',
      'Randomly assigned',
    ]);
  });

  testWidgets(
    'shows the real order total and identifies the voucher-discounted item',
    (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: OrderCard(
              timeDate: '8:41 AM - Nov 19, 2026',
              status: OrderStatus.completed,
              orderId: 'C2-261119-OVZ3GO',
              customerDetails: 'fahmi - 5 items',
              items: [OrderItem(title: '1x CK Ovomaltine', tags: const [])],
              voucherName: 'Welcome to C2',
              voucherDiscountTokens: 15,
              voucherRewardSummary: '1x CK Ovomaltine',
              paymentMode: 'token',
              tokenAmountCharged: 38,
              subsidyTokenAmount: 20,
              isEmployee: true,
              subsidyRole: 'employee',
              total: 53.80,
            ),
          ),
        ),
      );

      expect(find.text('38 C2 Credit tokens paid'), findsOneWidget);
      expect(find.text('Order value RM 53.80'), findsOneWidget);
      expect(find.text('Employee'), findsOneWidget);
      expect(
        find.text('Payment: 20 company + 18 personal tokens'),
        findsOneWidget,
      );
      expect(find.text('Voucher: Welcome to C2'), findsOneWidget);
      expect(find.text('Applied to: 1x CK Ovomaltine'), findsOneWidget);
      expect(find.text('Discount: 15 C2 Credit tokens'), findsOneWidget);
    },
  );
}
