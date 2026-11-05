import 'widgets/order_card.dart';

class OrderQueuePartition {
  const OrderQueuePartition({required this.active, required this.history});

  final List<CurrentOrder> active;
  final List<CurrentOrder> history;
}

OrderQueuePartition partitionTodayOrders(
  Iterable<CurrentOrder> orders, {
  DateTime? now,
}) {
  final localNow = (now ?? DateTime.now()).toLocal();
  final active = <CurrentOrder>[];
  final history = <CurrentOrder>[];

  for (final order in orders) {
    final localOrderDate = order.orderDate.toLocal();
    final isToday =
        localOrderDate.year == localNow.year &&
        localOrderDate.month == localNow.month &&
        localOrderDate.day == localNow.day;
    if (!isToday) continue;

    if (order.status == OrderStatus.newOrder ||
        order.status == OrderStatus.preparing) {
      active.add(order);
    } else {
      // A barista-finished order leaves the active queue immediately. It stays
      // in today's history while the customer-facing lifecycle can continue
      // from ready_for_pickup to collected independently.
      history.add(order);
    }
  }

  return OrderQueuePartition(active: active, history: history);
}
