import 'package:flutter/material.dart';
import 'package:counter_app/widgets/top_notice.dart';
import '../main.dart';
import '../widgets/order_card.dart';
import '../widgets/barista_page_header.dart';
import '../widgets/barista_card.dart';
import 'order_details_page.dart';
import '../services/api_service.dart';
import '../order_queue_partition.dart';

class CurrentOrderPage extends StatefulWidget {
  final VoidCallback? onSettingsTap;

  const CurrentOrderPage({super.key, this.onSettingsTap});

  @override
  State<CurrentOrderPage> createState() => _CurrentOrderPageState();
}

class _CurrentOrderPageState extends State<CurrentOrderPage> {
  final Color darkGreen = const Color(0xFF304A3A);
  final Set<String> _updatingOrderIds = <String>{};
  final Set<String> _printingOrderIds = <String>{};

  Future<void> _refreshOrders() async {
    final result = await ApiService.fetchOrders();
    if (!result.isSuccess) {
      globalOrderSyncError.value = result.errorMessage;
      return;
    }

    final partition = partitionTodayOrders(result.orders);
    globalCurrentOrders.value = partition.active;
    globalHistoryOrders.value = partition.history;
    globalOrderSyncError.value = null;
    globalLastOrderSync.value = DateTime.now();
  }

  Future<void> _startPreparing(CurrentOrder order) async {
    if (_updatingOrderIds.contains(order.orderId)) return;
    setState(() => _updatingOrderIds.add(order.orderId));

    final result = await ApiService.updateOrderStatus(
      order.orderId,
      'preparing',
    );
    if (!mounted) return;

    setState(() => _updatingOrderIds.remove(order.orderId));
    if (!result.isSuccess) {
      TopNotice.error(context, result.errorMessage!);
      return;
    }

    order.status = OrderStatus.preparing;
    globalCurrentOrders.value = List<CurrentOrder>.from(
      globalCurrentOrders.value,
    );
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

  void _openOrderDetails(CurrentOrder order) {
    Navigator.push(
      context,
      PageRouteBuilder(
        pageBuilder: (context, animation, secondaryAnimation) =>
            OrderDetailsPage(
              orderId: order.orderId,
              customerDetails: order.customerDetails,
              items: order.items,
              onSettingsTap: widget.onSettingsTap,
            ),
        transitionsBuilder: (context, animation, secondaryAnimation, child) {
          const begin = Offset(1.0, 0.0);
          const end = Offset.zero;
          final tween = Tween(
            begin: begin,
            end: end,
          ).chain(CurveTween(curve: Curves.easeOutCubic));
          return SlideTransition(
            position: animation.drive(tween),
            child: child,
          );
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<List<CurrentOrder>>(
      valueListenable: globalCurrentOrders,
      builder: (context, allOrders, _) {
        final filteredOrders = allOrders.toList();

        return Scaffold(
          backgroundColor: Colors.white,
          body: Stack(
            children: [
              Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 1120),
                  child: Container(
                    color: Colors.white,
                    child: RefreshIndicator(
                      color: darkGreen,
                      onRefresh: _refreshOrders,
                      child: ListView(
                        padding: const EdgeInsets.fromLTRB(24, 24, 24, 36),
                        children: [
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              BaristaPageHeader(
                                title: 'Current Order',
                                subtitle:
                                    'Live order queue for preparation and customer pickup.',
                                onRefresh: _refreshOrders,
                                refreshTooltip: 'Refresh orders',
                                bottom: Row(
                                  children: [
                                    Container(
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
                                        '${allOrders.length} active orders',
                                        style: const TextStyle(
                                          color: Color(0xFF203E32),
                                          fontSize: 13,
                                          fontWeight: FontWeight.w700,
                                        ),
                                      ),
                                    ),
                                    const SizedBox(width: 10),
                                    ValueListenableBuilder<DateTime?>(
                                      valueListenable: globalLastOrderSync,
                                      builder: (context, lastSync, _) {
                                        if (lastSync == null) {
                                          return const SizedBox.shrink();
                                        }
                                        final hour = lastSync.hour
                                            .remainder(12)
                                            .toString()
                                            .padLeft(2, '0');
                                        final minute = lastSync.minute
                                            .toString()
                                            .padLeft(2, '0');
                                        final suffix = lastSync.hour >= 12
                                            ? 'PM'
                                            : 'AM';
                                        return Text(
                                          'Updated $hour:$minute $suffix',
                                          style: TextStyle(
                                            color: const Color(
                                              0xFF203E32,
                                            ).withValues(alpha: 0.62),
                                            fontSize: 13,
                                            fontWeight: FontWeight.w600,
                                          ),
                                        );
                                      },
                                    ),
                                  ],
                                ),
                              ),
                              const SizedBox(height: 22.0),
                              ValueListenableBuilder<String?>(
                                valueListenable: globalOrderSyncError,
                                builder: (context, syncError, _) {
                                  if (syncError == null) {
                                    return const SizedBox.shrink();
                                  }
                                  return Container(
                                    margin: const EdgeInsets.only(bottom: 16),
                                    padding: const EdgeInsets.all(12),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFFFFF4E5),
                                      borderRadius: BorderRadius.circular(12),
                                      border: Border.all(
                                        color: const Color(0xFFD3B17D),
                                      ),
                                    ),
                                    child: Row(
                                      children: [
                                        const Icon(
                                          Icons.cloud_off_outlined,
                                          color: Color(0xFF8A5A13),
                                        ),
                                        const SizedBox(width: 10),
                                        Expanded(
                                          child: Text(
                                            '$syncError Showing the last successful queue.',
                                          ),
                                        ),
                                        TextButton(
                                          onPressed: _refreshOrders,
                                          child: const Text('Retry'),
                                        ),
                                      ],
                                    ),
                                  );
                                },
                              ),
                              const BaristaSectionLabel(label: 'LIVE QUEUE'),
                              const SizedBox(height: 12),
                              if (filteredOrders.isEmpty)
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
                                          Icons.shopping_basket_outlined,
                                          size: 48,
                                          color: const Color(
                                            0xFF203E32,
                                          ).withValues(alpha: 0.25),
                                        ),
                                        const SizedBox(height: 14),
                                        const Text(
                                          'No orders found.',
                                          style: TextStyle(
                                            color: Color(0xFF203E32),
                                            fontSize: 16,
                                            fontWeight: FontWeight.w700,
                                          ),
                                        ),
                                        const SizedBox(height: 6),
                                        Text(
                                          'New incoming orders will appear here automatically.',
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
                                  ...filteredOrders.map((order) {
                                    return OrderCard(
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
                                      isActionLoading: _updatingOrderIds
                                          .contains(order.orderId),
                                      isPrintLoading: _printingOrderIds
                                          .contains(order.orderId),
                                      onPrintPressed: () =>
                                          _printReceipt(order),
                                      onActionPressed: () {
                                        if (order.status ==
                                                OrderStatus.newOrder &&
                                            order.cancellationRequestStatus ==
                                                null) {
                                          _startPreparing(order);
                                        } else {
                                          _openOrderDetails(order);
                                        }
                                      },
                                      onTap: () => _openOrderDetails(order),
                                    );
                                  }),
                              ],
                            ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
