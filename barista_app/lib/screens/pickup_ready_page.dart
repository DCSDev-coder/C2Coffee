import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../main.dart';
import '../widgets/order_card.dart';
import '../widgets/blinking_online_indicator.dart';


class PickupReadyPage extends StatelessWidget {
  final String orderId;
  final String customerDetails;
  final List<OrderItem> items;
  final VoidCallback? onSettingsTap;

  const PickupReadyPage({
    super.key,
    required this.orderId,
    required this.customerDetails,
    required this.items,
    this.onSettingsTap,
  });

  @override
  Widget build(BuildContext context) {
    const Color darkGreen = Color(0xFF304A3A);
    const Color beigeColor = Color(0xFFD3B17D);

    return Scaffold(
      backgroundColor: Colors.white,
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Dark Green Top Header
          Container(
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
          
          Expanded(
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 800),
                child: ListView(
                  padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 32.0),
                  children: [
                    // Huge Checkmark
                Center(
                  child: Container(
                    width: 100,
                    height: 100,
                    decoration: BoxDecoration(
                      color: Colors.white,
                      shape: BoxShape.circle,
                      border: Border.all(color: darkGreen, width: 12.0),
                    ),
                    child: const Icon(Icons.check, color: darkGreen, size: 56),
                  ),
                ),
                
                const SizedBox(height: 24.0),
                
                // Text headers
                const Center(
                  child: Text(
                    'PICKUP READY',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w900,
                      color: Colors.grey,
                    ),
                  ),
                ),
                Center(
                  child: FittedBox(
                    fit: BoxFit.scaleDown,
                    child: Text(
                      orderId,
                      maxLines: 1,
                      style: const TextStyle(
                        fontSize: 32,
                        fontWeight: FontWeight.bold,
                        color: Colors.black,
                      ),
                    ),
                  ),
                ),
                Center(
                  child: Text(
                    customerDetails,
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                      color: beigeColor,
                    ),
                  ),
                ),
                
                const SizedBox(height: 32.0),
                
                // Order Summary Box
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
                        'Order Summary',
                        style: TextStyle(
                          fontSize: 22,
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
                                fontSize: 20,
                                fontWeight: FontWeight.bold,
                                color: Colors.black,
                              ),
                            ),
                            const SizedBox(height: 4.0),
                            Row(
                              children: [
                                Expanded(
                                  child: Wrap(
                                    spacing: 8.0,
                                    runSpacing: 6.0,
                                    children: item.tags.map((tag) {
                                      return Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 10.0, vertical: 4.0),
                                        decoration: BoxDecoration(
                                          color: darkGreen,
                                          borderRadius: BorderRadius.circular(12.0),
                                        ),
                                        child: Text(
                                          tag,
                                          style: const TextStyle(
                                            color: Colors.white,
                                            fontSize: 12,
                                            fontWeight: FontWeight.w700,
                                          ),
                                        ),
                                      );
                                    }).toList(),
                                  ),
                                ),
                              ],
                            ),
                            if (idx < items.length - 1) ...[
                              const SizedBox(height: 16.0),
                              const Divider(height: 1, color: Colors.grey, thickness: 0.5),
                              const SizedBox(height: 16.0),
                            ]
                          ],
                        );
                      }),
                      
                      const SizedBox(height: 32.0),
                      
                      // Ready to Pickup Button
                      SizedBox(
                        width: double.infinity,
                        height: 52,
                        child: ElevatedButton(
                          onPressed: () async {
                            // Update status to readyForPickup and trigger rebuild
                            await ApiService.updateOrderStatus(orderId, 'ready_for_pickup');
                            final order = globalCurrentOrders.value.firstWhere((o) => o.orderId == orderId);
                            order.status = OrderStatus.readyForPickup;
                            globalCurrentOrders.value = List.from(globalCurrentOrders.value);

                            if (!context.mounted) return;
                            // Pop exactly 2 screens: PickupReadyPage -> OrderDetailsPage -> MainLayout (CurrentOrderPage)
                            int count = 0;
                            Navigator.of(context).popUntil((_) => count++ >= 2);
                          },
                          style: ElevatedButton.styleFrom(
                            backgroundColor: darkGreen,
                            foregroundColor: Colors.white,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12.0),
                            ),
                            elevation: 0,
                          ),
                          child: const Text(
                            'Ready to Pickup',
                            style: TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ),
                      
                      const SizedBox(height: 12.0),
                      
                      // Back to Orders Details
                      SizedBox(
                        width: double.infinity,
                        height: 52,
                        child: ElevatedButton(
                          onPressed: () {
                            Navigator.of(context).pop();
                          },
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.grey.shade300,
                            foregroundColor: darkGreen,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12.0),
                            ),
                            elevation: 0,
                          ),
                          child: const Text(
                            'Back to Orders Details',
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ),
                    ], // closes children of Column
                  ), // closes Column
                ), // closes Container
              ], // closes children of ListView
            ), // closes ListView
          ), // closes ConstrainedBox
        ), // closes Center
      ), // closes Expanded
    ], // closes children of Column (root)
    ), // closes Column (root)
    ); // closes Scaffold
  } // build
} // class
