import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../widgets/order_card.dart';
import 'direct_printer_service.dart';
import 'api_config.dart';
import 'secure_session_service.dart';

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
          case 'clock_in_required':
            return 'Clock in from Workstation before preparing orders.';
          case 'shift_access_locked':
            return error['message']?.toString() ??
                'The workstation is locked until the scheduled shift clocks in.';
          case 'handover_required':
            return 'The incoming scheduled barista must clock in before this shift can clock out.';
          case 'shift_coverage_required':
            return 'The final scheduled barista must stay clocked in until the shift ends or another scheduled barista takes over.';
          case 'active_orders_require_coverage':
            return 'The final barista cannot clock out while active orders still need coverage.';
          case 'workstation_outlet_required':
            return 'Assign this C2 Store device to one outlet in Admin Web before using shift access.';
          case 'barista_not_clocked_in':
            return 'Clock in before completing this side-work task.';
          case 'invalid_barista_pin':
            return 'The selected barista or PIN is not valid.';
          case 'side_work_not_due':
            return 'This side-work task is not due yet or is no longer available.';
          case 'printer_not_ready':
            return 'The receipt printer is not ready. Please contact an operations administrator.';
          case 'direct_printer_not_assigned':
            return 'The printer test worked, but this C2 Store device is not assigned to that printer in Admin Web.';
          case 'forbidden':
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
        'Unable to record this side-work task. Check the connection and try again.',
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
    canPrepareOrders: json['can_prepare_orders'] == true,
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
  final int clockInBeeps;
  final String clockInStyle;
  final int clockOutBeeps;
  final String clockOutStyle;
  final int sideWorkBeeps;
  final String sideWorkStyle;

  const BaristaSoundSettings({
    required this.volumePercent,
    required this.clockInBeeps,
    required this.clockInStyle,
    required this.clockOutBeeps,
    required this.clockOutStyle,
    required this.sideWorkBeeps,
    required this.sideWorkStyle,
  });

  const BaristaSoundSettings.defaults()
    : volumePercent = 70,
      clockInBeeps = 1,
      clockInStyle = 'short',
      clockOutBeeps = 2,
      clockOutStyle = 'long',
      sideWorkBeeps = 3,
      sideWorkStyle = 'two_tone';

  factory BaristaSoundSettings.fromJson(Map<String, dynamic> json) =>
      BaristaSoundSettings(
        volumePercent: (json['volume_percent'] as num?)?.toInt() ?? 70,
        clockInBeeps: (json['clock_in_beeps'] as num?)?.toInt() ?? 1,
        clockInStyle: _soundStyle(json['clock_in_style'], 'short'),
        clockOutBeeps: (json['clock_out_beeps'] as num?)?.toInt() ?? 2,
        clockOutStyle: _soundStyle(json['clock_out_style'], 'long'),
        sideWorkBeeps: (json['side_work_beeps'] as num?)?.toInt() ?? 3,
        sideWorkStyle: _soundStyle(json['side_work_style'], 'two_tone'),
      );

  static String _soundStyle(Object? value, String fallback) {
    final style = value?.toString();
    return const {'short', 'long', 'two_tone'}.contains(style)
        ? style!
        : fallback;
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
        pinConfigured: json['pin_configured'] == true,
      );
}

class BaristaAttendanceStatus {
  final List<AttendanceBarista> baristas;
  final List<BaristaAttendance> activeAttendance;
  const BaristaAttendanceStatus({
    required this.baristas,
    required this.activeAttendance,
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
    isDefault: json['is_default'] == true,
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
