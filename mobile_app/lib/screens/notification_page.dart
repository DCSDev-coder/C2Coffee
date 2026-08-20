import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../services/notification_service.dart';
import '../services/secure_session_service.dart';
import '../utils/app_colors.dart';
import '../widgets/app_page_shell.dart';
import 'loading_order_page.dart';

class NotificationPage extends StatefulWidget {
  const NotificationPage({super.key});

  @override
  State<NotificationPage> createState() => _NotificationPageState();
}

class _NotificationPageState extends State<NotificationPage> {
  late Future<List<InAppNotification>> _notificationsFuture;

  @override
  void initState() {
    super.initState();
    _notificationsFuture = _loadNotifications();
  }

  Future<List<InAppNotification>> _loadNotifications() async {
    final accessToken =
        await SecureSessionService.instance.getValidAccessToken();
    if (accessToken == null || accessToken.isEmpty) {
      throw Exception('Please sign in again to view notifications.');
    }

    return NotificationService.instance.getNotifications(
      accessToken: accessToken,
    );
  }

  void _retry() {
    setState(() {
      _notificationsFuture = _loadNotifications();
    });
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: true,
      child: AppPageShell(
        title: 'NOTIFICATIONS',
        onBack: () => InteractiveFillingLoader.showPop(context),
        backgroundColor: Colors.white,
        bodyPadding: const EdgeInsets.fromLTRB(20, 20, 20, 28),
        child: FutureBuilder<List<InAppNotification>>(
          future: _notificationsFuture,
          builder: (context, snapshot) {
            if (snapshot.connectionState == ConnectionState.waiting) {
              return SizedBox(
                height: 220,
                child: Center(
                  child: CircularProgressIndicator(
                    color: AppColors.deepTeal,
                  ),
                ),
              );
            }

            if (snapshot.hasError) {
              return _buildStateCard(
                title: 'Unable to load notifications',
                message: snapshot.error.toString(),
                actionLabel: 'Try Again',
                onAction: _retry,
              );
            }

            final notifications = snapshot.data ?? const <InAppNotification>[];
            if (notifications.isEmpty) {
              return _buildStateCard(
                title: 'No notifications yet',
                message:
                    'Order updates, token top-ups, referrals, and rewards will appear here.',
              );
            }

            return Column(
              children: [
                _buildSectionHeader('Latest updates'),
                const SizedBox(height: 12),
                ...notifications.asMap().entries.expand((entry) {
                  final index = entry.key;
                  final notification = entry.value;
                  return [
                    _buildNotificationItem(notification),
                    if (index != notifications.length - 1)
                      const SizedBox(height: 12),
                  ];
                }),
              ],
            );
          },
        ),
      ),
    );
  }

  Widget _buildSectionHeader(String text) {
    return Align(
      alignment: Alignment.centerLeft,
      child: Text(
        text,
        style: TextStyle(
          fontFamily: 'Recoleta',
          fontSize: 18,
          fontWeight: FontWeight.bold,
          color: AppColors.deepTeal,
        ),
      ),
    );
  }

  Widget _buildStateCard({
    required String title,
    required String message,
    String? actionLabel,
    VoidCallback? onAction,
  }) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.border),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: TextStyle(
              fontFamily: 'Recoleta',
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: AppColors.deepTeal,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            message,
            style: const TextStyle(
              fontFamily: 'Afacad',
              fontSize: 14,
              color: Colors.black87,
              height: 1.35,
            ),
          ),
          if (actionLabel != null && onAction != null) ...[
            const SizedBox(height: 16),
            Align(
              alignment: Alignment.centerRight,
              child: TextButton(
                onPressed: onAction,
                child: Text(
                  actionLabel,
                  style: TextStyle(
                    fontFamily: 'Afacad',
                    fontSize: 15,
                    fontWeight: FontWeight.bold,
                    color: AppColors.deepTeal,
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildNotificationItem(InAppNotification notification) {
    final dateLabel =
        DateFormat('d MMM yyyy • h:mm a').format(notification.createdAt);
    final isUnread = !notification.isRead;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: isUnread
              ? AppColors.deepTeal.withValues(alpha: 0.18)
              : AppColors.border,
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
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: isUnread ? AppColors.deepTeal : AppColors.surfaceLight,
              shape: BoxShape.circle,
            ),
            child: Icon(
              Icons.coffee,
              color: isUnread ? Colors.white : AppColors.deepTeal,
              size: 22,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Text(
                        notification.title,
                        style: TextStyle(
                          fontFamily: 'Recoleta',
                          fontSize: 16,
                          fontWeight:
                              isUnread ? FontWeight.bold : FontWeight.w600,
                          color: AppColors.deepTeal,
                          height: 1.2,
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    if (isUnread)
                      Container(
                        width: 10,
                        height: 10,
                        margin: const EdgeInsets.only(top: 4),
                        decoration: BoxDecoration(
                          color: AppColors.terracotta,
                          shape: BoxShape.circle,
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  dateLabel,
                  style: TextStyle(
                    fontFamily: 'Afacad',
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: Colors.grey.shade700,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  notification.body,
                  style: const TextStyle(
                    fontFamily: 'Afacad',
                    fontSize: 14,
                    color: Colors.black87,
                    height: 1.35,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
