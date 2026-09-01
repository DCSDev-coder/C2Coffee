import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../main.dart';
import '../widgets/order_card.dart';
import 'api_config.dart';

class ApiService {
  static String get baseUrl => ApiConfig.baseUrl;
  static String? _accessToken;
  static String _currentUserName = '';
  static String _currentUsername = '';
  static List<String> _currentRoles = const [];
  static int? _activeBaristaId;
  static String _activeBaristaName = '';

  static String get currentUserName => _currentUserName;
  static String get currentUsername => _currentUsername;
  static List<String> get currentRoles => List.unmodifiable(_currentRoles);
  static int? get activeBaristaId => _activeBaristaId;
  static String get activeBaristaName => _activeBaristaName;

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
      final response = await http.patch(
        Uri.parse('$baseUrl/admin/orders/$orderId/status'),
        headers: {
          'Content-Type': 'application/json',
          if (_accessToken != null) 'Authorization': 'Bearer $_accessToken',
        },
        body: json.encode({
          'status': status,
          if (_activeBaristaId != null) 'barista_id': _activeBaristaId,
        }),
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
          'tenant_code': 'c2coffee',
          'identifier': identifier,
          'password': password,
        }),
      );
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        _accessToken = data['access_token'];
        final user = data['user'] as Map<String, dynamic>? ?? const {};
        final fullName = (user['full_name'] as String?)?.trim() ?? '';
        _currentUsername = ((user['username'] as String?) ?? '').trim();
        _currentUserName = fullName.isNotEmpty ? fullName : _currentUsername;
        _currentRoles = (user['roles'] as List? ?? const [])
            .map((role) => role.toString())
            .toList();

        if (!canWorkOrders) {
          logout();
          return false;
        }

        return true;
      }
    } catch (e) {
      debugPrint('Login Error: $e');
    }
    return false;
  }

  static Future<List<BaristaStaff>> fetchActiveBaristas() async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/admin/baristas'),
        headers: _accessToken != null
            ? {'Authorization': 'Bearer $_accessToken'}
            : {},
      );
      if (response.statusCode != 200) return const [];
      final data = json.decode(response.body) as Map<String, dynamic>;
      return (data['baristas'] as List? ?? const [])
          .map((row) => BaristaStaff.fromJson(row as Map<String, dynamic>))
          .where((staff) => staff.isActive)
          .toList();
    } catch (e) {
      debugPrint('Barista roster error: $e');
      return const [];
    }
  }

  static void selectBarista(BaristaStaff staff) {
    _activeBaristaId = staff.id;
    _activeBaristaName = staff.name;
    globalActiveBaristaId.value = staff.id;
    globalActiveBarista.value = staff.name;
  }

  static Future<OrdersFetchResult> fetchOrders() async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/admin/orders'),
        headers: _accessToken != null
            ? {'Authorization': 'Bearer $_accessToken'}
            : {},
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

              // Fallbacks for date
              final dateStr = json['date'] ?? 'Aug 19, 2026';
              final timeStr = json['time'] ?? '10:00 AM';

              return CurrentOrder(
                status: parsedStatus,
                orderId: json['id'] ?? 'ORD-000',
                timeDate: '$timeStr - $dateStr',
                orderDate: DateTime.now(), // Fallback for sorting if needed
                customerDetails:
                    '${json['customer'] ?? 'guest'} - ${parsedItems.length} items',
                baristaName: (json['baristaName'] as String?)?.trim() ?? '',
                items: parsedItems,
              );
            })
            .whereType<CurrentOrder>()
            .toList();
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
        final message = error['message']?.toString().trim() ?? '';
        if (message.isNotEmpty) return message;
      }
    } catch (_) {
      // Fall through to a safe user-facing fallback.
    }
    return 'Request could not be completed. Please try again.';
  }

  static void logout() {
    _accessToken = null;
    _currentUserName = '';
    _currentUsername = '';
    _currentRoles = const [];
    _activeBaristaId = null;
    _activeBaristaName = '';
    globalActiveBaristaId.value = null;
    globalActiveBarista.value = '';
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

class BaristaStaff {
  final int id;
  final String name;
  final bool isActive;

  const BaristaStaff({
    required this.id,
    required this.name,
    required this.isActive,
  });

  factory BaristaStaff.fromJson(Map<String, dynamic> json) => BaristaStaff(
    id: (json['id'] as num).toInt(),
    name: (json['name'] as String? ?? '').trim(),
    isActive: json['is_active'] == true,
  );
}
