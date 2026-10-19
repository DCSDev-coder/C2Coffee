import 'package:c2_coffee/services/catalog_api_service.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('store can remain open after mobile ordering cutoff', () {
    final store = StoreSummary.fromApi({
      'id': 3,
      'code': 'ECO',
      'name': 'C2 Coffee Eco Forest',
      'supports_pickup': true,
      'pickup_lead_minutes': 10,
      'status': 'active',
      'is_open_now': true,
      'accepts_mobile_orders_now': false,
      'mobile_ordering_status': 'closed',
      'mobile_order_cutoff_at': null,
    });

    expect(store.isOpenNow, isTrue);
    expect(store.acceptsMobileOrdersNow, isFalse);
    expect(store.mobileOrderingStatus, 'closed');
  });

  test('closing-soon response includes the server cutoff deadline', () {
    final store = StoreSummary.fromApi({
      'id': 3,
      'code': 'ECO',
      'name': 'C2 Coffee Eco Forest',
      'supports_pickup': true,
      'pickup_lead_minutes': 10,
      'status': 'active',
      'is_open_now': true,
      'accepts_mobile_orders_now': true,
      'mobile_ordering_status': 'closing_soon',
      'mobile_order_cutoff_at': '2026-10-19T13:50:00.000Z',
    });

    expect(store.mobileOrderingStatus, 'closing_soon');
    expect(store.mobileOrderCutoffAt, isNotNull);
  });

  test('older API responses fall back to the outlet open state', () {
    final store = StoreSummary.fromApi({
      'id': 3,
      'code': 'ECO',
      'name': 'C2 Coffee Eco Forest',
      'supports_pickup': true,
      'pickup_lead_minutes': 10,
      'status': 'active',
      'is_open_now': false,
    });

    expect(store.acceptsMobileOrdersNow, isFalse);
  });
}
