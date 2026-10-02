import 'package:counter_app/session_manager.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('member sessions expose only voucher maps from the API payload', () {
    final session = CustomerSession(
      phone: '+60123456789',
      sessionToken: 'customer-session',
      deviceToken: 'device-token',
      customerSummary: {
        'display_name': 'Test Member',
        'active_vouchers': [
          {
            'id': 42,
            'name': 'RM 5 Off',
            'discount_mode': 'fixed_rm',
            'discount_value': '5.00',
          },
          'invalid-entry',
        ],
      },
    );

    expect(session.isGuest, isFalse);
    expect(session.activeVouchers, hasLength(1));
    expect(session.activeVouchers.single['id'], 42);
  });

  test('guest sessions cannot expose member vouchers', () {
    final session = CustomerSession(
      phone: 'Guest',
      sessionToken: '',
      deviceToken: '',
      customerSummary: const {},
    );

    expect(session.isGuest, isTrue);
    expect(session.activeVouchers, isEmpty);
  });
}
