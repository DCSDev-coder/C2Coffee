import 'package:flutter/material.dart';
import 'loading_order_page.dart';
import '../utils/app_colors.dart';

class NotificationPage extends StatelessWidget {
  const NotificationPage({super.key});

  @override
  Widget build(BuildContext context) {
    const Color bgColor = Colors.white;

    return PopScope(
      canPop: true,
      child: Scaffold(
        backgroundColor: bgColor,
        body: Column(
          children: [
            // App Bar
            Container(
              width: double.infinity,
              padding: EdgeInsets.only(
                  top: MediaQuery.paddingOf(context).top + 14,
                  bottom: 16,
                  left: 20,
                  right: 20),
              decoration: BoxDecoration(
                color: AppColors.deepTeal,
                borderRadius: const BorderRadius.only(
                  bottomLeft: Radius.circular(20),
                  bottomRight: Radius.circular(20),
                ),
              ),
              child: Stack(
                alignment: Alignment.center,
                children: [
                  Align(
                    alignment: Alignment.centerLeft,
                    child: GestureDetector(
                      onTap: () => InteractiveFillingLoader.showPop(context),
                      child: const Icon(Icons.arrow_back_ios,
                          color: Colors.white, size: 20),
                    ),
                  ),
                  const Text(
                    'NOTIFICATIONS',
                    style: TextStyle(
                      fontFamily: 'Recoleta',
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                      letterSpacing: 1.0,
                    ),
                  ),
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
    final Color brandColor = AppColors.deepTeal;

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
            border: Border.all(
              color: AppColors.border,
              width: 1,
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.03),
                blurRadius: 8,
                offset: const Offset(0, 2),
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
                decoration: BoxDecoration(
                  color: brandColor,
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
                      style: TextStyle(
                        fontFamily: 'Recoleta',
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        color: brandColor,
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
