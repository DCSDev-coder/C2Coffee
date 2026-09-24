import 'dart:convert';

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

class NotificationService {
  NotificationService._();

  static final NotificationService instance = NotificationService._();

  final http.Client _client = http.Client();

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
    final request = http.Request(method, Uri.parse('${ApiConfig.baseUrl}$path'))
      ..headers.addAll({
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $accessToken',
      })
      ..body = body == null ? '' : jsonEncode(body);
    final response = await http.Response.fromStream(
      await _client.send(request).timeout(const Duration(seconds: 15)),
    );
    if (response.statusCode >= 200 && response.statusCode < 300) return;
    throw ApiException('Unable to update notifications.');
  }
}
