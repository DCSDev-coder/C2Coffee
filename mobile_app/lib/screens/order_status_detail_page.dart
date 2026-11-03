import 'dart:async';

import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../services/app_session_service.dart';
import '../services/auth_api_service.dart';
import '../services/checkout_api_service.dart';
import '../services/customer_data_service.dart';
import '../services/secure_session_service.dart';
import '../services/payment_security.dart';
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
  Timer? _paymentTimer;
  bool _isRefreshing = false;
  bool _isCollecting = false;
  bool _isCancelling = false;
  bool _isRetryingPayment = false;
  bool _isEmailingReceipt = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _order = widget.order;
    _startPolling();
    _startPaymentTimer();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _refreshOrder(silent: true);
    });
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _paymentTimer?.cancel();
    super.dispose();
  }

  void _startPaymentTimer() {
    _paymentTimer?.cancel();
    if (_order.status != 'pending_payment' || _order.paymentExpiresAt == null) {
      return;
    }
    _paymentTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() {});
    });
  }

  String _paymentCountdown() {
    final expiresAt = _order.paymentExpiresAt;
    if (expiresAt == null) return 'Payment window is being checked.';
    final remaining = expiresAt.difference(DateTime.now());
    if (remaining.isNegative || remaining.inSeconds <= 0) {
      return 'Payment window expired. Check the status before trying again.';
    }
    final minutes = remaining.inMinutes;
    final seconds = remaining.inSeconds % 60;
    return 'Payment window: $minutes:${seconds.toString().padLeft(2, '0')} remaining';
  }

  Future<void> _continuePayment() async {
    if (_isRefreshing) return;
    try {
      final accessToken =
          await SecureSessionService.instance.getValidAccessToken();
      if (accessToken == null || accessToken.isEmpty) {
        throw ApiException('Missing access token.',
            code: 'missing_access_token');
      }
      final payment = await CustomerDataService.instance.getOrderPayment(
        accessToken: accessToken,
        orderId: _order.id,
      );
      final checkoutUrl = payment['checkout_url'] as String?;
      if (checkoutUrl == null || !isTrustedPaymentCheckoutUrl(checkoutUrl)) {
        await _refreshOrder(silent: true);
        if (!mounted) return;
        await _retryPayment();
        return;
      }
      await launchUrl(Uri.parse(checkoutUrl),
          mode: LaunchMode.externalApplication);
    } on ApiException catch (error) {
      if (mounted) AppNotification.showError(context, _friendlyMessage(error));
    } catch (_) {
      if (mounted) {
        AppNotification.showError(
            context, 'Unable to reopen the payment page right now.');
      }
    }
  }

  Future<void> _retryPayment() async {
    if (_isRetryingPayment) return;
    final method = await showDialog<String>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text('Choose another payment method',
            style: TextStyle(
                fontFamily: 'Recoleta',
                fontWeight: FontWeight.bold,
                color: AppColors.deepTeal)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            for (final option in const [
              ('fpx', 'FPX Online Banking'),
              ('duitnow_qr', 'DuitNow QR'),
              ('card', 'Debit / Credit Card'),
              ('ewallet', 'Online Payment'),
            ])
              ListTile(
                title: Text(option.$2,
                    style: const TextStyle(fontFamily: 'Afacad')),
                leading: Icon(Icons.payment, color: AppColors.deepTeal),
                onTap: () => Navigator.of(dialogContext).pop(option.$1),
              ),
          ],
        ),
      ),
    );
    if (method == null || !mounted) return;
    setState(() => _isRetryingPayment = true);
    try {
      final accessToken =
          await SecureSessionService.instance.getValidAccessToken();
      if (accessToken == null || accessToken.isEmpty) {
        throw ApiException('Missing access token.',
            code: 'missing_access_token');
      }
      final payment = await CustomerDataService.instance.retryOrderPayment(
        accessToken: accessToken,
        orderId: _order.id,
        paymentMethod: method,
      );
      final checkoutUrl = payment['checkout_url'] as String?;
      if (checkoutUrl == null || !isTrustedPaymentCheckoutUrl(checkoutUrl)) {
        throw ApiException('The new payment page is not available yet.');
      }
      await launchUrl(Uri.parse(checkoutUrl),
          mode: LaunchMode.externalApplication);
      await _refreshOrder(silent: true);
    } on ApiException catch (error) {
      if (mounted) AppNotification.showError(context, _friendlyMessage(error));
    } catch (_) {
      if (mounted) {
        AppNotification.showError(
            context, 'Unable to start another payment method right now.');
      }
    } finally {
      if (mounted) setState(() => _isRetryingPayment = false);
    }
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
        _startPaymentTimer();
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

  bool get _canCancelOrder =>
      _order.status == 'pending_payment' && _order.paymentMode == 'direct';

  bool get _canRequestCancellation =>
      const {'paid', 'accepted'}.contains(_order.status) &&
      (_order.paymentMode == 'token' || _order.paymentStatus == 'paid') &&
      _order.cancellationRequestStatus == null;

  bool get _hasCancellationRequest =>
      _order.cancellationRequestStatus != null &&
      _order.cancellationRequestStatus != 'rejected' &&
      _order.cancellationRequestStatus != 'withdrawn';

  bool get _paymentConfirmed =>
      const {
        'paid',
        'accepted',
        'preparing',
        'ready_for_pickup',
        'collected',
      }.contains(_order.status) &&
      _order.paymentStatus != 'refunded';

  Future<void> _cancelOrder() async {
    if (_isCancelling) return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
        title: Text(
          'Cancel this order?',
          style: TextStyle(
            fontFamily: 'Recoleta',
            fontWeight: FontWeight.bold,
            color: AppColors.deepTeal,
          ),
        ),
        content: Text(
          _order.status == 'pending_payment'
              ? 'This will close the current payment attempt and cancel the unpaid order. No payment will be taken, and you can place a new order later.'
              : 'This is only available before the store starts preparing your order. Your tokens will be returned immediately and this cannot be undone.',
          style: const TextStyle(fontFamily: 'Afacad', height: 1.35),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.deepTeal,
              foregroundColor: Colors.white,
            ),
            child: const Text('Cancel order'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    setState(() {
      _isCancelling = true;
      _errorMessage = null;
    });
    try {
      final accessToken =
          await SecureSessionService.instance.getValidAccessToken();
      if (accessToken == null || accessToken.isEmpty) {
        throw ApiException('Missing access token.',
            code: 'missing_access_token');
      }
      final result = await CustomerDataService.instance.cancelOrder(
        accessToken: accessToken,
        orderId: _order.id,
      );
      final tokenBalance = (result['token_balance'] as num?)?.toInt();
      if (tokenBalance != null) {
        AppSessionService.instance.applyTokenBalance(tokenBalance);
      }
      await _refreshOrder(silent: true);
      if (!mounted) return;
      final returnedTokens = (result['returned_tokens'] as num?)?.toInt() ?? 0;
      AppNotification.showSuccess(
        context,
        returnedTokens > 0
            ? '$returnedTokens tokens returned. Your order is cancelled.'
            : 'Your unpaid order is cancelled. No payment was taken.',
      );
    } on ApiException catch (error) {
      if (!mounted) return;
      final message = _friendlyMessage(error);
      setState(() => _errorMessage = message);
      AppNotification.showError(context, message);
    } catch (_) {
      if (!mounted) return;
      const message = 'Unable to cancel this order right now.';
      setState(() => _errorMessage = message);
      AppNotification.showError(context, message);
    } finally {
      if (mounted) setState(() => _isCancelling = false);
    }
  }

  Future<void> _requestCancellation() async {
    if (_isCancelling) return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
        title: Text(
          'Request cancellation?',
          style: TextStyle(
            fontFamily: 'Recoleta',
            fontWeight: FontWeight.bold,
            color: AppColors.deepTeal,
          ),
        ),
        content: const Text(
          'Your request will be sent to the barista. The order stays active until the store decides, and the request may be declined once preparation begins.',
          style: TextStyle(fontFamily: 'Afacad', height: 1.35),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(),
              child: const Text('Keep order')),
          ElevatedButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.deepTeal,
                foregroundColor: Colors.white),
            child: const Text('Send request'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    setState(() {
      _isCancelling = true;
      _errorMessage = null;
    });
    try {
      final accessToken =
          await SecureSessionService.instance.getValidAccessToken();
      if (accessToken == null || accessToken.isEmpty) {
        throw ApiException('Missing access token.',
            code: 'missing_access_token');
      }
      await CustomerDataService.instance.requestOrderCancellation(
        accessToken: accessToken,
        orderId: _order.id,
      );
      await _refreshOrder(silent: true);
      if (!mounted) return;
      AppNotification.showSuccess(
          context, 'Cancellation request sent to the barista.');
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() => _errorMessage = _friendlyMessage(error));
      AppNotification.showError(context, _friendlyMessage(error));
    } catch (_) {
      if (!mounted) return;
      const message = 'Unable to send the cancellation request right now.';
      setState(() => _errorMessage = message);
      AppNotification.showError(context, message);
    } finally {
      if (mounted) setState(() => _isCancelling = false);
    }
  }

  Future<void> _emailReceipt() async {
    if (_isEmailingReceipt) return;
    setState(() {
      _isEmailingReceipt = true;
      _errorMessage = null;
    });
    try {
      final accessToken =
          await SecureSessionService.instance.getValidAccessToken();
      if (accessToken == null || accessToken.isEmpty) {
        throw ApiException('Missing access token.',
            code: 'missing_access_token');
      }
      await CheckoutApiService.instance.emailOrderReceipt(
        accessToken: accessToken,
        orderId: _order.id,
      );
      if (!mounted) return;
      AppNotification.showSuccess(
        context,
        'Your receipt is being sent to your registered email address.',
      );
    } on ApiException catch (error) {
      if (!mounted) return;
      final message = error.code == 'receipt_email_unavailable'
          ? 'Add and verify an email address in Settings before requesting a receipt.'
          : _friendlyMessage(error);
      setState(() => _errorMessage = message);
      AppNotification.showError(context, message);
    } catch (_) {
      if (!mounted) return;
      const message =
          'Unable to email your receipt right now. Please try again.';
      setState(() => _errorMessage = message);
      AppNotification.showError(context, message);
    } finally {
      if (mounted) setState(() => _isEmailingReceipt = false);
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
        return friendlyCustomerErrorMessage(
          error,
          fallback:
              'We could not update this order right now. Please try again.',
        );
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
        return 'This order was refunded. Check your C2 Credit history for any token return.';
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
        return 'assets/images/OrderStatus/2.png';
      case 'ready_for_pickup':
      case 'collected':
        return 'assets/images/OrderStatus/3.png';
      default:
        return 'assets/images/OrderStatus/4.png';
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
                fontSize: 15,
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
                fontSize: 30,
                fontWeight: FontWeight.bold,
                color: AppColors.deepTeal,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              _orderTitle(),
              style: const TextStyle(
                fontFamily: 'Afacad',
                fontSize: 17,
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
            if (status == 'pending_payment' &&
                _order.paymentMode == 'direct') ...[
              const SizedBox(height: 18),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  color: AppColors.surfaceLight,
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: AppColors.border),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Payment still in progress',
                        style: TextStyle(
                            fontFamily: 'Recoleta',
                            fontSize: 20,
                            fontWeight: FontWeight.bold,
                            color: AppColors.deepTeal)),
                    const SizedBox(height: 6),
                    Text(_paymentCountdown(),
                        style: const TextStyle(
                            fontFamily: 'Afacad',
                            fontSize: 16,
                            color: Colors.black87)),
                    const SizedBox(height: 8),
                    const Text(
                        'Retry reopens the current payment when it is still available. If its window has closed, you can safely choose another payment method for this same order.',
                        style: TextStyle(
                            fontFamily: 'Afacad',
                            fontSize: 15,
                            height: 1.3,
                            color: Colors.black54)),
                    const SizedBox(height: 14),
                    Row(
                      children: [
                        Expanded(
                            child: OutlinedButton(
                                onPressed: _isRefreshing
                                    ? null
                                    : () => _refreshOrder(),
                                child: const Text('CHECK STATUS'))),
                        const SizedBox(width: 10),
                        Expanded(
                            child: ElevatedButton(
                                onPressed: _continuePayment,
                                style: ElevatedButton.styleFrom(
                                    backgroundColor: AppColors.deepTeal,
                                    foregroundColor: Colors.white),
                                child: const Text('RETRY PAYMENT'))),
                      ],
                    ),
                    const SizedBox(height: 10),
                    SizedBox(
                      width: double.infinity,
                      child: TextButton(
                        onPressed: _isRetryingPayment ? null : _retryPayment,
                        child: Text(
                          _isRetryingPayment
                              ? 'CHECKING PAYMENT...'
                              : 'USE ANOTHER PAYMENT METHOD',
                          style: TextStyle(
                              fontFamily: 'Afacad',
                              fontWeight: FontWeight.bold,
                              color: AppColors.deepTeal),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
            const SizedBox(height: 28),
            Text(
              _statusTitle(status),
              textAlign: TextAlign.center,
              style: TextStyle(
                fontFamily: 'Recoleta',
                fontSize: 32,
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
                fontSize: 19,
                color: Colors.black87,
                height: 1.35,
              ),
            ),
            if (_errorMessage != null) ...[
              const SizedBox(height: 18),
              Text(
                _errorMessage!,
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontFamily: 'Afacad',
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: Colors.red.shade700,
                ),
              ),
            ],
            if (_paymentConfirmed) ...[
              const SizedBox(height: 32),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: _isEmailingReceipt ? null : _emailReceipt,
                  icon: const Icon(Icons.email_outlined),
                  label: Text(
                    _isEmailingReceipt ? 'SENDING RECEIPT...' : 'EMAIL RECEIPT',
                    style: const TextStyle(
                      fontFamily: 'Recoleta',
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.deepTeal,
                    side: BorderSide(color: AppColors.border),
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(18),
                    ),
                  ),
                ),
              ),
            ],
            const SizedBox(height: 12),
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
                      fontSize: 18,
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
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ),
            if (_canRequestCancellation) ...[
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: TextButton(
                  onPressed: _isCancelling ? null : _requestCancellation,
                  child: Text(
                    _isCancelling
                        ? 'SENDING REQUEST...'
                        : 'REQUEST CANCELLATION',
                    style: TextStyle(
                      fontFamily: 'Afacad',
                      fontWeight: FontWeight.bold,
                      color: AppColors.deepTeal,
                    ),
                  ),
                ),
              ),
            ],
            if (_hasCancellationRequest) ...[
              const SizedBox(height: 12),
              Text(
                _order.cancellationRequestStatus == 'refund_pending'
                    ? 'Cancellation approved. Direct-payment refund is still pending provider confirmation.'
                    : 'Cancellation request sent. The barista will decide before preparation starts.',
                textAlign: TextAlign.center,
                style:
                    TextStyle(fontFamily: 'Afacad', color: AppColors.deepTeal),
              ),
            ],
            if (_canCancelOrder) ...[
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: TextButton(
                  onPressed: _isCancelling ? null : _cancelOrder,
                  child: Text(
                    _isCancelling ? 'CANCELLING...' : 'CANCEL UNPAID PAYMENT',
                    style: TextStyle(
                        fontFamily: 'Afacad',
                        fontWeight: FontWeight.bold,
                        color: AppColors.deepTeal),
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
