import 'package:c2_coffee/services/payment_security.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('accepts only HTTPS CHIP checkout hosts', () {
    expect(isTrustedPaymentCheckoutUrl('https://gate.chip-in.asia/p/abc'),
        isTrue);
    expect(
        isTrustedPaymentCheckoutUrl('https://checkout.chip-in.asia/p/abc'),
        isTrue);
    expect(isTrustedPaymentCheckoutUrl('http://gate.chip-in.asia/p/abc'),
        isFalse);
    expect(
        isTrustedPaymentCheckoutUrl('https://chip-in.asia.evil.test/p/abc'),
        isFalse);
    expect(
        isTrustedPaymentCheckoutUrl(
            'https://user:pass@gate.chip-in.asia/p/abc'),
        isFalse);
  });
}
