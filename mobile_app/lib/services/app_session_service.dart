import 'dart:async';

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
  CustomerOrder? get temporarySandboxActiveOrder => _temporarySandboxActiveOrder;
  List<CustomerOrder> get temporarySandboxHistoryOrders =>
      List.unmodifiable(_temporarySandboxHistoryOrders);
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
            name: entry.value.name,
            basePriceRm: entry.value.basePriceRm.toStringAsFixed(2),
            tokenPrice: entry.value.tokenPrice,
            quantity: entry.value.quantity,
            lineSubtotalRm: entry.value.lineTotalRm.toStringAsFixed(2),
            lineTokenAmount: entry.value.lineTotalTokens,
            isQualifyingCup: true,
          ),
        )
        .toList();

    _temporarySandboxActiveOrder = CustomerOrder(
      id: result.order.id,
      orderRef: result.order.orderRef,
      status: result.order.status,
      paymentMode: result.order.paymentMode,
      finalTotalRm: result.order.finalTotalRm,
      tokenAmountCharged: result.order.tokenAmountCharged,
      pickupSlotAt: DateTime.now().add(const Duration(minutes: 5)),
      createdAt: DateTime.now(),
      store: CustomerOrderStore(
        id: cart.storeId,
        name: cart.storeName,
      ),
      itemCount: cart.items.fold<int>(0, (sum, item) => sum + item.quantity),
      primaryItemName: cart.items.isEmpty ? null : cart.items.first.name,
      items: items,
      statusHistory: const [],
    );
    globalOrderStatusRawStatus.value = result.order.status;
    globalOrderStatusVisible.value = true;
    notifyListeners();

    _temporarySandboxPreparingTimer = Timer(const Duration(seconds: 8), () {
      final current = _temporarySandboxActiveOrder;
      if (current == null) return;

      _temporarySandboxActiveOrder = current.copyWith(status: 'preparing');
      globalOrderStatusRawStatus.value = 'preparing';
      globalOrderStatusVisible.value = true;
      notifyListeners();
    });

    _temporarySandboxReadyTimer = Timer(const Duration(minutes: 1), () {
      final current = _temporarySandboxActiveOrder;
      if (current == null) return;

      _temporarySandboxActiveOrder = current.copyWith(status: 'ready_for_pickup');
      globalOrderStatusRawStatus.value = 'ready_for_pickup';
      globalOrderStatusVisible.value = true;
      notifyListeners();
    });
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
    globalOrderStatusRawStatus.value = 'collected';
    globalOrderStatusVisible.value = false;
    notifyListeners();
  }

  void markTemporarySandboxReadyForPickup() {
    final current = _temporarySandboxActiveOrder;
    if (current == null) return;

    _temporarySandboxActiveOrder = current.copyWith(status: 'ready_for_pickup');
    globalOrderStatusRawStatus.value = 'ready_for_pickup';
    globalOrderStatusVisible.value = true;
    notifyListeners();
  }

  void markTemporarySandboxPreparing() {
    final current = _temporarySandboxActiveOrder;
    if (current == null) return;

    _temporarySandboxActiveOrder = current.copyWith(status: 'preparing');
    globalOrderStatusRawStatus.value = 'preparing';
    globalOrderStatusVisible.value = true;
    notifyListeners();
  }

  void markTemporarySandboxPaymentConfirmed() {
    final current = _temporarySandboxActiveOrder;
    if (current == null) return;

    _temporarySandboxActiveOrder = current.copyWith(status: 'paid');
    globalOrderStatusRawStatus.value = 'paid';
    globalOrderStatusVisible.value = true;
    notifyListeners();
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
    globalOrderStatusRawStatus.value = null;
    globalOrderStatusVisible.value = false;
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
}
