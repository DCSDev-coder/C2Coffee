import 'dart:convert';
import 'dart:math';

import 'package:http/http.dart' as http;
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'api_config.dart';

class ApiException implements Exception {
  final String message;
  final String? code;

  ApiException(this.message, {this.code});

  @override
  String toString() => message;
}

class OtpRequestResult {
  final String requestId;
  final String channel;
  final int expiresInSeconds;
  final int resendInSeconds;
  final String? debugOtpCode;

  const OtpRequestResult({
    required this.requestId,
    required this.channel,
    required this.expiresInSeconds,
    required this.resendInSeconds,
    required this.debugOtpCode,
  });
}

class VerifyOtpUser {
  final int id;
  final String phone;
  final String displayName;
  final String? status;

  const VerifyOtpUser({
    required this.id,
    required this.phone,
    required this.displayName,
    required this.status,
  });
}

class VerifyOtpResult {
  final String accessToken;
  final String refreshToken;
  final VerifyOtpUser user;
  final int tokenBalance;
  final String tier;

  const VerifyOtpResult({
    required this.accessToken,
    required this.refreshToken,
    required this.user,
    required this.tokenBalance,
    required this.tier,
  });
}

class SessionTokens {
  final String accessToken;
  final String refreshToken;

  const SessionTokens({
    required this.accessToken,
    required this.refreshToken,
  });
}

class CurrentUserProfile {
  final int id;
  final String phone;
  final String displayName;
  final String status;
  final String? email;
  final String? birthday;
  final String? gender;
  final String? address;

  const CurrentUserProfile({
    required this.id,
    required this.phone,
    required this.displayName,
    required this.status,
    required this.email,
    required this.birthday,
    required this.gender,
    required this.address,
  });

  factory CurrentUserProfile.fromApi(Map<String, dynamic> user) {
    return CurrentUserProfile(
      id: (user['id'] as num).toInt(),
      phone: user['phone'] as String,
      displayName: user['display_name'] as String? ?? 'C2 Member',
      status: user['status'] as String? ?? 'active',
      email: user['email'] as String?,
      birthday: _formatBirthdayForDisplay(user['birthday'] as String?),
      gender: user['gender'] as String?,
      address: user['address'] as String?,
    );
  }

  Map<String, String> toLocalProfileMap() {
    return {
      'username': displayName,
      'phone': phone,
      if (email != null) 'email': email!,
      if (birthday != null) 'birthday': birthday!,
      if (gender != null) 'gender': gender!,
      if (address != null) 'address': address!,
    };
  }

  static String? _formatBirthdayForDisplay(String? raw) {
    if (raw == null || raw.isEmpty) return null;
    try {
      return DateFormat('dd MMM yyyy').format(DateTime.parse(raw));
    } catch (_) {
      return raw;
    }
  }
}

class AuthApiService {
  AuthApiService._();

  static final AuthApiService instance = AuthApiService._();
  static const _deviceFingerprintKey = 'device_fingerprint';

  final http.Client _client = http.Client();

  Future<String> getOrCreateDeviceFingerprint() async {
    final prefs = await SharedPreferences.getInstance();
    final existing = prefs.getString(_deviceFingerprintKey);
    if (existing != null && existing.isNotEmpty) {
      return existing;
    }

    final random = Random.secure();
    final fingerprint =
        'c2-${DateTime.now().microsecondsSinceEpoch}-${random.nextInt(1 << 31).toRadixString(16)}';

    await prefs.setString(_deviceFingerprintKey, fingerprint);
    return fingerprint;
  }

  Future<OtpRequestResult> requestOtp({
    required String phone,
    required String deviceFingerprint,
    String preferredChannel = 'whatsapp',
  }) async {
    final response = await _post(
      '/auth/request-otp',
      body: {
        'phone': phone,
        'device_fingerprint': deviceFingerprint,
        'preferred_channel': preferredChannel,
      },
    );

    return OtpRequestResult(
      requestId: response['request_id'] as String,
      channel: response['channel'] as String,
      expiresInSeconds: (response['expires_in_seconds'] as num).toInt(),
      resendInSeconds: (response['resend_in_seconds'] as num).toInt(),
      debugOtpCode: response['debug_otp_code'] as String?,
    );
  }

  Future<VerifyOtpResult> verifyOtp({
    required String requestId,
    required String phone,
    required String otpCode,
    required String deviceFingerprint,
  }) async {
    final response = await _post(
      '/auth/verify-otp',
      body: {
        'request_id': requestId,
        'phone': phone,
        'otp_code': otpCode,
        'device_fingerprint': deviceFingerprint,
      },
    );

    final user = response['user'] as Map<String, dynamic>;
    final bootstrap = response['bootstrap'] as Map<String, dynamic>;

    return VerifyOtpResult(
      accessToken: response['access_token'] as String,
      refreshToken: response['refresh_token'] as String,
      user: VerifyOtpUser(
        id: (user['id'] as num).toInt(),
        phone: user['phone'] as String,
        displayName: user['display_name'] as String,
        status: user['status'] as String?,
      ),
      tokenBalance: (bootstrap['token_balance'] as num).toInt(),
      tier: bootstrap['tier'] as String,
    );
  }

  Future<SessionTokens> refreshSession({
    required String refreshToken,
  }) async {
    final response = await _post(
      '/auth/refresh',
      body: {
        'refresh_token': refreshToken,
      },
    );

    return SessionTokens(
      accessToken: response['access_token'] as String,
      refreshToken: response['refresh_token'] as String,
    );
  }

  Future<CurrentUserProfile> getCurrentUser({
    required String accessToken,
  }) async {
    final response = await _get(
      '/me',
      accessToken: accessToken,
    );

    final user = Map<String, dynamic>.from(response['user'] as Map);
    return CurrentUserProfile.fromApi(user);
  }

  Future<CurrentUserProfile> updateProfile({
    required String accessToken,
    required Map<String, String> profile,
  }) async {
    final response = await _put(
      '/me/profile',
      accessToken: accessToken,
      body: {
        'display_name': profile['display_name'] ?? 'C2 Member',
        'email': profile['email'] ?? '',
        'birthday': profile['birthday'] ?? '',
        'gender': profile['gender'] ?? '',
        'house_line': profile['house_line'] ?? '',
        'street_line': profile['street_line'] ?? '',
        'postcode': profile['postcode'] ?? '',
        'city': profile['city'] ?? '',
      },
    );

    final user = Map<String, dynamic>.from(response['user'] as Map);
    return CurrentUserProfile.fromApi(user);
  }

  Future<void> logout({
    required String accessToken,
  }) async {
    await _post(
      '/auth/logout',
      accessToken: accessToken,
      body: const {},
    );
  }

  Future<Map<String, dynamic>> _post(
    String path, {
    required Map<String, dynamic> body,
    String? accessToken,
  }) async {
    final response = await _client
        .post(
          Uri.parse('${ApiConfig.baseUrl}$path'),
          headers: _headers(accessToken: accessToken),
          body: jsonEncode(body),
        )
        .timeout(const Duration(seconds: 15));

    return _decodeResponse(response);
  }

  Future<Map<String, dynamic>> _get(
    String path, {
    String? accessToken,
  }) async {
    final response = await _client
        .get(
          Uri.parse('${ApiConfig.baseUrl}$path'),
          headers: _headers(accessToken: accessToken),
        )
        .timeout(const Duration(seconds: 15));

    return _decodeResponse(response);
  }

  Future<Map<String, dynamic>> _put(
    String path, {
    required Map<String, dynamic> body,
    String? accessToken,
  }) async {
    final response = await _client
        .put(
          Uri.parse('${ApiConfig.baseUrl}$path'),
          headers: _headers(accessToken: accessToken),
          body: jsonEncode(body),
        )
        .timeout(const Duration(seconds: 15));

    return _decodeResponse(response);
  }

  Map<String, String> _headers({String? accessToken}) {
    return {
      'Content-Type': 'application/json',
      if (accessToken != null && accessToken.isNotEmpty)
        'Authorization': 'Bearer $accessToken',
    };
  }

  Map<String, dynamic> _decodeResponse(http.Response response) {
    final text = utf8.decode(response.bodyBytes);
    final decoded = text.isEmpty ? <String, dynamic>{} : jsonDecode(text);

    if (response.statusCode >= 200 && response.statusCode < 300) {
      return Map<String, dynamic>.from(decoded as Map);
    }

    final body = decoded is Map ? Map<String, dynamic>.from(decoded) : <String, dynamic>{};
    final error = body['error'];
    if (error is Map<String, dynamic>) {
      throw ApiException(
        (error['message'] as String?) ?? 'Request failed.',
        code: error['code'] as String?,
      );
    }

    throw ApiException('Request failed with status ${response.statusCode}.');
  }
}
