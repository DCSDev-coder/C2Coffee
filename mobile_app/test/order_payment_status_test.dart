import 'package:c2_coffee/services/customer_data_service.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('OrderPaymentStatus', () {
    test('parses the additive normalized payment contract', () {
      final status = OrderPaymentStatus.fromApi({
        'status': 'pending_execute',
        'normalized_state': 'payment_processing',
        'checkout_url': 'https://gate.chip-in.asia/p/test',
        'payment_method': 'fpx',
        'expires_at': '2026-11-20T08:00:00.000Z',
        'can_continue': false,
        'can_change_method': true,
        'can_cancel': false,
        'enabled_methods': ['fpx', 'ewallet'],
        'method_descriptions': {
          'ewallet': 'ShopeePay and supported wallets',
        },
      });

      expect(status.state, OrderPaymentState.processing);
      expect(status.canContinue, isFalse);
      expect(status.canChangeMethod, isTrue);
      expect(status.canCancel, isFalse);
      expect(status.enabledMethods, ['fpx', 'ewallet']);
      expect(
        status.methodDescriptions['ewallet'],
        'ShopeePay and supported wallets',
      );
    });

    test('preserves compatibility with the legacy response', () {
      final status = OrderPaymentStatus.fromApi({
        'status': 'pending',
        'checkout_url': 'https://gate.chip-in.asia/p/test',
        'payment_method': 'duitnow_qr',
        'amount_rm': '12.90',
        'expires_at': '2026-11-20T08:00:00.000Z',
      });

      expect(status.state, OrderPaymentState.active);
      expect(status.canContinue, isTrue);
      expect(status.paymentMethod, 'duitnow_qr');
      expect(status.enabledMethods, isEmpty);
    });

    test('maps provider and normalized states to specific customer messages',
        () {
      expect(
        orderPaymentCustomerMessage(OrderPaymentState.processing),
        contains('still confirming'),
      );
      expect(
        orderPaymentCustomerMessage(OrderPaymentState.expired),
        contains('expired'),
      );
      expect(
        orderPaymentCustomerMessage(
          OrderPaymentState.providerTemporarilyUnavailable,
        ),
        contains('temporarily unavailable'),
      );
    });
  });
}
