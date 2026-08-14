import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../utils/app_colors.dart';
import '../utils/global_state.dart';
import 'auth_api_service.dart';
import 'cart_service.dart';
import 'catalog_api_service.dart';
import 'customer_data_service.dart';
import 'checkout_api_service.dart';
import 'secure_session_service.dart';
import 'user_service.dart';

class AppSessionService extends ChangeNotifier {
  AppSessionService._();

  static final AppSessionService instance = AppSessionService._();
  static const _selectedStoreIdKey = 'selected_store_id';
  static const _sandboxActiveOrderKey = 'temporary_sandbox_active_order';
  static const _sandboxHistoryOrdersKey = 'temporary_sandbox_history_orders';
  static const _sandboxCompletedOrderIdKey =
      'temporary_sandbox_completed_order_id';

  CurrentUserProfile? _user;
  int _tokenBalance = 0;
  int _tokenReserved = 0;
  int _tokenCap = 0;
  String _tier = 'kawan';
  int _cupsLast180d = 0;
  bool _isBootstrapLoading = false;
  bool _isMenuLoading = false;
  String? _bootstrapError;
  String? _menuError;
  List<StoreSummary> _stores = const [];
  StoreSummary? _selectedStore;
  List<MenuCategoryGroup> _menuCategories = const [];
  CustomerOrder? _temporarySandboxActiveOrder;
  final List<CustomerOrder> _temporarySandboxHistoryOrders = [];
  int? _temporarySandboxCompletedOrderId;
  Timer? _temporarySandboxPreparingTimer;
  Timer? _temporarySandboxReadyTimer;

  CurrentUserProfile? get user => _user;
  int get tokenBalance => _tokenBalance;
  int get tokenReserved => _tokenReserved;
  int get tokenCap => _tokenCap;
  String get tier => _tier;
  int get cupsLast180d => _cupsLast180d;
  bool get isBootstrapLoading => _isBootstrapLoading;
  bool get isMenuLoading => _isMenuLoading;
  String? get bootstrapError => _bootstrapError;
  String? get menuError => _menuError;
  List<StoreSummary> get stores => _stores;
  StoreSummary? get selectedStore => _selectedStore;
  List<MenuCategoryGroup> get menuCategories => _menuCategories;
  CustomerOrder? get temporarySandboxActiveOrder =>
      _temporarySandboxActiveOrder;
  List<CustomerOrder> get temporarySandboxHistoryOrders =>
      List.unmodifiable(_temporarySandboxHistoryOrders);
  int? get temporarySandboxCompletedOrderId =>
      _temporarySandboxCompletedOrderId;
  Map<String, String?> get userProfileSnapshot =>
      _user?.toLocalProfileMap() ?? const {};

  List<CatalogMenuItem> get allMenuItems => [
        for (final category in _menuCategories) ...category.items,
      ];

  void applyCheckoutResult(CheckoutResult result) {
    _tokenBalance = result.tokenBalance;
    _tokenReserved = result.tokenReserved;
    _tokenCap = result.tokenCap;
    globalOrderStatusRawStatus.value = result.order.status;
    notifyListeners();
  }

  void syncBackendOrderState(CustomerOrder? activeOrder) {
    if (activeOrder == null) {
      if (_temporarySandboxActiveOrder == null) {
        globalOrderStatusRawStatus.value = null;
        globalOrderStatusVisible.value = false;
      }
      notifyListeners();
      return;
    }

    if (_temporarySandboxActiveOrder != null) {
      if (_temporarySandboxActiveOrder!.id == activeOrder.id) {
        _temporarySandboxActiveOrder =
            _temporarySandboxActiveOrder!.copyWith(status: activeOrder.status);
      } else {
        _temporarySandboxPreparingTimer?.cancel();
        _temporarySandboxReadyTimer?.cancel();
        _temporarySandboxPreparingTimer = null;
        _temporarySandboxReadyTimer = null;
        _temporarySandboxActiveOrder = null;
        _temporarySandboxHistoryOrders.clear();
        _temporarySandboxCompletedOrderId = null;
      }
    }

    globalOrderStatusRawStatus.value = activeOrder.status;
    globalOrderStatusVisible.value = activeOrder.isActive;
    notifyListeners();
  }

  Future<void> clearTemporarySandboxOrderState() async {
    _temporarySandboxPreparingTimer?.cancel();
    _temporarySandboxReadyTimer?.cancel();
    _temporarySandboxPreparingTimer = null;
    _temporarySandboxReadyTimer = null;
    _temporarySandboxActiveOrder = null;
    _temporarySandboxHistoryOrders.clear();
    _temporarySandboxCompletedOrderId = null;
    globalOrderStatusRawStatus.value = null;
    globalOrderStatusVisible.value = false;
    await _clearTemporarySandboxPersistence();
    notifyListeners();
  }

  void seedTemporarySandboxOrder({
    required CheckoutResult result,
    required CartSnapshot cart,
  }) {
    _temporarySandboxPreparingTimer?.cancel();
    _temporarySandboxReadyTimer?.cancel();

    final items = cart.items
        .asMap()
        .entries
        .map(
          (entry) => CustomerOrderItem(
            id: entry.key + 1,
            menuItemId: entry.value.menuItemId,
            name: entry.value.name,
            basePriceRm: entry.value.basePriceRm.toStringAsFixed(2),
            tokenPrice: entry.value.tokenPrice,
            quantity: entry.value.quantity,
            lineSubtotalRm: entry.value.lineTotalRm.toStringAsFixed(2),
            lineTokenAmount: entry.value.lineTotalTokens,
            isQualifyingCup: true,
            modifiers: const [],
          ),
        )
        .toList();

    _temporarySandboxActiveOrder = CustomerOrder(
      id: result.order.id,
      orderRef: result.order.orderRef,
      dailyOrderNumber: result.order.dailyOrderNumber,
      status: result.order.status,
      paymentMode: result.order.paymentMode,
      finalTotalRm: result.order.finalTotalRm,
      tokenAmountCharged: result.order.tokenAmountCharged,
      createdAt: DateTime.now(),
      pickupSlotAt: DateTime.now(),
      store: CustomerOrderStore(
        id: cart.storeId,
        name: cart.storeName,
      ),
      itemCount: cart.items.fold<int>(0, (sum, item) => sum + item.quantity),
      primaryItemName: cart.items.isEmpty ? null : cart.items.first.name,
      items: items,
      statusHistory: const [],
    );
    _temporarySandboxCompletedOrderId = null;
    _persistTemporarySandboxState();
    _reconcileTemporarySandboxOrder();
    notifyListeners();
  }

  void markTemporarySandboxCollected() {
    final current = _temporarySandboxActiveOrder;
    if (current == null) return;

    _temporarySandboxPreparingTimer?.cancel();
    _temporarySandboxReadyTimer?.cancel();
    _temporarySandboxHistoryOrders.insert(
      0,
      current.copyWith(status: 'collected'),
    );
    _temporarySandboxActiveOrder = null;
    _temporarySandboxCompletedOrderId = current.id;
    globalOrderStatusRawStatus.value = 'collected';
    globalOrderStatusVisible.value = false;
    _persistTemporarySandboxState();
    notifyListeners();
  }

  void markTemporarySandboxReadyForPickup() {
    final current = _temporarySandboxActiveOrder;
    if (current == null) return;

    _temporarySandboxActiveOrder = current.copyWith(status: 'ready_for_pickup');
    globalOrderStatusRawStatus.value = 'ready_for_pickup';
    globalOrderStatusVisible.value = true;
    _persistTemporarySandboxState();
    notifyListeners();
  }

  void markTemporarySandboxPreparing() {
    final current = _temporarySandboxActiveOrder;
    if (current == null) return;

    _temporarySandboxActiveOrder = current.copyWith(status: 'preparing');
    globalOrderStatusRawStatus.value = 'preparing';
    globalOrderStatusVisible.value = true;
    _persistTemporarySandboxState();
    notifyListeners();
  }

  void markTemporarySandboxPaymentConfirmed() {
    final current = _temporarySandboxActiveOrder;
    if (current == null) return;

    _temporarySandboxActiveOrder = current.copyWith(status: 'paid');
    globalOrderStatusRawStatus.value = 'paid';
    globalOrderStatusVisible.value = true;
    _persistTemporarySandboxState();
    notifyListeners();
  }

  Future<void> reconcileTemporarySandboxState() async {
    if (_temporarySandboxActiveOrder != null) {
      _reconcileTemporarySandboxOrder(persist: true);
      return;
    }

    await _restoreTemporarySandboxState();
  }

  Future<void> loadAuthenticatedState({bool force = false}) async {
    if (_isBootstrapLoading || _isMenuLoading) return;
    if (!force &&
        _user != null &&
        _stores.isNotEmpty &&
        _selectedStore != null &&
        _menuCategories.isNotEmpty) {
      return;
    }

    _isBootstrapLoading = true;
    _bootstrapError = null;
    notifyListeners();

    try {
      final accessToken = await SecureSessionService.instance.getAccessToken();
      if (accessToken == null || accessToken.isEmpty) {
        throw ApiException('Missing access token.',
            code: 'missing_access_token');
      }

      final bootstrapFuture = CatalogApiService.instance.getBootstrap(
        accessToken: accessToken,
      );
      final storesFuture = CatalogApiService.instance.getStores(
        accessToken: accessToken,
      );
      final currentUserFuture = AuthApiService.instance.getCurrentUser(
        accessToken: accessToken,
      );

      final bootstrap = await bootstrapFuture;
      final stores = await storesFuture;
      final currentUser = await currentUserFuture;

      _user = currentUser;
      _tokenBalance = bootstrap.tokenBalance;
      _tokenReserved = bootstrap.tokenReserved;
      _tokenCap = bootstrap.tokenCap;
      _tier = bootstrap.tier;
      _cupsLast180d = bootstrap.cupsLast180d;
      _stores = stores;

      await UserService.overwriteUserProfile(_user!.toLocalProfileMap());

      AppColors.setTier(_tierToIndex(_tier));

      _selectedStore = await _resolveSelectedStore(_stores);
      _isBootstrapLoading = false;
      notifyListeners();

      if (_selectedStore != null) {
        await _loadMenu(accessToken: accessToken, storeId: _selectedStore!.id);
      } else {
        _menuCategories = const [];
        _menuError = null;
        notifyListeners();
      }

      await _clearTemporarySandboxPersistence();
    } catch (error) {
      _bootstrapError = _friendlyErrorMessage(
        error,
        fallback: 'Unable to load your account data right now.',
      );
      _isBootstrapLoading = false;
      notifyListeners();
      rethrow;
    }
  }

  Future<void> selectStore(StoreSummary store) async {
    if (_selectedStore?.id == store.id && _menuCategories.isNotEmpty) return;

    _selectedStore = store;
    _menuError = null;
    notifyListeners();

    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt(_selectedStoreIdKey, store.id);

    final accessToken = await SecureSessionService.instance.getAccessToken();
    if (accessToken == null || accessToken.isEmpty) {
      _menuCategories = const [];
      _menuError = 'Missing access token.';
      notifyListeners();
      return;
    }

    await _loadMenu(accessToken: accessToken, storeId: store.id);
  }

  void clear() {
    _temporarySandboxPreparingTimer?.cancel();
    _temporarySandboxReadyTimer?.cancel();
    _temporarySandboxPreparingTimer = null;
    _temporarySandboxReadyTimer = null;
    _temporarySandboxActiveOrder = null;
    _temporarySandboxHistoryOrders.clear();
    _temporarySandboxCompletedOrderId = null;
    globalOrderStatusRawStatus.value = null;
    globalOrderStatusVisible.value = false;
    _clearTemporarySandboxPersistence();
    _user = null;
    _tokenBalance = 0;
    _tokenReserved = 0;
    _tokenCap = 0;
    _tier = 'kawan';
    _cupsLast180d = 0;
    _isBootstrapLoading = false;
    _isMenuLoading = false;
    _bootstrapError = null;
    _menuError = null;
    _stores = const [];
    _selectedStore = null;
    _menuCategories = const [];
    notifyListeners();
  }

  Future<void> _loadMenu({
    required String accessToken,
    required int storeId,
  }) async {
    _isMenuLoading = true;
    _menuError = null;
    notifyListeners();

    try {
      _menuCategories = await CatalogApiService.instance.getMenu(
        accessToken: accessToken,
        storeId: storeId,
      );
    } on ApiException catch (error) {
      _menuError = _friendlyErrorMessage(
        error,
        fallback: 'Unable to load the menu right now.',
      );
      _menuCategories = const [];
    } catch (error) {
      _menuError = 'Unable to load the menu right now.';
      _menuCategories = const [];
    } finally {
      _isMenuLoading = false;
      notifyListeners();
    }
  }

  Future<StoreSummary?> _resolveSelectedStore(List<StoreSummary> stores) async {
    if (stores.isEmpty) return null;

    final prefs = await SharedPreferences.getInstance();
    final storedId = prefs.getInt(_selectedStoreIdKey);
    if (storedId != null) {
      for (final store in stores) {
        if (store.id == storedId) {
          return store;
        }
      }
    }

    final fallback = stores.first;
    await prefs.setInt(_selectedStoreIdKey, fallback.id);
    return fallback;
  }

  int _tierToIndex(String tier) {
    switch (tier.toLowerCase()) {
      case 'kawan':
        return 0;
      case 'dilamun':
        return 1;
      case 'ketagih':
        return 2;
      case 'legend':
        return 3;
      default:
        return 0;
    }
  }

  String _friendlyErrorMessage(
    Object error, {
    required String fallback,
  }) {
    if (error is! ApiException) return fallback;

    if (_isSessionErrorCode(error.code)) {
      return 'Your session has expired. Please log in again.';
    }

    return error.message;
  }

  bool _isSessionErrorCode(String? code) {
    switch (code) {
      case 'missing_access_token':
      case 'missing_bearer_token':
      case 'invalid_access_token':
      case 'session_not_found':
      case 'session_version_mismatch':
      case 'user_not_active':
        return true;
      default:
        return false;
    }
  }

  Future<void> _restoreTemporarySandboxState() async {
    final prefs = await SharedPreferences.getInstance();
    final activeOrderJson = prefs.getString(_sandboxActiveOrderKey);
    final historyOrderJson =
        prefs.getStringList(_sandboxHistoryOrdersKey) ?? const [];
    final completedOrderId = prefs.getInt(_sandboxCompletedOrderIdKey);

    _temporarySandboxPreparingTimer?.cancel();
    _temporarySandboxReadyTimer?.cancel();
    _temporarySandboxPreparingTimer = null;
    _temporarySandboxReadyTimer = null;
    _temporarySandboxActiveOrder = null;
    _temporarySandboxHistoryOrders.clear();
    _temporarySandboxCompletedOrderId = completedOrderId;

    for (final entry in historyOrderJson) {
      final decoded = jsonDecode(entry);
      if (decoded is Map<String, dynamic>) {
        _temporarySandboxHistoryOrders.add(
          _customerOrderFromStoredJson(decoded),
        );
      } else if (decoded is Map) {
        _temporarySandboxHistoryOrders.add(
          _customerOrderFromStoredJson(Map<String, dynamic>.from(decoded)),
        );
      }
    }

    if (activeOrderJson != null && activeOrderJson.isNotEmpty) {
      final decoded = jsonDecode(activeOrderJson);
      final orderMap = decoded is Map<String, dynamic>
          ? decoded
          : Map<String, dynamic>.from(decoded as Map);
      _temporarySandboxActiveOrder =
          _customerOrderFromStoredJson(orderMap);
      _reconcileTemporarySandboxOrder(persist: true);
      return;
    }

    if (_temporarySandboxHistoryOrders.isNotEmpty ||
        _temporarySandboxCompletedOrderId != null) {
      globalOrderStatusRawStatus.value = null;
      globalOrderStatusVisible.value = false;
      notifyListeners();
      return;
    }

    globalOrderStatusRawStatus.value = null;
    globalOrderStatusVisible.value = false;
    notifyListeners();
  }

  void _reconcileTemporarySandboxOrder({bool persist = false}) {
    final current = _temporarySandboxActiveOrder;
    if (current == null) return;

    final age = DateTime.now().difference(current.createdAt);
    final effectiveStatus = _temporarySandboxStatusForAge(current.status, age);
    final updated = current.copyWith(status: effectiveStatus);
    if (updated.status != current.status) {
      _temporarySandboxActiveOrder = updated;
    }

    _temporarySandboxPreparingTimer?.cancel();
    _temporarySandboxReadyTimer?.cancel();
    _temporarySandboxPreparingTimer = null;
    _temporarySandboxReadyTimer = null;

    globalOrderStatusRawStatus.value = effectiveStatus;
    globalOrderStatusVisible.value = true;

    if (effectiveStatus == 'paid') {
      final preparingDelay = const Duration(seconds: 8) - age;
      final readyDelay = const Duration(minutes: 1) - age;

      if (preparingDelay > Duration.zero) {
        _temporarySandboxPreparingTimer = Timer(preparingDelay, () {
          final active = _temporarySandboxActiveOrder;
          if (active == null) return;

          _temporarySandboxActiveOrder = active.copyWith(status: 'preparing');
          globalOrderStatusRawStatus.value = 'preparing';
          globalOrderStatusVisible.value = true;
          _persistTemporarySandboxState();
          notifyListeners();
          _reconcileTemporarySandboxOrder();
        });
      }

      if (readyDelay > Duration.zero) {
        _temporarySandboxReadyTimer = Timer(readyDelay, () {
          final active = _temporarySandboxActiveOrder;
          if (active == null) return;

          _temporarySandboxActiveOrder =
              active.copyWith(status: 'ready_for_pickup');
          globalOrderStatusRawStatus.value = 'ready_for_pickup';
          globalOrderStatusVisible.value = true;
          _persistTemporarySandboxState();
          notifyListeners();
        });
      }
    } else if (effectiveStatus == 'preparing') {
      final readyDelay = const Duration(minutes: 1) - age;
      if (readyDelay > Duration.zero) {
        _temporarySandboxReadyTimer = Timer(readyDelay, () {
          final active = _temporarySandboxActiveOrder;
          if (active == null) return;

          _temporarySandboxActiveOrder =
              active.copyWith(status: 'ready_for_pickup');
          globalOrderStatusRawStatus.value = 'ready_for_pickup';
          globalOrderStatusVisible.value = true;
          _persistTemporarySandboxState();
          notifyListeners();
        });
      }
    }

    if (persist) {
      _persistTemporarySandboxState();
    }
  }

  String _temporarySandboxStatusForAge(String status, Duration age) {
    if (status == 'collected') {
      return 'collected';
    }

    if (age >= const Duration(minutes: 1)) {
      return 'ready_for_pickup';
    }

    if (age >= const Duration(seconds: 8)) {
      return 'preparing';
    }

    return status;
  }

  CustomerOrder _customerOrderFromStoredJson(Map<String, dynamic> json) {
    return CustomerOrder(
      id: (json['id'] as num).toInt(),
      orderRef: json['order_ref'] as String? ?? '',
      dailyOrderNumber: (json['daily_order_number'] as num?)?.toInt() ?? 0,
      status: json['status'] as String? ?? '',
      paymentMode: json['payment_mode'] as String? ?? '',
      finalTotalRm: json['final_total_rm'] as String? ?? '0.00',
      tokenAmountCharged: (json['token_amount_charged'] as num?)?.toInt() ?? 0,
      pickupSlotAt: DateTime.parse(json['pickup_slot_at'] as String),
      createdAt: DateTime.parse(json['created_at'] as String),
      store: CustomerOrderStore.fromApi(
        Map<String, dynamic>.from(json['store'] as Map),
      ),
      itemCount: (json['item_count'] as num?)?.toInt() ?? 0,
      primaryItemName: json['primary_item_name'] as String?,
      items: (json['items'] as List? ?? const [])
          .map(
            (item) => CustomerOrderItem.fromApi(
              Map<String, dynamic>.from(item as Map),
            ),
          )
          .toList(),
      statusHistory: (json['status_history'] as List? ?? const [])
          .map(
            (item) => CustomerOrderStatusEvent.fromApi(
              Map<String, dynamic>.from(item as Map),
            ),
          )
          .toList(),
    );
  }

  Map<String, dynamic> _serializeOrder(CustomerOrder order) {
    return {
      'id': order.id,
      'order_ref': order.orderRef,
      'daily_order_number': order.dailyOrderNumber,
      'status': order.status,
      'payment_mode': order.paymentMode,
      'final_total_rm': order.finalTotalRm,
      'token_amount_charged': order.tokenAmountCharged,
      'pickup_slot_at': order.pickupSlotAt.toIso8601String(),
      'created_at': order.createdAt.toIso8601String(),
      'store': {
        'id': order.store.id,
        'name': order.store.name,
      },
      'item_count': order.itemCount,
      'primary_item_name': order.primaryItemName,
      'items': order.items.map(_serializeOrderItem).toList(),
      'status_history': order.statusHistory.map(_serializeStatusEvent).toList(),
    };
  }

  Map<String, dynamic> _serializeOrderItem(CustomerOrderItem item) {
    return {
      'id': item.id,
      'menu_item_id': item.menuItemId,
      'name': item.name,
      'base_price_rm': item.basePriceRm,
      'token_price': item.tokenPrice,
      'quantity': item.quantity,
      'line_subtotal_rm': item.lineSubtotalRm,
      'line_token_amount': item.lineTokenAmount,
      'is_qualifying_cup': item.isQualifyingCup,
      'modifiers': item.modifiers.map(_serializeOrderItemModifier).toList(),
    };
  }

  Map<String, dynamic> _serializeOrderItemModifier(
    CustomerOrderItemModifier modifier,
  ) {
    return {
      'group_name': modifier.groupName,
      'option_name': modifier.optionName,
      'price_delta_rm': modifier.priceDeltaRm,
      'token_price_delta': modifier.tokenPriceDelta,
    };
  }

  Map<String, dynamic> _serializeStatusEvent(CustomerOrderStatusEvent event) {
    return {
      'from_status': event.fromStatus,
      'to_status': event.toStatus,
      'reason': event.reason,
      'created_at': event.createdAt.toIso8601String(),
    };
  }

  Future<void> _persistTemporarySandboxState() async {
    final prefs = await SharedPreferences.getInstance();
    if (_temporarySandboxActiveOrder != null) {
      await prefs.setString(
        _sandboxActiveOrderKey,
        jsonEncode(_serializeOrder(_temporarySandboxActiveOrder!)),
      );
    } else {
      await prefs.remove(_sandboxActiveOrderKey);
    }

    if (_temporarySandboxHistoryOrders.isNotEmpty) {
      await prefs.setStringList(
        _sandboxHistoryOrdersKey,
        _temporarySandboxHistoryOrders
            .map((order) => jsonEncode(_serializeOrder(order)))
            .toList(),
      );
    } else {
      await prefs.remove(_sandboxHistoryOrdersKey);
    }

    if (_temporarySandboxCompletedOrderId != null) {
      await prefs.setInt(
        _sandboxCompletedOrderIdKey,
        _temporarySandboxCompletedOrderId!,
      );
    } else {
      await prefs.remove(_sandboxCompletedOrderIdKey);
    }
  }

  Future<void> _clearTemporarySandboxPersistence() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_sandboxActiveOrderKey);
    await prefs.remove(_sandboxHistoryOrdersKey);
    await prefs.remove(_sandboxCompletedOrderIdKey);
  }
}
