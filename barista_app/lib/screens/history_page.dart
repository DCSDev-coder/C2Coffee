import 'package:flutter/material.dart';
import '../main.dart';
import '../widgets/order_card.dart';
import '../widgets/blinking_online_indicator.dart';
import '../widgets/custom_date_picker.dart';
import '../widgets/active_barista_profile.dart';
import 'order_details_page.dart';

class HistoryPage extends StatefulWidget {
  final VoidCallback? onSettingsTap;

  const HistoryPage({super.key, this.onSettingsTap});

  @override
  State<HistoryPage> createState() => _HistoryPageState();
}

class _HistoryPageState extends State<HistoryPage> {
  final Color darkGreen = const Color(0xFF304A3A);
  final Color beigeColor = const Color(0xFFD3B17D);

  DateTime? _selectedDate;
  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = '';

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

  Future<void> _selectDate() async {
    final DateTime? picked = await showDialog<DateTime>(
      context: context,
      builder: (BuildContext context) {
        return CustomDatePicker(initialDate: _selectedDate ?? DateTime.now());
      },
    );
    if (picked != null && picked != _selectedDate) {
      setState(() {
        _selectedDate = picked;
      });
    }
  }

  void _clearDate() {
    setState(() {
      _selectedDate = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<List<CurrentOrder>>(
      valueListenable: globalHistoryOrders,
      builder: (context, allHistoryOrders, _) {
        // Filter orders based on selected date and search query
        final filteredOrders = allHistoryOrders.where((order) {
          bool matchesDate = true;
          if (_selectedDate != null) {
            matchesDate =
                order.orderDate.year == _selectedDate!.year &&
                order.orderDate.month == _selectedDate!.month &&
                order.orderDate.day == _selectedDate!.day;
          }

          bool matchesSearch = true;
          if (_searchQuery.isNotEmpty) {
            matchesSearch =
                order.orderId.toLowerCase().contains(_searchQuery) ||
                order.customerDetails.toLowerCase().contains(_searchQuery);
          }

          return matchesDate && matchesSearch;
        }).toList();

        return Scaffold(
          backgroundColor: Colors.white,
          body: Stack(
            children: [
              Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 800),
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
                                        'History',
                                        style: TextStyle(
                                          color: darkGreen,
                                          fontSize: 32,
                                          fontWeight: FontWeight.bold,
                                        ),
                                      ),
                                      Text(
                                        '${filteredOrders.length} total orders',
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
                            const SizedBox(height: 16.0),

                            // Search Bar and Calendar Icon Row
                            Row(
                              children: [
                                Expanded(
                                  child: TextField(
                                    controller: _searchController,
                                    decoration: InputDecoration(
                                      hintText:
                                          'Search by order ID or Username...',
                                      hintStyle: const TextStyle(
                                        color: Colors.grey,
                                        fontSize: 14,
                                      ),
                                      prefixIcon: Icon(
                                        Icons.search,
                                        color: darkGreen,
                                      ),
                                      contentPadding:
                                          const EdgeInsets.symmetric(
                                            vertical: 12.0,
                                          ),
                                      border: OutlineInputBorder(
                                        borderRadius: BorderRadius.circular(
                                          30.0,
                                        ),
                                        borderSide: BorderSide(
                                          color: darkGreen,
                                          width: 1.5,
                                        ),
                                      ),
                                      enabledBorder: OutlineInputBorder(
                                        borderRadius: BorderRadius.circular(
                                          30.0,
                                        ),
                                        borderSide: BorderSide(
                                          color: darkGreen,
                                          width: 1.5,
                                        ),
                                      ),
                                      focusedBorder: OutlineInputBorder(
                                        borderRadius: BorderRadius.circular(
                                          30.0,
                                        ),
                                        borderSide: BorderSide(
                                          color: darkGreen,
                                          width: 2.0,
                                        ),
                                      ),
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 12.0),
                                // Simple Calendar Button Beside Search Bar
                                IconButton(
                                  onPressed: _selectedDate != null
                                      ? _clearDate
                                      : _selectDate,
                                  icon: Icon(
                                    _selectedDate != null
                                        ? Icons.close
                                        : Icons.calendar_month,
                                    color: darkGreen,
                                    size: 28,
                                  ),
                                  style: IconButton.styleFrom(
                                    backgroundColor: _selectedDate != null
                                        ? darkGreen.withOpacity(0.1)
                                        : Colors.transparent,
                                    shape: const CircleBorder(),
                                  ),
                                ),
                              ],
                            ),

                            if (_selectedDate != null)
                              Padding(
                                padding: const EdgeInsets.only(
                                  top: 12.0,
                                  bottom: 4.0,
                                ),
                                child: Text(
                                  'Showing orders for ${_selectedDate!.day.toString().padLeft(2, '0')} ${_getMonth(_selectedDate!.month)} ${_selectedDate!.year}',
                                  style: TextStyle(
                                    color: darkGreen,
                                    fontWeight: FontWeight.w600,
                                    fontSize: 14,
                                  ),
                                ),
                              )
                            else
                              const SizedBox(height: 16.0),

                            const SizedBox(height: 8.0),

                            // Dynamically display filtered orders
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
                                        'No orders found for this date.',
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
                                return Padding(
                                  padding: const EdgeInsets.only(bottom: 16.0),
                                  child: OrderCard(
                                    timeDate: order.timeDate,
                                    status: OrderStatus.completed,
                                    orderId: order.orderId,
                                    customerDetails: order.customerDetails,
                                    items: order.items,
                                    onActionPressed: () {},
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
                                                isHistory: true,
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
                                                const curve =
                                                    Curves.easeOutCubic;
                                                var tween =
                                                    Tween(
                                                      begin: begin,
                                                      end: end,
                                                    ).chain(
                                                      CurveTween(curve: curve),
                                                    );
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
                                  ),
                                );
                              }).toList(),
                          ],
                        ),
                      ),
                    ],
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

  String _getMonth(int month) {
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    return months[month - 1];
  }
}
