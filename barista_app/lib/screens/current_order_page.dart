import 'package:flutter/material.dart';
import '../main.dart';
import '../widgets/order_card.dart';
import '../widgets/active_barista_profile.dart';
import '../widgets/daily_orders_card.dart';
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

  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = '';
  int _selectedTab = 0;

  @override
  void initState() {
    super.initState();
    _searchController.addListener(() {
      setState(() {
        _searchQuery = _searchController.text.toLowerCase();
      });
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<List<CurrentOrder>>(
      valueListenable: globalCurrentOrders,
      builder: (context, allOrders, _) {
        final int inProgressCount = allOrders
            .where(
              (o) =>
                  o.status == OrderStatus.newOrder ||
                  o.status == OrderStatus.preparing,
            )
            .length;
        final int readyCount = allOrders
            .where((o) => o.status == OrderStatus.readyForPickup)
            .length;

        final filteredOrders = allOrders
            .where((order) {
              if (_searchQuery.isEmpty) return true;
              return order.orderId.toLowerCase().contains(_searchQuery) ||
                  order.customerDetails.toLowerCase().contains(_searchQuery);
            })
            .where((order) {
              if (_selectedTab == 0) {
                return order.status == OrderStatus.newOrder ||
                    order.status == OrderStatus.preparing;
              } else {
                return order.status == OrderStatus.readyForPickup;
              }
            })
            .toList();

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
                            .where((o) => o.status != OrderStatus.completed)
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
                                        _selectedTab == 0
                                            ? '$inProgressCount active orders in queue'
                                            : '$readyCount ready for pickup',
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

                            // Animated Daily Orders Card
                            ValueListenableBuilder<List<CurrentOrder>>(
                              valueListenable: globalHistoryOrders,
                              builder: (context, historyOrders, _) {
                                // Calculate completed orders for today
                                final today = DateTime.now();
                                final todayCompletedCount = historyOrders.where((order) {
                                  return order.status == OrderStatus.completed &&
                                      order.orderDate.year == today.year &&
                                      order.orderDate.month == today.month &&
                                      order.orderDate.day == today.day;
                                }).length;
                                return DailyOrdersCard(ordersCompleted: todayCompletedCount);
                              },
                            ),
                            const SizedBox(height: 24.0),

                            // Search Bar
                            TextField(
                              controller: _searchController,
                              decoration: InputDecoration(
                                hintText: 'Search by order ID or Username...',
                                hintStyle: const TextStyle(
                                  color: Colors.grey,
                                  fontSize: 14,
                                ),
                                prefixIcon: Icon(
                                  Icons.search,
                                  color: darkGreen,
                                ),
                                contentPadding: const EdgeInsets.symmetric(
                                  vertical: 12.0,
                                ),
                                border: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(30.0),
                                  borderSide: BorderSide(
                                    color: darkGreen,
                                    width: 1.5,
                                  ),
                                ),
                                enabledBorder: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(30.0),
                                  borderSide: BorderSide(
                                    color: darkGreen,
                                    width: 1.5,
                                  ),
                                ),
                                focusedBorder: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(30.0),
                                  borderSide: BorderSide(
                                    color: darkGreen,
                                    width: 2.0,
                                  ),
                                ),
                              ),
                            ),
                            const SizedBox(height: 16.0),

                            // Tabs
                            Container(
                              padding: const EdgeInsets.all(4.0),
                              decoration: BoxDecoration(
                                color: Colors.grey.shade200,
                                borderRadius: BorderRadius.circular(30.0),
                              ),
                              child: Row(
                                children: [
                                  Expanded(
                                    child: GestureDetector(
                                      onTap: () =>
                                          setState(() => _selectedTab = 0),
                                      child: Container(
                                        padding: const EdgeInsets.symmetric(
                                          vertical: 12.0,
                                        ),
                                        decoration: BoxDecoration(
                                          color: _selectedTab == 0
                                              ? Colors.white
                                              : Colors.transparent,
                                          borderRadius: BorderRadius.circular(
                                            26.0,
                                          ),
                                          boxShadow: _selectedTab == 0
                                              ? [
                                                  BoxShadow(
                                                    color: Colors.black
                                                        .withOpacity(0.05),
                                                    blurRadius: 4,
                                                    offset: const Offset(0, 2),
                                                  ),
                                                ]
                                              : null,
                                        ),
                                        child: Center(
                                          child: Text(
                                            'In Progress',
                                            style: TextStyle(
                                              color: _selectedTab == 0
                                                  ? darkGreen
                                                  : Colors.grey,
                                              fontWeight: FontWeight.bold,
                                            ),
                                          ),
                                        ),
                                      ),
                                    ),
                                  ),
                                  Expanded(
                                    child: GestureDetector(
                                      onTap: () =>
                                          setState(() => _selectedTab = 1),
                                      child: Container(
                                        padding: const EdgeInsets.symmetric(
                                          vertical: 12.0,
                                        ),
                                        decoration: BoxDecoration(
                                          color: _selectedTab == 1
                                              ? Colors.white
                                              : Colors.transparent,
                                          borderRadius: BorderRadius.circular(
                                            26.0,
                                          ),
                                          boxShadow: _selectedTab == 1
                                              ? [
                                                  BoxShadow(
                                                    color: Colors.black
                                                        .withOpacity(0.05),
                                                    blurRadius: 4,
                                                    offset: const Offset(0, 2),
                                                  ),
                                                ]
                                              : null,
                                        ),
                                        child: Center(
                                          child: Row(
                                            mainAxisAlignment:
                                                MainAxisAlignment.center,
                                            children: [
                                              Text(
                                                'Ready for Pickup',
                                                style: TextStyle(
                                                  color: _selectedTab == 1
                                                      ? darkGreen
                                                      : Colors.grey,
                                                  fontWeight: FontWeight.bold,
                                                ),
                                              ),
                                              if (readyCount > 0) ...[
                                                const SizedBox(width: 6),
                                                Container(
                                                  padding: const EdgeInsets.all(
                                                    4,
                                                  ),
                                                  decoration:
                                                      const BoxDecoration(
                                                        color: Color(
                                                          0xFFDF7E65,
                                                        ),
                                                        shape: BoxShape.circle,
                                                      ),
                                                  child: Text(
                                                    '$readyCount',
                                                    style: const TextStyle(
                                                      color: Colors.white,
                                                      fontSize: 10,
                                                      fontWeight:
                                                          FontWeight.bold,
                                                    ),
                                                  ),
                                                ),
                                              ],
                                            ],
                                          ),
                                        ),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
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
                              }).toList(),
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
                        color: Colors.black.withOpacity(0.1),
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
