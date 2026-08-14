import 'dart:io';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../services/app_session_service.dart';
import '../services/auth_api_service.dart';
import '../services/checkout_api_service.dart';
import '../services/customer_data_service.dart';
import '../services/catalog_api_service.dart';
import '../services/cart_service.dart';
import '../services/secure_session_service.dart';
import '../utils/app_colors.dart';
import '../widgets/custom_bottom_nav.dart';
import '../widgets/order_status_banner.dart';
import 'order_confirmation_page.dart';
import 'home_page.dart';
import 'loading_order_page.dart';
import 'menu_page.dart';
import 'profile_page.dart';
import 'rewards_page.dart';

class OrdersPage extends StatefulWidget {
  final File? initialPickedImage;
  final String? initialPresetPath;
  final int initialAvatarIndex;
  final int initialTabIndex;

  const OrdersPage({
    super.key,
    this.initialPickedImage,
    this.initialPresetPath,
    this.initialAvatarIndex = 0,
    this.initialTabIndex = 0,
  });

  @override
  State<OrdersPage> createState() => _OrdersPageState();
}

class _OrdersPageState extends State<OrdersPage>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;
  final AppSessionService _session = AppSessionService.instance;
  bool _isOrdersLoading = true;
  String? _ordersError;
  CustomerOrder? _activeOrder;
  List<CustomerOrder> _orders = const [];
  int _historyDisplayLimit = 10;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(
      length: 2,
      vsync: this,
      initialIndex: widget.initialTabIndex,
    );
    _session.addListener(_handleSessionChanged);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadOrders();
    });
  }

  @override
  void dispose() {
    _session.removeListener(_handleSessionChanged);
    _tabController.dispose();
    super.dispose();
  }

  void _handleSessionChanged() {
    if (mounted) {
      setState(() {});
    }
  }

  CustomerOrder? get _displayActiveOrder =>
      _activeOrder;

  List<CustomerOrder> get _displayHistoryOrders {
    final backendHistoryOrders =
        _orders.where((order) => !order.isActive).toList(growable: true);
    return backendHistoryOrders
        .take(_historyDisplayLimit)
        .toList(growable: false);
  }

  int get _totalHistoryOrderCount {
    return _orders.where((order) => !order.isActive).length;
  }

  bool get _canLoadMoreHistory =>
      _totalHistoryOrderCount > _historyDisplayLimit;

  void _loadOlderHistory() {
    setState(() {
      _historyDisplayLimit = (_historyDisplayLimit + 10).clamp(10, 100);
    });
  }

  Future<void> _loadOrders({bool forceSessionReload = false}) async {
    setState(() {
      _isOrdersLoading = true;
      _ordersError = null;
    });

    try {
      await _session.loadAuthenticatedState(force: forceSessionReload);
      final accessToken = await SecureSessionService.instance.getAccessToken();
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

      _session.syncBackendOrderState(snapshot.activeOrder);
      if (!mounted) return;
      setState(() {
        _activeOrder = snapshot.activeOrder;
        _orders = snapshot.orders;
        _historyDisplayLimit = 10;
        _isOrdersLoading = false;
      });
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _ordersError = _friendlyMessage(error);
        _isOrdersLoading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _ordersError = 'Unable to load orders right now.';
        _isOrdersLoading = false;
      });
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
      default:
        return error.message;
    }
  }

  void _onBottomNavTapped(int index) {
    if (index == 2) return;

    Widget target;
    switch (index) {
      case 0:
        target = HomePage(
          initialPickedImage: widget.initialPickedImage,
          initialPresetPath: widget.initialPresetPath,
          initialAvatarIndex: widget.initialAvatarIndex,
        );
        break;
      case 1:
        target = const MenuPage();
        break;
      case 3:
        target = RewardsPage(
          initialPickedImage: widget.initialPickedImage,
          initialPresetPath: widget.initialPresetPath,
          initialAvatarIndex: widget.initialAvatarIndex,
        );
        break;
      case 4:
        target = ProfilePage(
          initialPickedImage: widget.initialPickedImage,
          initialPresetPath: widget.initialPresetPath,
          initialAvatarIndex: widget.initialAvatarIndex,
        );
        break;
      default:
        return;
    }

    InteractiveFillingLoader.show(context, targetPage: target);
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: true,
      child: Scaffold(
        backgroundColor: Colors.white,
        extendBody: true,
        bottomNavigationBar: CustomBottomNav(
          selectedIndex: 2,
          onItemTapped: _onBottomNavTapped,
        ),
        body: Stack(
          children: [
            Column(
              children: [
                _buildHeader(),
                Container(
                  alignment: Alignment.centerLeft,
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: TabBar(
                    controller: _tabController,
                    isScrollable: true,
                    tabAlignment: TabAlignment.start,
                    dividerColor: Colors.transparent,
                    indicatorColor: AppColors.deepTeal,
                    labelColor: AppColors.deepTeal,
                    unselectedLabelColor: Colors.grey.shade500,
                    indicatorSize: TabBarIndicatorSize.label,
                    labelStyle: const TextStyle(
                      fontFamily: 'Afacad',
                      fontWeight: FontWeight.bold,
                      fontSize: 16,
                    ),
                    tabs: const [
                      Tab(text: 'Active Orders'),
                      Tab(text: 'Order History'),
                    ],
                  ),
                ),
                Expanded(
                  child: TabBarView(
                    controller: _tabController,
                    physics: const NeverScrollableScrollPhysics(),
                    children: [
                      _buildActiveOrdersTab(),
                      _buildOrderHistoryTab(),
                    ],
                  ),
                ),
              ],
            ),
            OrderStatusBanner(
              bottomOffset: 90 + MediaQuery.paddingOf(context).bottom,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Container(
      width: double.infinity,
      padding: EdgeInsets.only(
        top: MediaQuery.paddingOf(context).top + 14,
        bottom: 16,
        left: 20,
        right: 20,
      ),
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
              child: const Icon(
                Icons.arrow_back_ios,
                color: Colors.white,
                size: 20,
              ),
            ),
          ),
          const Text(
            'MY ORDER',
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
    );
  }

  Widget _buildActiveOrdersTab() {
    if (_isOrdersLoading) {
      return _buildLoadingState('Loading your latest order...');
    }

    if (_ordersError != null) {
      return _buildMessageState(
        title: 'Unable to load orders',
        message: _ordersError!,
        actionLabel: 'Try Again',
        onPressed: () => _loadOrders(forceSessionReload: true),
      );
    }

    final activeOrder = _displayActiveOrder;
    if (activeOrder != null) {
      return ListView(
        padding:
            const EdgeInsets.only(left: 16, right: 16, top: 20, bottom: 120),
        children: [
          _buildOrderCard(activeOrder, isActive: true),
        ],
      );
    }

    return _buildMessageState(
      title: 'No active order right now',
      message: 'Your active order will appear here when you place one.',
    );
  }

  Widget _buildOrderHistoryTab() {
    if (_isOrdersLoading) {
      return _buildLoadingState('Loading your order history...');
    }

    if (_ordersError != null) {
      return _buildMessageState(
        title: 'Unable to load history',
        message: _ordersError!,
        actionLabel: 'Try Again',
        onPressed: () => _loadOrders(forceSessionReload: true),
      );
    }

    final historyOrders = _displayHistoryOrders;
    if (historyOrders.isNotEmpty) {
      return ListView(
        padding:
            const EdgeInsets.only(left: 16, right: 16, top: 20, bottom: 120),
        children: [
          for (var i = 0; i < historyOrders.length; i++) ...[
            if (i > 0) const SizedBox(height: 12),
            _buildOrderCard(historyOrders[i]),
          ],
          if (_canLoadMoreHistory) ...[
            const SizedBox(height: 12),
            TextButton(
              onPressed: _loadOlderHistory,
              child: Text(
                'Load older orders (${_totalHistoryOrderCount - historyOrders.length} more)',
                style: TextStyle(
                  fontFamily: 'Afacad',
                  fontWeight: FontWeight.bold,
                  color: AppColors.deepTeal,
                ),
              ),
            ),
          ],
        ],
      );
    }

    return _buildMessageState(
      title: 'No order history available yet',
      message:
          'Past orders will appear here after you complete your first order.',
    );
  }

  Widget _buildOrderCard(CustomerOrder order, {bool isActive = false}) {
    final createdLabel =
        DateFormat('dd MMM yyyy, h:mm a').format(order.createdAt);
    final pickupLabel =
        DateFormat('dd MMM yyyy, h:mm a').format(order.pickupSlotAt);
    final orderNumber =
        order.dailyOrderNumber > 0 ? order.dailyOrderNumber : order.id;
    final orderTitle = 'Order #$orderNumber';
    final showCollectedAction = isActive && order.status == 'ready_for_pickup';

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border, width: 1),
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
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      orderTitle,
                      style: TextStyle(
                        fontFamily: 'Recoleta',
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                        color: AppColors.deepTeal,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      order.store.name,
                      style: const TextStyle(
                        fontFamily: 'Afacad',
                        fontSize: 14,
                        color: Colors.black87,
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: isActive
                      ? AppColors.deepTeal.withValues(alpha: 0.10)
                      : AppColors.surfaceLight,
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  _formatStatus(order.status),
                  style: TextStyle(
                    fontFamily: 'Afacad',
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    color: AppColors.deepTeal,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Text(
            'Order Ref: ${order.orderRef}',
            style: const TextStyle(
              fontFamily: 'Afacad',
              fontSize: 14,
              color: Colors.black54,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Created: $createdLabel',
            style: const TextStyle(
              fontFamily: 'Afacad',
              fontSize: 14,
              color: Colors.black54,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Pickup: $pickupLabel',
            style: const TextStyle(
              fontFamily: 'Afacad',
              fontSize: 14,
              color: Colors.black54,
            ),
          ),
          const SizedBox(height: 12),
          const Divider(height: 1),
          const SizedBox(height: 12),
          Text(
            '${order.itemCount} item(s)',
            style: TextStyle(
              fontFamily: 'Afacad',
              fontSize: 14,
              fontWeight: FontWeight.bold,
              color: AppColors.deepTeal,
            ),
          ),
          const SizedBox(height: 8),
          ...order.items.take(3).map(
                (item) => Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: Text(
                    '${item.quantity}x ${item.name}',
                    style: const TextStyle(
                      fontFamily: 'Afacad',
                      fontSize: 14,
                      color: Colors.black87,
                    ),
                  ),
                ),
              ),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                order.paymentMode == 'token'
                    ? '${order.tokenAmountCharged} tokens'
                    : 'RM ${order.finalTotalRm}',
                style: TextStyle(
                  fontFamily: 'Recoleta',
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: AppColors.gold,
                ),
              ),
              if (order.paymentMode == 'token')
                Text(
                  'RM ${order.finalTotalRm}',
                  style: const TextStyle(
                    fontFamily: 'Afacad',
                    fontSize: 14,
                    color: Colors.black54,
                  ),
                ),
            ],
          ),
          if (showCollectedAction) ...[
            const SizedBox(height: 14),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton(
                onPressed: () => _collectOrder(order),
                style: OutlinedButton.styleFrom(
                  side: BorderSide(color: AppColors.deepTeal, width: 1.5),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                  backgroundColor: AppColors.deepTeal.withValues(alpha: 0.06),
                ),
                child: Text(
                  'Collected',
                  style: TextStyle(
                    fontFamily: 'Recoleta',
                    fontWeight: FontWeight.bold,
                    color: AppColors.deepTeal,
                  ),
                ),
              ),
            ),
          ] else if (!isActive) ...[
            const SizedBox(height: 14),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () => _reorderOrder(order),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.deepTeal,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
                child: const Text(
                  'Reorder',
                  style: TextStyle(
                    fontFamily: 'Recoleta',
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Future<void> _reorderOrder(CustomerOrder order) async {
    try {
      final selectedStore = _session.selectedStore;
      if (selectedStore?.id != order.store.id) {
        await _session.selectStore(
          StoreSummary(
            id: order.store.id,
            code: 'reorder',
            name: order.store.name,
            supportsPickup: true,
            pickupLeadMinutes: 0,
            status: 'active',
          ),
        );
      }

      final menuItemsById = {
        for (final item in _session.allMenuItems) item.id: item,
      };
      final itemsToAdd = <CartItem>[];

      for (final orderItem in order.items) {
        final currentMenuItem = menuItemsById[orderItem.menuItemId];
        if (currentMenuItem == null || !currentMenuItem.isAvailable) {
          throw ApiException(
            'One or more items from this order are no longer available.',
            code: 'order_item_unavailable',
          );
        }

        final modifiers = orderItem.modifiers
            .map(
              (modifier) => CartModifier(
                groupName: modifier.groupName,
                optionName: modifier.optionName,
                priceDeltaRm: double.tryParse(modifier.priceDeltaRm) ?? 0.0,
                tokenPriceDelta: modifier.tokenPriceDelta,
              ),
            )
            .toList();

        final currentTokenPrice = currentMenuItem.tokenPrices[_session.tier] ??
            orderItem.tokenPrice ??
            0;

        itemsToAdd.add(
          CartItem(
            id: 'reorder-${order.id}-${orderItem.id}',
            menuItemId: currentMenuItem.id,
            menuItemCode: currentMenuItem.code,
            name: currentMenuItem.name,
            imageAssetPath: null,
            imageUrl: currentMenuItem.imageUrl,
            basePriceRm: double.tryParse(currentMenuItem.basePriceRm) ??
                double.tryParse(orderItem.basePriceRm) ??
                0.0,
            tokenPrice: currentTokenPrice,
            quantity: orderItem.quantity,
            remarks: null,
            displayDetails: null,
            modifiers: modifiers,
          ),
        );
      }

      if (itemsToAdd.isEmpty) {
        throw ApiException(
          'This order has no items to reorder.',
          code: 'order_empty',
        );
      }

      CartService.instance.clear();
      for (final item in itemsToAdd) {
        CartService.instance.addItem(
          storeId: order.store.id,
          storeName: order.store.name,
          item: item,
        );
      }

      if (!mounted) return;
      InteractiveFillingLoader.show(
        context,
        targetPage: const OrderConfirmationPage(),
      );
    } on ApiException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(error.message),
          backgroundColor: Colors.redAccent,
        ),
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Unable to reorder this order right now.'),
          backgroundColor: Colors.redAccent,
        ),
      );
    }
  }

  Future<void> _collectOrder(CustomerOrder order) async {
    try {
      final accessToken = await SecureSessionService.instance.getAccessToken();
      if (accessToken == null || accessToken.isEmpty) {
        throw ApiException(
          'Missing access token.',
          code: 'missing_access_token',
        );
      }

      await CheckoutApiService.instance.collectOrder(
        accessToken: accessToken,
        orderId: order.id,
      );

      if (!mounted) return;
      await _loadOrders(forceSessionReload: true);
    } on ApiException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(_friendlyMessage(error))),
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Unable to mark the order as collected right now.'),
        ),
      );
    }
  }

  String _formatStatus(String status) {
    switch (status) {
      case 'ready_for_pickup':
        return 'Ready For Pickup';
      case 'pending_payment':
        return 'Pending Payment';
      case 'payment_failed':
        return 'Payment Failed';
      default:
        return status
            .split('_')
            .map((part) => part.isEmpty
                ? part
                : '${part[0].toUpperCase()}${part.substring(1)}')
            .join(' ');
    }
  }

  Widget _buildLoadingState(String label) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          CircularProgressIndicator(color: AppColors.deepTeal),
          const SizedBox(height: 16),
          Text(
            label,
            style: TextStyle(
              fontFamily: 'Afacad',
              fontSize: 14,
              color: AppColors.deepTeal,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMessageState({
    required String title,
    required String message,
    String? actionLabel,
    VoidCallback? onPressed,
  }) {
    return ListView(
      padding: const EdgeInsets.only(left: 16, right: 16, top: 20, bottom: 120),
      children: [
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.border, width: 1),
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
              Icon(
                Icons.receipt_long_outlined,
                size: 42,
                color: AppColors.deepTeal,
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
              const SizedBox(height: 10),
              Text(
                message,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontFamily: 'Afacad',
                  fontSize: 15,
                  color: Colors.black54,
                  height: 1.35,
                ),
              ),
              if (actionLabel != null && onPressed != null) ...[
                const SizedBox(height: 18),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: onPressed,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.deepTeal,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                      ),
                    ),
                    child: Text(
                      actionLabel,
                      style: const TextStyle(
                        fontFamily: 'Recoleta',
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }
}
