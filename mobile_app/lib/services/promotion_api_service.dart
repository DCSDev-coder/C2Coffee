import 'dart:convert';

import 'package:http/http.dart' as http;

import 'api_config.dart';
import 'auth_api_service.dart';
import 'cart_service.dart';
import 'catalog_api_service.dart';

class PromotionalRewardOption {
  const PromotionalRewardOption(
      {required this.menuItemId,
      required this.name,
      required this.imageUrl,
      required this.availableQuantity,
      required this.isAvailable});
  final int menuItemId;
  final String name;
  final String? imageUrl;
  final int availableQuantity;
  final bool isAvailable;

  factory PromotionalRewardOption.fromApi(Map<String, dynamic> json) =>
      PromotionalRewardOption(
        menuItemId: (json['menu_item_id'] as num).toInt(),
        name: json['name'] as String? ?? 'Promotional gift',
        imageUrl: resolveCatalogImageSource(json['image_url'] as String?),
        availableQuantity: (json['available_quantity'] as num?)?.toInt() ?? 0,
        isAvailable: json['is_available'] == true,
      );
}

class PromotionalAddonQuote {
  const PromotionalAddonQuote(
      {required this.id,
      required this.name,
      required this.assignmentMode,
      required this.allowDecline,
      required this.priceMode,
      required this.priceRm,
      required this.tokenAmount,
      required this.qualificationSummary,
      required this.rewards});
  final int id;
  final String name;
  final String assignmentMode;
  final bool allowDecline;
  final String priceMode;
  final String priceRm;
  final int tokenAmount;
  final String qualificationSummary;
  final List<PromotionalRewardOption> rewards;
  bool get isRandom => assignmentMode == 'server_random';

  factory PromotionalAddonQuote.fromApi(Map<String, dynamic> json) =>
      PromotionalAddonQuote(
        id: (json['id'] as num).toInt(),
        name: json['name'] as String? ?? 'Promotional add-on',
        assignmentMode: json['assignment_mode'] as String? ?? 'customer_choice',
        allowDecline: json['allow_decline'] == true,
        priceMode: json['price_mode'] as String? ?? 'free',
        priceRm: json['price_rm'] as String? ?? '0.00',
        tokenAmount: (json['token_amount'] as num?)?.toInt() ?? 0,
        qualificationSummary: json['qualification_summary'] as String? ?? '',
        rewards: (json['rewards'] as List? ?? const [])
            .whereType<Map>()
            .map((value) => PromotionalRewardOption.fromApi(
                Map<String, dynamic>.from(value)))
            .toList(),
      );
}

class PromotionApiService {
  PromotionApiService({http.Client? client, String? baseUrl})
      : _client = client ?? http.Client(),
        _baseUrl = baseUrl ?? ApiConfig.baseUrl;
  static final PromotionApiService instance = PromotionApiService();
  final http.Client _client;
  final String _baseUrl;

  Future<PromotionalAddonQuote?> quote(
      {required String accessToken,
      required CartSnapshot cart,
      required String paymentMode}) async {
    final response = await _client
        .post(
          Uri.parse('$_baseUrl/promotional-addons/quote'),
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer $accessToken'
          },
          body: jsonEncode({
            'store_id': cart.storeId,
            'payment_mode': paymentMode,
            'client_capabilities': const ['promotion_addons_v1'],
            'items': cart.items
                .map((item) => {
                      'menu_item_id': item.menuItemId,
                      'quantity': item.quantity
                    })
                .toList(),
          }),
        )
        .timeout(const Duration(seconds: 20));
    final decoded = response.bodyBytes.isEmpty
        ? <String, dynamic>{}
        : jsonDecode(utf8.decode(response.bodyBytes));
    if (response.statusCode >= 200 && response.statusCode < 300) {
      final body = Map<String, dynamic>.from(decoded as Map);
      if (body['eligible'] != true || body['campaign'] is! Map) return null;
      return PromotionalAddonQuote.fromApi(
          Map<String, dynamic>.from(body['campaign'] as Map));
    }
    final body = decoded is Map
        ? Map<String, dynamic>.from(decoded)
        : <String, dynamic>{};
    final error = body['error'];
    throw ApiException(
        error is Map
            ? (error['message']?.toString() ??
                'Unable to check promotional gifts.')
            : 'Unable to check promotional gifts.',
        code: error is Map ? error['code']?.toString() : null);
  }
}
