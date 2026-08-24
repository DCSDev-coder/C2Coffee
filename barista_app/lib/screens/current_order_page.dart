import 'package:flutter/material.dart';
import '../widgets/order_card.dart';
import '../widgets/active_barista_profile.dart';
import 'order_details_page.dart';

class CurrentOrderPage extends StatefulWidget {
  final VoidCallback? onSettingsTap;
  
  const CurrentOrderPage({
    super.key,
    this.onSettingsTap,
  });

  @override
  State<CurrentOrderPage> createState() => _CurrentOrderPageState();
}

class _MockCurrentOrder {
  final OrderStatus status;
  final String orderId;
  final String timeDate;
  final String customerDetails;
  final List<OrderItem> items;

  _MockCurrentOrder({
    required this.status,
    required this.orderId,
    required this.timeDate,
    required this.customerDetails,
    required this.items,
  });
}

class _CurrentOrderPageState extends State<CurrentOrderPage> {
  final Color darkGreen = const Color(0xFF304A3A);
  final Color beigeColor = const Color(0xFFD3B17D);

  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = '';
  
  final List<_MockCurrentOrder> _allOrders = [
    _MockCurrentOrder(
      status: OrderStatus.preparing,
      orderId: 'ORD-001',
      timeDate: '5:20 PM - 11 December 2026',
      customerDetails: 'miraelys - 2 items - dine in',
      items: [
        OrderItem(
          title: '1x Mount Broga',
          tags: ['Dato Blend', '1 espresso shot', 'Regular milk', 'Regular sweet', 'Regular ice', 'Cold', 'Dine in', 'Remarks: None'],
        ),
        OrderItem(
          title: '1x Mount Broga',
          tags: ['Dato Blend', '1 espresso shot', 'Regular milk', 'Regular sweet', 'Regular ice', 'Cold', 'Dine in', 'Remarks: None'],
        ),
      ]
    ),
    _MockCurrentOrder(
      status: OrderStatus.newOrder,
      orderId: 'ORD-002',
      timeDate: '5:30 PM - 11 December 2026',
      customerDetails: 'alex_chong - 2 items - take away',
      items: [
        OrderItem(title: '1x Latte', tags: ['Hot']),
        OrderItem(title: '1x Latte', tags: ['Hot']),
      ]
    )
  ];

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
    final filteredOrders = _allOrders.where((order) {
      if (_searchQuery.isEmpty) return true;
      return order.orderId.toLowerCase().contains(_searchQuery) ||
             order.customerDetails.toLowerCase().contains(_searchQuery);
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
            padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 16.0),
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
                            'Current Order',
                            style: TextStyle(
                              color: darkGreen,
                              fontSize: 40,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          Text(
                            '12 active orders in queue',
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
                
                // Search Bar
                TextField(
                  controller: _searchController,
                  decoration: InputDecoration(
                    hintText: 'Search by order ID or Username...',
                    hintStyle: const TextStyle(color: Colors.grey, fontSize: 14),
                    prefixIcon: Icon(Icons.search, color: darkGreen),
                    contentPadding: const EdgeInsets.symmetric(vertical: 12.0),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(30.0),
                      borderSide: BorderSide(color: darkGreen, width: 1.5),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(30.0),
                      borderSide: BorderSide(color: darkGreen, width: 1.5),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(30.0),
                      borderSide: BorderSide(color: darkGreen, width: 2.0),
                    ),
                  ),
                ),
                const SizedBox(height: 24.0),
                
                if (filteredOrders.isEmpty)
                  Center(
                    child: Padding(
                      padding: const EdgeInsets.all(32.0),
                      child: Column(
                        children: [
                          Icon(Icons.search_off, size: 48, color: Colors.grey.shade300),
                          const SizedBox(height: 16),
                          Text('No orders found.', style: TextStyle(color: Colors.grey.shade500)),
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
                            pageBuilder: (context, animation, secondaryAnimation) => OrderDetailsPage(
                              orderId: order.orderId,
                              customerDetails: order.customerDetails,
                              items: order.items,
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
}
