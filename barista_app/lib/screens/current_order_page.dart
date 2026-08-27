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
                  onRefresh: () async {
                    try {
                      final fetchedOrders = await ApiService.fetchOrders();
                      if (fetchedOrders.isNotEmpty) {
                        globalCurrentOrders.value = fetchedOrders
                            .where((o) => o.status != OrderStatus.completed && o.status != OrderStatus.readyForPickup)
                            .toList();
                        globalHistoryOrders.value = fetchedOrders
                            .where((o) => o.status == OrderStatus.completed)
                            .toList();
                      }
                    } catch (e) {
                      debugPrint('Failed to fetch orders: $e');
                    }
                  },
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
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
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
                                    ],
                                  ),
                                ),
                                ActiveBaristaProfile(
                                  onTap: widget.onSettingsTap,
                                ),
                              ],
                            ),
                            const SizedBox(height: 24.0),






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
                                  items: order.items,
                                  onActionPressed: () {
                                    Navigator.push(
                                      context,
                                      PageRouteBuilder(
                                        pageBuilder:
                                            (
                                              context,
                                              animation,
                                              secondaryAnimation,
                                            ) => OrderDetailsPage(
                                              orderId: order.orderId,
                                              customerDetails:
                                                  order.customerDetails,
                                              items: order.items,
                                              onSettingsTap:
                                                  widget.onSettingsTap,
                                            ),
                                        transitionsBuilder:
                                            (
                                              context,
                                              animation,
                                              secondaryAnimation,
                                              child,
                                            ) {
                                              const begin = Offset(1.0, 0.0);
                                              const end = Offset.zero;
                                              const curve = Curves.easeOutCubic;
                                              var tween = Tween(
                                                begin: begin,
                                                end: end,
                                              ).chain(CurveTween(curve: curve));
                                              return SlideTransition(
                                                position: animation.drive(
                                                  tween,
                                                ),
                                                child: child,
                                              );
                                            },
                                      ),
                                    );
                                  },
                                  onTap: () {
                                    Navigator.push(
                                      context,
                                      PageRouteBuilder(
                                        pageBuilder:
                                            (
                                              context,
                                              animation,
                                              secondaryAnimation,
                                            ) => OrderDetailsPage(
                                              orderId: order.orderId,
                                              customerDetails:
                                                  order.customerDetails,
                                              items: order.items,
                                              onSettingsTap:
                                                  widget.onSettingsTap,
                                            ),
                                        transitionsBuilder:
                                            (
                                              context,
                                              animation,
                                              secondaryAnimation,
                                              child,
                                            ) {
                                              const begin = Offset(1.0, 0.0);
                                              const end = Offset.zero;
                                              const curve = Curves.easeOutCubic;
                                              var tween = Tween(
                                                begin: begin,
                                                end: end,
                                              ).chain(CurveTween(curve: curve));
                                              return SlideTransition(
                                                position: animation.drive(
                                                  tween,
                                                ),
                                                child: child,
                                              );
                                            },
                                      ),
                                    );
                                  },
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
                          Image.asset(
                            'assets/images/c2_logo.png',
                            height: 40,
                          ),
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
