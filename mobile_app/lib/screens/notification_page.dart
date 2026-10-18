import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../services/notification_service.dart';
import '../services/secure_session_service.dart';
import '../utils/app_colors.dart';
import '../utils/app_notification.dart';
import '../widgets/app_page_shell.dart';
import 'loading_order_page.dart';
import 'my_rewards_page.dart';
import 'orders_page.dart';
import 'top_up_wallet_page.dart';

class _NotificationInboxData {
  final List<PaymentServiceNotice> paymentNotices;
  final List<InAppNotification> notifications;

  const _NotificationInboxData({
    required this.paymentNotices,
    required this.notifications,
  });
}

class NotificationPage extends StatefulWidget {
  const NotificationPage({super.key});

  @override
  State<NotificationPage> createState() => _NotificationPageState();
}

class _NotificationPageState extends State<NotificationPage> {
  late Future<_NotificationInboxData> _notificationsFuture;
  bool _clearing = false;

  @override
  void initState() {
    super.initState();
    _notificationsFuture = _loadNotifications();
  }

  Future<_NotificationInboxData> _loadNotifications() async {
    final accessToken =
        await SecureSessionService.instance.getValidAccessToken();
    if (accessToken == null || accessToken.isEmpty) {
      throw Exception('Please sign in again to view notifications.');
    }

    final results = await Future.wait([
      NotificationService.instance.getPaymentServiceNotices(
        accessToken: accessToken,
      ),
      NotificationService.instance.getNotifications(
        accessToken: accessToken,
        limit: 20,
      ),
    ]);
    return _NotificationInboxData(
      paymentNotices: results[0] as List<PaymentServiceNotice>,
      notifications: results[1] as List<InAppNotification>,
    );
  }

  void _retry() {
    setState(() {
      _notificationsFuture = _loadNotifications();
    });
  }

  Future<void> _clearAll() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Clear notifications'),
        content: const Text(
          'This removes all current notifications from your inbox. New updates will still appear here.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text('Clear all'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    setState(() => _clearing = true);
    try {
      final accessToken =
          await SecureSessionService.instance.getValidAccessToken();
      if (accessToken == null || accessToken.isEmpty) {
        throw Exception('Please sign in again to clear notifications.');
      }
      await NotificationService.instance.clearNotifications(
        accessToken: accessToken,
      );
      if (!mounted) return;
      final current = await _notificationsFuture;
      if (!mounted) return;
      setState(() => _notificationsFuture = Future.value(
            _NotificationInboxData(
              paymentNotices: current.paymentNotices,
              notifications: const [],
            ),
          ));
    } catch (_) {
      if (!mounted) return;
      AppNotification.showError(
        context,
        'We could not clear notifications. Please try again.',
      );
    } finally {
      if (mounted) setState(() => _clearing = false);
    }
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
        child: FutureBuilder<_NotificationInboxData>(
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
                message:
                    'We could not load your notifications right now. Please try again shortly.',
                actionLabel: 'Try Again',
                onAction: _retry,
              );
            }

            final inbox = snapshot.data ?? const _NotificationInboxData(
              paymentNotices: [],
              notifications: [],
            );
            final notifications = inbox.notifications;
            if (notifications.isEmpty && inbox.paymentNotices.isEmpty) {
              return _buildStateCard(
                title: 'No notifications yet',
                message:
                    'Order updates, token top-ups, referrals, and rewards will appear here.',
              );
            }

            return Column(
              children: [
                if (inbox.paymentNotices.isNotEmpty) ...[
                  _buildPaymentServiceHeader(inbox.paymentNotices.length),
                  const SizedBox(height: 12),
                  ...inbox.paymentNotices.map((notice) => Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: _buildPaymentServiceNotice(notice),
                      )),
                  const SizedBox(height: 8),
                ],
                if (notifications.isNotEmpty) ...[
                  _buildSectionHeader('Latest updates', notifications.length),
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
              ],
            );
          },
        ),
      ),
    );
  }

  Widget _buildPaymentServiceHeader(int count) {
    return Row(
      children: [
        Icon(Icons.warning_amber_rounded, color: Colors.amber.shade800),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            count == 1 ? 'Payment service notice' : 'Payment service notices ($count)',
            style: TextStyle(
              fontFamily: 'Recoleta',
              fontSize: 20,
              fontWeight: FontWeight.bold,
              color: AppColors.deepTeal,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildPaymentServiceNotice(PaymentServiceNotice notice) {
    final formatter = DateFormat('d MMM yyyy • h:mm a');
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(17),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF8E7),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFE6C98D)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            notice.title,
            style: TextStyle(
              fontFamily: 'Recoleta',
              fontSize: 19,
              fontWeight: FontWeight.bold,
              color: AppColors.deepTeal,
            ),
          ),
          const SizedBox(height: 7),
          Text(
            notice.message,
            style: const TextStyle(fontFamily: 'Afacad', fontSize: 16, height: 1.35),
          ),
          const SizedBox(height: 12),
          Text(
            'Affected: ${notice.paymentMethodLabel}',
            style: const TextStyle(fontFamily: 'Afacad', fontSize: 15, fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 4),
          Text(
            '${formatter.format(notice.startsAt)} – ${formatter.format(notice.endsAt)}',
            style: TextStyle(fontFamily: 'Afacad', fontSize: 14, color: Colors.grey.shade800),
          ),
        ],
      ),
    );
  }

  Widget _buildSectionHeader(String text, int count) {
    return Row(
      children: [
        Expanded(
          child: Text(
            '$text ($count)',
            style: TextStyle(
              fontFamily: 'Recoleta',
              fontSize: 20,
              fontWeight: FontWeight.bold,
              color: AppColors.deepTeal,
            ),
          ),
        ),
        TextButton(
          onPressed: _clearing ? null : _clearAll,
          child: _clearing
              ? const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Text('Clear all'),
        ),
      ],
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
              fontSize: 20,
              fontWeight: FontWeight.bold,
              color: AppColors.deepTeal,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            message,
            style: const TextStyle(
              fontFamily: 'Afacad',
              fontSize: 16,
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
                    fontSize: 17,
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
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: () => _openNotification(notification),
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
                            fontSize: 18,
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
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: Colors.grey.shade700,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    notification.body,
                    style: const TextStyle(
                      fontFamily: 'Afacad',
                      fontSize: 16,
                      color: Colors.black87,
                      height: 1.35,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _openNotification(InAppNotification notification) async {
    try {
      final accessToken =
          await SecureSessionService.instance.getValidAccessToken();
      if (accessToken != null &&
          accessToken.isNotEmpty &&
          !notification.isRead) {
        await NotificationService.instance.markRead(
          accessToken: accessToken,
          notificationId: notification.id,
        );
      }
    } catch (_) {
      // Opening a destination must not depend on a read-state update.
    }
    if (!mounted) return;
    switch (notification.type) {
      case 'order_created':
      case 'order_ready':
      case 'order_pickup_reminder':
      case 'order_collected':
        Navigator.push(
            context, MaterialPageRoute(builder: (_) => const OrdersPage()));
      case 'tier_reward':
      case 'referral_reward':
      case 'voucher_expiring':
        Navigator.push(
            context, MaterialPageRoute(builder: (_) => const MyRewardsPage()));
      case 'token_topup_paid':
      case 'token_topup_failed':
      case 'token_topup_cancelled':
      case 'token_topup_refunded':
      case 'token_topup_review':
        Navigator.push(context,
            MaterialPageRoute(builder: (_) => const TopUpWalletPage()));
      default:
        _retry();
    }
  }
}
