import 'package:flutter/material.dart';
import '../widgets/order_card.dart';
import '../widgets/active_barista_profile.dart';
import 'order_details_page.dart';

class HistoryPage extends StatefulWidget {
  final VoidCallback? onSettingsTap;
  
  const HistoryPage({
    super.key,
    this.onSettingsTap,
  });

  @override
  State<HistoryPage> createState() => _HistoryPageState();
}

// Simple model for mock data
class _MockHistoryOrder {
  final String orderId;
  final DateTime date;
  final String customerDetails;
  final List<OrderItem> items;

  _MockHistoryOrder({
    required this.orderId,
    required this.date,
    required this.customerDetails,
    required this.items,
  });
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

  // Generating some mock data with different dates (Today, Yesterday, etc.)
  final List<_MockHistoryOrder> _allOrders = [
    _MockHistoryOrder(
      orderId: 'ORD-142',
      date: DateTime.now(),
      customerDetails: 'miraelys - 2 items - dine in',
      items: [
        OrderItem(
          title: '1x Mount Broga',
          tags: ['Dato Blend', '1 esp shot', 'Reg. milk'],
        ),
        OrderItem(title: '1x Latte', tags: ['Hot', 'Oat milk']),
      ],
    ),
    _MockHistoryOrder(
      orderId: 'ORD-141',
      date: DateTime.now().subtract(const Duration(hours: 2)),
      customerDetails: 'alex_chong - 1 item - take away',
      items: [
        OrderItem(title: '1x Mont Broga', tags: ['Iced', 'Extra shot']),
      ],
    ),
    _MockHistoryOrder(
      orderId: 'ORD-140',
      date: DateTime.now().subtract(const Duration(days: 1)),
      customerDetails: 'sarah_lee - 3 items - dine in',
      items: [
        OrderItem(title: '2x Matcha Latte', tags: ['Hot']),
        OrderItem(title: '1x Mocha', tags: ['Warm']),
      ],
    ),
    _MockHistoryOrder(
      orderId: 'ORD-139',
      date: DateTime.now().subtract(const Duration(days: 2)),
      customerDetails: 'balqis01 - 1 item - dine in',
      items: [
        OrderItem(title: '1x Espresso', tags: ['Dato Blend']),
      ],
    ),
    _MockHistoryOrder(
      orderId: 'ORD-138',
      date: DateTime.now().subtract(const Duration(days: 5)),
      customerDetails: 'nur02- 2 items - take away',
      items: [
        OrderItem(title: '1x Mocha', tags: ['Iced', 'Reg. milk']),
        OrderItem(title: '1x Mont Broga', tags: []),
      ],
    ),
  ];

  Future<void> _selectDate() async {
    final DateTime? picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate ?? DateTime.now(),
      firstDate: DateTime(2020),
      lastDate: DateTime(2030),
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: ColorScheme.light(
              primary: darkGreen,
              onPrimary: Colors.white,
              onSurface: darkGreen,
            ),
          ),
          child: child!,
        );
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
    // Filter orders based on selected date and search query
    final filteredOrders = _allOrders.where((order) {
      bool matchesDate = true;
      if (_selectedDate != null) {
        matchesDate = order.date.year == _selectedDate!.year &&
            order.date.month == _selectedDate!.month &&
            order.date.day == _selectedDate!.day;
      }
      
      bool matchesSearch = true;
      if (_searchQuery.isNotEmpty) {
        matchesSearch = order.orderId.toLowerCase().contains(_searchQuery) ||
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
            padding: const EdgeInsets.only(top: 100, bottom: 120), // padding to scroll past the header and floating bottom bar
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
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'History',
                            style: TextStyle(
                              color: darkGreen,
                              fontSize: 40,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          Text(
                            '142 total orders',
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
                          hintText: 'Search by order ID or Username...',
                          hintStyle: const TextStyle(
                            color: Colors.grey,
                            fontSize: 14,
                          ),
                          prefixIcon: Icon(Icons.search, color: darkGreen),
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
                    ),
                    const SizedBox(width: 12.0),
                    // Calendar Button Beside Search Bar
                    InkWell(
                      onTap: _selectedDate != null ? _clearDate : _selectDate,
                      borderRadius: BorderRadius.circular(16.0),
                      child: Container(
                        height: 48,
                        width: 48,
                        decoration: BoxDecoration(
                          color: _selectedDate != null
                              ? darkGreen
                              : Colors.white,
                          border: Border.all(
                            color: _selectedDate != null
                                ? darkGreen
                                : darkGreen,
                            width: 1.5,
                          ),
                          borderRadius: BorderRadius.circular(16.0),
                        ),
                        child: Icon(
                          _selectedDate != null
                              ? Icons.close
                              : Icons.calendar_month,
                          color: _selectedDate != null
                              ? Colors.white
                              : darkGreen,
                        ),
                      ),
                    ),
                  ],
                ),

                if (_selectedDate != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 12.0, bottom: 4.0),
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
                            style: TextStyle(color: Colors.grey.shade500),
                          ),
                        ],
                      ),
                    ),
                  )
                else
                  ...filteredOrders.map((order) {
                    // Format time/date string
                    final timeStr =
                        "${_formatHour(order.date.hour)}:${order.date.minute.toString().padLeft(2, '0')} ${_getAmPm(order.date.hour)}";
                    final dateStr =
                        "${order.date.day} ${_getMonth(order.date.month)} ${order.date.year}";

                    return Padding(
                      padding: const EdgeInsets.only(bottom: 16.0),
                      child: OrderCard(
                        timeDate: '$timeStr - $dateStr',
                        status: OrderStatus.completed,
                        orderId: order.orderId,
                        customerDetails: order.customerDetails,
                        items: order.items,
                        onActionPressed: () {},
                        onTap: () {
                          Navigator.push(
                            context,
                            PageRouteBuilder(
                              pageBuilder: (context, animation, secondaryAnimation) => OrderDetailsPage(
                                orderId: order.orderId,
                                customerDetails: order.customerDetails,
                                items: order.items,
                                isHistory: true,
                                onSettingsTap: widget.onSettingsTap,
                              ),
                              transitionsBuilder: (context, animation, secondaryAnimation, child) {
                                const begin = Offset(1.0, 0.0);
                                const end = Offset.zero;
                                const curve = Curves.easeOutCubic;
                                var tween = Tween(begin: begin, end: end).chain(CurveTween(curve: curve));
                                return SlideTransition(position: animation.drive(tween), child: child);
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
      height: 100, // Roughly covers status bar + a bit more
      decoration: BoxDecoration(
        color: darkGreen,
        borderRadius: const BorderRadius.only(
          bottomLeft: Radius.circular(16.0),
          bottomRight: Radius.circular(16.0),
        ),
      ),
    ),
  ),
  ],
  ),
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

  String _formatHour(int hour) {
    if (hour == 0) return '12';
    if (hour > 12) return (hour - 12).toString();
    return hour.toString();
  }

  String _getAmPm(int hour) {
    return hour >= 12 ? 'PM' : 'AM';
  }
}
