import 'package:flutter/material.dart';
import '../widgets/order_card.dart'; // To reuse OrderItem if needed
import 'pickup_ready_page.dart';

class OrderDetailsPage extends StatelessWidget {
  final String orderId;
  final String customerDetails;
  final List<OrderItem> items;
  final bool isHistory;

  const OrderDetailsPage({
    super.key,
    required this.orderId,
    required this.customerDetails,
    required this.items,
    this.isHistory = false,
  });

  @override
  Widget build(BuildContext context) {
    const Color darkGreen = Color(0xFF304A3A);
    const Color beigeColor = Color(0xFFD3B17D);
    const Color buttonOrange = Color(0xFFDF7E65);

    return Scaffold(
      backgroundColor: Colors.white,
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Dark Green Top Header
          Container(
            height: 100,
            decoration: const BoxDecoration(
              color: darkGreen,
              borderRadius: BorderRadius.only(
                bottomLeft: Radius.circular(16.0),
                bottomRight: Radius.circular(16.0),
              ),
            ),
          ),
          
          Expanded(
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 800),
                child: ListView(
                  padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 24.0),
                  children: [
                // Header (Back button + Title)
                Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    IconButton(
                      icon: const Icon(Icons.arrow_back, color: darkGreen, size: 32),
                      onPressed: () => Navigator.of(context).pop(),
                      padding: EdgeInsets.zero,
                      alignment: Alignment.centerLeft,
                    ),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '#$orderId',
                            style: const TextStyle(
                              color: darkGreen,
                              fontSize: 32,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          Text(
                            customerDetails,
                            style: const TextStyle(
                              color: beigeColor,
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                
                const SizedBox(height: 24.0),
                
                // Status Tracker
                Container(
                  padding: const EdgeInsets.symmetric(vertical: 20.0, horizontal: 16.0),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    border: Border.all(color: darkGreen, width: 1.2),
                    borderRadius: BorderRadius.circular(20.0),
                  ),
                  child: Row(
                    children: [
                      _buildStatusNode(
                        title: 'Ordered',
                        icon: Icons.receipt_long,
                        isActive: true,
                        isCompleted: true,
                        color: darkGreen,
                      ),
                      _buildConnector(isActive: true, color: darkGreen),
                      _buildStatusNode(
                        title: 'Preparing',
                        icon: Icons.coffee_maker,
                        isActive: true,
                        isCompleted: isHistory,
                        color: darkGreen,
                      ),
                      isHistory
                          ? _buildConnector(isActive: true, color: darkGreen)
                          : _buildAnimatedConnector(color: darkGreen, trackColor: Colors.grey.shade300),
                      _buildStatusNode(
                        title: 'Ready',
                        icon: Icons.check,
                        isActive: isHistory,
                        isCompleted: isHistory,
                        color: isHistory ? darkGreen : Colors.grey.shade300,
                      ),
                    ],
                  ),
                ),
                
                const SizedBox(height: 24.0),
                
                // Items Box
                Container(
                  padding: const EdgeInsets.all(24.0),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    border: Border.all(color: darkGreen, width: 1.2),
                    borderRadius: BorderRadius.circular(24.0),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'ITEMS',
                        style: TextStyle(
                          fontSize: 24,
                          fontWeight: FontWeight.bold,
                          color: Colors.black,
                        ),
                      ),
                      const SizedBox(height: 16.0),
                      const Divider(height: 1, color: Colors.grey),
                      const SizedBox(height: 16.0),
                      
                      ...items.asMap().entries.map((entry) {
                        int idx = entry.key;
                        OrderItem item = entry.value;
                        return Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              item.title,
                              style: const TextStyle(
                                fontSize: 22,
                                fontWeight: FontWeight.bold,
                                color: Colors.black,
                              ),
                            ),
                            const SizedBox(height: 8.0),
                            ...item.tags.map((tag) => Padding(
                              padding: const EdgeInsets.only(left: 16.0, bottom: 4.0),
                              child: Row(
                                children: [
                                  Container(
                                    width: 4,
                                    height: 4,
                                    decoration: const BoxDecoration(
                                      color: Colors.grey,
                                      shape: BoxShape.circle,
                                    ),
                                  ),
                                  const SizedBox(width: 8.0),
                                  Text(
                                    tag,
                                    style: TextStyle(
                                      fontSize: 14,
                                      color: Colors.grey.shade600,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ],
                              ),
                            )),
                            if (idx < items.length - 1) ...[
                              const SizedBox(height: 16.0),
                              const Divider(height: 1, color: Colors.grey),
                              const SizedBox(height: 16.0),
                            ]
                          ],
                        );
                      }),
                      
                      if (!isHistory) ...[
                        const SizedBox(height: 32.0),
                        
                        // Mark as Ready Button
                        SizedBox(
                          width: double.infinity,
                          height: 56,
                          child: ElevatedButton(
                            onPressed: () {
                              Navigator.push(
                                context,
                                PageRouteBuilder(
                                  pageBuilder: (context, animation, secondaryAnimation) => PickupReadyPage(
                                    orderId: orderId,
                                    customerDetails: customerDetails,
                                    items: items,
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
                            style: ElevatedButton.styleFrom(
                              backgroundColor: buttonOrange,
                              foregroundColor: Colors.white,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(16.0),
                              ),
                              elevation: 0,
                            ),
                            child: const Text(
                              'Mark as Ready',
                              style: TextStyle(
                                fontSize: 22,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    ],
  ),
);
}

  Widget _buildStatusNode({
    required String title,
    required IconData icon,
    required bool isActive,
    required bool isCompleted,
    required Color color,
  }) {
    return Expanded(
      flex: 2,
      child: Column(
        children: [
          Stack(
            clipBehavior: Clip.none,
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: color,
                  shape: BoxShape.circle,
                ),
                child: Icon(icon, color: Colors.white, size: 24),
              ),
              if (isCompleted)
                Positioned(
                  bottom: -2,
                  right: -2,
                  child: Container(
                    padding: const EdgeInsets.all(2),
                    decoration: const BoxDecoration(
                      color: Colors.white,
                      shape: BoxShape.circle,
                    ),
                    child: Container(
                      decoration: BoxDecoration(
                        color: color,
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.check, size: 12, color: Colors.white),
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 8.0),
          Text(
            title,
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.bold,
              color: Colors.black,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildConnector({required bool isActive, required Color color}) {
    return Expanded(
      flex: 3,
      child: Container(
        margin: const EdgeInsets.only(bottom: 24.0), // offset for text
        height: 4,
        color: color,
      ),
    );
  }

  Widget _buildAnimatedConnector({required Color color, required Color trackColor}) {
    return Expanded(
      flex: 3,
      child: Container(
        margin: const EdgeInsets.only(bottom: 24.0), // offset for text
        height: 4,
        color: trackColor,
        alignment: Alignment.centerLeft,
        child: TweenAnimationBuilder<double>(
          tween: Tween(begin: 0.0, end: 0.85), // Animates to 85% full
          duration: const Duration(milliseconds: 1500),
          curve: Curves.easeOutCubic,
          builder: (context, value, child) {
            return FractionallySizedBox(
              widthFactor: value,
              child: Container(color: color),
            );
          },
        ),
      ),
    );
  }
}
