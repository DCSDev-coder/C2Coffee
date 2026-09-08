import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../widgets/order_card.dart';
import 'api_config.dart';
import 'secure_session_service.dart';

class ApiService {
  static String get baseUrl => ApiConfig.baseUrl;
  static String? _accessToken;
  static String? _refreshToken;
  static String _tenantCode = ApiConfig.tenantCode;
  static String _currentUserName = '';
  static String _currentUsername = '';
  static List<String> _currentRoles = const [];

  static String get currentUserName => _currentUserName;
  static String get currentUsername => _currentUsername;
  static List<String> get currentRoles => List.unmodifiable(_currentRoles);
  static bool get isSignedIn =>
      _accessToken != null && _accessToken!.isNotEmpty;

  static bool get canWorkOrders {
    return _currentRoles.any(
      (role) => ['barista', 'operations_admin', 'super_admin'].contains(role),
    );
  }

  static Future<ApiRequestResult> updateOrderStatus(
    String orderId,
    String status,
  ) async {
    try {
      final response = await _authenticatedRequest(
        (headers) => http.patch(
          Uri.parse('$baseUrl/admin/orders/$orderId/status'),
          headers: headers,
          body: json.encode({'status': status}),
        ),
      );
      if (response.statusCode == 200) {
        return const ApiRequestResult.success();
      }
      return ApiRequestResult.failure(_responseMessage(response));
    } catch (e) {
      debugPrint('Update Status Error: $e');
      return const ApiRequestResult.failure(
        'Unable to update this order. Check the connection and try again.',
      );
    }
  }

  static Future<bool> login(String identifier, String password) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/admin/auth/login'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({
          'tenant_code': _tenantCode,
          'identifier': identifier,
          'password': password,
        }),
      );
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        await _applySession(data);

        if (!canWorkOrders) {
          await logout();
          return false;
        }

        return true;
      }
    } catch (e) {
      debugPrint('Login Error: $e');
    }
    return false;
  }

  static Future<OperationsContext> fetchOperationsContext() async {
    final response = await _authenticatedRequest(
      (headers) => http.get(
        Uri.parse('$baseUrl/barista/operations/context'),
        headers: headers,
      ),
    );
    if (response.statusCode != 200) {
      throw StateError(_responseMessage(response));
    }
    return OperationsContext.fromJson(
      json.decode(response.body) as Map<String, dynamic>,
    );
  }

  static Future<OrdersFetchResult> fetchOrders() async {
    try {
      final response = await _authenticatedRequest(
        (headers) =>
            http.get(Uri.parse('$baseUrl/admin/orders'), headers: headers),
      );

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        final List<dynamic> ordersJson = data['orders'] ?? [];

        final orders = ordersJson
            .map<CurrentOrder?>((json) {
              // Parse status
              OrderStatus? parsedStatus;
              final statusStr =
                  (json['status'] as String?)?.toLowerCase() ?? '';
              if (statusStr == 'paid' || statusStr == 'accepted') {
                parsedStatus = OrderStatus.newOrder;
              } else if (statusStr.contains('preparing')) {
                parsedStatus = OrderStatus.preparing;
              } else if (statusStr.contains('ready')) {
                parsedStatus = OrderStatus.readyForPickup;
              } else if (statusStr.contains('completed') ||
                  statusStr.contains('collected')) {
                parsedStatus = OrderStatus.completed;
              }

              // Cancelled, refunded, and payment-failed orders must never enter
              // the preparation queue.
              if (parsedStatus == null) return null;

              // Parse items
              List<OrderItem> parsedItems = [];
              if (json['items'] != null) {
                for (var item in json['items']) {
                  final title = '${item['qty']}x ${item['name']}';

                  List<String> tags = [];
                  void addIfPresent(
                    String? val, [
                    String prefix = '',
                    String suffix = '',
                  ]) {
                    if (val != null && val.trim().isNotEmpty) {
                      tags.add('$prefix$val$suffix');
                    }
                  }

                  addIfPresent(item['bean']?.toString());
                  final shotVal = item['espressoShot']?.toString();
                  if (shotVal != null && shotVal.trim().isNotEmpty) {
                    addIfPresent(
                      shotVal,
                      '',
                      shotVal.toLowerCase().contains('shot') ? '' : ' Shot',
                    );
                  }
                  addIfPresent(item['temperature']?.toString());
                  addIfPresent(item['sparkling']?.toString(), 'Sparkling: ');
                  addIfPresent(item['milk']?.toString());
                  addIfPresent(item['sweetness']?.toString());
                  addIfPresent(item['iceLevel']?.toString());
                  addIfPresent(item['orderType']?.toString());
                  addIfPresent(item['remarks']?.toString(), 'Remarks: ');

                  parsedItems.add(OrderItem(title: title, tags: tags));
                }
              }

              // Keep the real creation time so the preparation queue is FIFO.
              final dateStr = json['date'] ?? 'Aug 19, 2026';
              final timeStr = json['time'] ?? '10:00 AM';
              final createdAt =
                  DateTime.tryParse(json['createdAt']?.toString() ?? '') ??
                  DateTime.fromMillisecondsSinceEpoch(0);

              return CurrentOrder(
                status: parsedStatus,
                orderId: json['id'] ?? 'ORD-000',
                timeDate: '$timeStr - $dateStr',
                orderDate: createdAt,
                customerDetails:
                    '${json['customer'] ?? 'guest'} - ${parsedItems.length} items',
                items: parsedItems,
              );
            })
            .whereType<CurrentOrder>()
            .toList();
        orders.sort(
          (first, second) => first.orderDate.compareTo(second.orderDate),
        );
        return OrdersFetchResult.success(orders);
      } else {
        return OrdersFetchResult.failure(_responseMessage(response));
      }
    } catch (e) {
      debugPrint('API Error: $e');
      return const OrdersFetchResult.failure(
        'Unable to refresh orders. Check the connection and try again.',
      );
    }
  }

  static String _responseMessage(http.Response response) {
    try {
      final body = json.decode(response.body) as Map<String, dynamic>;
      final error = body['error'];
      if (error is Map<String, dynamic>) {
        switch (error['code']?.toString()) {
          case 'invalid_access_token':
          case 'missing_bearer_token':
          case 'session_not_found':
          case 'session_version_mismatch':
            return 'Your session has expired. Please sign in again.';
          case 'invalid_order_transition':
            return 'This order has already been updated. Please refresh the order list.';
          case 'printer_not_ready':
            return 'The receipt printer is not ready. Please contact an operations administrator.';
          case 'forbidden':
            return 'Your account does not have permission for this action.';
        }
      }
    } catch (_) {
      // Fall through to a safe user-facing fallback.
    }
    return 'Request could not be completed. Please try again.';
  }

  static Future<void> restoreSession() async {
    final session = await SecureSessionService.instance.read();
    if (session == null) return;

    _accessToken = session.accessToken;
    _refreshToken = session.refreshToken;
    _tenantCode = session.tenantCode ?? ApiConfig.tenantCode;

    if (!await _refreshAccessToken()) {
      await _clearSession();
    }
  }

  static Future<http.Response> _authenticatedRequest(
    Future<http.Response> Function(Map<String, String> headers) send,
  ) async {
    var response = await send(_authorizedHeaders());
    if (response.statusCode != 401 || !await _refreshAccessToken()) {
      return response;
    }
    response = await send(_authorizedHeaders());
    return response;
  }

  static Map<String, String> _authorizedHeaders() => {
    'Content-Type': 'application/json',
    if (_accessToken != null) 'Authorization': 'Bearer $_accessToken',
  };

  static Future<bool> _refreshAccessToken() async {
    final refreshToken = _refreshToken;
    if (refreshToken == null || refreshToken.isEmpty) return false;

    try {
      final response = await http.post(
        Uri.parse('$baseUrl/admin/auth/refresh'),
        headers: const {'Content-Type': 'application/json'},
        body: json.encode({'refresh_token': refreshToken}),
      );
      if (response.statusCode != 200) return false;

      await _applySession(json.decode(response.body) as Map<String, dynamic>);
      return canWorkOrders;
    } catch (error) {
      debugPrint('Session refresh error: $error');
      return false;
    }
  }

  static Future<void> _applySession(Map<String, dynamic> data) async {
    final accessToken = data['access_token']?.toString();
    final refreshToken = data['refresh_token']?.toString();
    if (accessToken == null ||
        accessToken.isEmpty ||
        refreshToken == null ||
        refreshToken.isEmpty) {
      throw const FormatException(
        'The sign-in response did not contain a valid session.',
      );
    }

    _accessToken = accessToken;
    _refreshToken = refreshToken;
    final tenant = data['tenant'];
    if (tenant is Map<String, dynamic>) {
      final tenantCode = tenant['code']?.toString().trim();
      if (tenantCode != null && tenantCode.isNotEmpty) _tenantCode = tenantCode;
    }

    final user = data['user'] as Map<String, dynamic>? ?? const {};
    final fullName = (user['full_name'] as String?)?.trim() ?? '';
    _currentUsername = ((user['username'] as String?) ?? '').trim();
    _currentUserName = fullName.isNotEmpty ? fullName : _currentUsername;
    _currentRoles = (user['roles'] as List? ?? const [])
        .map((role) => role.toString())
        .toList();

    await SecureSessionService.instance.save(
      accessToken: accessToken,
      refreshToken: refreshToken,
      tenantCode: _tenantCode,
    );
  }

  static Future<void> logout() async {
    final accessToken = _accessToken;
    if (accessToken != null && accessToken.isNotEmpty) {
      try {
        await http.post(
          Uri.parse('$baseUrl/admin/auth/logout'),
          headers: {'Authorization': 'Bearer $accessToken'},
        );
      } catch (error) {
        debugPrint('Sign-out request error: $error');
      }
    }
    await _clearSession();
  }

  static Future<void> _clearSession() async {
    _accessToken = null;
    _refreshToken = null;
    _tenantCode = ApiConfig.tenantCode;
    _currentUserName = '';
    _currentUsername = '';
    _currentRoles = const [];
    await SecureSessionService.instance.clear();
  }
}

class ApiRequestResult {
  final String? errorMessage;

  const ApiRequestResult.success() : errorMessage = null;
  const ApiRequestResult.failure(this.errorMessage);

  bool get isSuccess => errorMessage == null;
}

class OrdersFetchResult {
  final List<CurrentOrder> orders;
  final String? errorMessage;

  const OrdersFetchResult.success(this.orders) : errorMessage = null;
  const OrdersFetchResult.failure(this.errorMessage) : orders = const [];

  bool get isSuccess => errorMessage == null;
}

class OperationsContext {
  final List<OperationalIntegration> integrations;
  final List<PrinterTarget> printers;
  final List<WeeklyScheduleEntry> weeklySchedule;

  const OperationsContext({
    required this.integrations,
    required this.printers,
    required this.weeklySchedule,
  });

  factory OperationsContext.fromJson(
    Map<String, dynamic> json,
  ) => OperationsContext(
    integrations: (json['integrations'] as List? ?? const [])
        .map(
          (entry) =>
              OperationalIntegration.fromJson(entry as Map<String, dynamic>),
        )
        .toList(),
    printers: (json['printers'] as List? ?? const [])
        .map((entry) => PrinterTarget.fromJson(entry as Map<String, dynamic>))
        .toList(),
    weeklySchedule: (json['weekly_schedule'] as List? ?? const [])
        .map(
          (entry) =>
              WeeklyScheduleEntry.fromJson(entry as Map<String, dynamic>),
        )
        .toList(),
  );
}

class OperationalIntegration {
  final String providerCode;
  final String displayName;
  final String status;

  const OperationalIntegration({
    required this.providerCode,
    required this.displayName,
    required this.status,
  });

  factory OperationalIntegration.fromJson(Map<String, dynamic> json) =>
      OperationalIntegration(
        providerCode: json['provider_code']?.toString() ?? '',
        displayName: json['display_name']?.toString() ?? 'POS integration',
        status: json['status']?.toString() ?? 'not_configured',
      );
}

class PrinterTarget {
  final String name;
  final String deliveryMode;
  final String status;
  final bool isDefault;

  const PrinterTarget({
    required this.name,
    required this.deliveryMode,
    required this.status,
    required this.isDefault,
  });

  factory PrinterTarget.fromJson(Map<String, dynamic> json) => PrinterTarget(
    name: json['name']?.toString() ?? 'Receipt printer',
    deliveryMode: json['delivery_mode']?.toString() ?? '',
    status: json['status']?.toString() ?? 'not_configured',
    isDefault: json['is_default'] == true,
  );
}

class WeeklyScheduleEntry {
  final int baristaId;
  final int weekday;
  final String startsAt;
  final String endsAt;
  final String baristaName;

  const WeeklyScheduleEntry({
    required this.baristaId,
    required this.weekday,
    required this.startsAt,
    required this.endsAt,
    required this.baristaName,
  });

  factory WeeklyScheduleEntry.fromJson(Map<String, dynamic> json) =>
      WeeklyScheduleEntry(
        baristaId: (json['barista_id'] as num?)?.toInt() ?? 0,
        weekday: (json['weekday'] as num?)?.toInt() ?? 0,
        startsAt: json['starts_at']?.toString() ?? '',
        endsAt: json['ends_at']?.toString() ?? '',
        baristaName: json['barista_name']?.toString() ?? 'Unassigned',
      );
}
