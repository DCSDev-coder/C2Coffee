import 'package:flutter/material.dart';
import '../widgets/order_card.dart';
import '../widgets/floating_bottom_nav.dart';

class CurrentOrderPage extends StatefulWidget {
  const CurrentOrderPage({super.key});

  @override
  State<CurrentOrderPage> createState() => _CurrentOrderPageState();
}

class _CurrentOrderPageState extends State<CurrentOrderPage> {
  final Color darkGreen = const Color(0xFF304A3A);
  final Color beigeColor = const Color(0xFFD3B17D);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: Stack(
        children: [
          ListView(
            padding: const EdgeInsets.only(bottom: 120), // padding to scroll past the floating bottom bar
            children: [
              // Dark Green Top Header
              Container(
                height: 100, // Roughly covers status bar + a bit more
                decoration: BoxDecoration(
                  color: darkGreen,
                  borderRadius: const BorderRadius.only(
                    bottomLeft: Radius.circular(16.0),
                    bottomRight: Radius.circular(16.0),
                  ),
                ),
              ),
              
              // Content
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Title
                    Text(
                      'Current Order',
                      style: TextStyle(
                        color: darkGreen,
                        fontSize: 40,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    
                    // Subtitle
                    Text(
                      '12 active orders in queue',
                      style: TextStyle(
                        color: beigeColor,
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 16.0),
                    
                    // Search Bar
                    TextField(
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
                    
                    // Order 1 (Preparing)
                    OrderCard(
                      timeDate: '5:20 PM - 11 December 2026',
                      status: OrderStatus.preparing,
                      orderId: 'ORD-001',
                      customerDetails: 'miraelys - 2 items - dine in',
                      items: [
                        OrderItem(
                          title: '1x Mount Broga',
                          tags: ['Dato Blend', '1 esp shot', 'Reg. milk'],
                        ),
                        OrderItem(
                          title: '1x Mount Broga',
                          tags: ['Dato Blend', '1 esp shot', 'Reg. milk'],
                        ),
                      ],
                      onActionPressed: () {},
                    ),
                    
                    // Order 2 (New)
                    OrderCard(
                      timeDate: '5:30 PM - 11 December 2026',
                      status: OrderStatus.newOrder,
                      orderId: 'ORD-001',
                      customerDetails: 'miraelys - 2 items - dine in',
                      items: [
                        OrderItem(
                          title: '1x Mount Broga',
                          tags: ['Hot'],
                        ),
                        OrderItem(
                          title: '1x Mount Broga',
                          tags: ['Hot'],
                        ),
                      ],
                      onActionPressed: () {},
                    ),
                  ],
                ),
              ),
            ],
          ),
          
          // Floating Bottom Navigation
          const FloatingBottomNav(activePage: NavPage.currentOrder),
        ],
      ),
    );
  }
}
