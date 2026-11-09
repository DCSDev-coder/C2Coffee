import 'dart:io';

import 'package:counter_app/api_client.dart';
import 'package:counter_app/auth_service.dart';
import 'package:counter_app/device_printer_worker.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;

class _FakeApiClient extends ApiClient {
  _FakeApiClient(this.statusCode, {this.responseBody = '{}'});

  final int statusCode;
  final String responseBody;

  @override
  Future<http.Response> get(
    String path, {
    String? token,
    Map<String, String>? headers,
  }) async => http.Response(responseBody, statusCode);

  @override
  Future<http.Response> post(
    String path,
    Map<String, dynamic> body, {
    String? token,
    Map<String, String>? headers,
  }) async => http.Response(responseBody, statusCode);
}

void main() {
  test(
    'incoming order sound and receipt print start from the same claimed job',
    () {
      final source = File('lib/device_printer_worker.dart').readAsStringSync();
      expect(source, contains('BaristaSoundEvent.incomingOrder'));
      expect(source, contains('Future.wait<void>'));
      expect(source, contains('DirectPrinterService.instance.printJob(job)'));
      expect(
        source.indexOf('Future.wait<void>'),
        lessThan(source.indexOf("printed: true")),
      );
    },
  );

  test('counter API endpoint requires a secure origin', () {
    final source = File('lib/api_client.dart').readAsStringSync();
    expect(source, contains("uri.scheme != 'https'"));
    expect(source, contains('uri.userInfo.isNotEmpty'));
    expect(source, contains('uri.hasQuery'));
    expect(source, contains('uri.hasFragment'));
  });

  test('resuming the app triggers one fresh durable queue poll', () async {
    var polls = 0;
    final worker = DevicePrinterWorker(
      authService: AuthService(),
      pollOverride: () async {
        polls += 1;
      },
    );
    addTearDown(worker.dispose);

    worker.start();
    worker.start();
    await Future<void>.delayed(const Duration(milliseconds: 10));
    expect(polls, 1);

    worker.resume();
    await Future<void>.delayed(const Duration(milliseconds: 10));
    expect(polls, 2);
  });

  test(
    'temporary device verification failures preserve the activation token',
    () async {
      FlutterSecureStorage.setMockInitialValues({'device_token': 'device-1'});
      final service = AuthService(
        apiClient: _FakeApiClient(503),
        storage: const FlutterSecureStorage(),
      );
      expect(
        await service.verifyDevice(),
        DeviceVerificationStatus.temporarilyUnavailable,
      );
      expect(await service.getToken(), 'device-1');
    },
  );

  test('only an unauthorized response requires device reactivation', () async {
    FlutterSecureStorage.setMockInitialValues({'device_token': 'device-1'});
    final service = AuthService(
      apiClient: _FakeApiClient(401),
      storage: const FlutterSecureStorage(),
    );
    expect(
      await service.verifyDevice(),
      DeviceVerificationStatus.activationRequired,
    );
    expect(await service.getToken(), isNull);
  });

  test(
    'administrator unlock clears dead device token and triggers activationRequired when device_token_valid is false',
    () async {
      FlutterSecureStorage.setMockInitialValues({'device_token': 'stale-token'});
      final service = AuthService(
        apiClient: _FakeApiClient(
          200,
          responseBody: '{"unlocked":true,"device_token_valid":false}',
        ),
        storage: const FlutterSecureStorage(),
      );
      final result = await service.verifyAdministratorPassword('AdminPass123!');
      expect(result.success, isTrue);
      expect(result.deviceTokenValid, isFalse);
      expect(await service.getToken(), isNull);
      expect(
        service.statusNotifier.value,
        DeviceVerificationStatus.activationRequired,
      );
    },
  );

  test(
    'administrator unlock preserves valid device token when device_token_valid is true',
    () async {
      FlutterSecureStorage.setMockInitialValues({'device_token': 'valid-token'});
      final service = AuthService(
        apiClient: _FakeApiClient(
          200,
          responseBody: '{"unlocked":true,"device_token_valid":true}',
        ),
        storage: const FlutterSecureStorage(),
      );
      final result = await service.verifyAdministratorPassword('AdminPass123!');
      expect(result.success, isTrue);
      expect(result.deviceTokenValid, isTrue);
      expect(await service.getToken(), 'valid-token');
    },
  );
}
