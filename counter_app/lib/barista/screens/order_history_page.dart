import 'package:counter_app/widgets/top_notice.dart';
import 'package:flutter/material.dart';

import '../main.dart';
import '../services/api_service.dart';
import '../widgets/order_card.dart';
import '../widgets/barista_page_header.dart';
import '../widgets/barista_card.dart';
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
              constraints: const BoxConstraints(maxWidth: 1120),
              child: Container(
                color: Colors.white,
                child: RefreshIndicator(
                  color: _darkGreen,
                  onRefresh: _refreshOrders,
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(24, 24, 24, 36),
                    children: [
                      BaristaPageHeader(
                        title: 'Order History',
                        subtitle:
                            "Completed and finished orders for today's shift.",
                        onRefresh: _refreshOrders,
                        refreshTooltip: 'Refresh history',
                        bottom: Align(
                          alignment: Alignment.centerLeft,
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 10,
                              vertical: 4,
                            ),
                            decoration: BoxDecoration(
                              color: const Color(
                                0xFF203E32,
                              ).withValues(alpha: 0.08),
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(
                                color: const Color(
                                  0xFF203E32,
                                ).withValues(alpha: 0.12),
                              ),
                            ),
                            child: Text(
                              '${newestFirst.length} finished orders today',
                              style: const TextStyle(
                                color: Color(0xFF203E32),
                                fontSize: 13,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 22),
                      const BaristaSectionLabel(
                        label: "TODAY'S FINISHED ORDERS",
                      ),
                      const SizedBox(height: 12),
                      if (newestFirst.isEmpty)
                        BaristaCard(
                          padding: const EdgeInsets.symmetric(
                            vertical: 48,
                            horizontal: 24,
                          ),
                          child: Center(
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(
                                  Icons.history_rounded,
                                  size: 48,
                                  color: const Color(
                                    0xFF203E32,
                                  ).withValues(alpha: 0.25),
                                ),
                                const SizedBox(height: 14),
                                const Text(
                                  'No finished orders yet today.',
                                  style: TextStyle(
                                    color: Color(0xFF203E32),
                                    fontSize: 16,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                                const SizedBox(height: 6),
                                Text(
                                  'Orders marked completed will appear in this history log.',
                                  style: TextStyle(
                                    color: const Color(
                                      0xFF203E32,
                                    ).withValues(alpha: 0.6),
                                    fontSize: 14,
                                  ),
                                ),
                              ],
                            ),
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
                            voucherName: order.voucherName,
                            voucherType: order.voucherType,
                            discount: order.discount,
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
          ),
        );
      },
    );
  }
}
