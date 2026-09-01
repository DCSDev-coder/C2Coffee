import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../main.dart';
import '../widgets/order_card.dart';
import '../widgets/blinking_online_indicator.dart';

class PickupReadyPage extends StatelessWidget {
  final String orderId;
  final String customerDetails;
  final String baristaName;
  final String? timeDate;
  final List<OrderItem> items;
  final VoidCallback? onSettingsTap;

  const PickupReadyPage({
    super.key,
    required this.orderId,
    required this.customerDetails,
    this.baristaName = '',
    this.timeDate,
    required this.items,
    this.onSettingsTap,
  });

  @override
  Widget build(BuildContext context) {
    const Color darkGreen = Color(0xFF304A3A);
    const Color beigeColor = Color(0xFFD3B17D);

    final now = DateTime.now();
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
    final hour = now.hour;
    final minute = now.minute.toString().padLeft(2, '0');
    final ampm = hour >= 12 ? 'PM' : 'AM';
    final hour12 = hour % 12 == 0 ? 12 : hour % 12;
    final formattedTime =
        '$hour12:$minute $ampm - ${months[now.month - 1]} ${now.day}, ${now.year}';

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

          Expanded(
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 800),
                child: ListView(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 24.0,
                    vertical: 32.0,
                  ),
                  children: [
                    // Huge Checkmark with Animation
                    TweenAnimationBuilder(
                      duration: const Duration(milliseconds: 1000),
                      curve: Curves.elasticOut,
                      tween: Tween<double>(begin: 0.0, end: 1.0),
                      builder: (context, double value, child) {
                        return Transform.scale(scale: value, child: child);
                      },
                      child: Center(
                        child: Container(
                          width: 100,
                          height: 100,
                          decoration: BoxDecoration(
                            color: Colors.white,
                            shape: BoxShape.circle,
                            border: Border.all(color: darkGreen, width: 12.0),
                            boxShadow: [
                              BoxShadow(
                                color: darkGreen.withValues(alpha: 0.3),
                                blurRadius: 15,
                                spreadRadius: 2,
                                offset: const Offset(0, 5),
                              ),
                            ],
                          ),
                          child: const Icon(
                            Icons.check,
                            color: darkGreen,
                            size: 56,
                          ),
                        ),
                      ),
                    ),

                    const SizedBox(height: 24.0),

                    // Text headers with Fade & Slide Animation
                    TweenAnimationBuilder(
                      duration: const Duration(milliseconds: 600),
                      tween: Tween<double>(begin: 0.0, end: 1.0),
                      builder: (context, double value, child) {
                        return Opacity(
                          opacity: value,
                          child: Transform.translate(
                            offset: Offset(0, 20 * (1 - value)),
                            child: child,
                          ),
                        );
                      },
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.center,
                        children: [
                          const Text(
                            'PICKUP READY',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w900,
                              color: Colors.grey,
                              letterSpacing: 2.0,
                            ),
                          ),
                          FittedBox(
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
                          Text(
                            customerDetails,
                            style: const TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.bold,
                              color: beigeColor,
                            ),
                          ),
                          if (baristaName.trim().isNotEmpty)
                            Padding(
                              padding: const EdgeInsets.only(top: 6.0),
                              child: Text(
                                'Prepared by $baristaName',
                                style: TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.bold,
                                  color: darkGreen,
                                ),
                              ),
                            ),
                          Padding(
                            padding: const EdgeInsets.only(top: 8.0),
                            child: Text(
                              formattedTime,
                              style: const TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: Colors.grey,
                              ),
                            ),
                          ),
                        ],
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
                                        spacing: 6.0,
                                        runSpacing: 6.0,
                                        children: item.tags
                                            .map(
                                              (tag) => Container(
                                                padding:
                                                    const EdgeInsets.symmetric(
                                                      horizontal: 10.0,
                                                      vertical: 6.0,
                                                    ),
                                                decoration: BoxDecoration(
                                                  color: darkGreen.withValues(
                                                    alpha: 0.06,
                                                  ),
                                                  borderRadius:
                                                      BorderRadius.circular(
                                                        8.0,
                                                      ),
                                                  border: Border.all(
                                                    color: darkGreen.withValues(
                                                      alpha: 0.1,
                                                    ),
                                                  ),
                                                ),
                                                child: Text(
                                                  tag,
                                                  style: TextStyle(
                                                    color: darkGreen,
                                                    fontSize: 12,
                                                    fontWeight: FontWeight.w700,
                                                  ),
                                                ),
                                              ),
                                            )
                                            .toList(),
                                      ),
                                    ),
                                  ],
                                ),
                                if (idx < items.length - 1) ...[
                                  const SizedBox(height: 16.0),
                                  const Divider(
                                    height: 1,
                                    color: Colors.grey,
                                    thickness: 0.5,
                                  ),
                                  const SizedBox(height: 16.0),
                                ],
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
                                final result =
                                    await ApiService.updateOrderStatus(
                                      orderId,
                                      'ready_for_pickup',
                                    );
                                if (!result.isSuccess) {
                                  if (!context.mounted) return;
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(
                                      content: Text(result.errorMessage!),
                                    ),
                                  );
                                  return;
                                }

                                // Remove from current orders entirely since Barista's job is done
                                globalCurrentOrders.value = globalCurrentOrders
                                    .value
                                    .where((o) => o.orderId != orderId)
                                    .toList();

                                if (!context.mounted) return;
                                // Pop exactly 2 screens: PickupReadyPage -> OrderDetailsPage -> MainLayout (CurrentOrderPage)
                                int count = 0;
                                Navigator.of(
                                  context,
                                ).popUntil((_) => count++ >= 2);
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
