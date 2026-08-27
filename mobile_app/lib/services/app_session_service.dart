import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../utils/app_colors.dart';
import '../utils/global_state.dart';
import 'auth_api_service.dart';
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
  List<HomeBanner> _homeBanners = const [];
  List<LoyaltyTier> _loyaltyTiers = const [];

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
  List<HomeBanner> get homeBanners => _homeBanners;
  List<LoyaltyTier> get loyaltyTiers => _loyaltyTiers;
  Map<String, String?> get userProfileSnapshot =>
      _user?.toLocalProfileMap() ?? const {};

  List<CatalogMenuItem> get allMenuItems => [
        for (final category in _menuCategories) ...category.items,
      ];

  Timer? _activeOrderTimer;

  void applyCheckoutResult(CheckoutResult result) {
    _tokenBalance = result.tokenBalance;
    _tokenReserved = result.tokenReserved;
    _tokenCap = result.tokenCap;
    globalOrderStatusRawStatus.value = result.order.status;
    globalOrderStatusVisible.value = true;
    startActiveOrderPolling();
    notifyListeners();
  }

  void syncBackendOrderState(List<CustomerOrder> activeOrders) {
    final normalizedActiveOrders = List<CustomerOrder>.from(activeOrders)
      ..sort((a, b) {
        final createdComparison = a.createdAt.compareTo(b.createdAt);
        if (createdComparison != 0) {
          return createdComparison;
        }
        return a.id.compareTo(b.id);
      });

    globalActiveOrders.value = normalizedActiveOrders;

    if (normalizedActiveOrders.isEmpty) {
      globalOrderStatusRawStatus.value = null;
      globalOrderStatusVisible.value = false;
      stopActiveOrderPolling();
      notifyListeners();
      return;
    }

    globalOrderStatusRawStatus.value = normalizedActiveOrders.first.status;
    globalOrderStatusVisible.value = true;
    startActiveOrderPolling();
    notifyListeners();
  }

  void startActiveOrderPolling() {
    _activeOrderTimer?.cancel();
    _activeOrderTimer = Timer.periodic(const Duration(seconds: 8), (_) async {
      await pollActiveOrder();
    });
  }

  void stopActiveOrderPolling() {
    _activeOrderTimer?.cancel();
    _activeOrderTimer = null;
  }

  Future<void> pollActiveOrder() async {
    try {
      final accessToken =
          await SecureSessionService.instance.getValidAccessToken();
      if (accessToken == null || accessToken.isEmpty) return;

      final snapshot = await CustomerDataService.instance.getOrders(
        accessToken: accessToken,
        limit: 20,
      );

      final activeOrders =
          snapshot.orders.where((order) => order.isActive).toList();
      syncBackendOrderState(activeOrders);
    } catch (_) {
      // Ignore background poll errors silently
    }
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
      String? accessToken =
          await SecureSessionService.instance.getValidAccessToken();
      if (accessToken == null || accessToken.isEmpty) {
        throw ApiException('Missing access token.',
            code: 'missing_access_token');
      }

      BootstrapSnapshot bootstrap;
      List<StoreSummary> stores;
      CurrentUserProfile currentUser;

      try {
        final bootstrapFuture = CatalogApiService.instance.getBootstrap(
          accessToken: accessToken,
        );
        final storesFuture = CatalogApiService.instance.getStores(
          accessToken: accessToken,
        );
        final currentUserFuture = AuthApiService.instance.getCurrentUser(
          accessToken: accessToken,
        );

        bootstrap = await bootstrapFuture;
        stores = await storesFuture;
        currentUser = await currentUserFuture;
      } on ApiException catch (e) {
        if (e.message.toLowerCase().contains('expired') ||
            e.code == 'invalid_access_token' ||
            e.code == 'session_not_found') {
          final refreshed =
              await SecureSessionService.instance.refreshTokenSilently();
          if (refreshed != null && refreshed.isNotEmpty) {
            accessToken = refreshed;
            bootstrap = await CatalogApiService.instance.getBootstrap(
              accessToken: accessToken,
            );
            stores = await CatalogApiService.instance.getStores(
              accessToken: accessToken,
            );
            currentUser = await AuthApiService.instance.getCurrentUser(
              accessToken: accessToken,
            );
          } else {
            rethrow;
          }
        } else {
          rethrow;
        }
      }

      _user = currentUser;
      _tokenBalance = bootstrap.tokenBalance;
      _tokenReserved = bootstrap.tokenReserved;
      _tokenCap = bootstrap.tokenCap;
      _tier = bootstrap.tier;
      _cupsLast180d = bootstrap.cupsLast180d;
      _stores = stores;
      _homeBanners = bootstrap.homeBanners;
      _loyaltyTiers = bootstrap.loyaltyTiers;

      await UserService.overwriteUserProfile(_user!.toLocalProfileMap());

      AppColors.setTier(_tierToIndex(_tier));

      _selectedStore = await _resolveSelectedStore(_stores);
      _isBootstrapLoading = false;
      notifyListeners();

      unawaited(pollActiveOrder());

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

    final accessToken =
        await SecureSessionService.instance.getValidAccessToken();
    if (accessToken == null || accessToken.isEmpty) {
      _menuCategories = const [];
      _menuError = 'Missing access token.';
      notifyListeners();
      return;
    }

    await _loadMenu(accessToken: accessToken, storeId: store.id);
  }

  void clear() {
    globalOrderStatusRawStatus.value = null;
    globalOrderStatusVisible.value = false;
    globalActiveOrders.value = const [];
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
    _homeBanners = const [];
    _loyaltyTiers = const [];
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
