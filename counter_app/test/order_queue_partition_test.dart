import 'package:counter_app/barista/order_queue_partition.dart';
import 'package:counter_app/barista/widgets/order_card.dart';
import 'package:flutter_test/flutter_test.dart';

CurrentOrder order(String id, OrderStatus status, DateTime createdAt) {
  return CurrentOrder(
    status: status,
    orderId: id,
    timeDate: '',
    orderDate: createdAt,
    customerDetails: '',
    items: const [],
  );
}

void main() {
  test('keeps only today new and preparing orders active', () {
    final now = DateTime(2026, 11, 5, 10);
    final result = partitionTodayOrders([
      order('new', OrderStatus.newOrder, DateTime(2026, 11, 5, 8)),
      order('preparing', OrderStatus.preparing, DateTime(2026, 11, 5, 9)),
      order('yesterday', OrderStatus.preparing, DateTime(2026, 11, 4, 23)),
    ], now: now);

    expect(result.active.map((item) => item.orderId), ['new', 'preparing']);
    expect(result.history, isEmpty);
  });

  test('moves today ready and collected orders into history', () {
    final now = DateTime(2026, 11, 5, 10);
    final result = partitionTodayOrders([
      order('ready', OrderStatus.readyForPickup, DateTime(2026, 11, 5, 8)),
      order('collected', OrderStatus.completed, DateTime(2026, 11, 5, 9)),
      order('old-ready', OrderStatus.readyForPickup, DateTime(2026, 11, 4, 9)),
    ], now: now);

    expect(result.active, isEmpty);
    expect(result.history.map((item) => item.orderId), ['ready', 'collected']);
  });
}
