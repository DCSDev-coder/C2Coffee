import 'package:flutter/material.dart';
import '../main.dart';
import '../widgets/order_card.dart';
import '../widgets/active_barista_profile.dart';
import 'order_details_page.dart';
import '../services/api_service.dart';
import '../widgets/blinking_online_indicator.dart';

class CurrentOrderPage extends StatefulWidget {
  final VoidCallback? onSettingsTap;

  const CurrentOrderPage({super.key, this.onSettingsTap});

  @override
  State<CurrentOrderPage> createState() => _CurrentOrderPageState();
}

class _CurrentOrderPageState extends State<CurrentOrderPage> {
  final Color darkGreen = const Color(0xFF304A3A);
  final Color beigeColor = const Color(0xFFD3B17D);
  final Set<String> _updatingOrderIds = <String>{};

  Future<void> _refreshOrders() async {
    final result = await ApiService.fetchOrders();
    if (!result.isSuccess) {
      globalOrderSyncError.value = result.errorMessage;
      return;
    }

    final orders = result.orders;
    globalCurrentOrders.value = orders
        .where(
          (order) =>
              order.status != OrderStatus.completed &&
              order.status != OrderStatus.readyForPickup,
        )
        .toList();
    globalHistoryOrders.value = orders
        .where((order) => order.status == OrderStatus.completed)
        .toList();
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
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(result.errorMessage!)));
      return;
    }

    order.status = OrderStatus.preparing;
    order.baristaName = ApiService.activeBaristaName;
    globalCurrentOrders.value = List<CurrentOrder>.from(
      globalCurrentOrders.value,
    );
  }

  void _openOrderDetails(CurrentOrder order) {
    Navigator.push(
      context,
      PageRouteBuilder(
        pageBuilder: (context, animation, secondaryAnimation) =>
            OrderDetailsPage(
              orderId: order.orderId,
              customerDetails: order.customerDetails,
              baristaName: order.baristaName,
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
                  constraints: const BoxConstraints(maxWidth: 800),
                  child: RefreshIndicator(
                    color: darkGreen,
                    onRefresh: _refreshOrders,
                    child: ListView(
                      padding: const EdgeInsets.only(
                        top: 100,
                        bottom: 180,
                      ), // padding to scroll past the header and floating bottom bar
                      children: [
                        // Content
                        Padding(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 24.0,
                            vertical: 16.0,
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              // Title & Active Barista Profile
                              Row(
                                crossAxisAlignment: CrossAxisAlignment.center,
                                mainAxisAlignment:
                                    MainAxisAlignment.spaceBetween,
                                children: [
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          'Current Order',
                                          style: TextStyle(
                                            color: darkGreen,
                                            fontSize: 32,
                                            fontWeight: FontWeight.bold,
                                          ),
                                        ),
                                        Text(
                                          '${allOrders.length} active orders',
                                          style: TextStyle(
                                            color: beigeColor,
                                            fontSize: 16,
                                            fontWeight: FontWeight.bold,
                                          ),
                                        ),
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
                                                color: darkGreen.withValues(
                                                  alpha: 0.62,
                                                ),
                                                fontSize: 12,
                                                fontWeight: FontWeight.w600,
                                              ),
                                            );
                                          },
                                        ),
                                      ],
                                    ),
                                  ),
                                  ActiveBaristaProfile(
                                    onTap: widget.onSettingsTap,
                                  ),
                                ],
                              ),
                              const SizedBox(height: 24.0),
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

                              if (filteredOrders.isEmpty)
                                Center(
                                  child: Padding(
                                    padding: const EdgeInsets.all(32.0),
                                    child: Column(
                                      children: [
                                        Icon(
                                          Icons.search_off,
                                          size: 48,
                                          color: Colors.grey.shade300,
                                        ),
                                        const SizedBox(height: 16),
                                        Text(
                                          'No orders found.',
                                          style: TextStyle(
                                            color: Colors.grey.shade500,
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
                                    baristaName: order.baristaName,
                                    items: order.items,
                                    isActionLoading: _updatingOrderIds.contains(
                                      order.orderId,
                                    ),
                                    onActionPressed: () {
                                      if (order.status ==
                                          OrderStatus.newOrder) {
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
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              // Dark Green Top Header (Fixed)
              Positioned(
                top: 0,
                left: 0,
                right: 0,
                child: Container(
                  height: 110,
                  padding: const EdgeInsets.only(top: 40, left: 24, right: 24),
                  decoration: BoxDecoration(
                    color: darkGreen,
                    borderRadius: const BorderRadius.only(
                      bottomLeft: Radius.circular(16.0),
                      bottomRight: Radius.circular(16.0),
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.1),
                        blurRadius: 10,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      Row(
                        children: [
                          Image.asset('assets/images/c2_logo.png', height: 40),
                        ],
                      ),
                      const BlinkingOnlineIndicator(),
                    ],
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
