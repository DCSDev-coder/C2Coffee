import 'dart:convert';

import 'package:http/http.dart' as http;

import 'api_config.dart';
import 'auth_api_service.dart';
import 'cart_service.dart';

class CheckoutOrderSummary {
  final int id;
  final String orderRef;
  final String status;
  final String paymentMode;
  final String finalTotalRm;
  final int tokenAmountCharged;

  const CheckoutOrderSummary({
    required this.id,
    required this.orderRef,
    required this.status,
    required this.paymentMode,
    required this.finalTotalRm,
    required this.tokenAmountCharged,
  });

  factory CheckoutOrderSummary.fromApi(Map<String, dynamic> json) {
    return CheckoutOrderSummary(
      id: (json['id'] as num).toInt(),
      orderRef: json['order_ref'] as String? ?? '',
      status: json['status'] as String? ?? 'paid',
      paymentMode: json['payment_mode'] as String? ?? 'token',
      finalTotalRm: json['final_total_rm'] as String? ?? '0.00',
      tokenAmountCharged: (json['token_amount_charged'] as num?)?.toInt() ?? 0,
    );
  }
}

class CheckoutResult {
  final CheckoutOrderSummary order;
  final int tokenBalance;
  final int tokenReserved;
  final int tokenCap;

  const CheckoutResult({
    required this.order,
    required this.tokenBalance,
    required this.tokenReserved,
    required this.tokenCap,
  });

  factory CheckoutResult.fromApi(Map<String, dynamic> json) {
    return CheckoutResult(
      order: CheckoutOrderSummary.fromApi(
        Map<String, dynamic>.from(json['order'] as Map),
      ),
      tokenBalance: (json['token_balance'] as num?)?.toInt() ?? 0,
      tokenReserved: (json['token_reserved'] as num?)?.toInt() ?? 0,
      tokenCap: (json['token_cap'] as num?)?.toInt() ?? 0,
    );
  }
}

class CheckoutApiService {
  CheckoutApiService._();

  static final CheckoutApiService instance = CheckoutApiService._();

  final http.Client _client = http.Client();

  Future<CheckoutResult> createTokenOrder({
    required String accessToken,
    required CartSnapshot cart,
  }) async {
    final response = await _client
        .post(
          Uri.parse('${ApiConfig.baseUrl}/orders'),
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer $accessToken',
          },
          body: jsonEncode({
            'store_id': cart.storeId,
            'payment_mode': 'token',
            'items': cart.items.map((item) => item.toApi()).toList(),
          }),
        )
        .timeout(const Duration(seconds: 20));

    final text = utf8.decode(response.bodyBytes);
    final decoded = text.isEmpty ? <String, dynamic>{} : jsonDecode(text);

    if (response.statusCode >= 200 && response.statusCode < 300) {
      return CheckoutResult.fromApi(
        Map<String, dynamic>.from(decoded as Map),
      );
    }

    final body = decoded is Map
        ? Map<String, dynamic>.from(decoded)
        : <String, dynamic>{};
    final error = body['error'];
    if (error is Map<String, dynamic>) {
      throw ApiException(
        (error['message'] as String?) ?? 'Checkout failed.',
        code: error['code'] as String?,
      );
    }

    throw ApiException('Checkout failed with status ${response.statusCode}.');
  }
}
