import 'dart:async';
import 'dart:convert';

import 'package:c2_coffee/screens/order_status_detail_page.dart';
import 'package:c2_coffee/services/app_session_service.dart';
import 'package:c2_coffee/services/customer_data_service.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

void main() {
  testWidgets('pending direct payment uses a payment-only page', (tester) async {
    final service = _service(
      <String>[],
      paymentState: 'payment_active',
      checkoutUrl: 'https://gate.chip-in.asia/p/test',
    );

    await tester.pumpWidget(_app(service));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 20));

    expect(find.text('WAITING FOR PAYMENT'), findsOneWidget);
    expect(find.text('ORDER STATUS'), findsNothing);
    expect(find.text('Order received'), findsNothing);
    expect(find.text('Total'), findsOneWidget);
    expect(find.text('CANCEL'), findsOneWidget);
    await _disposePage(tester);
  });

  testWidgets('check status reconciles payment before refreshing the order',
      (tester) async {
    final requests = <String>[];
    final service = _service(requests, paymentState: 'payment_processing');

    await tester.pumpWidget(_app(service));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 20));
    requests.clear();

    final checkButton = find.text('CHECK PAYMENT STATUS');
    await tester.ensureVisible(checkButton);
    await tester.tap(checkButton);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 20));

    expect(requests.take(2), ['/v1/orders/42/payment', '/v1/orders?limit=100']);
    expect(
        find.textContaining('You have not been charged twice'), findsOneWidget);
    expect(find.text('CHANGE PAYMENT METHOD'), findsOneWidget);
    expect(find.text('CANCEL ORDER'), findsNothing);
    await _disposePage(tester);
  });

  testWidgets('change method shows only methods enabled by the server',
      (tester) async {
    final requests = <String>[];
    final service = _service(
      requests,
      paymentState: 'payment_expired',
      enabledMethods: const ['ewallet'],
    );

    await tester.pumpWidget(_app(service));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 20));

    final changeButton = find.text('CHANGE PAYMENT METHOD');
    await tester.ensureVisible(changeButton);
    await tester.tap(changeButton);
    await tester.pump(const Duration(milliseconds: 300));

    expect(find.text('Online Payment'), findsOneWidget);
    expect(find.text('FPX Online Banking'), findsNothing);
    expect(find.text('DuitNow QR'), findsNothing);
    expect(find.text('Debit / Credit Card'), findsNothing);
    await _disposePage(tester);
  });

  testWidgets('change method excludes provider-inactive admin methods',
      (tester) async {
    final requests = <String>[];
    final service = _service(
      requests,
      paymentState: 'payment_expired',
      enabledMethods: const ['fpx', 'ewallet'],
      activeMethods: const ['fpx'],
    );

    await tester.pumpWidget(_app(service));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 20));

    final changeButton = find.text('CHANGE PAYMENT METHOD');
    await tester.ensureVisible(changeButton);
    await tester.tap(changeButton);
    await tester.pump(const Duration(milliseconds: 300));

    expect(find.text('FPX Online Banking'), findsOneWidget);
    expect(find.text('Online Payment'), findsNothing);
    await _disposePage(tester);
  });

  testWidgets('returning from external payment refreshes payment and order',
      (tester) async {
    final requests = <String>[];
    var launches = 0;
    final service = _service(
      requests,
      paymentState: 'payment_active',
      checkoutUrl: 'https://gate.chip-in.asia/p/test',
    );

    await tester.pumpWidget(_app(
      service,
      checkoutLauncher: (uri) async {
        launches += 1;
        return true;
      },
    ));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 20));
    requests.clear();

    final continueButton = find.byKey(const ValueKey('continue-payment'));
    await tester.ensureVisible(continueButton);
    await tester.tap(continueButton);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 20));
    expect(launches, 1);

    requests.clear();
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 20));

    expect(requests.take(2), ['/v1/orders/42/payment', '/v1/orders?limit=100']);
    await _disposePage(tester);
  });

  testWidgets('continue payment ignores duplicate taps while checking provider',
      (tester) async {
    final pendingResponse = Completer<http.Response>();
    var paymentRequests = 0;
    final service = CustomerDataService(
      client: MockClient((request) async {
        if (request.url.path.endsWith('/payment')) {
          paymentRequests += 1;
          if (paymentRequests > 1) return pendingResponse.future;
          return _activePaymentResponse();
        }
        if (request.url.path.endsWith('/orders')) {
          return http.Response(
            jsonEncode({
              'active_order': _orderJson(),
              'orders': [_orderJson()],
            }),
            200,
          );
        }
        return http.Response('{}', 404);
      }),
      baseUrl: 'https://test.example.com/v1',
    );

    await tester.pumpWidget(_app(service));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 20));

    final continueButton = find.byKey(const ValueKey('continue-payment'));
    await tester.ensureVisible(continueButton);
    await tester.tap(continueButton);
    await tester.pump();
    await tester.tap(continueButton);
    await tester.pump();

    expect(paymentRequests, 2,
        reason: 'one initial reconciliation plus one continue request');
    pendingResponse.complete(_activePaymentResponse());
    await tester.pump(const Duration(milliseconds: 20));
    await _disposePage(tester);
  });
}

http.Response _activePaymentResponse() => http.Response(
      jsonEncode({
        'status': 'pending',
        'normalized_state': 'payment_active',
        'checkout_url': 'https://gate.chip-in.asia/p/test',
        'can_continue': true,
        'can_change_method': false,
        'can_cancel': true,
        'enabled_methods': ['fpx'],
      }),
      200,
    );

Future<void> _disposePage(WidgetTester tester) async {
  AppSessionService.instance.stopActiveOrderPolling();
  await tester.pumpWidget(const SizedBox());
}

Widget _app(
  CustomerDataService service, {
  Future<bool> Function(Uri uri)? checkoutLauncher,
}) {
  return MaterialApp(
    home: OrderStatusDetailPage(
      order: _order(),
      dataService: service,
      accessTokenProvider: () async => 'token',
      checkoutLauncher: checkoutLauncher,
    ),
  );
}

CustomerDataService _service(
  List<String> requests, {
  required String paymentState,
  List<String> enabledMethods = const ['fpx', 'duitnow_qr'],
  List<String>? activeMethods,
  String? checkoutUrl,
}) {
  return CustomerDataService(
    client: MockClient((request) async {
      requests.add(request.url.path +
          (request.url.hasQuery ? '?${request.url.query}' : ''));
      if (request.url.path.endsWith('/payment')) {
        return http.Response(
          jsonEncode({
            'status': 'pending',
            'normalized_state': paymentState,
            'checkout_url': checkoutUrl,
            'can_continue': paymentState == 'payment_active',
            'can_change_method':
                paymentState == 'payment_active' ||
                paymentState == 'payment_processing' ||
                paymentState == 'payment_expired',
            'can_cancel': paymentState != 'payment_processing',
            'enabled_methods': enabledMethods,
          }),
          200,
        );
      }
      if (request.url.path.endsWith('/topups/payment-methods')) {
        return http.Response(
          jsonEncode({
            'methods': activeMethods ?? enabledMethods,
            'method_descriptions': const <String, String>{},
          }),
          200,
        );
      }
      if (request.url.path.endsWith('/orders')) {
        return http.Response(
          jsonEncode({
            'active_order': _orderJson(),
            'orders': [_orderJson()],
          }),
          200,
        );
      }
      return http.Response('{}', 404);
    }),
    baseUrl: 'https://test.example.com/v1',
  );
}

CustomerOrder _order() => CustomerOrder.fromApi(_orderJson());

Map<String, dynamic> _orderJson() => {
      'id': 42,
      'order_ref': 'C2-TEST',
      'daily_order_number': 7,
      'status': 'pending_payment',
      'payment_mode': 'direct',
      'payment_status': 'pending',
      'payment_method': 'fpx',
      'payment_expires_at': '2026-11-20T08:00:00.000Z',
      'final_total_rm': '12.90',
      'token_amount_charged': 0,
      'pickup_slot_at': '2026-11-20T08:30:00.000Z',
      'collected_at': null,
      'created_at': '2026-11-20T07:30:00.000Z',
      'store': {'id': 1, 'name': 'C2 Test'},
      'item_count': 1,
      'primary_item_name': 'Latte',
      'barista_name': null,
      'barista_username': null,
      'cancellation_request_status': null,
      'items': <dynamic>[],
      'status_history': <dynamic>[],
    };
