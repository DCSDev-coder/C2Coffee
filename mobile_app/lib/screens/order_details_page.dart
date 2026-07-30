import 'package:flutter/material.dart';
import 'loading_order_page.dart';
import 'orders_page.dart';

class OrderDetailsPage extends StatelessWidget {
  final Map<String, dynamic> item;

  const OrderDetailsPage({super.key, required this.item});

  @override
  Widget build(BuildContext context) {
    final Color orangeColor = const Color(0xFFE66B00);
    final Color bgColor = const Color(0xFFFAF4EE);

    return Scaffold(
      backgroundColor: bgColor,
      body: Column(
        children: [
          Container(
            padding:
                const EdgeInsets.only(top: 60, bottom: 20, left: 20, right: 20),
            decoration: BoxDecoration(
              color: orangeColor,
              borderRadius: const BorderRadius.only(
                bottomLeft: Radius.circular(20),
                bottomRight: Radius.circular(20),
              ),
            ),
            child: Row(
              children: [
                GestureDetector(
                  onTap: () {
                    Navigator.pushReplacement(
                      context,
                      MaterialPageRoute(
                        builder: (context) => const InteractiveFillingLoader(
                          targetPage: OrdersPage(),
                        ),
                      ),
                    );
                  },
                  child: const Icon(Icons.arrow_back_ios,
                      color: Colors.white, size: 24),
                ),
                const Expanded(
                  child: Center(
                    child: Text(
                      'ORDER DETAILS',
                      style: TextStyle(
                        fontFamily: 'Recoleta',
                        fontSize: 28,
                        fontWeight: FontWeight.w900,
                        color: Colors.white,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 24),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(20.0),
            child: Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.05),
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Image.asset(
                        item['image'],
                        width: 80,
                        height: 100,
                        fit: BoxFit.contain,
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              '${item['date']} . ${item['time']}',
                              style: const TextStyle(
                                fontFamily: 'Afacad',
                                fontSize: 12,
                                color: Colors.black54,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  item['name'],
                                  style: const TextStyle(
                                    fontFamily: 'Recoleta',
                                    fontSize: 20,
                                    fontWeight: FontWeight.bold,
                                    color: Colors.black,
                                  ),
                                ),
                                Text(
                                  'x${item['quantity']}',
                                  style: TextStyle(
                                    fontFamily: 'Afacad',
                                    fontSize: 22,
                                    fontWeight: FontWeight.bold,
                                    color: orangeColor,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 8),
                            Text(
                              item['details'],
                              style: const TextStyle(
                                fontFamily: 'Afacad',
                                fontSize: 14,
                                color: Colors.black87,
                                height: 1.2,
                              ),
                            ),
                            const SizedBox(height: 16),
                            Text(
                              'Remarks: ${item['remarks']}',
                              style: const TextStyle(
                                fontFamily: 'Afacad',
                                fontSize: 14,
                                color: Colors.black87,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 24),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: [
                      Text(
                        '${item['quantity']} item  ',
                        style: const TextStyle(
                          fontFamily: 'Afacad',
                          fontSize: 14,
                          color: Colors.black87,
                        ),
                      ),
                      const Text(
                        'RM16.90',
                        style: TextStyle(
                          fontFamily: 'Afacad',
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                          color: Colors.black,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
