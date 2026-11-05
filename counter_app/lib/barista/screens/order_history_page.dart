import 'package:counter_app/widgets/top_notice.dart';
import 'package:flutter/material.dart';

import '../main.dart';
import '../services/api_service.dart';
import '../widgets/order_card.dart';
import 'order_details_page.dart';
import '../order_queue_partition.dart';

class OrderHistoryPage extends StatefulWidget {
  const OrderHistoryPage({super.key, this.onSettingsTap});

  final VoidCallback? onSettingsTap;

  @override
  State<OrderHistoryPage> createState() => _OrderHistoryPageState();
}

class _OrderHistoryPageState extends State<OrderHistoryPage> {
  static const _darkGreen = Color(0xFF304A3A);
  static const _beige = Color(0xFFD3B17D);
  final Set<String> _printingOrderIds = <String>{};

  Future<void> _refreshOrders() async {
    final result = await ApiService.fetchOrders();
    if (!result.isSuccess) {
      globalOrderSyncError.value = result.errorMessage;
      if (mounted) TopNotice.error(context, result.errorMessage!);
      return;
    }
    final partition = partitionTodayOrders(result.orders);
    globalCurrentOrders.value = partition.active;
    globalHistoryOrders.value = partition.history;
    globalOrderSyncError.value = null;
    globalLastOrderSync.value = DateTime.now();
  }

  Future<void> _printReceipt(CurrentOrder order) async {
    if (_printingOrderIds.contains(order.orderId)) return;
    setState(() => _printingOrderIds.add(order.orderId));
    final result = await ApiService.queueReceiptReprint(order.orderId);
    if (!mounted) return;
    setState(() => _printingOrderIds.remove(order.orderId));
    if (!result.isSuccess) {
      TopNotice.error(context, result.errorMessage!);
      return;
    }
    TopNotice.info(context, 'Receipt queued for printing.');
  }

  void _openOrder(CurrentOrder order) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => OrderDetailsPage(
          orderId: order.orderId,
          customerDetails: order.customerDetails,
          items: order.items,
          isHistory: true,
          onSettingsTap: widget.onSettingsTap,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<List<CurrentOrder>>(
      valueListenable: globalHistoryOrders,
      builder: (context, orders, _) {
        final newestFirst = orders.reversed.toList();
        return Scaffold(
          backgroundColor: Colors.white,
          body: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 800),
              child: RefreshIndicator(
                color: _darkGreen,
                onRefresh: _refreshOrders,
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(24, 32, 24, 36),
                  children: [
                    const Text(
                      "Today's Order History",
                      style: TextStyle(
                        color: _darkGreen,
                        fontSize: 32,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    Text(
                      '${newestFirst.length} finished orders today',
                      style: const TextStyle(
                        color: _beige,
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 24),
                    if (newestFirst.isEmpty)
                      const Padding(
                        padding: EdgeInsets.symmetric(vertical: 72),
                        child: Column(
                          children: [
                            Icon(
                              Icons.history_rounded,
                              size: 52,
                              color: Color(0xFFBDBDBD),
                            ),
                            SizedBox(height: 16),
                            Text(
                              'No finished orders yet today.',
                              style: TextStyle(color: Color(0xFF757575)),
                            ),
                          ],
                        ),
                      )
                    else
                      ...newestFirst.map(
                        (order) => OrderCard(
                          timeDate: order.timeDate,
                          status: order.status,
                          orderId: order.orderId,
                          customerDetails: order.customerDetails,
                          items: order.items,
                          cancellationRequestStatus:
                              order.cancellationRequestStatus,
                          isPrintLoading: _printingOrderIds.contains(
                            order.orderId,
                          ),
                          onPrintPressed: () => _printReceipt(order),
                          onTap: () => _openOrder(order),
                        ),
                      ),
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}
