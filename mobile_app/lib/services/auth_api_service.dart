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

String friendlyAuthErrorMessage(
  ApiException error, {
  required String fallback,
}) {
  final message = error.message.trim();

  switch (error.code) {
    case 'signup_phone_taken':
      return 'That phone number is already in use. Please choose another one.';
    case 'signup_email_taken':
      return 'That email address is already in use. Please choose another one.';
    case 'signup_phone_email_conflict':
      return 'That phone number and email are already in use. Please choose different details.';
    case 'otp_email_required':
      return 'Please add an email address before requesting the verification code.';
    case 'otp_delivery_failed':
      return 'We could not send the verification code right now. Please try again shortly.';
    case 'otp_cooldown_active':
      return error.message;
    case 'validation_error':
      return message.isNotEmpty ? message : fallback;
    default:
      if (RegExp(r'^Request failed with status \d+\.?$').hasMatch(message)) {
        return fallback;
      }
      return message.isNotEmpty ? message : fallback;
  }
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

class EmailChangeRequest {
  final String requestId;
  final int expiresInSeconds;

  const EmailChangeRequest({
    required this.requestId,
    required this.expiresInSeconds,
  });
}

class SupportTicketResult {
  final String ticketNumber;
  final String message;

  const SupportTicketResult({
    required this.ticketNumber,
    required this.message,
  });
}

class SupportTicketAttachment {
  final String fileName;
  final String mimeType;
  final List<int> bytes;

  const SupportTicketAttachment({
    required this.fileName,
    required this.mimeType,
    required this.bytes,
  });

  Map<String, String> toApi() => {
        'file_name': fileName,
        'mime_type': mimeType,
        'data_url': 'data:$mimeType;base64,${base64Encode(bytes)}',
      };
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
  final String? state;
  final String? avatarType;
  final String? avatarValue;

  const CurrentUserProfile({
    required this.id,
    required this.phone,
    required this.displayName,
    required this.status,
    required this.email,
    required this.birthday,
    required this.gender,
    required this.address,
    required this.state,
    required this.avatarType,
    required this.avatarValue,
  });

  factory CurrentUserProfile.fromApi(Map<String, dynamic> user) {
    final address = user['address'] as String?;
    return CurrentUserProfile(
      id: (user['id'] as num).toInt(),
      phone: user['phone'] as String,
      displayName: user['display_name'] as String? ?? 'C2 Member',
      status: user['status'] as String? ?? 'active',
      email: user['email'] as String?,
      birthday: _formatBirthdayForDisplay(user['birthday'] as String?),
      gender: user['gender'] as String?,
      address: address,
      state: user['state'] as String?,
      avatarType: user['avatar_type'] as String?,
      avatarValue: user['avatar_value'] as String?,
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
      if (state != null) 'state': state!,
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
    String? email,
  }) async {
    final body = <String, dynamic>{
      'phone': phone,
      'device_fingerprint': deviceFingerprint,
      if (email != null && email.trim().isNotEmpty) 'email': email.trim(),
    };

    final response = await _post('/auth/request-otp', body: body);

    return OtpRequestResult(
      requestId: response['request_id'] as String,
      channel: response['channel'] as String,
      expiresInSeconds: (response['expires_in_seconds'] as num).toInt(),
      resendInSeconds: (response['resend_in_seconds'] as num).toInt(),
      debugOtpCode: response['debug_otp_code'] as String?,
    );
  }

  Future<void> checkSignupIdentity({
    required String phone,
    required String email,
  }) async {
    await _post(
      '/auth/check-signup-identity',
      body: {
        'phone': phone.trim(),
        'email': email.trim(),
      },
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
        'state': profile['state'] ?? '',
        'avatar_type': profile['avatar_type'] ?? 'preset',
        'avatar_value': profile['avatar_value'] ?? '',
      },
    );

    final user = Map<String, dynamic>.from(response['user'] as Map);
    return CurrentUserProfile.fromApi(user);
  }

  Future<CurrentUserProfile> uploadAvatar({
    required String accessToken,
    required String fileName,
    required String mimeType,
    required List<int> bytes,
  }) async {
    final response = await _post(
      '/me/avatar',
      accessToken: accessToken,
      body: {
        'file_name': fileName,
        'mime_type': mimeType,
        'data_url': 'data:$mimeType;base64,${base64Encode(bytes)}',
      },
    );
    return CurrentUserProfile.fromApi(
      Map<String, dynamic>.from(response['user'] as Map),
    );
  }

  Future<SupportTicketResult> submitSupportTicket({
    required String accessToken,
    required String category,
    required String subject,
    required String message,
    String? orderReference,
    List<SupportTicketAttachment> attachments = const [],
  }) async {
    final response = await _post(
      '/me/support-tickets',
      accessToken: accessToken,
      body: {
        'category': category,
        'subject': subject,
        'message': message,
        if (orderReference != null && orderReference.trim().isNotEmpty)
          'order_reference': orderReference.trim(),
        if (attachments.isNotEmpty)
          'attachments':
              attachments.map((attachment) => attachment.toApi()).toList(),
      },
    );
    return SupportTicketResult(
      ticketNumber: response['ticket_number'] as String,
      message:
          response['message'] as String? ?? 'Your request has been received.',
    );
  }

  Future<EmailChangeRequest> requestEmailChange({
    required String accessToken,
    required String email,
  }) async {
    final response = await _post(
      '/me/email-change/request',
      accessToken: accessToken,
      body: {'email': email.trim()},
    );
    return EmailChangeRequest(
      requestId: response['request_id'] as String,
      expiresInSeconds: (response['expires_in_seconds'] as num).toInt(),
    );
  }

  Future<CurrentUserProfile> confirmEmailChange({
    required String accessToken,
    required String requestId,
    required String otpCode,
  }) async {
    final response = await _post(
      '/me/email-change/confirm',
      accessToken: accessToken,
      body: {'request_id': requestId, 'otp_code': otpCode.trim()},
    );
    return CurrentUserProfile.fromApi(
      Map<String, dynamic>.from(response['user'] as Map),
    );
  }

  Future<void> requestAccountClosure({
    required String accessToken,
    required String reason,
  }) async {
    await _post(
      '/me/account-closure',
      accessToken: accessToken,
      body: {'reason': reason.trim(), 'confirm': true},
    );
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

    final body = decoded is Map
        ? Map<String, dynamic>.from(decoded)
        : <String, dynamic>{};
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
