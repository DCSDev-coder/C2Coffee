import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

void main() {
  test('incoming order sound and receipt print start from the same claimed job', () {
    final source = File('lib/device_printer_worker.dart').readAsStringSync();
    expect(source, contains('BaristaSoundEvent.incomingOrder'));
    expect(source, contains('Future.wait<void>'));
    expect(source, contains('DirectPrinterService.instance.printJob(job)'));
    expect(source.indexOf('Future.wait<void>'), lessThan(source.indexOf("printed: true")));
  });
}
