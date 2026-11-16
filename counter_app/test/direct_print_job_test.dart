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
}
