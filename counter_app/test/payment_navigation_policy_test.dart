import 'package:counter_app/payment_navigation_policy.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('allows CHIP and explicitly configured payment hosts', () {
    expect(
      isTrustedPaymentWebViewUri(Uri.parse('https://gate.chip-in.asia/pay')),
      isTrue,
    );
    expect(
      isTrustedPaymentWebViewUri(
        Uri.parse('https://secure.bank.example/pay'),
        configuredHosts: 'bank.example',
      ),
      isTrue,
    );
  });

  test('blocks insecure, lookalike, credential-bearing, and arbitrary hosts', () {
    for (final value in [
      'http://gate.chip-in.asia/pay',
      'https://chip-in.asia.example.com/pay',
      'https://user:password@gate.chip-in.asia/pay',
      'https://example.com/pay',
    ]) {
      expect(isTrustedPaymentWebViewUri(Uri.parse(value)), isFalse);
    }
  });

  test('ignores malformed configured hosts', () {
    expect(
      trustedPaymentHosts(configuredHosts: 'https://bank.example,*.example'),
      {'chip-in.asia'},
    );
  });
}
