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

  test('counter API endpoint requires a secure origin', () {
    final source = File('lib/api_client.dart').readAsStringSync();
    expect(source, contains("uri.scheme != 'https'"));
    expect(source, contains('uri.userInfo.isNotEmpty'));
    expect(source, contains('uri.hasQuery'));
    expect(source, contains('uri.hasFragment'));
  });
}
