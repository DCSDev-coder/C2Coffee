import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

import 'api_config.dart';
import 'auth_api_service.dart';
import 'secure_session_service.dart';

class InAppNotification {
  final int id;
  final String type;
  final String title;
  final String body;
  final bool isRead;
  final DateTime createdAt;
  final Map<String, String> data;

  const InAppNotification({
    required this.id,
    required this.type,
    required this.title,
    required this.body,
    required this.isRead,
    required this.createdAt,
    required this.data,
  });

  factory InAppNotification.fromApi(Map<String, dynamic> json) {
    return InAppNotification(
      id: (json['id'] as num).toInt(),
      type: json['type'] as String? ?? '',
      title: json['title'] as String? ?? '',
      body: json['body'] as String? ?? '',
      isRead: json['is_read'] as bool? ?? false,
      createdAt: DateTime.parse(json['created_at'] as String).toLocal(),
      data: (json['data'] as Map? ?? const {}).map(
        (key, value) => MapEntry('$key', '$value'),
      ),
    );
  }
}

class PaymentServiceNotice {
  final int id;
  final String title;
  final String message;
  final List<String> paymentMethods;
  final DateTime startsAt;
  final DateTime endsAt;
  final bool isPopupDismissed;

  const PaymentServiceNotice({
    required this.id,
    required this.title,
    required this.message,
    required this.paymentMethods,
    required this.startsAt,
    required this.endsAt,
    required this.isPopupDismissed,
  });

  factory PaymentServiceNotice.fromApi(Map<String, dynamic> json) {
    return PaymentServiceNotice(
      id: (json['id'] as num).toInt(),
      title: json['title'] as String? ?? 'Payment service maintenance',
      message: json['message'] as String? ?? '',
      paymentMethods: (json['payment_methods'] as List? ?? const [])
          .map((value) => '$value')
          .toList(growable: false),
      startsAt: DateTime.parse(json['starts_at'] as String).toLocal(),
      endsAt: DateTime.parse(json['ends_at'] as String).toLocal(),
      isPopupDismissed: json['is_popup_dismissed'] as bool? ?? false,
    );
  }

  String get paymentMethodLabel => paymentMethods.map((method) {
        switch (method) {
          case 'fpx':
            return 'Online Banking (FPX)';
          case 'duitnow_qr':
            return 'DuitNow QR';
          default:
            return method;
        }
      }).join(', ');
}

class NotificationIndicatorState {
  final bool hasUnreadUpdates;
  final bool hasActiveWarnings;

  const NotificationIndicatorState({
    this.hasUnreadUpdates = false,
    this.hasActiveWarnings = false,
  });

  bool get hasIndicator => hasUnreadUpdates || hasActiveWarnings;
}

class NotificationService {
  NotificationService._();

  static final NotificationService instance = NotificationService._();

  final http.Client _client = http.Client();
  final ValueNotifier<NotificationIndicatorState> indicator =
      ValueNotifier(const NotificationIndicatorState());

  Future<void> refreshIndicator({String? accessToken}) async {
    final token = accessToken ??
        await SecureSessionService.instance.getValidAccessToken();
    if (token == null || token.isEmpty) return;

    try {
      final results = await Future.wait([
        getNotifications(accessToken: token, limit: 50),
        getPaymentServiceNotices(accessToken: token),
      ]);
      final notifications = results[0] as List<InAppNotification>;
      final notices = results[1] as List<PaymentServiceNotice>;
      indicator.value = NotificationIndicatorState(
        hasUnreadUpdates:
            notifications.any((notification) => !notification.isRead),
        hasActiveWarnings:
            notices.any((notice) => notice.endsAt.isAfter(DateTime.now())),
      );
    } catch (_) {
      // Keep the last known state. A transient refresh failure must not make
      // an active warning appear resolved or erase an unread update marker.
    }
  }

  Future<List<InAppNotification>> getNotifications({
    required String accessToken,
    int limit = 50,
  }) async {
    final response = await _get(
      '/notifications?limit=$limit',
      accessToken: accessToken,
    );

    return (response['notifications'] as List? ?? const [])
        .map((item) => InAppNotification.fromApi(
              Map<String, dynamic>.from(item as Map),
            ))
        .toList();
  }

  Future<List<PaymentServiceNotice>> getPaymentServiceNotices({
    required String accessToken,
  }) async {
    final response = await _get(
      '/payment-service-notices',
      accessToken: accessToken,
    );
    return (response['notices'] as List? ?? const [])
        .map((item) => PaymentServiceNotice.fromApi(
              Map<String, dynamic>.from(item as Map),
            ))
        .toList(growable: false);
  }

  Future<void> dismissPaymentServiceNoticePopup({
    required String accessToken,
    required int noticeId,
  }) {
    return _write(
      'POST',
      '/payment-service-notices/$noticeId/dismiss-popup',
      accessToken: accessToken,
    );
  }

  Future<void> markRead(
      {required String accessToken, required int notificationId}) async {
    await _write(
      'POST',
      '/notifications/$notificationId/read',
      accessToken: accessToken,
    );
  }

  Future<void> clearNotifications({required String accessToken}) {
    return _write(
      'DELETE',
      '/notifications',
      accessToken: accessToken,
    );
  }

  Future<bool> getMarketingPreference({required String accessToken}) async {
    final response =
        await _get('/notification-preferences', accessToken: accessToken);
    return response['marketing_enabled'] as bool? ?? true;
  }

  Future<void> updateMarketingPreference({
    required String accessToken,
    required bool enabled,
  }) async {
    await _write(
      'PUT',
      '/notification-preferences',
      accessToken: accessToken,
      body: {'marketing_enabled': enabled},
    );
  }

  Future<Map<String, dynamic>> _get(
    String path, {
    required String accessToken,
  }) async {
    http.Response response = await _client.get(
      Uri.parse('${ApiConfig.baseUrl}$path'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $accessToken',
      },
    ).timeout(const Duration(seconds: 15));

    if (response.statusCode == 401) {
      final refreshed =
          await SecureSessionService.instance.refreshTokenSilently();
      if (refreshed != null && refreshed.isNotEmpty) {
        response = await _client.get(
          Uri.parse('${ApiConfig.baseUrl}$path'),
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer $refreshed',
          },
        ).timeout(const Duration(seconds: 15));
      }
    }

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

  Future<void> _write(
    String method,
    String path, {
    required String accessToken,
    Map<String, dynamic>? body,
  }) async {
    Future<http.Response> send(String token) async {
      final request = http.Request(method, Uri.parse('${ApiConfig.baseUrl}$path'))
        ..headers['Authorization'] = 'Bearer $token';
      if (body != null) {
        request.headers['Content-Type'] = 'application/json';
        request.body = jsonEncode(body);
      }
      return http.Response.fromStream(
        await _client.send(request).timeout(const Duration(seconds: 15)),
      );
    }

    http.Response response = await send(accessToken);
    if (response.statusCode == 401) {
      final refreshed = await SecureSessionService.instance.refreshTokenSilently();
      if (refreshed != null && refreshed.isNotEmpty) {
        response = await send(refreshed);
      }
    }
    if (response.statusCode >= 200 && response.statusCode < 300) return;

    final text = utf8.decode(response.bodyBytes);
    final decoded = text.isEmpty ? <String, dynamic>{} : jsonDecode(text);
    if (decoded is Map) {
      final error = decoded['error'];
      if (error is Map) {
        throw ApiException(
          error['message'] as String? ?? 'Unable to update notifications.',
          code: error['code'] as String?,
        );
      }
    }
    throw ApiException('Unable to update notifications.');
  }
}
