import 'dart:async';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../services/customer_data_service.dart';
import '../services/notification_service.dart';
import '../services/secure_session_service.dart';
import '../utils/app_colors.dart';
import '../utils/app_notification.dart';
import '../widgets/app_page_shell.dart';
import 'loading_order_page.dart';
import 'my_rewards_page.dart';
import 'order_details_page.dart';
import 'order_status_detail_page.dart';
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
  static const int _initialDisplayLimit = 5;
  static const int _displayPageStep = 5;

  final ScrollController _scrollController = ScrollController();
  late Future<_NotificationInboxData> _notificationsFuture;
  _NotificationInboxData? _lastLoadedInbox;
  bool _clearing = false;
  int _displayLimit = _initialDisplayLimit;
  bool _showScrollToTop = false;

  @override
  void initState() {
    super.initState();
    _notificationsFuture = _loadNotifications();
    _scrollController.addListener(_handleScroll);
    NotificationService.instance.inboxRevision.addListener(_refreshInbox);
  }

  @override
  void dispose() {
    NotificationService.instance.inboxRevision.removeListener(_refreshInbox);
    _scrollController.removeListener(_handleScroll);
    _scrollController.dispose();
    super.dispose();
  }

  void _handleScroll() {
    final shouldShow =
        _scrollController.hasClients && _scrollController.offset > 300;
    if (shouldShow != _showScrollToTop && mounted) {
      setState(() => _showScrollToTop = shouldShow);
    }
  }

  Future<void> _scrollToTop() async {
    if (!_scrollController.hasClients) return;
    await _scrollController.animateTo(
      0,
      duration: const Duration(milliseconds: 450),
      curve: Curves.easeOutCubic,
    );
  }

  void _refreshInbox() {
    if (!mounted || _clearing) return;
    setState(() {
      _notificationsFuture = _loadNotifications();
    });
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
    await NotificationService.instance.refreshIndicator(
      accessToken: accessToken,
    );
    final inbox = _NotificationInboxData(
      paymentNotices: results[0] as List<PaymentServiceNotice>,
      notifications: results[1] as List<InAppNotification>,
    );
    _lastLoadedInbox = inbox;
    return inbox;
  }

  Future<void> _handleRefresh() async {
    final future = _loadNotifications();
    setState(() {
      _notificationsFuture = future;
    });
    try {
      await future;
    } catch (_) {
      // Handled by FutureBuilder.
    }
  }

  void _retry() {
    setState(() {
      _notificationsFuture = _loadNotifications();
    });
  }

  Future<void> _clearAll() async {
    final confirmed = await showDialog<bool>(
      context: context,
      barrierColor: Colors.black.withValues(alpha: 0.58),
      builder: (dialogContext) => Dialog(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        insetPadding: const EdgeInsets.symmetric(horizontal: 22),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(28),
        ),
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 46,
                    height: 46,
                    decoration: BoxDecoration(
                      color: AppColors.deepTeal.withValues(alpha: 0.10),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Icon(
                      Icons.notifications_off_outlined,
                      color: AppColors.deepTeal,
                      size: 24,
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Clear Latest Updates?',
                          style: TextStyle(
                            fontFamily: 'Recoleta',
                            fontSize: 22,
                            fontWeight: FontWeight.bold,
                            color: AppColors.deepTeal,
                            height: 1.15,
                          ),
                        ),
                        const SizedBox(height: 4),
                        const Text(
                          'Remove all current updates from your inbox.',
                          style: TextStyle(
                            fontFamily: 'Afacad',
                            fontSize: 15,
                            color: Colors.black54,
                          ),
                        ),
                      ],
                    ),
                  ),
                  InkWell(
                    onTap: () => Navigator.pop(dialogContext, false),
                    borderRadius: BorderRadius.circular(20),
                    child: Container(
                      width: 32,
                      height: 32,
                      decoration: BoxDecoration(
                        color: Colors.grey.shade100,
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(
                        Icons.close_rounded,
                        size: 18,
                        color: Colors.black54,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              const Text(
                'New order status alerts, wallet top-ups, and reward updates will continue to appear here automatically.',
                style: TextStyle(
                  fontFamily: 'Afacad',
                  fontSize: 15.5,
                  height: 1.4,
                  color: Colors.black87,
                ),
              ),
              const SizedBox(height: 14),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.surfaceLight,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: AppColors.border),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(
                      Icons.info_outline_rounded,
                      color: AppColors.deepTeal,
                      size: 19,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Active payment service notices stay visible until they expire or are resolved.',
                        style: TextStyle(
                          fontFamily: 'Afacad',
                          fontSize: 14,
                          height: 1.3,
                          fontWeight: FontWeight.w600,
                          color: AppColors.deepTeal,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 22),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => Navigator.pop(dialogContext, false),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: Colors.black87,
                        side: BorderSide(color: Colors.grey.shade300),
                        padding: const EdgeInsets.symmetric(vertical: 13),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                        ),
                      ),
                      child: const Text(
                        'Cancel',
                        style: TextStyle(
                          fontFamily: 'Afacad',
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: () => Navigator.pop(dialogContext, true),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.deepTeal,
                        foregroundColor: Colors.white,
                        elevation: 0,
                        padding: const EdgeInsets.symmetric(vertical: 13),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                        ),
                      ),
                      icon: const Icon(Icons.delete_sweep_outlined, size: 18),
                      label: const Text(
                        'Clear All',
                        style: TextStyle(
                          fontFamily: 'Afacad',
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                          color: Colors.white,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
    if (confirmed != true || !mounted) return;

    setState(() => _clearing = true);
    String? accessToken;
    try {
      accessToken = await SecureSessionService.instance.getValidAccessToken();
      if (accessToken == null || accessToken.isEmpty) {
        throw Exception('Please sign in again to clear notifications.');
      }
      await NotificationService.instance.clearNotifications(
        accessToken: accessToken,
      );
    } catch (_) {
      if (!mounted) return;
      AppNotification.showError(
        context,
        'We could not clear notifications. Please try again.',
      );
      setState(() => _clearing = false);
      return;
    }

    if (!mounted) return;
    final clearedInbox = _NotificationInboxData(
      paymentNotices:
          _lastLoadedInbox?.paymentNotices ?? const <PaymentServiceNotice>[],
      notifications: const [],
    );
    _lastLoadedInbox = clearedInbox;
    NotificationService.instance.markLatestUpdatesCleared();
    setState(() {
      _notificationsFuture = Future.value(clearedInbox);
      _clearing = false;
      _displayLimit = _initialDisplayLimit;
    });
    AppNotification.showSuccess(context, 'Latest updates cleared.');
    unawaited(NotificationService.instance.refreshIndicator(
      accessToken: accessToken,
    ));
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: true,
      child: AppPageShell(
        title: 'NOTIFICATIONS',
        onBack: () => InteractiveFillingLoader.showPop(context),
        backgroundColor: Colors.white,
        scrollController: _scrollController,
        onRefresh: _handleRefresh,
        overlay: Stack(
          children: [
            if (_showScrollToTop)
              Positioned(
                right: 18,
                bottom: 24 + MediaQuery.paddingOf(context).bottom,
                child: Semantics(
                  button: true,
                  label: 'Back to top',
                  child: Material(
                    color: AppColors.deepTeal,
                    elevation: 5,
                    shadowColor: Colors.black26,
                    shape: const CircleBorder(),
                    child: InkWell(
                      customBorder: const CircleBorder(),
                      onTap: _scrollToTop,
                      child: const SizedBox(
                        width: 48,
                        height: 48,
                        child: Icon(
                          Icons.keyboard_arrow_up_rounded,
                          color: Colors.white,
                          size: 30,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
          ],
        ),
        bodyPadding: const EdgeInsets.fromLTRB(20, 20, 20, 44),
        child: FutureBuilder<_NotificationInboxData>(
          future: _notificationsFuture,
          builder: (context, snapshot) {
            if (snapshot.connectionState == ConnectionState.waiting &&
                _lastLoadedInbox == null) {
              return SizedBox(
                height: 240,
                child: Center(
                  child: CircularProgressIndicator(
                    color: AppColors.deepTeal,
                  ),
                ),
              );
            }

            if (snapshot.hasError && _lastLoadedInbox == null) {
              return _buildStateCard(
                icon: Icons.cloud_off_rounded,
                title: 'Unable to load notifications',
                message:
                    'We could not load your notifications right now. Please try again shortly.',
                actionLabel: 'Try Again',
                onAction: _retry,
              );
            }

            final inbox = snapshot.data ??
                _lastLoadedInbox ??
                const _NotificationInboxData(
                  paymentNotices: [],
                  notifications: [],
                );
            final notifications = inbox.notifications;
            if (notifications.isEmpty && inbox.paymentNotices.isEmpty) {
              return _buildStateCard(
                icon: Icons.notifications_none_rounded,
                title: 'No notifications yet',
                message:
                    'Order updates, token top-ups, referrals, and rewards will appear here.',
              );
            }

            final visibleCount = notifications.length < _displayLimit
                ? notifications.length
                : _displayLimit;
            final visibleList = notifications.sublist(0, visibleCount);
            final remainingCount = notifications.length - visibleCount;
            final canCollapse = notifications.length > _initialDisplayLimit &&
                visibleCount > _initialDisplayLimit;

            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (inbox.paymentNotices.isNotEmpty) ...[
                  _buildPaymentServiceHeader(inbox.paymentNotices.length),
                  const SizedBox(height: 12),
                  ...inbox.paymentNotices.map((notice) => Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: _buildPaymentServiceNotice(notice),
                      )),
                  const SizedBox(height: 12),
                ],
                if (notifications.isNotEmpty) ...[
                  _buildSectionHeader(
                    'Latest updates',
                    notifications.length,
                  ),
                  const SizedBox(height: 14),
                  for (var i = 0; i < visibleList.length; i++) ...[
                    _buildNotificationItem(visibleList[i]),
                    if (i != visibleList.length - 1) const SizedBox(height: 12),
                  ],
                  if (remainingCount > 0 || canCollapse) ...[
                    const SizedBox(height: 16),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        if (remainingCount > 0)
                          Flexible(
                            child: TextButton(
                              onPressed: () {
                                setState(() {
                                  _displayLimit += _displayPageStep;
                                });
                              },
                              style: TextButton.styleFrom(
                                backgroundColor: AppColors.surfaceLight,
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 16,
                                  vertical: 10,
                                ),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(20),
                                  side: BorderSide(color: AppColors.border),
                                ),
                              ),
                              child: FittedBox(
                                fit: BoxFit.scaleDown,
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Icon(
                                      Icons.keyboard_arrow_down_rounded,
                                      color: AppColors.deepTeal,
                                      size: 20,
                                    ),
                                    const SizedBox(width: 4),
                                    Text(
                                      'Show More ($remainingCount more)',
                                      style: TextStyle(
                                        fontFamily: 'Afacad',
                                        fontSize: 15,
                                        fontWeight: FontWeight.w700,
                                        color: AppColors.deepTeal,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                        if (remainingCount > 0 && canCollapse)
                          const SizedBox(width: 8),
                        if (canCollapse)
                          Flexible(
                            child: TextButton(
                              onPressed: () {
                                setState(() {
                                  _displayLimit = _initialDisplayLimit;
                                });
                              },
                              style: TextButton.styleFrom(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 12,
                                  vertical: 10,
                                ),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(20),
                                ),
                              ),
                              child: const FittedBox(
                                fit: BoxFit.scaleDown,
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Icon(
                                      Icons.keyboard_arrow_up_rounded,
                                      color: Colors.black54,
                                      size: 19,
                                    ),
                                    SizedBox(width: 4),
                                    Text(
                                      'Show Less',
                                      style: TextStyle(
                                        fontFamily: 'Afacad',
                                        fontSize: 15,
                                        fontWeight: FontWeight.w700,
                                        color: Colors.black54,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                      ],
                    ),
                  ],
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
            count == 1
                ? 'Payment service notice'
                : 'Payment service notices ($count)',
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
            style: const TextStyle(
              fontFamily: 'Afacad',
              fontSize: 16,
              height: 1.35,
            ),
          ),
          const SizedBox(height: 12),
          Text(
            'Affected: ${notice.paymentMethodLabel}',
            style: const TextStyle(
              fontFamily: 'Afacad',
              fontSize: 15,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            '${formatter.format(notice.startsAt)} – ${formatter.format(notice.endsAt)}',
            style: TextStyle(
              fontFamily: 'Afacad',
              fontSize: 14,
              color: Colors.grey.shade800,
            ),
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
              fontSize: 21,
              fontWeight: FontWeight.bold,
              color: AppColors.deepTeal,
            ),
          ),
        ),
        InkWell(
          onTap: _clearing ? null : _clearAll,
          borderRadius: BorderRadius.circular(20),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 6),
            decoration: BoxDecoration(
              color: AppColors.surfaceLight,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: AppColors.border),
            ),
            child: _clearing
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : Text(
                    'Clear all',
                    style: TextStyle(
                      fontFamily: 'Afacad',
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: AppColors.deepTeal,
                    ),
                  ),
          ),
        ),
      ],
    );
  }

  Widget _buildStateCard({
    required IconData icon,
    required String title,
    required String message,
    String? actionLabel,
    VoidCallback? onAction,
  }) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 28),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.border, width: 1.4),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        children: [
          Container(
            width: 60,
            height: 60,
            decoration: BoxDecoration(
              color: AppColors.surfaceLight,
              shape: BoxShape.circle,
            ),
            child: Icon(
              icon,
              size: 28,
              color: AppColors.deepTeal,
            ),
          ),
          const SizedBox(height: 14),
          Text(
            title,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontFamily: 'Recoleta',
              fontSize: 22,
              fontWeight: FontWeight.bold,
              color: AppColors.deepTeal,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            message,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontFamily: 'Afacad',
              fontSize: 16,
              color: Colors.black54,
              height: 1.35,
            ),
          ),
          if (actionLabel != null && onAction != null) ...[
            const SizedBox(height: 18),
            ElevatedButton(
              onPressed: onAction,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.deepTeal,
                foregroundColor: Colors.white,
                elevation: 0,
                padding: const EdgeInsets.symmetric(
                  horizontal: 22,
                  vertical: 12,
                ),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
              ),
              child: Text(
                actionLabel,
                style: const TextStyle(
                  fontFamily: 'Afacad',
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  ({IconData icon, Color iconBg, Color iconColor}) _notificationVisuals(
    InAppNotification notification,
  ) {
    final isUnread = !notification.isRead;
    switch (notification.type) {
      case 'order_ready':
      case 'order_pickup_reminder':
        return (
          icon: Icons.local_cafe_rounded,
          iconBg: isUnread ? AppColors.deepTeal : AppColors.surfaceLight,
          iconColor: isUnread ? Colors.white : AppColors.deepTeal,
        );
      case 'order_collected':
        return (
          icon: Icons.task_alt_rounded,
          iconBg: const Color(0xFFE8F5E9),
          iconColor: const Color(0xFF2E7D32),
        );
      case 'order_created':
        return (
          icon: Icons.receipt_long_rounded,
          iconBg: isUnread ? AppColors.deepTeal : AppColors.surfaceLight,
          iconColor: isUnread ? Colors.white : AppColors.deepTeal,
        );
      case 'tier_reward':
      case 'referral_reward':
      case 'voucher_expiring':
      case 'voucher_start_reminder':
      case 'voucher_end_reminder':
        return (
          icon: Icons.card_giftcard_rounded,
          iconBg: AppColors.gold.withValues(alpha: 0.22),
          iconColor: AppColors.deepTeal,
        );
      case 'token_topup_paid':
      case 'token_topup_failed':
      case 'token_topup_cancelled':
      case 'token_topup_refunded':
      case 'token_topup_review':
        return (
          icon: Icons.account_balance_wallet_rounded,
          iconBg: isUnread ? AppColors.deepTeal : AppColors.surfaceLight,
          iconColor: isUnread ? Colors.white : AppColors.deepTeal,
        );
      default:
        return (
          icon: Icons.coffee,
          iconBg: isUnread ? AppColors.deepTeal : AppColors.surfaceLight,
          iconColor: isUnread ? Colors.white : AppColors.deepTeal,
        );
    }
  }

  Widget _buildNotificationItem(InAppNotification notification) {
    final dateLabel =
        DateFormat('d MMM yyyy • h:mm a').format(notification.createdAt);
    final isUnread = !notification.isRead;
    final visuals = _notificationVisuals(notification);

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: isUnread
              ? AppColors.deepTeal.withValues(alpha: 0.22)
              : AppColors.border,
          width: 1.2,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(18),
          onTap: () => _openNotification(notification),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: visuals.iconBg,
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    visuals.icon,
                    color: visuals.iconColor,
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
                                fontWeight: isUnread
                                    ? FontWeight.bold
                                    : FontWeight.w600,
                                color: AppColors.deepTeal,
                                height: 1.2,
                              ),
                            ),
                          ),
                          if (isUnread) ...[
                            const SizedBox(width: 10),
                            Container(
                              width: 9,
                              height: 9,
                              margin: const EdgeInsets.only(top: 5),
                              decoration: BoxDecoration(
                                color: AppColors.terracotta,
                                shape: BoxShape.circle,
                              ),
                            ),
                          ],
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        dateLabel,
                        style: TextStyle(
                          fontFamily: 'Afacad',
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: Colors.grey.shade600,
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
        ),
      ),
    );
  }

  Future<CustomerOrder?> _findOrderForNotification(
    String accessToken,
    InAppNotification notification,
  ) async {
    final orderIdRaw = notification.data['order_id'];
    final orderRefRaw = notification.data['order_ref']?.trim();
    final orderId = orderIdRaw != null ? int.tryParse(orderIdRaw) : null;

    if (orderId == null && (orderRefRaw == null || orderRefRaw.isEmpty)) {
      return null;
    }

    try {
      final result = await CustomerDataService.instance.getOrders(
        accessToken: accessToken,
        limit: 50,
      );
      for (final order in result.orders) {
        if (orderId != null && order.id == orderId) {
          return order;
        }
        if (orderRefRaw != null &&
            orderRefRaw.isNotEmpty &&
            order.orderRef == orderRefRaw) {
          return order;
        }
      }
    } catch (_) {
      // Fall back to OrdersPage tab navigation below.
    }
    return null;
  }

  Future<void> _openNotification(InAppNotification notification) async {
    String? accessToken;
    try {
      accessToken = await SecureSessionService.instance.getValidAccessToken();
      if (accessToken != null &&
          accessToken.isNotEmpty &&
          !notification.isRead) {
        await NotificationService.instance.markRead(
          accessToken: accessToken,
          notificationId: notification.id,
        );
        await NotificationService.instance.refreshIndicator(
          accessToken: accessToken,
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
        CustomerOrder? matchedOrder;
        if (accessToken != null && accessToken.isNotEmpty) {
          matchedOrder = await _findOrderForNotification(
            accessToken,
            notification,
          );
        }
        if (!mounted) return;
        if (matchedOrder != null) {
          final isPastOrder = notification.type == 'order_collected' ||
              const {'collected', 'cancelled', 'refunded'}
                  .contains(matchedOrder.status);
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => isPastOrder
                  ? OrderDetailsPage(order: matchedOrder!)
                  : OrderStatusDetailPage(order: matchedOrder!),
            ),
          );
        } else {
          final tabIndex = notification.type == 'order_collected' ? 1 : 0;
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => OrdersPage(initialTabIndex: tabIndex),
            ),
          );
        }
      case 'tier_reward':
      case 'referral_reward':
      case 'voucher_expiring':
      case 'voucher_start_reminder':
      case 'voucher_end_reminder':
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
