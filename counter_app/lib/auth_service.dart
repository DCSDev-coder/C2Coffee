import 'dart:async';
import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'api_client.dart';

class DeviceActivationResult {
  final bool success;
  final String? message;

  const DeviceActivationResult._(this.success, this.message);

  const DeviceActivationResult.success() : this._(true, null);
  const DeviceActivationResult.failure(String message) : this._(false, message);
}

class AuthService {
  final ApiClient _apiClient = ApiClient();
  final FlutterSecureStorage _storage = const FlutterSecureStorage();

  static const String _tokenKey = 'device_token';

  Future<String?> getToken() async {
    return await _storage.read(key: _tokenKey);
  }

  // Attempt to load the token. If it exists, call GET /v1/counter/device to verify it.
  Future<bool> verifyDevice() async {
    final token = await _storage.read(key: _tokenKey);
    if (token == null) {
      return false;
    }

    try {
      final response = await _apiClient.get('/v1/counter/device', token: token);
      if (response.statusCode == 200) {
        return true;
      } else if (response.statusCode == 401) {
        // Device revoked, reset, or no longer valid
        await logout();
        return false;
      }
      return false; // Handle other errors as failed validation for now
    } catch (e) {
      // Network error, you might want to handle this differently in a real app
      return false;
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
        } catch (_) {
          return const DeviceActivationResult.failure(
            'The server activated this device, but iOS/Android secure storage could not save its credential. Rebuild the app with Keychain/Keystore configuration, then reissue activation.',
          );
        }
        return const DeviceActivationResult.success();
      }

      try {
        final payload = jsonDecode(response.body) as Map<String, dynamic>;
        final error = payload['error'];
        final message = error is Map<String, dynamic>
            ? error['message']
            : payload['message'];
        if (message is String && message.isNotEmpty) {
          return DeviceActivationResult.failure(message);
        }
      } catch (_) {
        // Fall back to a status-specific message below.
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
        'Activation failed (server response ${response.statusCode}).',
      );
    } catch (_) {
      return const DeviceActivationResult.failure(
        'The server returned an unreadable activation response.',
      );
    }
  }

  Future<void> logout() async {
    await _storage.delete(key: _tokenKey);
  }
}
