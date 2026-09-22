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
  static const _sessionKey = 'session_tokens_v2';
  Future<SessionTokens>? _refreshInFlight;

  Future<void> saveSession({
    required String accessToken,
    required String refreshToken,
  }) async {
    // Keep rotated token pairs together. Two separate secure-storage writes
    // can leave an access token paired with an already-rotated refresh token
    // if the app is terminated between them.
    await _storage.write(
      key: _sessionKey,
      value: jsonEncode({
        'access_token': accessToken,
        'refresh_token': refreshToken,
      }),
    );
    await _storage.delete(key: _accessTokenKey);
    await _storage.delete(key: _refreshTokenKey);
  }

  Future<String?> getAccessToken() async {
    final session = await _readSession();
    return session?['access_token'] ??
        await _storage.read(key: _accessTokenKey);
  }

  Future<String?> getRefreshToken() async {
    final session = await _readSession();
    return session?['refresh_token'] ??
        await _storage.read(key: _refreshTokenKey);
  }

  Future<SessionTokens> refreshSession() {
    final existingRefresh = _refreshInFlight;
    if (existingRefresh != null) return existingRefresh;

    late final Future<SessionTokens> refresh;
    refresh = _refreshSession().whenComplete(() {
      if (identical(_refreshInFlight, refresh)) {
        _refreshInFlight = null;
      }
    });
    _refreshInFlight = refresh;
    return refresh;
  }

  Future<String?> refreshTokenSilently() async {
    try {
      return (await refreshSession()).accessToken;
    } catch (_) {
      return null;
    }
  }

  Future<SessionTokens> _refreshSession() async {
    final refreshToken = await getRefreshToken();
    if (refreshToken == null || refreshToken.isEmpty) {
      throw ApiException('Missing refresh token.',
          code: 'invalid_refresh_token');
    }

    final tokens = await AuthApiService.instance.refreshSession(
      refreshToken: refreshToken,
    );
    await saveSession(
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    );
    return tokens;
  }

  Future<Map<String, String>?> _readSession() async {
    final rawSession = await _storage.read(key: _sessionKey);
    if (rawSession == null || rawSession.isEmpty) return null;

    try {
      final decoded = jsonDecode(rawSession);
      if (decoded is! Map) return null;
      final accessToken = decoded['access_token'];
      final refreshToken = decoded['refresh_token'];
      if (accessToken is! String ||
          accessToken.isEmpty ||
          refreshToken is! String ||
          refreshToken.isEmpty) {
        return null;
      }
      return {
        'access_token': accessToken,
        'refresh_token': refreshToken,
      };
    } catch (_) {
      return null;
    }
  }

  bool _isTokenExpired(String token) {
    try {
      final parts = token.split('.');
      if (parts.length != 3) return true;
      final payloadString =
          utf8.decode(base64Url.decode(base64Url.normalize(parts[1])));
      final payloadMap = jsonDecode(payloadString);
      final exp = payloadMap['exp'];
      if (exp == null) return false;
      final expiresAt =
          DateTime.fromMillisecondsSinceEpoch((exp as int) * 1000);
      return DateTime.now()
          .isAfter(expiresAt.subtract(const Duration(minutes: 1)));
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
    await _storage.delete(key: _sessionKey);
    await _storage.delete(key: _accessTokenKey);
    await _storage.delete(key: _refreshTokenKey);
  }
}
