import 'package:flutter/material.dart';

import '../screens/orders_page.dart';
import '../utils/app_colors.dart';
import '../utils/global_state.dart';
import '../services/customer_data_service.dart';
import 'custom_bottom_nav.dart';

class OrderStatusBanner extends StatefulWidget {
  final double? bottomOffset;
  final double? leftOffset;
  final double? rightOffset;

  const OrderStatusBanner({
    super.key,
    this.bottomOffset,
    this.leftOffset,
    this.rightOffset,
  });

  @override
  State<OrderStatusBanner> createState() => _OrderStatusBannerState();
}

class _OrderStatusBannerState extends State<OrderStatusBanner>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<Offset> _slideAnimation;
  late final Animation<double> _fadeAnimation;
  bool _isExpanded = false;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 360),
    );
    _slideAnimation = Tween<Offset>(
      begin: const Offset(0.0, 1.0),
      end: Offset.zero,
    ).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeOutCubic),
    );
    _fadeAnimation = Tween<double>(
      begin: 0,
      end: 1,
    ).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeIn),
    );

    if (globalOrderStatusVisible.value) {
      _controller.forward();
    }
    globalOrderStatusVisible.addListener(_handleVisibleChanged);
  }

  @override
  void dispose() {
    globalOrderStatusVisible.removeListener(_handleVisibleChanged);
    _controller.dispose();
    super.dispose();
  }

  void _handleVisibleChanged() {
    if (globalOrderStatusVisible.value) {
      _controller.forward();
    } else {
      _controller.reverse();
      _isExpanded = false;
    }
  }

  double _progressForStatus(String? rawStatus) {
    switch (rawStatus) {
      case 'pending_payment':
        return 0.20;
      case 'paid':
        return 0.40;
      case 'accepted':
        return 0.60;
      case 'preparing':
        return 0.78;
      case 'ready_for_pickup':
      case 'collected':
        return 1.0;
      default:
        return 0.10;
    }
  }

  Color _progressColor(String? rawStatus) {
    switch (rawStatus) {
      case 'ready_for_pickup':
      case 'collected':
        return AppColors.gold;
      default:
        return AppColors.deepTeal;
    }
  }

  String _statusTitle(String? rawStatus) {
    switch (rawStatus) {
      case 'pending_payment':
        return 'Order placed';
      case 'paid':
        return 'Payment confirmed';
      case 'accepted':
        return 'Order confirmed';
      case 'preparing':
        return 'Processing';
      case 'ready_for_pickup':
        return 'Ready for pickup';
      case 'collected':
        return 'Collected';
      default:
        return 'Order update';
    }
  }

  String _statusHint(String? rawStatus) {
    switch (rawStatus) {
      case 'pending_payment':
        return 'We received your order.';
      case 'paid':
        return 'Your payment is complete.';
      case 'accepted':
        return 'The store has confirmed it.';
      case 'preparing':
        return 'Your drink is being prepared.';
      case 'ready_for_pickup':
        return 'Tap to view the order and mark it collected.';
      case 'collected':
        return 'Order completed.';
      default:
        return 'Tap to view order details.';
    }
  }

  double _summaryProgress(List<CustomerOrder> activeOrders) {
    if (activeOrders.isEmpty) return 0;

    final readyCount = activeOrders
        .where((order) => order.status == 'ready_for_pickup')
        .length;
    return readyCount / activeOrders.length;
  }

  String _summaryLabel(List<CustomerOrder> activeOrders) {
    if (activeOrders.isEmpty) return '0/0 ready';

    final readyCount = activeOrders
        .where((order) => order.status == 'ready_for_pickup')
        .length;
    return '$readyCount/${activeOrders.length} ready';
  }

  String _orderTitle(CustomerOrder order) {
    final orderNumber =
        order.dailyOrderNumber > 0 ? order.dailyOrderNumber : order.id;
    return 'Order #$orderNumber';
  }

  void _openOrdersPage() {
    if (!mounted) return;

    CustomBottomNav.switchTab(
      context,
      const OrdersPage(initialTabIndex: 0),
    );
  }

  Widget _buildFallbackBanner({
    required String? rawStatus,
    required double effectiveBottomOffset,
    required double effectiveLeftOffset,
    required double effectiveRightOffset,
  }) {
    final progress = _progressForStatus(rawStatus);
    final progressColor = _progressColor(rawStatus);

    return Positioned(
      left: effectiveLeftOffset,
      right: effectiveRightOffset,
      bottom: effectiveBottomOffset,
      child: IgnorePointer(
        ignoring: !globalOrderStatusVisible.value ||
            _controller.status == AnimationStatus.dismissed ||
            _controller.status == AnimationStatus.reverse,
        child: SlideTransition(
          position: _slideAnimation,
          child: FadeTransition(
            opacity: _fadeAnimation,
            child: GestureDetector(
              onTap: () {
                _openOrdersPage();
              },
              child: Container(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 10),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(
                    color: AppColors.deepTeal,
                    width: 1.25,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.08),
                      blurRadius: 14,
                      offset: const Offset(0, 5),
                    ),
                  ],
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          width: 10,
                          height: 10,
                          decoration: BoxDecoration(
                            color: progressColor,
                            shape: BoxShape.circle,
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            _statusTitle(rawStatus),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontFamily: 'Recoleta',
                              fontSize: 13,
                              fontWeight: FontWeight.bold,
                              color: AppColors.deepTeal,
                              height: 1.1,
                            ),
                          ),
                        ),
                        Text(
                          '${(progress * 100).round()}%',
                          style: TextStyle(
                            fontFamily: 'Afacad',
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                            color: AppColors.deepTeal,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(999),
                      child: LinearProgressIndicator(
                        value: progress,
                        minHeight: 4,
                        backgroundColor:
                            AppColors.deepTeal.withValues(alpha: 0.12),
                        valueColor: AlwaysStoppedAnimation<Color>(
                          progressColor,
                        ),
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      _statusHint(rawStatus),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontFamily: 'Afacad',
                        fontSize: 11,
                        color: Colors.black54,
                        height: 1.1,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildOrderTile(CustomerOrder order) {
    final progress = _progressForStatus(order.status);
    final progressColor = _progressColor(order.status);
    final isReady = order.status == 'ready_for_pickup';

    return GestureDetector(
      onTap: _openOrdersPage,
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color:
                isReady ? AppColors.gold.withValues(alpha: 0.45) : AppColors.border,
            width: 1,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    _orderTitle(order),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontFamily: 'Recoleta',
                      fontSize: 13,
                      fontWeight: FontWeight.bold,
                      color: AppColors.deepTeal,
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Text(
                  _statusTitle(order.status),
                  style: TextStyle(
                    fontFamily: 'Afacad',
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    color: progressColor,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),
            ClipRRect(
              borderRadius: BorderRadius.circular(999),
              child: LinearProgressIndicator(
                value: progress,
                minHeight: 6,
                backgroundColor: AppColors.deepTeal.withValues(alpha: 0.10),
                valueColor: AlwaysStoppedAnimation<Color>(progressColor),
              ),
            ),
            const SizedBox(height: 6),
            Text(
              _statusHint(order.status),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontFamily: 'Afacad',
                fontSize: 11,
                color: Colors.black54,
                height: 1.1,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildChevronButton() {
    return GestureDetector(
      onTap: () {
        setState(() {
          _isExpanded = !_isExpanded;
        });
      },
      behavior: HitTestBehavior.opaque,
      child: Padding(
        padding: const EdgeInsets.only(left: 6),
        child: Icon(
          _isExpanded ? Icons.expand_less : Icons.expand_more,
          size: 20,
          color: AppColors.deepTeal,
        ),
      ),
    );
  }

  Widget _buildHeaderRow({
    required String title,
    required String summaryLabel,
    required Color progressColor,
    required bool allowExpand,
    required String helperText,
  }) {
    return Row(
      children: [
        Container(
          width: 10,
          height: 10,
          decoration: BoxDecoration(
            color: progressColor,
            shape: BoxShape.circle,
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: GestureDetector(
            onTap: _openOrdersPage,
            behavior: HitTestBehavior.opaque,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontFamily: 'Recoleta',
                    fontSize: 13,
                    fontWeight: FontWeight.bold,
                    color: AppColors.deepTeal,
                    height: 1.1,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  helperText,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontFamily: 'Afacad',
                    fontSize: 11,
                    color: Colors.black54,
                    height: 1.1,
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(width: 10),
        GestureDetector(
          onTap: _openOrdersPage,
          behavior: HitTestBehavior.opaque,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                summaryLabel,
                style: TextStyle(
                  fontFamily: 'Afacad',
                  fontSize: 11,
                  fontWeight: FontWeight.bold,
                  color: AppColors.deepTeal,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                allowExpand ? 'Tap chevron for details' : 'View orders',
                style: TextStyle(
                  fontFamily: 'Afacad',
                  fontSize: 10,
                  color: Colors.black54,
                ),
              ),
            ],
          ),
        ),
        if (allowExpand) ...[
          const SizedBox(width: 6),
          _buildChevronButton(),
        ],
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final effectiveBottomOffset =
        widget.bottomOffset ?? (88 + MediaQuery.paddingOf(context).bottom);
    final effectiveLeftOffset = widget.leftOffset ?? 16.0;
    final effectiveRightOffset = widget.rightOffset ?? 16.0;

    return ValueListenableBuilder<bool>(
      valueListenable: globalOrderStatusVisible,
      builder: (context, isVisible, child) {
        return ValueListenableBuilder<List<CustomerOrder>>(
          valueListenable: globalActiveOrders,
          builder: (context, activeOrders, child) {
            if (!isVisible && _controller.isDismissed) {
              return const SizedBox.shrink();
            }

            if (activeOrders.isEmpty) {
              return ValueListenableBuilder<String?>(
                valueListenable: globalOrderStatusRawStatus,
                builder: (context, rawStatus, child) {
                  if (!isVisible && _controller.isDismissed) {
                    return const SizedBox.shrink();
                  }
                  if (rawStatus == null) {
                    return const SizedBox.shrink();
                  }
                  return _buildFallbackBanner(
                    rawStatus: rawStatus,
                    effectiveBottomOffset: effectiveBottomOffset,
                    effectiveLeftOffset: effectiveLeftOffset,
                    effectiveRightOffset: effectiveRightOffset,
                  );
                },
              );
            }

            final readyCount = activeOrders
                .where((order) => order.status == 'ready_for_pickup')
                .length;
            final progress = _summaryProgress(activeOrders);
            final progressColor = readyCount >= activeOrders.length
                ? AppColors.gold
                : AppColors.deepTeal;
            final summaryLabel = _summaryLabel(activeOrders);

            return Positioned(
              left: effectiveLeftOffset,
              right: effectiveRightOffset,
              bottom: effectiveBottomOffset,
              child: IgnorePointer(
                ignoring: !isVisible ||
                    _controller.status == AnimationStatus.dismissed ||
                    _controller.status == AnimationStatus.reverse,
                child: SlideTransition(
                  position: _slideAnimation,
                  child: FadeTransition(
                    opacity: _fadeAnimation,
                    child: GestureDetector(
                      onTap: _openOrdersPage,
                      behavior: HitTestBehavior.opaque,
                      child: AnimatedSize(
                        duration: const Duration(milliseconds: 220),
                        curve: Curves.easeOutCubic,
                        child: Container(
                          padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(18),
                            border: Border.all(
                              color: AppColors.deepTeal,
                              width: 1.25,
                            ),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withValues(alpha: 0.08),
                                blurRadius: 14,
                                offset: const Offset(0, 5),
                              ),
                            ],
                          ),
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              _buildHeaderRow(
                                title: 'Orders in progress',
                                summaryLabel: summaryLabel,
                                progressColor: progressColor,
                                allowExpand: true,
                                helperText: _isExpanded
                                    ? 'Tap chevron to collapse'
                                    : 'Tap header to open orders',
                              ),
                              const SizedBox(height: 6),
                              ClipRRect(
                                borderRadius: BorderRadius.circular(999),
                                child: LinearProgressIndicator(
                                  value: progress,
                                  minHeight: 4,
                                  backgroundColor:
                                      AppColors.deepTeal.withValues(alpha: 0.12),
                                  valueColor: AlwaysStoppedAnimation<Color>(
                                    progressColor,
                                  ),
                                ),
                              ),
                              const SizedBox(height: 6),
                              if (_isExpanded) ...[
                                const SizedBox(height: 12),
                                ConstrainedBox(
                                  constraints:
                                      const BoxConstraints(maxHeight: 260),
                                  child: SingleChildScrollView(
                                    child: Column(
                                      children: [
                                        for (var i = 0;
                                            i < activeOrders.length;
                                            i++) ...[
                                          if (i > 0) const SizedBox(height: 10),
                                          _buildOrderTile(activeOrders[i]),
                                        ],
                                      ],
                                    ),
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            );
          },
        );
      },
    );
  }
}
