import 'package:flutter/material.dart';
import 'loading_order_page.dart';

class NotificationPage extends StatelessWidget {
  const NotificationPage({super.key});

  @override
  Widget build(BuildContext context) {
    const Color orangeColor = Color(0xFFE66B00);
    const Color bgColor = Color(0xFFFAF4EE);

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) {
        if (didPop) return;
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(builder: (context) => const InteractiveFillingLoader()),
        );
      },
      child: Scaffold(
      backgroundColor: bgColor,
      body: Column(
        children: [
          // App Bar
          Container(
            padding: const EdgeInsets.only(top: 60, bottom: 20, left: 20, right: 20),
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
                          builder: (context) => const InteractiveFillingLoader(),
                        ),
                      );
                    },
                    child: const Icon(Icons.arrow_back_ios, color: Colors.white, size: 20),
                  ),
                  const Expanded(
                    child: Center(
                      child: Text(
                        'NOTIFICATIONS',
                        style: TextStyle(
                          fontFamily: 'Recoleta',
                          fontSize: 22,
                          fontWeight: FontWeight.bold,
                          color: Colors.white,
                          letterSpacing: 1.2,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 20), // Balance the flex space
                ],
              ),
            ),
            
            // Notifications List
            Expanded(
              child: ListView(
                padding: const EdgeInsets.all(20),
                children: [
                  _buildNotificationItem(
                    date: '2026-07-16 09:00',
                    title: 'Our fans love these. Have you tried them?',
                    description: 'The Paddle Pop by Syah are fan favourites right now. Your new user voucher is ready when you are',
                  ),
                  const SizedBox(height: 20),
                  _buildNotificationItem(
                    date: '2026-07-16 09:00',
                    title: 'Our fans love these. Have you tried them?',
                    description: 'The Paddle Pop by Syah are fan favourites right now. Your new user voucher is ready when you are',
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildNotificationItem({
    required String date,
    required String title,
    required String description,
  }) {
    const Color orangeColor = Color(0xFFC7511F); // Darker orange from mockup icon

    return Column(
      children: [
        Text(
          date,
          style: const TextStyle(
            fontFamily: 'Afacad',
            fontSize: 12,
            color: Colors.grey,
          ),
        ),
        const SizedBox(height: 10),
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.05),
                blurRadius: 10,
                offset: const Offset(0, 5),
              ),
            ],
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Icon
              Container(
                width: 40,
                height: 40,
                decoration: const BoxDecoration(
                  color: orangeColor,
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.coffee,
                  color: Colors.white,
                  size: 20,
                ),
              ),
              const SizedBox(width: 16),
              // Text Content
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        fontFamily: 'Recoleta',
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        color: Colors.black87,
                        height: 1.2,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      description,
                      style: const TextStyle(
                        fontFamily: 'Afacad',
                        fontSize: 14,
                        color: Colors.grey,
                        height: 1.3,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
