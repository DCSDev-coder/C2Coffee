import 'dart:convert';

import 'package:c2_coffee/services/cart_service.dart';
import 'package:c2_coffee/services/checkout_api_service.dart';
import 'package:c2_coffee/services/auth_api_service.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

void main() {
  test('checkout sends a token-only order with an idempotency key', () async {
    late http.Request captured;
    final client = MockClient((request) async {
      captured = request;
      return http.Response(
        jsonEncode({
          'order': {
            'id': 10,
            'order_ref': 'C2-TEST',
            'daily_order_number': 1,
            'status': 'paid',
            'payment_mode': 'token',
            'final_total_rm': '12.00',
            'token_amount_charged': 12,
          },
          'token_balance': 88,
          'token_reserved': 0,
          'token_cap': 500,
        }),
        200,
        headers: {'content-type': 'application/json'},
      );
    });
    final service = CheckoutApiService(
      client: client,
      baseUrl: 'https://test.example.com/v1',
    );
    final cart = CartSnapshot(
      storeId: 7,
      storeName: 'Test Outlet',
      items: const [],
    );

    final result = await service.createTokenOrder(
      accessToken: 'access-token',
      cart: cart,
      idempotencyKey: 'checkout-123',
      appliedVoucherId: 4,
    );

    final body = jsonDecode(captured.body) as Map<String, dynamic>;
    expect(captured.url.toString(), 'https://test.example.com/v1/orders');
    expect(captured.headers['authorization'], 'Bearer access-token');
    expect(captured.headers['idempotency-key'], 'checkout-123');
    expect(body['payment_mode'], 'token');
    expect(body['store_id'], 7);
    expect(body['applied_voucher_id'], 4);
    expect(result.order.paymentMode, 'token');
    expect(result.tokenBalance, 88);
  });

  test('checkout preserves top-up-required error code for customer messaging',
      () async {
    final client = MockClient((request) async {
      return http.Response(
        jsonEncode({
          'error': {
            'code': 'top_up_required',
            'message':
                'Complete one successful token top-up before placing an order or using vouchers.',
          },
        }),
        403,
        headers: {'content-type': 'application/json'},
      );
    });
    final service = CheckoutApiService(
      client: client,
      baseUrl: 'https://test.example.com/v1',
    );
    final cart = CartSnapshot(
      storeId: 7,
      storeName: 'Test Outlet',
      items: const [],
    );

    await expectLater(
      service.createTokenOrder(
        accessToken: 'access-token',
        cart: cart,
        idempotencyKey: 'checkout-topup-required',
      ),
      throwsA(
        isA<ApiException>()
            .having((error) => error.code, 'code', 'top_up_required')
            .having(
              (error) => friendlyCustomerErrorMessage(
                error,
                fallback: 'fallback',
              ),
              'friendly message',
              'Complete one successful token top-up to unlock ordering and voucher redemption.',
            ),
      ),
    );
  });

  test('checkout preserves store-closed error code for customer messaging',
      () async {
    final client = MockClient((request) async {
      return http.Response(
        jsonEncode({
          'error': {
            'code': 'store_closed',
            'message': 'This outlet is currently closed.',
          },
        }),
        409,
        headers: {'content-type': 'application/json'},
      );
    });
    final service = CheckoutApiService(
      client: client,
      baseUrl: 'https://test.example.com/v1',
    );
    final cart = CartSnapshot(
      storeId: 7,
      storeName: 'Test Outlet',
      items: const [],
    );

    await expectLater(
      service.createTokenOrder(
        accessToken: 'access-token',
        cart: cart,
        idempotencyKey: 'checkout-store-closed',
      ),
      throwsA(
        isA<ApiException>()
            .having((error) => error.code, 'code', 'store_closed')
            .having(
              (error) => friendlyCustomerErrorMessage(
                error,
                fallback: 'fallback',
              ),
              'friendly message',
              'This outlet is currently closed. Choose an open outlet before ordering.',
            ),
      ),
    );
  });
}
