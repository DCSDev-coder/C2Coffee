import 'dart:async';

import 'package:flutter/material.dart';

import '../services/app_session_service.dart';
import '../services/auth_api_service.dart';
import '../services/checkout_api_service.dart';
import '../services/customer_data_service.dart';
import '../services/secure_session_service.dart';
import '../utils/app_colors.dart';
import '../utils/app_notification.dart';
import '../widgets/app_page_shell.dart';

class OrderStatusDetailPage extends StatefulWidget {
  final CustomerOrder order;

  const OrderStatusDetailPage({
    super.key,
    required this.order,
  });

  @override
  State<OrderStatusDetailPage> createState() => _OrderStatusDetailPageState();
}

class _OrderStatusDetailPageState extends State<OrderStatusDetailPage> {
  late CustomerOrder _order;
  Timer? _pollTimer;
  bool _isRefreshing = false;
  bool _isCollecting = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _order = widget.order;
    _startPolling();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _refreshOrder(silent: true);
    });
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    super.dispose();
  }

  void _startPolling() {
    _pollTimer?.cancel();
    if (!_order.isActive) return;

    _pollTimer = Timer.periodic(const Duration(seconds: 5), (_) {
      _refreshOrder(silent: true);
    });
  }

  Future<void> _refreshOrder({bool silent = false}) async {
    if (_isRefreshing) return;
    if (!silent) {
      setState(() {
        _errorMessage = null;
      });
    }

    _isRefreshing = true;
    try {
      final accessToken =
          await SecureSessionService.instance.getValidAccessToken();
      if (accessToken == null || accessToken.isEmpty) {
        throw ApiException(
          'Missing access token.',
          code: 'missing_access_token',
        );
      }

      final snapshot = await CustomerDataService.instance.getOrders(
        accessToken: accessToken,
        limit: 100,
      );
      AppSessionService.instance.syncBackendOrderState(
        snapshot.orders.where((order) => order.isActive).toList(),
      );

      CustomerOrder? latest;
      for (final order in snapshot.orders) {
        if (order.id == _order.id) {
          latest = order;
          break;
        }
      }

      if (!mounted) return;
      if (latest != null) {
        setState(() {
          _order = latest!;
          _errorMessage = null;
        });
        if (!_order.isActive) {
          _pollTimer?.cancel();
        }
      }
    } on ApiException catch (error) {
      if (!mounted || silent) return;
      setState(() {
        _errorMessage = _friendlyMessage(error);
      });
    } catch (_) {
      if (!mounted || silent) return;
      setState(() {
        _errorMessage = 'Unable to refresh this order right now.';
      });
    } finally {
      _isRefreshing = false;
    }
  }

  Future<void> _confirmCollect() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
        title: Text(
          'Confirm pickup?',
          style: TextStyle(
            fontFamily: 'Recoleta',
            fontWeight: FontWeight.bold,
            color: AppColors.deepTeal,
          ),
        ),
        content: const Text(
          'Only mark this order as collected after you have received it from the counter.',
          style: TextStyle(fontFamily: 'Afacad', height: 1.35),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: Text(
              'Cancel',
              style: TextStyle(
                fontFamily: 'Afacad',
                color: AppColors.deepTeal,
              ),
            ),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(context).pop(true),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.deepTeal,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
            child: const Text(
              'I have collected it',
              style: TextStyle(fontFamily: 'Afacad'),
            ),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      await _collectOrder();
    }
  }

  Future<void> _collectOrder() async {
    if (_isCollecting) return;
    setState(() {
      _isCollecting = true;
      _errorMessage = null;
    });

    try {
      final accessToken =
          await SecureSessionService.instance.getValidAccessToken();
      if (accessToken == null || accessToken.isEmpty) {
        throw ApiException(
          'Missing access token.',
          code: 'missing_access_token',
        );
      }

      await CheckoutApiService.instance.collectOrder(
        accessToken: accessToken,
        orderId: _order.id,
      );
      await _refreshOrder(silent: true);

      if (!mounted) return;
      AppNotification.showSuccess(
        context,
        'Order marked as collected.',
      );
    } on ApiException catch (error) {
      if (!mounted) return;
      final msg = _friendlyMessage(error);
      setState(() {
        _errorMessage = msg;
      });
      AppNotification.showError(context, msg);
    } catch (_) {
      if (!mounted) return;
      const msg = 'Unable to mark this order as collected right now.';
      setState(() {
        _errorMessage = msg;
      });
      AppNotification.showError(context, msg);
    } finally {
      if (mounted) {
        setState(() {
          _isCollecting = false;
        });
      }
    }
  }

  String _friendlyMessage(ApiException error) {
    switch (error.code) {
      case 'missing_access_token':
      case 'missing_bearer_token':
      case 'invalid_access_token':
      case 'session_not_found':
      case 'session_version_mismatch':
      case 'user_not_active':
        return 'Your session has expired. Please log in again.';
      case 'order_not_ready_for_collection':
        return 'This order is not ready for pickup yet.';
      default:
        return error.message;
    }
  }

  String _orderTitle() {
    final orderNumber =
        _order.dailyOrderNumber > 0 ? _order.dailyOrderNumber : _order.id;
    return 'Order #$orderNumber';
  }

  String _statusTitle(String status) {
    switch (status) {
      case 'pending_payment':
        return 'Order received';
      case 'paid':
        return 'Payment confirmed';
      case 'accepted':
        return 'Order accepted';
      case 'preparing':
        return 'Brewing';
      case 'ready_for_pickup':
        return 'Ready for pickup';
      case 'collected':
        return 'Collected';
      case 'cancelled':
        return 'Cancelled';
      case 'refunded':
        return 'Refunded';
      default:
        return 'Order update';
    }
  }

  String _statusDescription(String status) {
    switch (status) {
      case 'pending_payment':
        return 'We received your order and are confirming the payment status.';
      case 'paid':
        return 'Your token payment is confirmed. The store will accept the order shortly.';
      case 'accepted':
        return 'The store accepted your order and will start preparing it.';
      case 'preparing':
        return 'Your drink is being prepared by the barista.';
      case 'ready_for_pickup':
        return 'Your order is ready. Please collect it at the pickup counter.';
      case 'collected':
        return 'This order has been marked as collected.';
      case 'cancelled':
        return 'This order was cancelled. Contact support if you need help.';
      case 'refunded':
        return 'This order was refunded. Check your wallet history for any token return.';
      default:
        return 'Open My Order for the latest details.';
    }
  }

  String _estimateLabel(String status) {
    switch (status) {
      case 'pending_payment':
        return 'CONFIRMING';
      case 'paid':
        return 'WAITING FOR STORE';
      case 'accepted':
        return 'IN QUEUE';
      case 'preparing':
        return 'BREWING NOW';
      case 'ready_for_pickup':
        return 'READY';
      case 'collected':
        return 'DONE';
      case 'cancelled':
        return 'CANCELLED';
      case 'refunded':
        return 'REFUNDED';
      default:
        return 'UPDATING';
    }
  }

  void _leavePage() {
    Navigator.of(context).maybePop(_order);
  }

  String _imagePath(String status) {
    switch (status) {
      case 'preparing':
        return 'assets/images/status brew.png';
      case 'ready_for_pickup':
      case 'collected':
        return 'assets/images/status bag.png';
      default:
        return 'assets/images/status received.png';
    }
  }

  int _workflowStage(String status) {
    switch (status) {
      case 'pending_payment':
      case 'paid':
      case 'accepted':
        return 0;
      case 'preparing':
        return 1;
      case 'ready_for_pickup':
      case 'collected':
        return 2;
      default:
        return 0;
    }
  }

  Widget _buildWorkflowNode({
    required String title,
    required IconData icon,
    required bool isActive,
    required bool isCompleted,
    required Color activeColor,
  }) {
    final color = isActive ? activeColor : Colors.grey.shade300;
    return Expanded(
      flex: 3,
      child: Column(
        children: [
          Stack(
            clipBehavior: Clip.none,
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(color: color, shape: BoxShape.circle),
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
                        color: activeColor,
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.check,
                          size: 12, color: Colors.white),
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 8),
          FittedBox(
            fit: BoxFit.scaleDown,
            child: Text(
              title,
              style: TextStyle(
                fontFamily: 'Afacad',
                fontSize: 13,
                fontWeight: FontWeight.bold,
                color: isActive ? Colors.black87 : Colors.grey.shade500,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildWorkflowConnector({required bool isActive}) {
    return Expanded(
      flex: 2,
      child: Container(
        margin: const EdgeInsets.only(bottom: 26),
        height: 4,
        decoration: BoxDecoration(
          color: isActive ? AppColors.deepTeal : Colors.grey.shade300,
          borderRadius: BorderRadius.circular(999),
        ),
      ),
    );
  }

  Widget _buildWorkflowTracker(String status) {
    final stage = _workflowStage(status);
    final isReady = stage == 2;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 18),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: AppColors.deepTeal, width: 1.2),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        children: [
          _buildWorkflowNode(
            title: 'Ordered',
            icon: Icons.receipt_long,
            isActive: true,
            isCompleted: true,
            activeColor: AppColors.deepTeal,
          ),
          _buildWorkflowConnector(isActive: stage >= 1),
          _buildWorkflowNode(
            title: 'Preparing',
            icon: Icons.coffee_maker,
            isActive: stage >= 1,
            isCompleted: stage >= 1,
            activeColor: AppColors.deepTeal,
          ),
          _buildWorkflowConnector(isActive: isReady),
          _buildWorkflowNode(
            title: 'Ready',
            icon: Icons.check,
            isActive: isReady,
            isCompleted: isReady,
            activeColor: AppColors.deepTeal,
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final status = _order.status;
    final canCollect = status == 'ready_for_pickup';

    return AppPageShell(
      title: 'ORDER STATUS',
      onBack: _leavePage,
      backgroundColor: Colors.white,
      scrollable: false,
      bodyPadding: EdgeInsets.zero,
      trailing: IconButton(
        onPressed: () => _refreshOrder(),
        icon: Icon(Icons.refresh, color: AppColors.deepTeal),
      ),
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(24, 28, 24, 36),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Text(
              _estimateLabel(status),
              textAlign: TextAlign.center,
              style: TextStyle(
                fontFamily: 'Recoleta',
                fontSize: 28,
                fontWeight: FontWeight.bold,
                color: AppColors.deepTeal,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              _orderTitle(),
              style: const TextStyle(
                fontFamily: 'Afacad',
                fontSize: 15,
                color: Colors.black54,
              ),
            ),
            const SizedBox(height: 28),
            Image.asset(
              _imagePath(status),
              height: 220,
              width: 220,
              alignment: Alignment.center,
              fit: BoxFit.contain,
            ),
            const SizedBox(height: 28),
            _buildWorkflowTracker(status),
            const SizedBox(height: 28),
            Text(
              _statusTitle(status),
              textAlign: TextAlign.center,
              style: TextStyle(
                fontFamily: 'Recoleta',
                fontSize: 30,
                fontWeight: FontWeight.bold,
                color: AppColors.deepTeal,
              ),
            ),
            const SizedBox(height: 14),
            Text(
              _statusDescription(status),
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontFamily: 'Afacad',
                fontSize: 17,
                color: Colors.black87,
                height: 1.35,
              ),
            ),
            if ((_order.baristaName ?? '').trim().isNotEmpty) ...[
              const SizedBox(height: 12),
              Text(
                'Prepared by ${_order.baristaName!.trim()}',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontFamily: 'Afacad',
                  fontSize: 15,
                  fontWeight: FontWeight.bold,
                  color: AppColors.deepTeal,
                ),
              ),
            ],
            if (_errorMessage != null) ...[
              const SizedBox(height: 18),
              Text(
                _errorMessage!,
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontFamily: 'Afacad',
                  fontSize: 14,
                  fontWeight: FontWeight.bold,
                  color: Colors.red.shade700,
                ),
              ),
            ],
            const SizedBox(height: 32),
            if (canCollect)
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _isCollecting ? null : _confirmCollect,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.deepTeal,
                    disabledBackgroundColor:
                        AppColors.deepTeal.withValues(alpha: 0.35),
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(18),
                    ),
                  ),
                  child: Text(
                    _isCollecting ? 'UPDATING...' : 'MARK AS COLLECTED',
                    style: const TextStyle(
                      fontFamily: 'Recoleta',
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                  ),
                ),
              )
            else
              SizedBox(
                width: double.infinity,
                child: OutlinedButton(
                  onPressed: _leavePage,
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.deepTeal,
                    side: BorderSide(color: AppColors.border),
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(18),
                    ),
                  ),
                  child: const Text(
                    'BACK TO MY ORDER',
                    style: TextStyle(
                      fontFamily: 'Recoleta',
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
