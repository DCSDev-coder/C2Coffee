import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class SecureSessionService {
  SecureSessionService._();

  static final SecureSessionService instance = SecureSessionService._();

  static const _accessTokenKey = 'barista_access_token';
  static const _refreshTokenKey = 'barista_refresh_token';
  static const _tenantCodeKey = 'barista_tenant_code';

  final FlutterSecureStorage _storage = const FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
  );

  Future<void> save({
    required String accessToken,
    required String refreshToken,
    required String tenantCode,
  }) async {
    await _storage.write(key: _accessTokenKey, value: accessToken);
    await _storage.write(key: _refreshTokenKey, value: refreshToken);
    await _storage.write(key: _tenantCodeKey, value: tenantCode);
  }

  Future<BaristaStoredSession?> read() async {
    final accessToken = await _storage.read(key: _accessTokenKey);
    final refreshToken = await _storage.read(key: _refreshTokenKey);
    if (accessToken == null || accessToken.isEmpty || refreshToken == null || refreshToken.isEmpty) {
      return null;
    }

    return BaristaStoredSession(
      accessToken: accessToken,
      refreshToken: refreshToken,
      tenantCode: await _storage.read(key: _tenantCodeKey),
    );
  }

  Future<void> clear() => _storage.deleteAll();
}

class BaristaStoredSession {
  const BaristaStoredSession({
    required this.accessToken,
    required this.refreshToken,
    required this.tenantCode,
  });

  final String accessToken;
  final String refreshToken;
  final String? tenantCode;
}
