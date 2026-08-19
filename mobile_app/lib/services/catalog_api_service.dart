import 'dart:convert';

import 'package:http/http.dart' as http;

import 'api_config.dart';
import 'auth_api_service.dart';
import 'secure_session_service.dart';

class StoreSummary {
  final int id;
  final String code;
  final String name;
  final bool supportsPickup;
  final int pickupLeadMinutes;
  final String status;

  const StoreSummary({
    required this.id,
    required this.code,
    required this.name,
    required this.supportsPickup,
    required this.pickupLeadMinutes,
    required this.status,
  });

  factory StoreSummary.fromApi(Map<String, dynamic> json) {
    return StoreSummary(
      id: (json['id'] as num).toInt(),
      code: json['code'] as String? ?? '',
      name: json['name'] as String? ?? 'Store',
      supportsPickup: json['supports_pickup'] as bool? ?? false,
      pickupLeadMinutes: (json['pickup_lead_minutes'] as num?)?.toInt() ?? 0,
      status: json['status'] as String? ?? 'active',
    );
  }
}

class CatalogMenuItem {
  final int id;
  final String code;
  final String name;
  final String? description;
  final String basePriceRm;
  final String? imageUrl;
  final bool isAvailable;
  final bool isHandcraftedDrink;
  final bool isQualifyingCup;
  final Map<String, int> tokenPrices;

  const CatalogMenuItem({
    required this.id,
    required this.code,
    required this.name,
    required this.description,
    required this.basePriceRm,
    required this.imageUrl,
    required this.isAvailable,
    required this.isHandcraftedDrink,
    required this.isQualifyingCup,
    required this.tokenPrices,
  });

  factory CatalogMenuItem.fromApi(Map<String, dynamic> json) {
    final rawTokenPrices = Map<String, dynamic>.from(
      (json['token_prices'] as Map?) ?? const {},
    );
    return CatalogMenuItem(
      id: (json['id'] as num).toInt(),
      code: json['code'] as String? ?? '',
      name: json['name'] as String? ?? 'Menu Item',
      description: json['description'] as String?,
      basePriceRm: json['base_price_rm'] as String? ?? '0.00',
      imageUrl: json['image_url'] as String?,
      isAvailable: json['is_available'] as bool? ?? true,
      isHandcraftedDrink: json['is_handcrafted_drink'] as bool? ?? false,
      isQualifyingCup: json['is_qualifying_cup'] as bool? ?? false,
      tokenPrices: rawTokenPrices.map(
        (key, value) => MapEntry(key, (value as num).toInt()),
      ),
    );
  }
}

class MenuCategoryGroup {
  final int id;
  final String code;
  final String name;
  final List<CatalogMenuItem> items;

  const MenuCategoryGroup({
    required this.id,
    required this.code,
    required this.name,
    required this.items,
  });

  factory MenuCategoryGroup.fromApi(Map<String, dynamic> json) {
    final items = (json['items'] as List? ?? const [])
        .map((item) => CatalogMenuItem.fromApi(
              Map<String, dynamic>.from(item as Map),
            ))
        .toList();

    return MenuCategoryGroup(
      id: (json['id'] as num).toInt(),
      code: json['code'] as String? ?? '',
      name: json['name'] as String? ?? 'Category',
      items: items,
    );
  }
}

class HomeBanner {
  final String code;
  final String title;
  final String subtitle;
  final String imageSource;
  final String placement;
  final int sortOrder;

  const HomeBanner({
    required this.code,
    required this.title,
    required this.subtitle,
    required this.imageSource,
    required this.placement,
    required this.sortOrder,
  });

  bool get appearsOnHome =>
      placement == 'home' || placement == 'both' || placement.isEmpty;

  bool get appearsOnProfile =>
      placement == 'profile' || placement == 'both' || placement.isEmpty;

  factory HomeBanner.fromApi(Map<String, dynamic> json) {
    return HomeBanner(
      code: json['code'] as String? ?? '',
      title: json['title'] as String? ?? '',
      subtitle: json['subtitle'] as String? ?? '',
      imageSource: json['image_source'] as String? ?? '',
      placement: json['placement'] as String? ?? 'both',
      sortOrder: (json['sort_order'] as num?)?.toInt() ?? 0,
    );
  }
}

class BootstrapSnapshot {
  final CurrentUserProfile user;
  final int tokenBalance;
  final int tokenReserved;
  final int tokenCap;
  final String tier;
  final int cupsLast180d;
  final List<HomeBanner> homeBanners;

  const BootstrapSnapshot({
    required this.user,
    required this.tokenBalance,
    required this.tokenReserved,
    required this.tokenCap,
    required this.tier,
    required this.cupsLast180d,
    required this.homeBanners,
  });
}

class CatalogApiService {
  CatalogApiService._();

  static final CatalogApiService instance = CatalogApiService._();

  final http.Client _client = http.Client();

  Future<BootstrapSnapshot> getBootstrap({
    required String accessToken,
  }) async {
    final response = await _get('/bootstrap', accessToken: accessToken);

    final user = CurrentUserProfile.fromApi(
      Map<String, dynamic>.from(response['user'] as Map),
    );
    final token = Map<String, dynamic>.from(response['token'] as Map);
    final loyalty = Map<String, dynamic>.from(response['loyalty'] as Map);
    final homeBanners = (response['home_banners'] as List? ?? const [])
        .map((banner) => HomeBanner.fromApi(
              Map<String, dynamic>.from(banner as Map),
            ))
        .toList()
      ..sort((a, b) => a.sortOrder.compareTo(b.sortOrder));

    return BootstrapSnapshot(
      user: user,
      tokenBalance: (token['balance_available'] as num?)?.toInt() ?? 0,
      tokenReserved: (token['balance_reserved'] as num?)?.toInt() ?? 0,
      tokenCap: (token['balance_cap'] as num?)?.toInt() ?? 0,
      tier: loyalty['tier'] as String? ?? 'kawan',
      cupsLast180d: (loyalty['cups_last_180d'] as num?)?.toInt() ?? 0,
      homeBanners: homeBanners,
    );
  }

  Future<List<StoreSummary>> getStores({
    required String accessToken,
  }) async {
    final response = await _get('/stores', accessToken: accessToken);
    final stores = (response['stores'] as List? ?? const [])
        .map((store) => StoreSummary.fromApi(
              Map<String, dynamic>.from(store as Map),
            ))
        .toList();
    return stores;
  }

  Future<List<MenuCategoryGroup>> getMenu({
    required String accessToken,
    required int storeId,
  }) async {
    final response = await _get(
      '/menu?store_id=$storeId',
      accessToken: accessToken,
    );
    final categories = (response['categories'] as List? ?? const [])
        .map((category) => MenuCategoryGroup.fromApi(
              Map<String, dynamic>.from(category as Map),
            ))
        .toList();
    return categories;
  }

  Future<Map<String, dynamic>> _get(
    String path, {
    required String accessToken,
  }) async {
    http.Response response = await _client.get(
      Uri.parse('${ApiConfig.baseUrl}$path'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $accessToken',
      },
    ).timeout(const Duration(seconds: 15));

    if (response.statusCode == 401) {
      final refreshed =
          await SecureSessionService.instance.refreshTokenSilently();
      if (refreshed != null && refreshed.isNotEmpty) {
        response = await _client.get(
          Uri.parse('${ApiConfig.baseUrl}$path'),
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer $refreshed',
          },
        ).timeout(const Duration(seconds: 15));
      }
    }

    final text = utf8.decode(response.bodyBytes);
    final decoded = text.isEmpty ? <String, dynamic>{} : jsonDecode(text);

    if (response.statusCode >= 200 && response.statusCode < 300) {
      return Map<String, dynamic>.from(decoded as Map);
    }

    final body = decoded is Map
        ? Map<String, dynamic>.from(decoded)
        : <String, dynamic>{};
    final error = body['error'];
    if (error is Map<String, dynamic>) {
      throw ApiException(
        (error['message'] as String?) ?? 'Request failed.',
        code: error['code'] as String?,
      );
    }

    throw ApiException('Request failed with status ${response.statusCode}.');
  }
}
