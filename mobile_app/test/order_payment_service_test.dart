import 'dart:convert';

import 'package:c2_coffee/services/customer_data_service.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

void main() {
  test('order payment status uses the reconciliation endpoint', () async {
    late http.Request captured;
    final service = CustomerDataService(
      client: MockClient((request) async {
        captured = request;
        return http.Response(
          jsonEncode({
            'status': 'pending_execute',
            'normalized_state': 'payment_processing',
            'can_continue': false,
            'can_change_method': false,
            'can_cancel': false,
          }),
          200,
        );
      }),
      baseUrl: 'https://test.example.com/v1',
    );

    final result = await service.getOrderPayment(
      accessToken: 'token',
      orderId: 42,
    );

    expect(captured.url.toString(),
        'https://test.example.com/v1/orders/42/payment');
    expect(captured.headers['authorization'], 'Bearer token');
    expect(result.state, OrderPaymentState.processing);
  });

  test('retry payment parses the same additive payment contract', () async {
    late http.Request captured;
    final service = CustomerDataService(
      client: MockClient((request) async {
        captured = request;
        return http.Response(
          jsonEncode({
            'status': 'pending',
            'normalized_state': 'payment_active',
            'checkout_url': 'https://gate.chip-in.asia/p/new',
            'can_continue': true,
          }),
          200,
        );
      }),
      baseUrl: 'https://test.example.com/v1',
    );

    final result = await service.retryOrderPayment(
      accessToken: 'token',
      orderId: 42,
      paymentMethod: 'ewallet',
    );

    expect(captured.url.toString(),
        'https://test.example.com/v1/orders/42/payment/retry');
    expect(jsonDecode(captured.body), {'payment_method': 'ewallet'});
    expect(result.state, OrderPaymentState.active);
    expect(result.checkoutUrl, 'https://gate.chip-in.asia/p/new');
  });
}
