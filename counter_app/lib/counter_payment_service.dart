import 'dart:convert';

import 'api_client.dart';

class CounterPaymentException implements Exception {
  const CounterPaymentException(this.message);
  final String message;
  @override
  String toString() => message;
}

class CounterPaymentService {
  CounterPaymentService({ApiClient? apiClient})
    : _apiClient = apiClient ?? ApiClient();

  final ApiClient _apiClient;
  Map<String, String> _sessionHeaders(String? sessionToken) => {
    if (sessionToken != null && sessionToken.isNotEmpty)
      'X-Counter-Customer-Session': sessionToken,
  };

  Map<String, dynamic> _decode(String body) {
    final decoded = jsonDecode(body);
    return decoded is Map ? Map<String, dynamic>.from(decoded) : {};
  }

  Never _failure(String body, String fallback) {
    try {
      final decoded = _decode(body);
      final error = decoded['error'];
      if (error is Map && error['message'] != null) {
        throw CounterPaymentException(error['message'].toString());
      }
      if (decoded['message'] != null) {
        throw CounterPaymentException(decoded['message'].toString());
      }
    } on FormatException {
      // Use the safe fallback below.
    }
    throw CounterPaymentException(fallback);
  }

  Future<List<String>> paymentMethods(String deviceToken) async {
    final response = await _apiClient.get(
      '/v1/counter/payment-methods',
      token: deviceToken,
    );
    if (response.statusCode != 200) {
      _failure(response.body, 'Payment methods could not be loaded.');
    }
    return (_decode(response.body)['methods'] as List? ?? const [])
        .map((value) => value.toString())
        .toList();
  }

  Future<Map<String, dynamic>> quote({
    required String deviceToken,
    required String sessionToken,
    required List<Map<String, dynamic>> items,
    int? voucherId,
  }) async {
    final response = await _apiClient.post(
      '/v1/counter/orders/quote',
      {'items': items, 'applied_voucher_id': voucherId},
      token: deviceToken,
      headers: _sessionHeaders(sessionToken),
    );
    if (response.statusCode != 200) {
      _failure(response.body, 'The order total could not be confirmed.');
    }
    return Map<String, dynamic>.from(_decode(response.body)['quote'] as Map);
  }

  Future<Map<String, dynamic>> requestVoucherOtp({
    required String deviceToken,
    required String sessionToken,
    required List<Map<String, dynamic>> items,
    required int voucherId,
  }) async {
    final response = await _apiClient.post(
      '/v1/counter/voucher-authorizations/request',
      {'items': items, 'applied_voucher_id': voucherId},
      token: deviceToken,
      headers: _sessionHeaders(sessionToken),
    );
    if (response.statusCode != 200) {
      _failure(response.body, 'The voucher approval code could not be sent.');
    }
    return _decode(response.body);
  }

  Future<String> verifyVoucherOtp({
    required String deviceToken,
    required String sessionToken,
    required String requestId,
    required String otpCode,
  }) async {
    final response = await _apiClient.post(
      '/v1/counter/voucher-authorizations/verify',
      {'request_id': requestId, 'otp_code': otpCode},
      token: deviceToken,
      headers: _sessionHeaders(sessionToken),
    );
    if (response.statusCode != 200) {
      _failure(response.body, 'The voucher approval code is incorrect.');
    }
    return _decode(response.body)['voucher_authorization_token'].toString();
  }

  Future<Map<String, dynamic>> createPayment({
    required String deviceToken,
    required String? sessionToken,
    required String? paymentMethod,
    required String fulfillmentType,
    required List<Map<String, dynamic>> items,
    int? voucherId,
    String? voucherAuthorizationToken,
  }) async {
    final response = await _apiClient.post(
      '/v1/counter/orders/payment',
      {
        'payment_method': paymentMethod,
        'fulfillment_type': fulfillmentType,
        'items': items,
        'applied_voucher_id': voucherId,
        'voucher_authorization_token': voucherAuthorizationToken,
      },
      token: deviceToken,
      headers: {
        ..._sessionHeaders(sessionToken),
        'Idempotency-Key': '${DateTime.now().microsecondsSinceEpoch}',
      },
    );
    if (response.statusCode != 200) {
      _failure(response.body, 'Payment could not be started.');
    }
    return _decode(response.body);
  }

  Future<Map<String, dynamic>> paymentStatus({
    required String deviceToken,
    required String orderRef,
  }) async {
    final response = await _apiClient.get(
      '/v1/counter/orders/${Uri.encodeComponent(orderRef)}/payment',
      token: deviceToken,
    );
    if (response.statusCode != 200) {
      _failure(response.body, 'Payment status could not be checked.');
    }
    return _decode(response.body);
  }

  Uri checkoutUri(String url) {
    final uri = Uri.tryParse(url);
    final host = uri?.host.toLowerCase() ?? '';
    if (uri == null ||
        uri.scheme != 'https' ||
        (host != 'chip-in.asia' && !host.endsWith('.chip-in.asia'))) {
      throw const CounterPaymentException('The payment link is invalid.');
    }
    return uri;
  }
}
