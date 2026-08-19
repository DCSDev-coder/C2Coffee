import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'auth_api_service.dart';

class SecureSessionService {
  SecureSessionService._();

  static final SecureSessionService instance = SecureSessionService._();

  static const _storage = FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
  );

  static const _accessTokenKey = 'access_token';
  static const _refreshTokenKey = 'refresh_token';

  Future<void> saveSession({
    required String accessToken,
    required String refreshToken,
  }) async {
    await _storage.write(key: _accessTokenKey, value: accessToken);
    await _storage.write(key: _refreshTokenKey, value: refreshToken);
  }

  Future<String?> getAccessToken() {
    return _storage.read(key: _accessTokenKey);
  }

  Future<String?> getRefreshToken() {
    return _storage.read(key: _refreshTokenKey);
  }

  Future<String?> refreshTokenSilently() async {
    final refreshToken = await getRefreshToken();
    if (refreshToken == null || refreshToken.isEmpty) return null;
    try {
      final tokens = await AuthApiService.instance.refreshSession(
        refreshToken: refreshToken,
      );
      await saveSession(
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      );
      return tokens.accessToken;
    } catch (_) {
      return null;
    }
  }

  bool _isTokenExpired(String token) {
    try {
      final parts = token.split('.');
      if (parts.length != 3) return true;
      final payloadString = utf8.decode(base64Url.decode(base64Url.normalize(parts[1])));
      final payloadMap = jsonDecode(payloadString);
      final exp = payloadMap['exp'];
      if (exp == null) return false;
      final expiresAt = DateTime.fromMillisecondsSinceEpoch((exp as int) * 1000);
      return DateTime.now().isAfter(expiresAt.subtract(const Duration(minutes: 1)));
    } catch (_) {
      return true;
    }
  }

  Future<String?> getValidAccessToken() async {
    final token = await getAccessToken();
    if (token != null && token.isNotEmpty) {
      if (!_isTokenExpired(token)) {
        return token;
      }
    }
    return refreshTokenSilently();
  }

  Future<void> clearSession() async {
    await _storage.delete(key: _accessTokenKey);
    await _storage.delete(key: _refreshTokenKey);
  }
}
