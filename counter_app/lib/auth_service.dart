import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'api_client.dart';
import 'safe_error_message.dart';

enum DeviceVerificationStatus {
  activated,
  activationRequired,
  temporarilyUnavailable,
}

class DeviceActivationResult {
  final bool success;
  final String? message;

  const DeviceActivationResult._(this.success, this.message);

  const DeviceActivationResult.success() : this._(true, null);
  const DeviceActivationResult.failure(String message) : this._(false, message);
}

class AdministratorUnlockResult {
  final bool success;
  final String? message;
  final bool deviceTokenValid;

  const AdministratorUnlockResult._(
    this.success,
    this.message, {
    this.deviceTokenValid = true,
  });

  const AdministratorUnlockResult.success({bool deviceTokenValid = true})
      : this._(true, null, deviceTokenValid: deviceTokenValid);
  const AdministratorUnlockResult.failure(String message)
      : this._(false, message);
}

class AuthService {
  AuthService({ApiClient? apiClient, FlutterSecureStorage? storage})
    : _apiClient = apiClient ?? ApiClient(),
      _storage = storage ?? const FlutterSecureStorage();

  final ApiClient _apiClient;
  final FlutterSecureStorage _storage;

  static const String _tokenKey = 'device_token';

  final ValueNotifier<DeviceVerificationStatus> statusNotifier =
      ValueNotifier<DeviceVerificationStatus>(
    DeviceVerificationStatus.temporarilyUnavailable,
  );

  Future<String?> getToken() async {
    return _storage.read(key: _tokenKey);
  }

  Future<DeviceVerificationStatus> verifyDevice() async {
    final token = await getToken();
    if (token == null) {
      statusNotifier.value = DeviceVerificationStatus.activationRequired;
      return DeviceVerificationStatus.activationRequired;
    }

    try {
      final response = await _apiClient.get('/v1/counter/device', token: token);
      if (response.statusCode == 200) {
        statusNotifier.value = DeviceVerificationStatus.activated;
        return DeviceVerificationStatus.activated;
      } else if (response.statusCode == 401) {
        // Device revoked, reset, or no longer valid
        await logout();
        statusNotifier.value = DeviceVerificationStatus.activationRequired;
        return DeviceVerificationStatus.activationRequired;
      }
      statusNotifier.value = DeviceVerificationStatus.temporarilyUnavailable;
      return DeviceVerificationStatus.temporarilyUnavailable;
    } catch (_) {
      statusNotifier.value = DeviceVerificationStatus.temporarilyUnavailable;
      return DeviceVerificationStatus.temporarilyUnavailable;
    }
  }

  Future<AdministratorUnlockResult> verifyAdministratorPassword(
    String password,
  ) async {
    final token = await getToken();

    try {
      final response = await _apiClient.post(
        '/v1/counter/administrator-unlock',
        {'password': password},
        token: token,
      );
      if (response.statusCode == 200) {
        try {
          final body = jsonDecode(response.body) as Map<String, dynamic>? ?? const {};
          final deviceTokenValid = body['device_token_valid'] as bool? ?? true;
          if (!deviceTokenValid) {
            // Device token is no longer recognized by the backend.
            // Clear local token so the tablet can return to the activation screen.
            await logout();
          }
          return AdministratorUnlockResult.success(
            deviceTokenValid: deviceTokenValid,
          );
        } catch (_) {
          return const AdministratorUnlockResult.success();
        }
      }
      if (response.statusCode == 429) {
        return const AdministratorUnlockResult.failure(
          'Too many attempts. Please wait 15 minutes before trying again.',
        );
      }
      return const AdministratorUnlockResult.failure(
        'Administrator password is incorrect.',
      );
    } on TimeoutException {
      return const AdministratorUnlockResult.failure(
        'The server took too long to respond. Check the internet connection and try again.',
      );
    } catch (_) {
      return const AdministratorUnlockResult.failure(
        'Unable to verify the administrator. Check the internet connection and try again.',
      );
    }
  }

  // Activate the device using a one-time activation code
  Future<DeviceActivationResult> activateDevice(String activationCode) async {
    late final dynamic response;
    try {
      response = await _apiClient.post('/v1/counter/activate', {
        'activation_code': activationCode.trim().toUpperCase(),
      });
    } on TimeoutException {
      return const DeviceActivationResult.failure(
        'The server took too long to respond. Check the internet connection and try again.',
      );
    } catch (_) {
      return DeviceActivationResult.failure(
        'Cannot reach ${ApiClient.baseUrl}. Check this device\'s internet connection and API configuration.',
      );
    }

    try {
      if (response.statusCode == 200) {
        final jsonResponse = jsonDecode(response.body) as Map<String, dynamic>;
        final token = jsonResponse['device_token'];
        if (token is! String || token.isEmpty) {
          return const DeviceActivationResult.failure(
            'The server returned an invalid device credential.',
          );
        }
        try {
          await _storage.write(key: _tokenKey, value: token);
          statusNotifier.value = DeviceVerificationStatus.activated;
        } catch (_) {
          return const DeviceActivationResult.failure(
            'The server activated this device, but iOS/Android secure storage could not save its credential. Rebuild the app with Keychain/Keystore configuration, then reissue activation.',
          );
        }
        return const DeviceActivationResult.success();
      }

      if (response.statusCode == 401) {
        return const DeviceActivationResult.failure(
          'This activation code is invalid, expired, or has already been used.',
        );
      }
      if (response.statusCode == 429) {
        return const DeviceActivationResult.failure(
          'Too many attempts. Wait 15 minutes before trying again.',
        );
      }
      return DeviceActivationResult.failure(
        SafeErrorMessage.fromStatus(
          response.statusCode,
          'Device activation failed. Please check the code and try again.',
        ),
      );
    } catch (_) {
      return const DeviceActivationResult.failure(
        'The server returned an unreadable activation response.',
      );
    }
  }

  Future<void> logout() async {
    await _storage.delete(key: _tokenKey);
    statusNotifier.value = DeviceVerificationStatus.activationRequired;
  }
}
