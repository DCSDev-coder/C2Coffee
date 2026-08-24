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
  final int basePriceToken;
  final String? imageUrl;
  final bool isAvailable;
  final bool isHandcraftedDrink;
  final bool isQualifyingCup;
  final bool allowChoiceOfBeans;
  final bool allowEspressoShot;
  final bool allowChoiceOfMilk;
  final bool allowChoiceOfSweetness;
  final bool allowIceLevel;
  final bool allowTemperature;
  final bool allowSparklingMixer;
  final bool allowOrderType;
  final bool allowRemarks;
  final int? subcategoryId;
  final String? subcategoryCode;
  final String? subcategoryName;
  final String productKindCode;
  final String productKindName;
  final Map<String, int> tokenPrices;
  final List<CatalogModifierGroup> modifierGroups;

  const CatalogMenuItem({
    required this.id,
    required this.code,
    required this.name,
    required this.description,
    required this.basePriceRm,
    required this.basePriceToken,
    required this.imageUrl,
    required this.isAvailable,
    required this.isHandcraftedDrink,
    required this.isQualifyingCup,
    required this.allowChoiceOfBeans,
    required this.allowEspressoShot,
    required this.allowChoiceOfMilk,
    required this.allowChoiceOfSweetness,
    required this.allowIceLevel,
    required this.allowTemperature,
    required this.allowSparklingMixer,
    required this.allowOrderType,
    required this.allowRemarks,
    required this.subcategoryId,
    required this.subcategoryCode,
    required this.subcategoryName,
    required this.productKindCode,
    required this.productKindName,
    required this.tokenPrices,
    required this.modifierGroups,
  });

  factory CatalogMenuItem.fromApi(Map<String, dynamic> json) {
    final rawTokenPrices = Map<String, dynamic>.from(
      (json['token_prices'] as Map?) ?? const {},
    );
    final modifierGroups = (json['modifier_groups'] as List? ?? const [])
        .map((group) => CatalogModifierGroup.fromApi(
              Map<String, dynamic>.from(group as Map),
            ))
        .toList();
    return CatalogMenuItem(
      id: (json['id'] as num).toInt(),
      code: json['code'] as String? ?? '',
      name: json['name'] as String? ?? 'Menu Item',
      description: json['description'] as String?,
      basePriceRm: json['base_price_rm'] as String? ?? '0.00',
      basePriceToken: (json['base_price_token'] as num?)?.toInt() ?? 0,
      imageUrl: json['image_url'] as String?,
      isAvailable: json['is_available'] as bool? ?? true,
      isHandcraftedDrink: json['is_handcrafted_drink'] as bool? ?? false,
      isQualifyingCup: json['is_qualifying_cup'] as bool? ?? false,
      allowChoiceOfBeans: json['allow_choice_of_beans'] as bool? ?? false,
      allowEspressoShot: json['allow_espresso_shot'] as bool? ?? false,
      allowChoiceOfMilk: json['allow_choice_of_milk'] as bool? ?? false,
      allowChoiceOfSweetness: json['allow_choice_of_sweetness'] as bool? ?? false,
      allowIceLevel: json['allow_ice_level'] as bool? ?? false,
      allowTemperature: json['allow_temperature'] as bool? ?? false,
      allowSparklingMixer: json['allow_sparkling_mixer'] as bool? ?? false,
      allowOrderType: json['allow_order_type'] as bool? ?? false,
      allowRemarks: json['allow_remarks'] as bool? ?? false,
      subcategoryId: (json['subcategory_id'] as num?)?.toInt(),
      subcategoryCode: json['subcategory_code'] as String?,
      subcategoryName: json['subcategory_name'] as String?,
      productKindCode: json['product_kind_code'] as String? ?? 'other',
      productKindName: json['product_kind_name'] as String? ?? 'Other',
      tokenPrices: rawTokenPrices.map(
        (key, value) => MapEntry(key, (value as num).toInt()),
      ),
      modifierGroups: modifierGroups,
    );
  }
}

class CatalogModifierOption {
  final int id;
  final String code;
  final String name;
  final String priceDeltaRm;
  final int tokenPriceDelta;
  final bool isActive;
  final int sortOrder;

  const CatalogModifierOption({
    required this.id,
    required this.code,
    required this.name,
    required this.priceDeltaRm,
    required this.tokenPriceDelta,
    required this.isActive,
    required this.sortOrder,
  });

  factory CatalogModifierOption.fromApi(Map<String, dynamic> json) {
    return CatalogModifierOption(
      id: (json['id'] as num).toInt(),
      code: json['code'] as String? ?? '',
      name: json['name'] as String? ?? '',
      priceDeltaRm: json['price_delta_rm'] as String? ?? '0.00',
      tokenPriceDelta: (json['token_price_delta'] as num?)?.toInt() ?? 0,
      isActive: json['is_active'] as bool? ?? true,
      sortOrder: (json['sort_order'] as num?)?.toInt() ?? 0,
    );
  }
}

class CatalogModifierGroup {
  final int id;
  final String code;
  final String name;
  final String selectionType;
  final int minSelect;
  final int maxSelect;
  final bool isRequired;
  final int sortOrder;
  final List<CatalogModifierOption> options;

  const CatalogModifierGroup({
    required this.id,
    required this.code,
    required this.name,
    required this.selectionType,
    required this.minSelect,
    required this.maxSelect,
    required this.isRequired,
    required this.sortOrder,
    required this.options,
  });

  factory CatalogModifierGroup.fromApi(Map<String, dynamic> json) {
    final options = (json['options'] as List? ?? const [])
        .map((option) => CatalogModifierOption.fromApi(
              Map<String, dynamic>.from(option as Map),
            ))
        .toList();

    return CatalogModifierGroup(
      id: (json['id'] as num).toInt(),
      code: json['code'] as String? ?? '',
      name: json['name'] as String? ?? '',
      selectionType: json['selection_type'] as String? ?? 'single',
      minSelect: (json['min_select'] as num?)?.toInt() ?? 0,
      maxSelect: (json['max_select'] as num?)?.toInt() ?? 1,
      isRequired: json['is_required'] as bool? ?? false,
      sortOrder: (json['sort_order'] as num?)?.toInt() ?? 0,
      options: options,
    );
  }
}

class MenuCategoryGroup {
  final int id;
  final String code;
  final String name;
  final String productKindCode;
  final String productKindName;
  final List<CatalogMenuItem> items;

  const MenuCategoryGroup({
    required this.id,
    required this.code,
    required this.name,
    required this.productKindCode,
    required this.productKindName,
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
      productKindCode: json['product_kind_code'] as String? ?? 'other',
      productKindName: json['product_kind_name'] as String? ?? 'Other',
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
