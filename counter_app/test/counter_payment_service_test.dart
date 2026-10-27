import 'package:counter_app/counter_payment_service.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  final service = CounterPaymentService();

  test('accepts only CHIP HTTPS checkout links', () {
    final uri = service.checkoutUri(
      'https://gate.chip-in.asia/p/secure-checkout',
    );
    expect(uri.scheme, 'https');
    expect(uri.host, 'gate.chip-in.asia');
  });

  test('rejects lookalike and insecure checkout links', () {
    expect(
      () => service.checkoutUri('https://chip-in.asia.example.com/payment'),
      throwsA(isA<CounterPaymentException>()),
    );
    expect(
      () => service.checkoutUri('http://chip-in.asia/payment'),
      throwsA(isA<CounterPaymentException>()),
    );
  });
}
