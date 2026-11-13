import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../widgets/order_card.dart';
import 'direct_printer_service.dart';
import 'api_config.dart';
import 'secure_session_service.dart';
import '../../json_helpers.dart';

String normalizeApiStatus(Object? value) {
  return value?.toString().trim().toLowerCase().replaceAll(
        RegExp(r'[\s-]+'),
        '_',
      ) ??
      '';
}

class ApiService {
  static String get baseUrl => ApiConfig.baseUrl;

  static String resolveAssetUrl(String imageUrl) {
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      return imageUrl;
    }
    final origin = Uri.parse(baseUrl).replace(path: '').toString();
    return '$origin${imageUrl.startsWith('/') ? imageUrl : '/$imageUrl'}';
  }

  static String? _accessToken;
  static String? _refreshToken;
  static Future<bool>? _refreshInFlight;
  static String _tenantCode = ApiConfig.tenantCode;
  static String _currentUserName = '';
  static String _currentUsername = '';
  static List<String> _currentRoles = const [];

  static String get currentUserName => _currentUserName;
  static String get currentUsername => _currentUsername;
  static List<String> get currentRoles => List.unmodifiable(_currentRoles);
  static bool get isSignedIn =>
      _accessToken != null && _accessToken!.isNotEmpty;

  static Future<String?> orderEntryAccessToken() async => _accessToken;

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
      final workstationKey = await DirectPrinterService.instance
          .workstationKey();
      final response = await _authenticatedRequest(
        (headers) => http.patch(
          Uri.parse('$baseUrl/admin/orders/$orderId/status'),
          headers: {...headers, 'x-c2-workstation-key': workstationKey},
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

  static Future<ApiRequestResult> confirmManualPayment(
    String orderId,
    String method,
  ) async {
    try {
      final response = await _authenticatedRequest(
        (headers) => http.post(
          Uri.parse('$baseUrl/barista/orders/$orderId/payment/confirm'),
          headers: headers,
          body: json.encode({'payment_method': method}),
        ),
      );
      if (response.statusCode == 200) return const ApiRequestResult.success();
      return ApiRequestResult.failure(_responseMessage(response));
    } catch (_) {
      return const ApiRequestResult.failure(
        'Unable to confirm payment. Check the connection and try again.',
      );
    }
  }

  static Future<ApiRequestResult> cancelOrder(
    String orderId, {
    String? reason,
  }) async {
    try {
      final response = await _authenticatedRequest(
        (headers) => http.post(
          Uri.parse('$baseUrl/barista/orders/$orderId/cancel'),
          headers: headers,
          body: json.encode({'reason': reason}),
        ),
      );
      if (response.statusCode == 200) {
        final decoded = json.decode(response.body);
        return ApiRequestResult.success(
          decoded is Map<String, dynamic> ? decoded : null,
        );
      }
      return ApiRequestResult.failure(_responseMessage(response));
    } catch (_) {
      return const ApiRequestResult.failure(
        'Unable to cancel this order. Check the connection and try again.',
      );
    }
  }

  static Future<ApiRequestResult> reviewCancellationRequest(
    String orderId,
    String decision,
  ) async {
    try {
      final response = await _authenticatedRequest(
        (headers) => http.patch(
          Uri.parse('$baseUrl/admin/orders/$orderId/cancellation-request'),
          headers: headers,
          body: json.encode({'decision': decision}),
        ),
      );
      if (response.statusCode == 200) {
        final decoded = json.decode(response.body);
        return ApiRequestResult.success(
          decoded is Map<String, dynamic> ? decoded : null,
        );
      }
      return ApiRequestResult.failure(_responseMessage(response));
    } catch (e) {
      debugPrint('Review cancellation error: $e');
      return const ApiRequestResult.failure(
        'Unable to review this cancellation request. Check the connection and try again.',
      );
    }
  }

  static Future<ApiRequestResult> login(
    String identifier,
    String password,
  ) async {
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
          return const ApiRequestResult.failure(
            'This account is not allowed to use the Barista Workspace.',
          );
        }

        return const ApiRequestResult.success();
      }
      return ApiRequestResult.failure(_responseMessage(response));
    } catch (e) {
      debugPrint('Login Error: $e');
      return const ApiRequestResult.failure(
        'Unable to sign in. Check the connection and try again.',
      );
    }
  }

  static Future<void> registerPushToken({
    required String platform,
    required String pushToken,
  }) async {
    final response = await _authenticatedRequest(
      (headers) => http.post(
        Uri.parse('$baseUrl/admin/devices/push-token'),
        headers: headers,
        body: json.encode({'platform': platform, 'push_token': pushToken}),
      ),
    );
    if (response.statusCode != 200) {
      throw StateError(_responseMessage(response));
    }
  }

  static Future<void> deactivatePushToken(String pushToken) async {
    final response = await _authenticatedRequest(
      (headers) => http.post(
        Uri.parse('$baseUrl/admin/devices/push-token/deactivate'),
        headers: headers,
        body: json.encode({'push_token': pushToken}),
      ),
    );
    if (response.statusCode != 200) {
      throw StateError(_responseMessage(response));
    }
  }

  static Future<OperationsContext> fetchOperationsContext() async {
    final workstationKey = await DirectPrinterService.instance.workstationKey();
    final response = await _authenticatedRequest(
      (headers) => http.get(
        Uri.parse('$baseUrl/barista/operations/context'),
        headers: {...headers, 'x-c2-workstation-key': workstationKey},
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
        (headers) => http.get(
          Uri.parse('$baseUrl/admin/orders?view=barista_workspace&limit=500'),
          headers: headers,
        ),
      );

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        final List<dynamic> ordersJson = data['orders'] ?? [];

        final orders = ordersJson
            .map<CurrentOrder?>((json) {
              // Parse status
              OrderStatus? parsedStatus;
              final statusStr = normalizeApiStatus(json['status']);
              if (statusStr == 'pending_payment' ||
                  statusStr == 'paid' ||
                  statusStr == 'accepted') {
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

                  parsedItems.add(
                    OrderItem(
                      title: title,
                      tags: tags,
                      menuItemId: (item['menuItemId'] as num?)?.toInt(),
                    ),
                  );
                }
              }

              // Keep the real creation time so the preparation queue is FIFO.
              final createdAt =
                  DateTime.tryParse(json['createdAt']?.toString() ?? '') ??
                  DateTime.fromMillisecondsSinceEpoch(0);
              final statusStartedAt = DateTime.tryParse(
                json['statusStartedAt']?.toString() ?? '',
              );

              return CurrentOrder(
                status: parsedStatus,
                orderId: json['id'] ?? 'ORD-000',
                timeDate: resolveOrderDisplayDateTime(
                  createdAt: createdAt,
                  serverTime: json['time']?.toString(),
                  serverDate: json['date']?.toString(),
                ),
                orderDate: createdAt,
                statusStartedAt: statusStartedAt,
                customerDetails:
                    '${json['customer'] ?? 'guest'} - ${parsedItems.length} items',
                items: parsedItems,
                voucherName: json['voucherName']?.toString(),
                voucherType: json['voucherType']?.toString(),
                discount: (json['discount'] as num?)?.toDouble() ?? 0,
                paymentMethod: json['paymentMethod']?.toString(),
                paymentStatus: normalizeApiStatus(json['paymentStatus']),
                total: (json['total'] as num?)?.toDouble() ?? 0,
                cancellationRequestStatus: json['cancellationRequestStatus']
                    ?.toString(),
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

  static Future<ApiRequestResult> queueReceiptReprint(String orderId) async {
    try {
      final context = await fetchOperationsContext();
      final availablePrinters = context.printers
          .where(
            (printer) =>
                printer.deliveryMode == 'android_direct' &&
                printer.status == 'connected',
          )
          .toList();
      if (availablePrinters.isEmpty) {
        return const ApiRequestResult.failure(
          'The receipt printer is not connected to this C2 Store device.',
        );
      }
      final printer = availablePrinters.firstWhere(
        (candidate) => candidate.isDefault,
        orElse: () => availablePrinters.first,
      );
      final response = await _authenticatedRequest(
        (headers) => http.post(
          Uri.parse('$baseUrl/barista/print-jobs'),
          headers: headers,
          body: json.encode({
            'order_ref': orderId,
            'printer_target_id': printer.id,
            'request_type': 'reprint',
          }),
        ),
      );
      if (response.statusCode == 202) {
        return ApiRequestResult.success(
          json.decode(response.body) as Map<String, dynamic>,
        );
      }
      return ApiRequestResult.failure(_responseMessage(response));
    } catch (error) {
      debugPrint('Receipt reprint error: $error');
      return const ApiRequestResult.failure(
        'Unable to queue the receipt. Check the printer connection and try again.',
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
          case 'clock_in_required':
            return 'Clock in from Workstation before preparing orders.';
          case 'shift_access_locked':
            return error['message']?.toString() ??
                'Clock in a barista with their PIN before preparing orders.';
          case 'active_orders_require_coverage':
            return error['message']?.toString() ??
                'The final barista cannot clock out while active orders still need coverage.';
          case 'emergency_active_orders_block':
            return 'Complete all preparing and ready-for-pickup orders before using emergency closure.';
          case 'emergency_closure_active':
            return 'This outlet is already temporarily closed.';
          case 'workstation_outlet_required':
            return 'Assign this C2 Store device to one outlet in Admin Web before using shift access.';
          case 'barista_not_clocked_in':
            return 'Clock in before completing this task.';
          case 'invalid_barista_pin':
            return 'The selected barista or PIN is not valid.';
          case 'side_work_not_due':
            return 'This task is not due yet or is no longer available.';
          case 'marketing_recipe_required':
            return 'This drink needs an inventory recipe before it can be recorded.';
          case 'marketing_stock_unavailable':
            return 'There is not enough available stock for this complimentary drink.';
          case 'marketing_drink_unavailable':
            return 'One or more selected drinks are no longer available.';
          case 'printer_not_ready':
            return 'The receipt printer is not ready. Please contact an operations administrator.';
          case 'direct_printer_not_assigned':
            return 'The printer test worked, but this C2 Store device is not assigned to that printer in Admin Web.';
          case 'forbidden':
          case 'admin_forbidden':
          case 'barista_route_forbidden':
            return 'Your account does not have permission for this action.';
          case 'rate_limit_exceeded':
            return 'Too many sign-in attempts. Please wait a few minutes before trying again.';
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

  static Future<bool> _refreshAccessToken() {
    final inFlight = _refreshInFlight;
    if (inFlight != null) return inFlight;
    final future = _performRefreshAccessToken();
    _refreshInFlight = future;
    return future.whenComplete(() {
      if (identical(_refreshInFlight, future)) {
        _refreshInFlight = null;
      }
    });
  }

  static Future<bool> _performRefreshAccessToken() async {
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
        // Keep the device from receiving queue alerts after explicit sign-out.
        // Failure is non-blocking because local credentials still must clear.
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

  static Future<BaristaAttendanceStatus> fetchAttendanceStatus() async {
    final workstationKey = await DirectPrinterService.instance.workstationKey();
    final response = await _authenticatedRequest(
      (headers) => http.get(
        Uri.parse('$baseUrl/barista/attendance/status'),
        headers: {...headers, 'x-c2-workstation-key': workstationKey},
      ),
    );
    if (response.statusCode != 200) {
      throw StateError(_responseMessage(response));
    }
    return BaristaAttendanceStatus.fromJson(
      json.decode(response.body) as Map<String, dynamic>,
    );
  }

  static Future<List<AttendanceHistoryEntry>> fetchAttendanceHistory() async {
    final workstationKey = await DirectPrinterService.instance.workstationKey();
    final response = await _authenticatedRequest(
      (headers) => http.get(
        Uri.parse('$baseUrl/barista/attendance/history'),
        headers: {...headers, 'x-c2-workstation-key': workstationKey},
      ),
    );
    if (response.statusCode != 200) {
      throw StateError(_responseMessage(response));
    }
    final data = json.decode(response.body) as Map<String, dynamic>;
    return (data['attendance'] as List? ?? const [])
        .map(
          (item) =>
              AttendanceHistoryEntry.fromJson(item as Map<String, dynamic>),
        )
        .toList();
  }

  static Future<ApiRequestResult> updateAttendance({
    required bool clockIn,
    required int baristaId,
    required String pin,
  }) async {
    try {
      final workstationKey = await DirectPrinterService.instance
          .workstationKey();
      final response = await _authenticatedRequest(
        (headers) => http.post(
          Uri.parse(
            '$baseUrl/barista/attendance/${clockIn ? 'clock-in' : 'clock-out'}',
          ),
          headers: {...headers, 'x-c2-workstation-key': workstationKey},
          body: json.encode({'barista_id': baristaId, 'pin': pin}),
        ),
      );
      return response.statusCode == 200 || response.statusCode == 201
          ? const ApiRequestResult.success()
          : ApiRequestResult.failure(_responseMessage(response));
    } catch (_) {
      return const ApiRequestResult.failure(
        'Unable to update your shift. Check the connection and try again.',
      );
    }
  }

  static Future<ApiRequestResult> emergencyCloseOutlet({
    required int baristaId,
    required String pin,
    required String reasonCode,
    String? note,
  }) async {
    try {
      final workstationKey = await DirectPrinterService.instance
          .workstationKey();
      final response = await _authenticatedRequest(
        (headers) => http.post(
          Uri.parse('$baseUrl/barista/outlet/emergency-close'),
          headers: {...headers, 'x-c2-workstation-key': workstationKey},
          body: json.encode({
            'barista_id': baristaId,
            'pin': pin,
            'reason_code': reasonCode,
            'note': note,
            'idempotency_key':
                'counter-emergency-$baristaId-${DateTime.now().microsecondsSinceEpoch}',
          }),
        ),
      );
      return response.statusCode == 200
          ? ApiRequestResult.success(
              json.decode(response.body) as Map<String, dynamic>,
            )
          : ApiRequestResult.failure(_responseMessage(response));
    } catch (_) {
      return const ApiRequestResult.failure(
        'Unable to close the outlet. Check the connection and try again.',
      );
    }
  }

  static Future<ApiRequestResult> emergencyReopenOutlet({
    required int baristaId,
    required String pin,
  }) async {
    try {
      final workstationKey = await DirectPrinterService.instance
          .workstationKey();
      final response = await _authenticatedRequest(
        (headers) => http.post(
          Uri.parse('$baseUrl/barista/outlet/emergency-reopen'),
          headers: {...headers, 'x-c2-workstation-key': workstationKey},
          body: json.encode({'barista_id': baristaId, 'pin': pin}),
        ),
      );
      return response.statusCode == 200
          ? const ApiRequestResult.success()
          : ApiRequestResult.failure(_responseMessage(response));
    } catch (_) {
      return const ApiRequestResult.failure(
        'Unable to reopen the outlet. Check the connection and try again.',
      );
    }
  }

  static Future<WorkstationAccessState> fetchWorkstationAccessState() async {
    final workstationKey = await DirectPrinterService.instance.workstationKey();
    final response = await _authenticatedRequest(
      (headers) => http.get(
        Uri.parse('$baseUrl/barista/workstation/access-state'),
        headers: {...headers, 'x-c2-workstation-key': workstationKey},
      ),
    );
    if (response.statusCode != 200) {
      throw StateError(_responseMessage(response));
    }
    return WorkstationAccessState.fromJson(
      json.decode(response.body) as Map<String, dynamic>,
    );
  }

  static Future<List<BaristaGuide>> fetchGuides({int? menuItemId}) async {
    final query = menuItemId == null ? '' : '?menu_item_id=$menuItemId';
    final response = await _authenticatedRequest(
      (headers) => http.get(
        Uri.parse('$baseUrl/barista/guides$query'),
        headers: headers,
      ),
    );
    if (response.statusCode != 200) {
      throw StateError(_responseMessage(response));
    }
    final guides =
        (json.decode(response.body) as Map<String, dynamic>)['guides']
            as List? ??
        const [];
    return guides
        .map((entry) => BaristaGuide.fromJson(entry as Map<String, dynamic>))
        .toList();
  }

  static Future<List<BaristaSideWorkTask>> fetchSideWork({
    String? from,
    String? to,
  }) async {
    final query = <String, String>{};
    if (from != null) query['from'] = from;
    if (to != null) query['to'] = to;
    final uri = Uri.parse(
      '$baseUrl/barista/side-work',
    ).replace(queryParameters: query.isEmpty ? null : query);
    final response = await _authenticatedRequest(
      (headers) => http.get(uri, headers: headers),
    );
    if (response.statusCode != 200) {
      throw StateError(_responseMessage(response));
    }
    final tasks =
        (json.decode(response.body) as Map<String, dynamic>)['tasks']
            as List? ??
        const [];
    return tasks
        .map(
          (entry) =>
              BaristaSideWorkTask.fromJson(entry as Map<String, dynamic>),
        )
        .toList();
  }

  static Future<ApiRequestResult> completeSideWork({
    required int taskId,
    required int baristaId,
    required String pin,
  }) async {
    try {
      final response = await _authenticatedRequest(
        (headers) => http.post(
          Uri.parse('$baseUrl/barista/side-work/complete'),
          headers: headers,
          body: json.encode({
            'task_id': taskId,
            'barista_id': baristaId,
            'pin': pin,
          }),
        ),
      );
      return response.statusCode == 200
          ? const ApiRequestResult.success()
          : ApiRequestResult.failure(_responseMessage(response));
    } catch (_) {
      return const ApiRequestResult.failure(
        'Unable to record this task. Check the connection and try again.',
      );
    }
  }

  static Future<List<MarketingDrink>> fetchMarketingDrinks() async {
    final workstationKey = await DirectPrinterService.instance.workstationKey();
    final response = await _authenticatedRequest(
      (headers) => http.get(
        Uri.parse('$baseUrl/barista/marketing-drinks/catalog'),
        headers: {...headers, 'x-c2-workstation-key': workstationKey},
      ),
    );
    if (response.statusCode != 200) {
      throw StateError(_responseMessage(response));
    }
    final rows =
        (json.decode(response.body) as Map<String, dynamic>)['drinks']
            as List? ??
        const [];
    return rows
        .map((row) => MarketingDrink.fromJson(row as Map<String, dynamic>))
        .toList();
  }

  static Future<BaristaInventoryResult> fetchBaristaInventory() async {
    final workstationKey = await DirectPrinterService.instance.workstationKey();
    final response = await _authenticatedRequest(
      (headers) => http.get(
        Uri.parse('$baseUrl/barista/inventory'),
        headers: {...headers, 'x-c2-workstation-key': workstationKey},
      ),
    );
    if (response.statusCode != 200) {
      throw StateError(_responseMessage(response));
    }
    return BaristaInventoryResult.fromJson(
      json.decode(response.body) as Map<String, dynamic>,
    );
  }

  static Future<ApiRequestResult> recordBaristaInventoryMovement({
    required int itemId,
    required double quantity,
    required bool isWaste,
    String? reasonCode,
    String? note,
  }) async {
    try {
      final workstationKey = await DirectPrinterService.instance
          .workstationKey();
      final response = await _authenticatedRequest(
        (headers) => http.post(
          Uri.parse('$baseUrl/barista/inventory/movements'),
          headers: {...headers, 'x-c2-workstation-key': workstationKey},
          body: json.encode({
            'inventory_item_id': itemId,
            'quantity': quantity,
            'movement_type': isWaste ? 'waste' : 'stock_add',
            'reason_code': ?reasonCode,
            if (note case final value? when value.trim().isNotEmpty)
              'note': value.trim(),
          }),
        ),
      );
      return response.statusCode == 201
          ? ApiRequestResult.success(
              json.decode(response.body) as Map<String, dynamic>,
            )
          : ApiRequestResult.failure(_responseMessage(response));
    } catch (error) {
      debugPrint('Barista inventory movement error: $error');
      return const ApiRequestResult.failure(
        'Unable to update inventory. Check the connection and try again.',
      );
    }
  }

  static Future<List<MarketingDrinkUsage>>
  fetchTodayMarketingDrinkUsages() async {
    final workstationKey = await DirectPrinterService.instance.workstationKey();
    final response = await _authenticatedRequest(
      (headers) => http.get(
        Uri.parse('$baseUrl/barista/marketing-drinks'),
        headers: {...headers, 'x-c2-workstation-key': workstationKey},
      ),
    );
    if (response.statusCode != 200) {
      throw StateError(_responseMessage(response));
    }
    final rows =
        (json.decode(response.body) as Map<String, dynamic>)['usages']
            as List? ??
        const [];
    return rows
        .map((row) => MarketingDrinkUsage.fromJson(row as Map<String, dynamic>))
        .toList();
  }

  static Future<ApiRequestResult> recordMarketingDrinkUsage({
    required int baristaId,
    required String pin,
    required String purposeCode,
    required String reasonNote,
    required Map<int, int> quantities,
    String? campaignName,
  }) async {
    try {
      final workstationKey = await DirectPrinterService.instance
          .workstationKey();
      final response = await _authenticatedRequest(
        (headers) => http.post(
          Uri.parse('$baseUrl/barista/marketing-drinks'),
          headers: {...headers, 'x-c2-workstation-key': workstationKey},
          body: json.encode({
            'barista_id': baristaId,
            'pin': pin,
            'purpose_code': purposeCode,
            'campaign_name': campaignName?.trim().isEmpty == true
                ? null
                : campaignName?.trim(),
            'reason_note': reasonNote.trim(),
            'idempotency_key':
                'counter-marketing-$baristaId-${DateTime.now().microsecondsSinceEpoch}',
            'items': quantities.entries
                .where((entry) => entry.value > 0)
                .map(
                  (entry) => {
                    'menu_item_id': entry.key,
                    'quantity': entry.value,
                  },
                )
                .toList(),
          }),
        ),
      );
      if (response.statusCode == 200 || response.statusCode == 201) {
        return ApiRequestResult.success(
          json.decode(response.body) as Map<String, dynamic>,
        );
      }
      return ApiRequestResult.failure(_responseMessage(response));
    } catch (error) {
      debugPrint('Marketing drink usage error: $error');
      return const ApiRequestResult.failure(
        'Unable to record this complimentary drink. Check the connection and try again.',
      );
    }
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

  static Future<BaristaMenuAvailabilityResult> fetchMenuAvailability() async {
    final workstationKey = await DirectPrinterService.instance.workstationKey();
    final response = await _authenticatedRequest(
      (headers) => http.get(
        Uri.parse('$baseUrl/barista/menu/availability'),
        headers: {...headers, 'x-c2-workstation-key': workstationKey},
      ),
    );
    if (response.statusCode != 200) {
      throw StateError(_responseMessage(response));
    }
    return BaristaMenuAvailabilityResult.fromJson(
      json.decode(response.body) as Map<String, dynamic>,
    );
  }

  static Future<ApiRequestResult> updateMenuItemAvailability({
    required int itemId,
    required bool isAvailable,
  }) async {
    try {
      final workstationKey = await DirectPrinterService.instance
          .workstationKey();
      final response = await _authenticatedRequest(
        (headers) => http.patch(
          Uri.parse('$baseUrl/barista/menu/items/$itemId/availability'),
          headers: {...headers, 'x-c2-workstation-key': workstationKey},
          body: json.encode({'is_available': isAvailable}),
        ),
      );
      if (response.statusCode == 200) {
        return const ApiRequestResult.success();
      }
      return ApiRequestResult.failure(_responseMessage(response));
    } catch (e) {
      return ApiRequestResult.failure(e.toString());
    }
  }

  static Future<ApiRequestResult> updateCustomizationAvailability({
    required String type,
    required String value,
    required bool isAvailable,
  }) async {
    try {
      final workstationKey = await DirectPrinterService.instance
          .workstationKey();
      final response = await _authenticatedRequest(
        (headers) => http.patch(
          Uri.parse('$baseUrl/barista/menu/customizations/availability'),
          headers: {...headers, 'x-c2-workstation-key': workstationKey},
          body: json.encode({
            'type': type,
            'value': value,
            'is_available': isAvailable,
          }),
        ),
      );
      if (response.statusCode == 200) {
        return const ApiRequestResult.success();
      }
      return ApiRequestResult.failure(_responseMessage(response));
    } catch (e) {
      return ApiRequestResult.failure(e.toString());
    }
  }

  static Future<ApiRequestResult> updateBeanAvailability({
    required String bean,
    required bool isAvailable,
  }) => updateCustomizationAvailability(
    type: 'bean',
    value: bean,
    isAvailable: isAvailable,
  );
}

String formatOrderDisplayDateTime(DateTime value) {
  final local = value.toLocal();
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  final hour = local.hour % 12 == 0 ? 12 : local.hour % 12;
  final minute = local.minute.toString().padLeft(2, '0');
  final period = local.hour < 12 ? 'AM' : 'PM';
  return '$hour:$minute $period - ${months[local.month - 1]} ${local.day}, ${local.year}';
}

String resolveOrderDisplayDateTime({
  required DateTime createdAt,
  String? serverTime,
  String? serverDate,
}) {
  final time = serverTime?.trim() ?? '';
  final date = serverDate?.trim() ?? '';
  if (time.isNotEmpty && date.isNotEmpty) return '$time - $date';
  return formatOrderDisplayDateTime(createdAt);
}

class BaristaInventoryResult {
  final int storeId;
  final String storeName;
  final List<BaristaInventoryItem> items;
  const BaristaInventoryResult({
    required this.storeId,
    required this.storeName,
    required this.items,
  });
  factory BaristaInventoryResult.fromJson(Map<String, dynamic> json) =>
      BaristaInventoryResult(
        storeId: (json['store_id'] as num?)?.toInt() ?? 0,
        storeName: json['store_name']?.toString() ?? 'Current outlet',
        items: (json['items'] as List? ?? const [])
            .map(
              (item) =>
                  BaristaInventoryItem.fromJson(item as Map<String, dynamic>),
            )
            .toList(),
      );
}

class BaristaInventoryItem {
  final int id;
  final String name;
  final String category;
  final String unitCode;
  final double onHand;
  final double reserved;
  final double available;
  const BaristaInventoryItem({
    required this.id,
    required this.name,
    required this.category,
    required this.unitCode,
    required this.onHand,
    required this.reserved,
    required this.available,
  });
  factory BaristaInventoryItem.fromJson(
    Map<String, dynamic> json,
  ) => BaristaInventoryItem(
    id: (json['id'] as num).toInt(),
    name: json['name']?.toString() ?? 'Item',
    category: json['category']?.toString() ?? 'ingredient',
    unitCode: json['unit_code']?.toString() ?? 'piece',
    onHand: double.tryParse(json['on_hand_quantity']?.toString() ?? '') ?? 0,
    reserved: double.tryParse(json['reserved_quantity']?.toString() ?? '') ?? 0,
    available:
        double.tryParse(json['available_quantity']?.toString() ?? '') ?? 0,
  );
  String get unitLabel => unitCode == 'millilitre'
      ? 'ml'
      : unitCode == 'gram'
      ? 'g'
      : 'pcs';
}

class BaristaAttendance {
  final int id;
  final int baristaId;
  final String baristaName;
  final DateTime clockedInAt;

  const BaristaAttendance({
    required this.id,
    required this.baristaId,
    required this.baristaName,
    required this.clockedInAt,
  });

  factory BaristaAttendance.fromJson(Map<String, dynamic> json) =>
      BaristaAttendance(
        id: (json['id'] as num).toInt(),
        baristaId: (json['barista_id'] as num?)?.toInt() ?? 0,
        baristaName: json['barista_name']?.toString() ?? 'Barista',
        clockedInAt: DateTime.parse(json['clocked_in_at'].toString()).toLocal(),
      );
}

class AttendanceHistoryEntry {
  final int id;
  final int baristaId;
  final String baristaName;
  final DateTime clockedInAt;
  final DateTime? clockedOutAt;

  const AttendanceHistoryEntry({
    required this.id,
    required this.baristaId,
    required this.baristaName,
    required this.clockedInAt,
    required this.clockedOutAt,
  });

  factory AttendanceHistoryEntry.fromJson(Map<String, dynamic> json) =>
      AttendanceHistoryEntry(
        id: (json['id'] as num).toInt(),
        baristaId: (json['barista_id'] as num?)?.toInt() ?? 0,
        baristaName: json['barista_name']?.toString() ?? 'Barista',
        clockedInAt: DateTime.parse(json['clocked_in_at'].toString()).toLocal(),
        clockedOutAt: json['clocked_out_at'] == null
            ? null
            : DateTime.tryParse(json['clocked_out_at'].toString())?.toLocal(),
      );
}

class MarketingDrink {
  const MarketingDrink({required this.id, required this.name, this.imageUrl});
  final int id;
  final String name;
  final String? imageUrl;

  factory MarketingDrink.fromJson(Map<String, dynamic> json) => MarketingDrink(
    id: (json['id'] as num).toInt(),
    name: json['name']?.toString() ?? 'Drink',
    imageUrl: json['image_url']?.toString(),
  );
}

class MarketingDrinkUsageItem {
  const MarketingDrinkUsageItem({required this.name, required this.quantity});
  final String name;
  final int quantity;
  factory MarketingDrinkUsageItem.fromJson(Map<String, dynamic> json) =>
      MarketingDrinkUsageItem(
        name: json['name']?.toString() ?? 'Drink',
        quantity: (json['quantity'] as num?)?.toInt() ?? 1,
      );
}

class MarketingDrinkUsage {
  const MarketingDrinkUsage({
    required this.usageRef,
    required this.purposeCode,
    required this.reasonNote,
    required this.baristaName,
    required this.postedAt,
    required this.items,
    this.campaignName,
    this.status = 'posted',
  });
  final String usageRef;
  final String purposeCode;
  final String reasonNote;
  final String baristaName;
  final DateTime postedAt;
  final List<MarketingDrinkUsageItem> items;
  final String? campaignName;
  final String status;

  factory MarketingDrinkUsage.fromJson(Map<String, dynamic> json) =>
      MarketingDrinkUsage(
        usageRef: json['usage_ref']?.toString() ?? '',
        purposeCode: json['purpose_code']?.toString() ?? 'other',
        reasonNote: json['reason_note']?.toString() ?? '',
        baristaName: json['barista_name']?.toString() ?? 'Barista',
        postedAt:
            DateTime.tryParse(json['posted_at']?.toString() ?? '')?.toLocal() ??
            DateTime.now(),
        items: (json['items'] as List? ?? const [])
            .map(
              (item) => MarketingDrinkUsageItem.fromJson(
                item as Map<String, dynamic>,
              ),
            )
            .toList(),
        campaignName: json['campaign_name']?.toString(),
        status: json['status']?.toString() ?? 'posted',
      );

  factory MarketingDrinkUsage.fromCreated(Map<String, dynamic> json) =>
      MarketingDrinkUsage.fromJson(json);
}

class ShiftStaff {
  final int baristaId;
  final String baristaName;
  final String? startsAt;
  final String? endsAt;

  const ShiftStaff({
    required this.baristaId,
    required this.baristaName,
    this.startsAt,
    this.endsAt,
  });

  factory ShiftStaff.fromJson(Map<String, dynamic> json) => ShiftStaff(
    baristaId: (json['barista_id'] as num).toInt(),
    baristaName: json['barista_name']?.toString() ?? 'Barista',
    startsAt: json['starts_at']?.toString(),
    endsAt: json['ends_at']?.toString(),
  );
}

class WorkstationAccessState {
  final String scheduleStatus;
  final String accessState;
  final bool canPrepareOrders;
  final String message;
  final String scheduleDate;
  final List<ShiftStaff> currentStaff;
  final List<ShiftStaff> missingStaff;
  final List<BaristaAttendance> activeAttendance;
  final int? minutesUntilShiftEnd;
  final BaristaSoundSettings soundSettings;

  const WorkstationAccessState({
    required this.scheduleStatus,
    required this.accessState,
    required this.canPrepareOrders,
    required this.message,
    required this.scheduleDate,
    required this.currentStaff,
    required this.missingStaff,
    required this.activeAttendance,
    required this.minutesUntilShiftEnd,
    required this.soundSettings,
  });

  factory WorkstationAccessState.fromJson(
    Map<String, dynamic> json,
  ) => WorkstationAccessState(
    scheduleStatus: json['schedule_status']?.toString() ?? 'unpublished',
    accessState: json['access_state']?.toString() ?? 'locked',
    canPrepareOrders: readJsonBool(json['can_prepare_orders']),
    message: json['message']?.toString() ?? 'Shift access is unavailable.',
    scheduleDate: json['schedule_date']?.toString() ?? '',
    currentStaff: (json['current_staff'] as List? ?? const [])
        .map((item) => ShiftStaff.fromJson(item as Map<String, dynamic>))
        .toList(),
    missingStaff: (json['missing_staff'] as List? ?? const [])
        .map((item) => ShiftStaff.fromJson(item as Map<String, dynamic>))
        .toList(),
    activeAttendance: (json['active_attendance'] as List? ?? const [])
        .map((item) => BaristaAttendance.fromJson(item as Map<String, dynamic>))
        .toList(),
    minutesUntilShiftEnd: (json['minutes_until_shift_end'] as num?)?.toInt(),
    soundSettings: BaristaSoundSettings.fromJson(
      json['sound_settings'] as Map<String, dynamic>? ?? const {},
    ),
  );
}

class BaristaSoundSettings {
  final int volumePercent;
  final bool incomingOrderEnabled;
  final int incomingOrderBeeps;
  final String incomingOrderStyle;
  final int clockInBeeps;
  final String clockInStyle;
  final int clockOutBeeps;
  final String clockOutStyle;
  final int sideWorkBeeps;
  final String sideWorkStyle;
  final bool cancellationAlertEnabled;
  final int cancellationAlertBeeps;
  final String cancellationAlertStyle;
  final bool waitingAlertEnabled;
  final int waitingAlertAfterMinutes;
  final int waitingAlertRepeatMinutes;
  final int waitingAlertBeeps;
  final String waitingAlertStyle;
  final bool preparingAlertEnabled;
  final int preparingAlertAfterMinutes;
  final int preparingAlertRepeatMinutes;
  final int preparingAlertBeeps;
  final String preparingAlertStyle;

  const BaristaSoundSettings({
    required this.volumePercent,
    required this.incomingOrderEnabled,
    required this.incomingOrderBeeps,
    required this.incomingOrderStyle,
    required this.clockInBeeps,
    required this.clockInStyle,
    required this.clockOutBeeps,
    required this.clockOutStyle,
    required this.sideWorkBeeps,
    required this.sideWorkStyle,
    required this.cancellationAlertEnabled,
    required this.cancellationAlertBeeps,
    required this.cancellationAlertStyle,
    required this.waitingAlertEnabled,
    required this.waitingAlertAfterMinutes,
    required this.waitingAlertRepeatMinutes,
    required this.waitingAlertBeeps,
    required this.waitingAlertStyle,
    required this.preparingAlertEnabled,
    required this.preparingAlertAfterMinutes,
    required this.preparingAlertRepeatMinutes,
    required this.preparingAlertBeeps,
    required this.preparingAlertStyle,
  });

  const BaristaSoundSettings.defaults()
    : volumePercent = 70,
      incomingOrderEnabled = true,
      incomingOrderBeeps = 4,
      incomingOrderStyle = 'two_tone',
      clockInBeeps = 1,
      clockInStyle = 'short',
      clockOutBeeps = 2,
      clockOutStyle = 'long',
      sideWorkBeeps = 3,
      sideWorkStyle = 'two_tone',
      cancellationAlertEnabled = true,
      cancellationAlertBeeps = 5,
      cancellationAlertStyle = 'two_tone',
      waitingAlertEnabled = true,
      waitingAlertAfterMinutes = 5,
      waitingAlertRepeatMinutes = 10,
      waitingAlertBeeps = 2,
      waitingAlertStyle = 'short',
      preparingAlertEnabled = true,
      preparingAlertAfterMinutes = 10,
      preparingAlertRepeatMinutes = 10,
      preparingAlertBeeps = 1,
      preparingAlertStyle = 'short';

  factory BaristaSoundSettings.fromJson(
    Map<String, dynamic> json,
  ) => BaristaSoundSettings(
    volumePercent: (json['volume_percent'] as num?)?.toInt() ?? 70,
    incomingOrderEnabled: _soundEnabled(json['incoming_order_enabled']),
    incomingOrderBeeps: (json['incoming_order_beeps'] as num?)?.toInt() ?? 4,
    incomingOrderStyle: _soundStyle(json['incoming_order_style'], 'two_tone'),
    clockInBeeps: (json['clock_in_beeps'] as num?)?.toInt() ?? 1,
    clockInStyle: _soundStyle(json['clock_in_style'], 'short'),
    clockOutBeeps: (json['clock_out_beeps'] as num?)?.toInt() ?? 2,
    clockOutStyle: _soundStyle(json['clock_out_style'], 'long'),
    sideWorkBeeps: (json['side_work_beeps'] as num?)?.toInt() ?? 3,
    sideWorkStyle: _soundStyle(json['side_work_style'], 'two_tone'),
    cancellationAlertEnabled: _soundEnabled(json['cancellation_alert_enabled']),
    cancellationAlertBeeps:
        (json['cancellation_alert_beeps'] as num?)?.toInt() ?? 5,
    cancellationAlertStyle: _soundStyle(
      json['cancellation_alert_style'],
      'two_tone',
    ),
    waitingAlertEnabled: _soundEnabled(json['waiting_alert_enabled']),
    waitingAlertAfterMinutes:
        (json['waiting_alert_after_minutes'] as num?)?.toInt() ?? 5,
    waitingAlertRepeatMinutes:
        (json['waiting_alert_repeat_minutes'] as num?)?.toInt() ?? 10,
    waitingAlertBeeps: (json['waiting_alert_beeps'] as num?)?.toInt() ?? 2,
    waitingAlertStyle: _soundStyle(json['waiting_alert_style'], 'short'),
    preparingAlertEnabled: _soundEnabled(json['preparing_alert_enabled']),
    preparingAlertAfterMinutes:
        (json['preparing_alert_after_minutes'] as num?)?.toInt() ?? 10,
    preparingAlertRepeatMinutes:
        (json['preparing_alert_repeat_minutes'] as num?)?.toInt() ?? 10,
    preparingAlertBeeps: (json['preparing_alert_beeps'] as num?)?.toInt() ?? 1,
    preparingAlertStyle: _soundStyle(json['preparing_alert_style'], 'short'),
  );

  static String _soundStyle(Object? value, String fallback) {
    final style = value?.toString();
    return const {'short', 'long', 'two_tone'}.contains(style)
        ? style!
        : fallback;
  }

  static bool _soundEnabled(Object? value) {
    if (value == null) return true;
    if (value is bool) return value;
    if (value is num) return value != 0;
    return value.toString().toLowerCase() != 'false' && value.toString() != '0';
  }
}

class AttendanceBarista {
  final int id;
  final String name;
  final bool pinConfigured;
  const AttendanceBarista({
    required this.id,
    required this.name,
    required this.pinConfigured,
  });
  factory AttendanceBarista.fromJson(Map<String, dynamic> json) =>
      AttendanceBarista(
        id: (json['id'] as num).toInt(),
        name: json['name']?.toString() ?? 'Barista',
        pinConfigured: readJsonBool(json['pin_configured']),
      );
}

class BaristaAttendanceStatus {
  final List<AttendanceBarista> baristas;
  final List<BaristaAttendance> activeAttendance;
  final OutletEmergencyClosure? emergencyClosure;
  const BaristaAttendanceStatus({
    required this.baristas,
    required this.activeAttendance,
    this.emergencyClosure,
  });
  factory BaristaAttendanceStatus.fromJson(
    Map<String, dynamic> json,
  ) => BaristaAttendanceStatus(
    baristas: (json['baristas'] as List? ?? const [])
        .map((item) => AttendanceBarista.fromJson(item as Map<String, dynamic>))
        .toList(),
    activeAttendance: (json['active_attendance'] as List? ?? const [])
        .map((item) => BaristaAttendance.fromJson(item as Map<String, dynamic>))
        .toList(),
    emergencyClosure: json['emergency_closure'] is Map
        ? OutletEmergencyClosure.fromJson(
            Map<String, dynamic>.from(json['emergency_closure'] as Map),
          )
        : null,
  );
}

class OutletEmergencyClosure {
  final int id;
  final String reasonCode;
  final DateTime? expectedReopenAt;
  final DateTime createdAt;

  const OutletEmergencyClosure({
    required this.id,
    required this.reasonCode,
    required this.expectedReopenAt,
    required this.createdAt,
  });

  factory OutletEmergencyClosure.fromJson(Map<String, dynamic> json) =>
      OutletEmergencyClosure(
        id: (json['id'] as num).toInt(),
        reasonCode: json['reason_code']?.toString() ?? 'other',
        expectedReopenAt: DateTime.tryParse(
          json['expected_reopen_at']?.toString() ?? '',
        )?.toLocal(),
        createdAt: DateTime.parse(json['created_at'].toString()).toLocal(),
      );
}

class BaristaGuide {
  final int id;
  final String type;
  final String imageUrl;
  final String? menuItemName;
  final int? menuItemId;
  final String? guideTitle;

  const BaristaGuide({
    required this.id,
    required this.type,
    required this.imageUrl,
    this.menuItemName,
    this.menuItemId,
    this.guideTitle,
  });

  factory BaristaGuide.fromJson(Map<String, dynamic> json) => BaristaGuide(
    id: (json['id'] as num).toInt(),
    type: json['guide_type']?.toString() ?? '',
    imageUrl: json['image_url']?.toString() ?? '',
    menuItemName: json['menu_item_name']?.toString(),
    menuItemId: (json['menu_item_id'] as num?)?.toInt(),
    guideTitle: json['guide_title']?.toString(),
  );
}

class BaristaSideWorkTask {
  final int id;
  final String title;
  final String instructions;
  final String scheduledDate;
  final String scheduledTime;
  final bool isDue;
  final DateTime? completedAt;
  final int? completedByBaristaId;
  final String? completedByBaristaName;

  const BaristaSideWorkTask({
    required this.id,
    required this.title,
    required this.instructions,
    required this.scheduledDate,
    required this.scheduledTime,
    required this.isDue,
    this.completedAt,
    this.completedByBaristaId,
    this.completedByBaristaName,
  });

  bool get isCompleted => completedAt != null;

  factory BaristaSideWorkTask.fromJson(Map<String, dynamic> json) {
    final completedAt = json['completed_at']?.toString();
    return BaristaSideWorkTask(
      id: (json['id'] as num).toInt(),
      title: json['title']?.toString() ?? 'Side-work task',
      instructions: json['instructions']?.toString() ?? '',
      scheduledDate: json['scheduled_date']?.toString() ?? '',
      scheduledTime: json['scheduled_time']?.toString() ?? '',
      isDue: json['is_due'] == true || json['is_due'] == 1,
      completedAt: completedAt == null || completedAt.isEmpty
          ? null
          : DateTime.tryParse(completedAt)?.toLocal(),
      completedByBaristaId: (json['completed_by_barista_id'] as num?)?.toInt(),
      completedByBaristaName: json['completed_by_barista_name']?.toString(),
    );
  }
}

class ApiRequestResult {
  final String? errorMessage;
  final Map<String, dynamic>? data;

  const ApiRequestResult.success([this.data]) : errorMessage = null;
  const ApiRequestResult.failure(this.errorMessage) : data = null;

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
  final List<DatedShiftEntry> scheduledShifts;

  const OperationsContext({
    required this.integrations,
    required this.printers,
    required this.scheduledShifts,
  });

  factory OperationsContext.fromJson(Map<String, dynamic> json) {
    final scheduledShifts = json['scheduled_shifts'];
    if (scheduledShifts is! List) {
      throw const FormatException(
        'The timetable service did not return a published dated schedule.',
      );
    }
    return OperationsContext(
      integrations: (json['integrations'] as List? ?? const [])
          .map(
            (entry) =>
                OperationalIntegration.fromJson(entry as Map<String, dynamic>),
          )
          .toList(),
      printers: (json['printers'] as List? ?? const [])
          .map((entry) => PrinterTarget.fromJson(entry as Map<String, dynamic>))
          .toList(),
      scheduledShifts: scheduledShifts
          .map(
            (entry) => DatedShiftEntry.fromJson(entry as Map<String, dynamic>),
          )
          .toList(),
    );
  }
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
  final int id;
  final String name;
  final String deliveryMode;
  final String status;
  final bool isDefault;
  final String? networkHost;
  final int? networkPort;

  const PrinterTarget({
    required this.id,
    required this.name,
    required this.deliveryMode,
    required this.status,
    required this.isDefault,
    required this.networkHost,
    required this.networkPort,
  });

  factory PrinterTarget.fromJson(Map<String, dynamic> json) => PrinterTarget(
    id: (json['id'] as num?)?.toInt() ?? 0,
    name: json['name']?.toString() ?? 'Receipt printer',
    deliveryMode: json['delivery_mode']?.toString() ?? '',
    status: json['status']?.toString() ?? 'not_configured',
    isDefault: readJsonBool(json['is_default']),
    networkHost: json['network_host']?.toString(),
    networkPort: (json['network_port'] as num?)?.toInt(),
  );
}

class DatedShiftEntry {
  final int baristaId;
  final String shiftDate;
  final String startsAt;
  final String endsAt;
  final String baristaName;

  const DatedShiftEntry({
    required this.baristaId,
    required this.shiftDate,
    required this.startsAt,
    required this.endsAt,
    required this.baristaName,
  });

  factory DatedShiftEntry.fromJson(Map<String, dynamic> json) =>
      DatedShiftEntry(
        baristaId: (json['barista_id'] as num?)?.toInt() ?? 0,
        shiftDate: json['shift_date']?.toString().split('T').first ?? '',
        startsAt: json['starts_at']?.toString() ?? '',
        endsAt: json['ends_at']?.toString() ?? '',
        baristaName: json['barista_name']?.toString() ?? 'Unassigned',
      );
}

class BaristaMenuAvailabilityResult {
  final int storeId;
  final String storeName;
  final List<BaristaCustomizationGroup> customizations;
  final List<BaristaBeanBlend> beans;
  final List<BaristaMenuCategory> categories;

  const BaristaMenuAvailabilityResult({
    required this.storeId,
    required this.storeName,
    required this.customizations,
    required this.beans,
    required this.categories,
  });

  factory BaristaMenuAvailabilityResult.fromJson(Map<String, dynamic> json) {
    final customizationGroups =
        (json['customizations'] as List<dynamic>? ?? const [])
            .map(
              (e) =>
                  BaristaCustomizationGroup.fromJson(e as Map<String, dynamic>),
            )
            .toList();

    return BaristaMenuAvailabilityResult(
      storeId: (json['store_id'] as num?)?.toInt() ?? 0,
      storeName: json['store_name']?.toString() ?? 'Current outlet',
      customizations: customizationGroups,
      beans: (json['beans'] as List<dynamic>? ?? const [])
          .map((e) => BaristaBeanBlend.fromJson(e as Map<String, dynamic>))
          .toList(),
      categories: (json['categories'] as List<dynamic>? ?? const [])
          .map((e) => BaristaMenuCategory.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }
}

class BaristaCustomizationGroup {
  final String type;
  final String categoryName;
  final String description;
  final List<BaristaCustomizationOption> options;

  const BaristaCustomizationGroup({
    required this.type,
    required this.categoryName,
    required this.description,
    required this.options,
  });

  factory BaristaCustomizationGroup.fromJson(Map<String, dynamic> json) =>
      BaristaCustomizationGroup(
        type: json['type']?.toString() ?? '',
        categoryName: json['category_name']?.toString() ?? '',
        description: json['description']?.toString() ?? '',
        options: (json['options'] as List<dynamic>? ?? const [])
            .map(
              (e) => BaristaCustomizationOption.fromJson(
                e as Map<String, dynamic>,
              ),
            )
            .toList(),
      );
}

class BaristaCustomizationOption {
  final String code;
  final String name;
  final String subtitle;
  final String value;
  bool isAvailable;

  BaristaCustomizationOption({
    required this.code,
    required this.name,
    required this.subtitle,
    required this.value,
    required this.isAvailable,
  });

  factory BaristaCustomizationOption.fromJson(Map<String, dynamic> json) =>
      BaristaCustomizationOption(
        code: json['code']?.toString() ?? '',
        name: json['name']?.toString() ?? '',
        subtitle: json['subtitle']?.toString() ?? '',
        value: json['value']?.toString() ?? '',
        isAvailable: readJsonBool(json['is_available']),
      );
}

class BaristaBeanBlend {
  final String code;
  final String name;
  final String subtitle;
  final String value;
  bool isAvailable;

  BaristaBeanBlend({
    required this.code,
    required this.name,
    required this.subtitle,
    required this.value,
    required this.isAvailable,
  });

  factory BaristaBeanBlend.fromJson(Map<String, dynamic> json) =>
      BaristaBeanBlend(
        code: json['code']?.toString() ?? '',
        name: json['name']?.toString() ?? '',
        subtitle: json['subtitle']?.toString() ?? '',
        value: json['value']?.toString() ?? '',
        isAvailable: readJsonBool(json['is_available']),
      );
}

class BaristaMenuCategory {
  final int id;
  final String name;
  final int sortOrder;
  final List<BaristaMenuItemAvailability> items;

  const BaristaMenuCategory({
    required this.id,
    required this.name,
    required this.sortOrder,
    required this.items,
  });

  factory BaristaMenuCategory.fromJson(Map<String, dynamic> json) =>
      BaristaMenuCategory(
        id: (json['id'] as num?)?.toInt() ?? 0,
        name: json['name']?.toString() ?? '',
        sortOrder: (json['sort_order'] as num?)?.toInt() ?? 0,
        items: (json['items'] as List<dynamic>? ?? const [])
            .map(
              (e) => BaristaMenuItemAvailability.fromJson(
                e as Map<String, dynamic>,
              ),
            )
            .toList(),
      );
}

class BaristaMenuItemAvailability {
  final int id;
  final String name;
  final String? description;
  final String basePriceRm;
  final String? imageUrl;
  final bool allowChoiceOfBeans;
  bool isAvailable;

  BaristaMenuItemAvailability({
    required this.id,
    required this.name,
    this.description,
    required this.basePriceRm,
    this.imageUrl,
    required this.allowChoiceOfBeans,
    required this.isAvailable,
  });

  factory BaristaMenuItemAvailability.fromJson(Map<String, dynamic> json) =>
      BaristaMenuItemAvailability(
        id: (json['id'] as num?)?.toInt() ?? 0,
        name: json['name']?.toString() ?? 'Item',
        description: json['description']?.toString(),
        basePriceRm: json['base_price_rm']?.toString() ?? '0.00',
        imageUrl: json['image_url']?.toString(),
        allowChoiceOfBeans: readJsonBool(json['allow_choice_of_beans']),
        isAvailable: readJsonBool(json['is_available'], fallback: true),
      );
}
