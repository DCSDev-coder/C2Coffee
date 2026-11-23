import 'package:counter_app/barista/services/api_service.dart';
import 'package:counter_app/barista/widgets/order_card.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('normalizes formatted API order and payment statuses', () {
    expect(normalizeApiStatus('Pending Payment'), 'pending_payment');
    expect(normalizeApiStatus('pending_payment'), 'pending_payment');
    expect(normalizeApiStatus('Ready For Pickup'), 'ready_for_pickup');
    expect(normalizeApiStatus('Pending'), 'pending');
  });

  test('keeps Admin Web intake statuses visible in the Counter queue', () {
    expect(parseBaristaOrderStatus('new'), OrderStatus.newOrder);
    expect(parseBaristaOrderStatus('Order Received'), OrderStatus.newOrder);
    expect(parseBaristaOrderStatus('order_received'), OrderStatus.newOrder);
    expect(parseBaristaOrderStatus('paid'), OrderStatus.newOrder);
  });
}
