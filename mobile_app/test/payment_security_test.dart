import 'package:c2_coffee/services/payment_security.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('accepts only HTTPS Billplz checkout hosts', () {
    expect(isTrustedPaymentCheckoutUrl('https://www.billplz.com/bills/abc'),
        isTrue);
    expect(
        isTrustedPaymentCheckoutUrl(
            'https://www.billplz-sandbox.com/bills/abc'),
        isTrue);
    expect(isTrustedPaymentCheckoutUrl('http://www.billplz.com/bills/abc'),
        isFalse);
    expect(
        isTrustedPaymentCheckoutUrl('https://billplz.com.evil.test/bills/abc'),
        isFalse);
    expect(
        isTrustedPaymentCheckoutUrl(
            'https://user:pass@www.billplz.com/bills/abc'),
        isFalse);
  });
}
