import 'package:c2_coffee/services/notification_service.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('payment maintenance notice maps methods and popup preference safely', () {
    final notice = PaymentServiceNotice.fromApi({
      'id': 42,
      'title': 'Payment service maintenance',
      'message': 'Scheduled provider maintenance.',
      'payment_methods': ['fpx', 'duitnow_qr'],
      'starts_at': '2026-10-20T01:00:00.000Z',
      'ends_at': '2026-10-20T03:00:00.000Z',
      'is_popup_dismissed': false,
    });

    expect(notice.id, 42);
    expect(notice.paymentMethodLabel, 'Online Banking (FPX), DuitNow QR');
    expect(notice.endsAt.isAfter(notice.startsAt), isTrue);
    expect(notice.isPopupDismissed, isFalse);
  });
}
