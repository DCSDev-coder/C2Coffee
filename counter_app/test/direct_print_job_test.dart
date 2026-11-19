import 'dart:convert';

import 'package:counter_app/barista/services/direct_printer_service.dart';
import 'package:flutter_test/flutter_test.dart';

DirectPrintJob job({required String name, required bool employee}) =>
    DirectPrintJob(
      jobRef: 'job-1',
      config: const DirectPrinterConfig(host: '192.0.2.1', port: 9100),
      orderRef: 'C2-TEST',
      customerName: name,
      customerIsEmployee: employee,
      createdAt: DateTime.utc(2026, 10, 21),
      items: const [],
    );

DirectPrintJob financeReceiptJob({
  required String requestType,
  required bool isGuest,
  required String fulfillmentType,
}) => DirectPrintJob(
  jobRef: 'job-finance-1',
  requestType: requestType,
  config: const DirectPrinterConfig(host: '192.0.2.1', port: 9100),
  orderRef: 'C2-FINANCE',
  customerName: isGuest ? 'Walk-in Guest' : 'Nur Aina',
  customerIsEmployee: false,
  isGuest: isGuest,
  fulfillmentType: fulfillmentType,
  paymentMode: 'direct',
  paymentMethod: 'manual_counter',
  paymentReference: 'CASH-00981',
  subtotal: 29.00,
  discount: 4.00,
  finalTotal: 25.00,
  createdAt: DateTime.utc(2026, 11, 19, 3, 30),
  items: const [
    DirectPrintItem(
      name: 'Cafe Latte',
      quantity: 2,
      details: ['Size: Large'],
      unitPriceRm: 12.50,
      lineTotalRm: 25.00,
      unitTokenValue: 13,
      lineTokenValue: 26,
    ),
    DirectPrintItem(
      name: 'Butter Croissant',
      quantity: 1,
      unitPriceRm: 4.00,
      lineTotalRm: 4.00,
      unitTokenValue: 4,
      lineTokenValue: 4,
    ),
  ],
);

void main() {
  test('accepts only private outlet IPv4 printers on raw print port 9100', () {
    expect(
      isAllowedDirectPrinterConfig(
        const DirectPrinterConfig(host: '192.168.1.50', port: 9100),
      ),
      isTrue,
    );
    expect(
      isAllowedDirectPrinterConfig(
        const DirectPrinterConfig(host: '8.8.8.8', port: 9100),
      ),
      isFalse,
    );
    expect(
      isAllowedDirectPrinterConfig(
        const DirectPrinterConfig(host: '192.168.1.50', port: 22),
      ),
      isFalse,
    );
  });

  test('adds an employee label to an employee receipt name', () {
    expect(
      job(name: 'Aina', employee: true).printedCustomerName,
      'Aina (Employee)',
    );
  });

  test('keeps a regular customer receipt name unchanged', () {
    expect(job(name: 'Amirul', employee: false).printedCustomerName, 'Amirul');
  });

  test(
    'original request remains a NEW ORDER kitchen docket without finance totals',
    () async {
      TestWidgetsFlutterBinding.ensureInitialized();
      final docketBytes = await DirectPrinterService.instance.buildOrderDocket(
        financeReceiptJob(
          requestType: 'original',
          isGuest: true,
          fulfillmentType: 'take_away',
        ),
      );
      final docketText = latin1.decode(docketBytes, allowInvalid: true);

      expect(docketText, contains('NEW ORDER'));
      expect(docketText, isNot(contains('ITEMISED RECEIPT')));
      expect(docketText, isNot(contains('Subtotal')));
      expect(docketText, isNot(contains('Final total')));
      expect(docketText, isNot(contains('RM 25.00')));
      expect(docketText, isNot(contains('CASH-00981')));
    },
  );

  test(
    'reprint renders an itemised walk-in takeaway finance receipt',
    () async {
      TestWidgetsFlutterBinding.ensureInitialized();
      final docketBytes = await DirectPrinterService.instance.buildOrderDocket(
        financeReceiptJob(
          requestType: 'reprint',
          isGuest: true,
          fulfillmentType: 'take_away',
        ),
      );
      final docketText = latin1.decode(docketBytes, allowInvalid: true);

      expect(docketText, contains('ITEMISED RECEIPT'));
      expect(docketText, contains('Customer type: Walk-in'));
      expect(docketText, contains('Fulfillment: Take Away'));
      expect(docketText, contains('2x Cafe Latte'));
      expect(docketText, contains('RM 25.00'));
      expect(docketText, contains('1x Butter Croissant'));
      expect(docketText, contains('RM 4.00'));
      expect(docketText, contains('Subtotal: RM 29.00'));
      expect(docketText, contains('Discount: RM 4.00'));
      expect(docketText, contains('Final total: RM 25.00'));
      expect(docketText, contains('Payment method: Counter'));
      expect(docketText, contains('Payment reference: CASH-00981'));
      expect(docketText, isNot(contains('NEW ORDER')));
    },
  );

  test('reprint labels a registered dine-in customer as a member', () async {
    TestWidgetsFlutterBinding.ensureInitialized();
    final docketBytes = await DirectPrinterService.instance.buildOrderDocket(
      financeReceiptJob(
        requestType: 'reprint',
        isGuest: false,
        fulfillmentType: 'dine_in',
      ),
    );
    final docketText = latin1.decode(docketBytes, allowInvalid: true);

    expect(docketText, contains('Customer type: Member'));
    expect(docketText, contains('Fulfillment: Dine In'));
  });

  test(
    'corrected token receipt prints every deduction so totals reconcile',
    () async {
      TestWidgetsFlutterBinding.ensureInitialized();
      final docketBytes = await DirectPrinterService.instance.buildOrderDocket(
        DirectPrintJob(
          jobRef: 'job-token-correction',
          requestType: 'reprint',
          config: const DirectPrinterConfig(host: '192.0.2.1', port: 9100),
          orderRef: 'C2-TOKEN',
          customerName: 'Nur Aina',
          customerIsEmployee: false,
          paymentMode: 'token',
          tokenAmountCharged: 20,
          voucherDiscountTokens: 5,
          giftCardTokenAmount: 2,
          priceCorrectionTokenAmount: 3,
          createdAt: DateTime.utc(2026, 11, 19, 3, 30),
          items: const [
            DirectPrintItem(
              name: 'Cafe Latte',
              quantity: 2,
              unitTokenValue: 15,
              lineTokenValue: 30,
            ),
          ],
        ),
      );
      final docketText = latin1.decode(docketBytes, allowInvalid: true);

      expect(docketText, contains('Subtotal: 30 C2 Credit tokens'));
      expect(docketText, contains('Voucher discount: -5 tokens'));
      expect(docketText, contains('Gift card: -2 tokens'));
      expect(docketText, contains('Price correction: -3 tokens'));
      expect(docketText, contains('Final total: 20 C2 Credit tokens'));
    },
  );

  test('parses a shift report returned after clock-out', () {
    final report = ShiftReportPrintSlip.fromJson(
      const DirectPrinterConfig(host: '192.168.1.50', port: 9100),
      {
        'attendance_id': 42,
        'barista_name': 'Aina',
        'clocked_in_at': '2026-11-16T01:00:00.000Z',
        'clocked_out_at': '2026-11-16T09:00:00.000Z',
        'order_count': 1,
        'gross_sales_rm': '10.40',
        'refunded_rm': '0.00',
        'net_sales_rm': '10.40',
        'orders': [
          {
            'order_ref': 'C2-TEST',
            'daily_order_number': 12,
            'status': 'collected',
            'payment_method': 'manual_counter',
            'final_total_rm': '10.40',
            'discount_total_rm': '2.60',
            'refunded_rm': '0.00',
            'created_at': '2026-11-16T03:00:00.000Z',
          },
        ],
        'items': [
          {'name': 'Latte', 'quantity': 1},
        ],
      },
    );

    expect(report.attendanceId, 42);
    expect(report.orders.single.discount, 2.60);
    expect(report.items.single.name, 'Latte');
    expect(report.netSales, 10.40);
  });

  test(
    'parses daily shift summary breakdown and formats readable audit labels',
    () async {
      TestWidgetsFlutterBinding.ensureInitialized();
      final report = ShiftReportPrintSlip.fromJson(
        const DirectPrinterConfig(host: '192.168.1.50', port: 9100),
        {
          'report_type': 'daily_summary',
          'attendance_id': 10,
          'barista_name': 'Harith',
          'clocked_in_at': '2026-11-16T00:00:00.000Z',
          'clocked_out_at': '2026-11-16T04:12:00.000Z',
          'order_count': 2,
          'total_items': 3,
          'gross_sales_rm': '62.22',
          'discount_total_rm': '0.38',
          'refunded_rm': '0.00',
          'net_sales_rm': '62.22',
          'counter_sales_rm': '43.80',
          'online_sales_rm': '0.00',
          'credit_sales_rm': '18.42',
          'total_tokens_charged': 18,
          'orders': [
            {
              'order_ref': 'C2-261116-4EGOOF',
              'daily_order_number': 1,
              'status': 'collected',
              'payment_mode': 'token',
              'payment_method': 'c2_credit',
              'final_total_rm': '18.42',
              'discount_total_rm': '0.38',
              'refunded_rm': '0.00',
              'token_amount_charged': 18,
              'created_at': '2026-11-16T00:23:00.000Z',
            },
            {
              'order_ref': 'C2-261116-SWBFG2',
              'daily_order_number': 7,
              'status': 'ready_for_pickup',
              'payment_mode': 'direct',
              'payment_method': 'manual_counter',
              'final_total_rm': '43.80',
              'discount_total_rm': '0.00',
              'refunded_rm': '0.00',
              'token_amount_charged': 0,
              'created_at': '2026-11-16T02:23:00.000Z',
            },
          ],
          'items': [
            {'name': 'Lamb Curry Puff', 'quantity': 2},
            {'name': 'Latte', 'quantity': 1},
          ],
        },
      );

      expect(report.reportType, 'daily_summary');
      expect(report.counterSales, 43.80);
      expect(report.creditSales, 18.42);
      expect(report.totalTokensCharged, 18);
      expect(report.totalItems, 3);
      expect(report.orders[0].formattedPaymentLabel, 'Credit');
      expect(report.orders[0].formattedStatusLabel, 'Collected');
      expect(report.orders[0].shortOrderRef, 'C2-4EGOOF');
      expect(report.orders[1].formattedPaymentLabel, 'Counter');
      expect(report.orders[1].formattedStatusLabel, 'Ready');

      final docketBytes = await DirectPrinterService.instance
          .buildShiftReportDocket(report);
      final docketText = latin1.decode(docketBytes, allowInvalid: true);
      expect(docketText, contains('DAILY SHIFT SUMMARY'));
      expect(docketText, contains('C2 Credit (Tokens)'));
      expect(docketText, contains('NET SALES'));
      expect(docketText, contains('C2-4EGOOF - Collected - Credit'));
      expect(docketText, contains('C2-SWBFG2 - Ready - Counter'));
      expect(docketText, isNot(contains('unpaid')));
      expect(docketText, isNot(contains('manual_counter')));
    },
  );
}
