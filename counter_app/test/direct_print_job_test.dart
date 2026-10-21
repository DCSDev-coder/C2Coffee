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
  test('adds an employee label to an employee receipt name', () {
    expect(
      job(name: 'Aina', employee: true).printedCustomerName,
      'Aina (Employee)',
    );
  });

  test('keeps a regular customer receipt name unchanged', () {
    expect(job(name: 'Amirul', employee: false).printedCustomerName, 'Amirul');
  });
}
