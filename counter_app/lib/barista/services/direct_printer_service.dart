import 'dart:convert';
import 'dart:io';
import 'dart:math';
import 'dart:typed_data';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:image/image.dart' as image;

import '../../api_client.dart';
import '../../auth_service.dart';

bool isPrivatePrinterIpv4(String value) {
  final parts = value.trim().split('.');
  if (parts.length != 4) return false;
  final octets = parts.map(int.tryParse).toList();
  if (octets.any((value) => value == null || value < 0 || value > 255)) {
    return false;
  }
  final first = octets[0]!;
  final second = octets[1]!;
  return first == 10 ||
      (first == 172 && second >= 16 && second <= 31) ||
      (first == 192 && second == 168);
}

bool isAllowedDirectPrinterConfig(DirectPrinterConfig config) {
  if (config.isSunmi) return config.port == 9100;
  return isPrivatePrinterIpv4(config.host) && config.port == 9100;
}

class DirectPrinterConfig {
  const DirectPrinterConfig({required this.host, required this.port});

  static const sunmiHost = 'sunmi_inner';

  final String host;
  final int port;

  bool get isConfigured => host.isNotEmpty;
  bool get isSunmi => host == sunmiHost;
  String get displayName =>
      isSunmi ? 'Sunmi Inner Printer (Built-in)' : '$host:$port';
}

class DirectPrintJob {
  const DirectPrintJob({
    required this.jobRef,
    this.requestType = 'original',
    required this.config,
    required this.orderRef,
    required this.customerName,
    required this.customerIsEmployee,
    this.isGuest = false,
    this.fulfillmentType = 'pickup',
    required this.createdAt,
    required this.items,
    this.subsidyRole = 'none',
    this.paymentMode,
    this.paymentMethod,
    this.paymentReference,
    this.subtotal = 0,
    this.finalTotal = 0,
    this.tokenAmountCharged = 0,
    this.subsidyTokenAmount = 0,
    this.giftCardTokenAmount = 0,
    this.priceCorrectionTokenAmount = 0,
    this.voucherName,
    this.voucherType,
    this.voucherCode,
    this.discount = 0,
    this.voucherDiscountTokens = 0,
    this.voucherRewardSummary,
  });

  final String jobRef;
  final String requestType;
  final DirectPrinterConfig config;
  final String orderRef;
  final String customerName;
  final bool customerIsEmployee;
  final bool isGuest;
  final String fulfillmentType;
  final String subsidyRole;
  final String? paymentMode;
  final String? paymentMethod;
  final String? paymentReference;
  final double subtotal;
  final double finalTotal;
  final int tokenAmountCharged;
  final int subsidyTokenAmount;
  final int giftCardTokenAmount;
  final int priceCorrectionTokenAmount;
  final DateTime createdAt;
  final List<DirectPrintItem> items;
  final String? voucherName;
  final String? voucherType;
  final String? voucherCode;
  final double discount;
  final int voucherDiscountTokens;
  final String? voucherRewardSummary;

  String get printedCustomerName =>
      customerIsEmployee ? '$customerName (Employee)' : customerName;

  bool get isItemisedReceipt => requestType == 'reprint';
}

class DirectPrintItem {
  const DirectPrintItem({
    required this.name,
    required this.quantity,
    this.details = const [],
    this.unitPriceRm = 0,
    this.lineTotalRm = 0,
    this.unitTokenValue = 0,
    this.lineTokenValue = 0,
    this.lineType = 'sale',
    this.campaignName,
    this.assignmentMode,
  });
  final String name;
  final int quantity;
  final List<String> details;
  final double unitPriceRm;
  final double lineTotalRm;
  final int unitTokenValue;
  final int lineTokenValue;
  final String lineType;
  final String? campaignName;
  final String? assignmentMode;
  bool get isPromotionalAddon => lineType == 'promotional_addon';
}

DirectPrintItem parseDirectPrintItem(Map<String, dynamic> value) {
  final promotion = value['promotional_addon'] is Map
      ? Map<String, dynamic>.from(value['promotional_addon'] as Map)
      : const <String, dynamic>{};
  String? read(String key) {
    final text = (value[key] ?? promotion[key])?.toString().trim();
    return text == null || text.isEmpty ? null : text;
  }

  return DirectPrintItem(
    name: value['name']?.toString() ?? 'Item',
    quantity: int.tryParse((value['quantity'] ?? 1).toString()) ?? 1,
    details: (value['details'] as List? ?? const [])
        .map((detail) => detail.toString())
        .toList(),
    unitPriceRm: double.tryParse(value['unit_price_rm']?.toString() ?? '') ?? 0,
    lineTotalRm: double.tryParse(value['line_total_rm']?.toString() ?? '') ?? 0,
    unitTokenValue:
        int.tryParse(value['unit_token_value']?.toString() ?? '') ?? 0,
    lineTokenValue:
        int.tryParse(value['line_token_value']?.toString() ?? '') ?? 0,
    lineType: read('line_type') ?? 'sale',
    campaignName: read('campaign_name'),
    assignmentMode: read('assignment_mode'),
  );
}

List<String> receiptLinesForItem(DirectPrintItem item) {
  if (!item.isPromotionalAddon) {
    return ['${item.quantity}x ${item.name}', ...item.details];
  }
  return [
    'PROMOTIONAL GIFT — INCLUDE IN BAG',
    '${item.quantity}x ${item.name}',
    if (item.campaignName?.isNotEmpty == true) 'Campaign: ${item.campaignName}',
    item.assignmentMode == 'server_random'
        ? 'Randomly assigned'
        : 'Customer selected',
  ];
}

class MarketingDrinkPrintSlip {
  const MarketingDrinkPrintSlip({
    required this.config,
    required this.usageRef,
    required this.baristaName,
    required this.purpose,
    required this.reason,
    required this.createdAt,
    required this.items,
    this.campaignName,
  });
  final DirectPrinterConfig config;
  final String usageRef;
  final String baristaName;
  final String purpose;
  final String reason;
  final String? campaignName;
  final DateTime createdAt;
  final List<DirectPrintItem> items;
}

class ShiftReportPrintSlip {
  const ShiftReportPrintSlip({
    required this.config,
    this.reportType = 'shift_session',
    required this.attendanceId,
    required this.baristaName,
    required this.clockedInAt,
    required this.clockedOutAt,
    required this.orderCount,
    this.totalItems = 0,
    required this.grossSales,
    this.discountTotal = 0,
    required this.refunded,
    required this.netSales,
    this.counterSales = 0,
    this.onlineSales = 0,
    this.creditSales = 0,
    this.personalCreditSales = 0,
    this.personalTokensUsed = 0,
    this.allowanceSales = 0,
    this.allowanceTokensUsed = 0,
    this.salesExclAllowance = 0,
    this.netSalesExclAllowance = 0,
    this.totalTokensCharged = 0,
    this.hasPaymentBreakdown = false,
    required this.orders,
    required this.items,
  });

  factory ShiftReportPrintSlip.fromJson(
    DirectPrinterConfig config,
    Map<String, dynamic> json,
  ) {
    double money(Object? value) =>
        double.tryParse(value?.toString() ?? '') ?? 0;
    final parsedOrders = (json['orders'] as List? ?? const [])
        .whereType<Map>()
        .map(
          (order) => ShiftReportOrder(
            orderRef: order['order_ref']?.toString() ?? '',
            dailyOrderNumber:
                int.tryParse(order['daily_order_number']?.toString() ?? '') ??
                0,
            status: order['status']?.toString() ?? '',
            paymentMode: order['payment_mode']?.toString(),
            paymentMethod: order['payment_method']?.toString(),
            finalTotal: money(order['final_total_rm']),
            discount: money(order['discount_total_rm']),
            refunded: money(order['refunded_rm']),
            tokenAmountCharged:
                int.tryParse(order['token_amount_charged']?.toString() ?? '') ??
                0,
            createdAt: DateTime.parse(order['created_at'].toString()),
          ),
        )
        .toList();
    final parsedItems = (json['items'] as List? ?? const [])
        .whereType<Map>()
        .map(
          (item) => DirectPrintItem(
            name: item['name']?.toString() ?? 'Item',
            quantity: int.tryParse(item['quantity']?.toString() ?? '') ?? 0,
          ),
        )
        .toList();
    final totalItems =
        int.tryParse(json['total_items']?.toString() ?? '') ??
        parsedItems.fold<int>(0, (sum, item) => sum + item.quantity);
    final discountTotal = json.containsKey('discount_total_rm')
        ? money(json['discount_total_rm'])
        : parsedOrders.fold<double>(0, (sum, order) => sum + order.discount);
    final counterSales = json.containsKey('counter_sales_rm')
        ? money(json['counter_sales_rm'])
        : parsedOrders
              .where((order) => order.formattedPaymentLabel == 'Counter')
              .fold<double>(0, (sum, order) => sum + order.finalTotal);
    final onlineSales = json.containsKey('online_sales_rm')
        ? money(json['online_sales_rm'])
        : parsedOrders
              .where((order) => order.formattedPaymentLabel == 'Online')
              .fold<double>(0, (sum, order) => sum + order.finalTotal);
    final creditSales = json.containsKey('credit_sales_rm')
        ? money(json['credit_sales_rm'])
        : parsedOrders
              .where((order) => order.formattedPaymentLabel == 'Credit')
              .fold<double>(0, (sum, order) => sum + order.finalTotal);
    final totalTokensCharged =
        int.tryParse(json['total_tokens_charged']?.toString() ?? '') ??
        parsedOrders.fold<int>(
          0,
          (sum, order) => sum + order.tokenAmountCharged,
        );
    final personalCreditSales = json.containsKey('personal_credit_sales_rm')
        ? money(json['personal_credit_sales_rm'])
        : creditSales;
    final personalTokensUsed =
        int.tryParse(json['personal_tokens_used']?.toString() ?? '') ??
        totalTokensCharged;
    final allowanceSales = json.containsKey('allowance_sales_rm')
        ? money(json['allowance_sales_rm'])
        : 0.0;
    final allowanceTokensUsed =
        int.tryParse(json['allowance_tokens_used']?.toString() ?? '') ?? 0;
    final grossSales = money(json['gross_sales_rm']);
    final refunded = money(json['refunded_rm']);
    final netSales = money(json['net_sales_rm']);
    final salesExclAllowance = json.containsKey('sales_excl_allowance_rm')
        ? money(json['sales_excl_allowance_rm'])
        : (counterSales + onlineSales + personalCreditSales > 0 || !json.containsKey('gross_sales_rm')
              ? counterSales + onlineSales + personalCreditSales
              : grossSales);
    final netSalesExclAllowance = json.containsKey('net_sales_excl_allowance_rm')
        ? money(json['net_sales_excl_allowance_rm'])
        : (salesExclAllowance - refunded).clamp(0.0, double.infinity).toDouble();
    final hasPaymentBreakdown =
        json.containsKey('counter_sales_rm') ||
        json.containsKey('online_sales_rm') ||
        json.containsKey('credit_sales_rm') ||
        json.containsKey('personal_credit_sales_rm') ||
        parsedOrders.isNotEmpty;

    return ShiftReportPrintSlip(
      config: config,
      reportType: json['report_type']?.toString() ?? 'shift_session',
      attendanceId: int.tryParse(json['attendance_id']?.toString() ?? '') ?? 0,
      baristaName: json['barista_name']?.toString() ?? 'Barista',
      clockedInAt: DateTime.parse(json['clocked_in_at'].toString()),
      clockedOutAt: DateTime.parse(json['clocked_out_at'].toString()),
      orderCount: int.tryParse(json['order_count']?.toString() ?? '') ?? 0,
      totalItems: totalItems,
      grossSales: grossSales,
      discountTotal: discountTotal,
      refunded: refunded,
      netSales: netSales,
      counterSales: counterSales,
      onlineSales: onlineSales,
      creditSales: creditSales,
      personalCreditSales: personalCreditSales,
      personalTokensUsed: personalTokensUsed,
      allowanceSales: allowanceSales,
      allowanceTokensUsed: allowanceTokensUsed,
      salesExclAllowance: salesExclAllowance,
      netSalesExclAllowance: netSalesExclAllowance,
      totalTokensCharged: totalTokensCharged,
      hasPaymentBreakdown: hasPaymentBreakdown,
      orders: parsedOrders,
      items: parsedItems,
    );
  }

  final DirectPrinterConfig config;
  final String reportType;
  final int attendanceId;
  final String baristaName;
  final DateTime clockedInAt;
  final DateTime clockedOutAt;
  final int orderCount;
  final int totalItems;
  final double grossSales;
  final double discountTotal;
  final double refunded;
  final double netSales;
  final double counterSales;
  final double onlineSales;
  final double creditSales;
  final double personalCreditSales;
  final int personalTokensUsed;
  final double allowanceSales;
  final int allowanceTokensUsed;
  final double salesExclAllowance;
  final double netSalesExclAllowance;
  final int totalTokensCharged;
  final bool hasPaymentBreakdown;
  final List<ShiftReportOrder> orders;
  final List<DirectPrintItem> items;
}

class ShiftReportOrder {
  const ShiftReportOrder({
    required this.orderRef,
    required this.dailyOrderNumber,
    required this.status,
    this.paymentMode,
    required this.paymentMethod,
    required this.finalTotal,
    required this.discount,
    required this.refunded,
    this.tokenAmountCharged = 0,
    required this.createdAt,
  });

  final String orderRef;
  final int dailyOrderNumber;
  final String status;
  final String? paymentMode;
  final String? paymentMethod;
  final double finalTotal;
  final double discount;
  final double refunded;
  final int tokenAmountCharged;
  final DateTime createdAt;

  String get formattedPaymentLabel {
    final normalizedMode = paymentMode?.trim().toLowerCase() ?? '';
    final normalizedMethod = paymentMethod?.trim().toLowerCase() ?? '';
    if (normalizedMode == 'token' || normalizedMethod == 'c2_credit') {
      return 'Credit';
    }
    if (normalizedMethod == 'manual_counter') {
      return 'Counter';
    }
    if (normalizedMethod.isNotEmpty) {
      return 'Online';
    }
    return 'Counter';
  }

  String get formattedStatusLabel {
    switch (status.trim().toLowerCase()) {
      case 'collected':
        return 'Collected';
      case 'ready_for_pickup':
        return 'Ready';
      case 'preparing':
        return 'Preparing';
      case 'accepted':
      case 'paid':
        return 'Paid';
      case 'cancelled':
        return 'Refunded';
      default:
        return status.trim().isEmpty ? 'Paid' : status.replaceAll('_', ' ');
    }
  }

  String get shortOrderRef {
    final match = RegExp(
      r'^C2-\d{6}-([A-Z0-9]+)$',
      caseSensitive: false,
    ).firstMatch(orderRef.trim());
    if (match != null) {
      return 'C2-${match.group(1)!.toUpperCase()}';
    }
    return orderRef;
  }
}

/// Stores this tablet's printer and sends kitchen dockets over the outlet Wi-Fi.
class DirectPrinterService {
  DirectPrinterService._();

  static final instance = DirectPrinterService._();

  static const _workstationKey = 'direct_printer_workstation_key';
  static const _printerHostKey = 'direct_printer_host';
  static const _printerPortKey = 'direct_printer_port';

  final FlutterSecureStorage _storage = const FlutterSecureStorage();
  final ApiClient _apiClient = ApiClient();
  final AuthService _authService = AuthService();
  static const MethodChannel _sunmiChannel = MethodChannel(
    'com.c2coffee.counter/sunmi_printer',
  );

  Future<bool> isSunmiAvailable() async {
    if (kIsWeb || !Platform.isAndroid) return false;
    try {
      final available = await _sunmiChannel.invokeMethod<bool>('isAvailable');
      return available ?? false;
    } catch (_) {
      return false;
    }
  }

  Future<String?> getSunmiStatus() async {
    if (kIsWeb || !Platform.isAndroid) return null;
    try {
      return await _sunmiChannel.invokeMethod<String>('getStatus');
    } catch (_) {
      return null;
    }
  }

  Future<String> workstationKey() async {
    final current = await _storage.read(key: _workstationKey);
    if (current != null && RegExp(r'^C2-[A-Z0-9]{12}$').hasMatch(current)) {
      return current;
    }
    final random = Random.secure();
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    final key =
        'C2-${List.generate(12, (_) => alphabet[random.nextInt(alphabet.length)]).join()}';
    await _storage.write(key: _workstationKey, value: key);
    return key;
  }

  Future<DirectPrinterConfig?> loadConfig() async {
    final host = (await _storage.read(key: _printerHostKey))?.trim() ?? '';
    final port = int.tryParse(await _storage.read(key: _printerPortKey) ?? '');
    if (host.isEmpty || port == null) return null;
    final config = DirectPrinterConfig(host: host, port: port);
    return isAllowedDirectPrinterConfig(config) ? config : null;
  }

  Future<void> saveConfig(DirectPrinterConfig config) async {
    if (!config.isConfigured || !isAllowedDirectPrinterConfig(config)) {
      throw StateError(
        'Use a private outlet Wi-Fi printer IPv4 address and port 9100.',
      );
    }
    final token = await _requiredDeviceToken();
    final key = await workstationKey();
    final response = await _apiClient.post(
      '/v1/counter/direct-printer/configure',
      {'network_host': config.host.trim(), 'network_port': config.port},
      token: token,
      headers: {'x-c2-workstation-key': key},
    );
    if (response.statusCode != 200) {
      throw StateError(_safeApiMessage(response.body, 'Printer setup failed.'));
    }
    await _storage.write(key: _printerHostKey, value: config.host.trim());
    await _storage.write(key: _printerPortKey, value: config.port.toString());
  }

  Future<void> clearConfig() async {
    final token = await _requiredDeviceToken();
    final key = await workstationKey();
    final response = await _apiClient.post(
      '/v1/counter/direct-printer/remove',
      const {},
      token: token,
      headers: {'x-c2-workstation-key': key},
    );
    if (response.statusCode != 200) {
      throw StateError(
        _safeApiMessage(response.body, 'Printer removal failed.'),
      );
    }
    await _storage.delete(key: _printerHostKey);
    await _storage.delete(key: _printerPortKey);
  }

  Future<void> confirmTestReceipt() async {
    final token = await _requiredDeviceToken();
    final key = await workstationKey();
    final response = await _apiClient.post(
      '/v1/counter/direct-printer/tested',
      const {},
      token: token,
      headers: {'x-c2-workstation-key': key},
    );
    if (response.statusCode != 200) {
      throw StateError(
        _safeApiMessage(response.body, 'Printer confirmation failed.'),
      );
    }
  }

  Future<String> _requiredDeviceToken() async {
    final token = await _authService.getToken();
    if (token == null || token.isEmpty) {
      throw StateError('This C2 Store device must be activated first.');
    }
    return token;
  }

  String _safeApiMessage(String body, String fallback) {
    try {
      final payload = jsonDecode(body) as Map<String, dynamic>;
      final error = payload['error'];
      if (error is Map<String, dynamic>) {
        final message = error['message']?.toString().trim();
        if (message != null && message.isNotEmpty) return message;
      }
    } catch (_) {
      // Return the stable fallback below.
    }
    return fallback;
  }

  Future<void> printJob(DirectPrintJob job) async {
    if (kIsWeb || !Platform.isAndroid) {
      throw StateError(
        'Direct receipt printing is available on an Android tablet.',
      );
    }
    await _send(job.config, await buildOrderDocket(job));
  }

  @visibleForTesting
  Future<List<int>> buildOrderDocket(DirectPrintJob job) {
    return job.isItemisedReceipt ? _itemisedReceipt(job) : _kitchenDocket(job);
  }

  Future<void> printMarketingDrink(MarketingDrinkPrintSlip slip) async {
    if (kIsWeb || !Platform.isAndroid) {
      throw StateError(
        'Direct receipt printing is available on an Android tablet.',
      );
    }
    await _send(slip.config, await _marketingDocket(slip));
  }

  Future<void> printShiftReport(ShiftReportPrintSlip slip) async {
    if (kIsWeb || !Platform.isAndroid) {
      throw StateError(
        'Direct receipt printing is available on an Android tablet.',
      );
    }
    await _send(slip.config, await buildShiftReportDocket(slip));
  }

  Future<void> printShiftSummaryReport(Map<String, dynamic> reportJson) async {
    final config = await loadConfig();
    if (config == null) {
      throw StateError(
        'Printer not configured. Set up a printer in Workstation settings first.',
      );
    }
    await printShiftReport(ShiftReportPrintSlip.fromJson(config, reportJson));
  }

  Future<void> printTestReceipt(DirectPrinterConfig config) async {
    if (kIsWeb || !Platform.isAndroid) {
      throw StateError(
        'Direct receipt printing is available on an Android tablet.',
      );
    }
    if (!config.isConfigured) {
      throw StateError(
        'Save the printer IP address before printing a test receipt.',
      );
    }
    await _send(config, await _testDocket(isSunmi: config.isSunmi));
  }

  Future<void> _send(DirectPrinterConfig config, List<int> bytes) async {
    if (config.isSunmi) {
      try {
        final success = await _sunmiChannel.invokeMethod<bool>('printRawData', {
          'data': Uint8List.fromList(bytes),
        });
        if (success != true) {
          throw StateError('Sunmi inner printer did not accept print data.');
        }
        return;
      } on PlatformException catch (e) {
        throw StateError('Sunmi inner printer error: ${e.message ?? e.code}');
      }
    }

    if (!isAllowedDirectPrinterConfig(config)) {
      throw StateError(
        'Printing was blocked because the destination is outside the private outlet network.',
      );
    }

    Socket? socket;
    try {
      socket = await Socket.connect(
        config.host,
        config.port,
        timeout: const Duration(seconds: 5),
      );
      socket.add(bytes);
      await socket.flush();
    } on SocketException catch (_) {
      throw StateError(
        'Could not reach ${config.host}:${config.port}. Check the tablet and printer are on the same Wi-Fi.',
      );
    } finally {
      await socket?.close();
    }
  }

  Future<List<int>> _kitchenDocket(DirectPrintJob order) async {
    final buffer = BytesBuilder();
    void write(String text) => buffer.add(latin1.encode(text));

    buffer.add(const [0x1B, 0x40]); // ESC @ - initialize printer.
    buffer.add(const [0x1B, 0x61, 0x01]); // Center.
    buffer.add(await _logoRaster());
    write('\n\n');
    buffer.add(const [0x1B, 0x45, 0x01]); // Bold on.
    write('C2 COFFEE\nNEW ORDER\n');
    buffer.add(const [0x1B, 0x45, 0x00]);
    write('${order.orderRef}\n${_formatPrintedTime(order.createdAt)}\n');
    buffer.add(const [0x1B, 0x61, 0x00]); // Left.
    _writeWrapped(buffer, 'Customer: ${order.printedCustomerName}');
    final roleLabel = order.subsidyRole == 'boss'
        ? 'Boss'
        : order.subsidyRole == 'intern'
        ? 'Intern'
        : order.customerIsEmployee
        ? 'Employee'
        : 'Customer';
    _writeWrapped(buffer, 'Customer role: $roleLabel');
    if (order.paymentMode == 'token') {
      final personalTokens = max(
        0,
        order.tokenAmountCharged - order.subsidyTokenAmount,
      );
      _writeWrapped(
        buffer,
        order.subsidyTokenAmount > 0
            ? 'Payment: ${order.subsidyTokenAmount} company allowance + $personalTokens personal C2 Credit tokens'
            : 'Payment: ${order.tokenAmountCharged} personal C2 Credit tokens',
      );
    } else {
      _writeWrapped(buffer, 'Payment: Direct RM');
    }
    if (order.voucherName != null && order.voucherName!.trim().isNotEmpty) {
      _writeWrapped(buffer, 'Voucher: ${order.voucherName}');
      if (order.voucherType == 'Manual Discount' &&
          order.voucherCode?.trim().isNotEmpty == true) {
        _writeWrapped(buffer, 'Remarks: ${order.voucherCode!.trim()}');
      }
      if (order.discount > 0) {
        _writeWrapped(
          buffer,
          'Discount: RM ${order.discount.toStringAsFixed(2)}',
        );
      }
      if (order.voucherDiscountTokens > 0) {
        _writeWrapped(
          buffer,
          'Discount: ${order.voucherDiscountTokens} C2 Credit tokens',
        );
      }
      if (order.voucherRewardSummary?.trim().isNotEmpty == true) {
        _writeWrapped(
          buffer,
          'Voucher applied to: ${order.voucherRewardSummary!.trim()}',
        );
      }
    }
    write('--------------------------------\n');
    for (final item in order.items) {
      if (item.isPromotionalAddon) {
        buffer.add(const [0x1B, 0x45, 0x01]);
        for (final line in receiptLinesForItem(item)) {
          _writeWrapped(buffer, line);
        }
        buffer.add(const [0x1B, 0x45, 0x00]);
      } else {
        final parsed = _printedItem(item);
        buffer.add(const [0x1B, 0x45, 0x01]);
        write('${parsed.quantity}x ${parsed.name}\n');
        buffer.add(const [0x1B, 0x45, 0x00]);
        for (final detail in item.details) {
          _writeWrapped(buffer, detail, indent: '   ');
        }
      }
      write('\n');
    }
    write('--------------------------------\n');
    buffer.add(const [0x1B, 0x61, 0x01]);
    write('Prepare with care\n\n\n');
    buffer.add(const [0x1D, 0x56, 0x00]); // Full cut.
    return buffer.toBytes();
  }

  Future<List<int>> _itemisedReceipt(DirectPrintJob order) async {
    final buffer = BytesBuilder();
    void write(String text) => buffer.add(latin1.encode(text));

    buffer.add(const [0x1B, 0x40]);
    buffer.add(const [0x1B, 0x61, 0x01]);
    buffer.add(await _logoRaster());
    write('\n\n');
    buffer.add(const [0x1B, 0x45, 0x01]);
    write('C2 COFFEE\nITEMISED RECEIPT\n');
    buffer.add(const [0x1B, 0x45, 0x00]);
    write('${order.orderRef}\n${_formatPrintedTime(order.createdAt)}\n');
    buffer.add(const [0x1B, 0x61, 0x00]);
    write('================================\n');
    _writeWrapped(buffer, 'Customer: ${order.printedCustomerName}');
    _writeWrapped(
      buffer,
      'Customer type: ${order.isGuest ? 'Walk-in' : 'Member'}',
    );
    _writeWrapped(
      buffer,
      'Fulfillment: ${_fulfillmentLabel(order.fulfillmentType)}',
    );
    write('--------------------------------\n');

    for (final item in order.items) {
      if (item.isPromotionalAddon) {
        buffer.add(const [0x1B, 0x45, 0x01]);
        for (final line in receiptLinesForItem(item)) {
          _writeWrapped(buffer, line);
        }
        buffer.add(const [0x1B, 0x45, 0x00]);
        write('\n');
        continue;
      }

      final parsed = _printedItem(item);
      buffer.add(const [0x1B, 0x45, 0x01]);
      _writeRow(
        buffer,
        '${parsed.quantity}x ${parsed.name}',
        order.paymentMode == 'token'
            ? '${item.lineTokenValue} tok'
            : 'RM ${item.lineTotalRm.toStringAsFixed(2)}',
      );
      buffer.add(const [0x1B, 0x45, 0x00]);
      if (parsed.quantity > 1) {
        _writeWrapped(
          buffer,
          order.paymentMode == 'token'
              ? '@ ${item.unitTokenValue} tok each'
              : '@ RM ${item.unitPriceRm.toStringAsFixed(2)} each',
          indent: '   ',
        );
      }
      for (final detail in item.details) {
        _writeWrapped(buffer, detail, indent: '   ');
      }
      write('\n');
    }

    write('--------------------------------\n');
    if (order.paymentMode == 'token') {
      final itemTokenTotal = order.items.fold<int>(
        0,
        (sum, item) => sum + item.lineTokenValue,
      );
      _writeWrapped(buffer, 'Subtotal: $itemTokenTotal C2 Credit tokens');
      if (order.voucherDiscountTokens > 0) {
        _writeWrapped(
          buffer,
          'Voucher discount: -${order.voucherDiscountTokens} tokens',
        );
      }
      if (order.giftCardTokenAmount > 0) {
        _writeWrapped(
          buffer,
          'Gift card: -${order.giftCardTokenAmount} tokens',
        );
      }
      if (order.priceCorrectionTokenAmount > 0) {
        _writeWrapped(
          buffer,
          'Price correction: -${order.priceCorrectionTokenAmount} tokens',
        );
      }
      buffer.add(const [0x1B, 0x45, 0x01]);
      _writeWrapped(
        buffer,
        'Final total: ${order.tokenAmountCharged} C2 Credit tokens',
      );
      buffer.add(const [0x1B, 0x45, 0x00]);
    } else {
      _writeWrapped(
        buffer,
        'Subtotal: RM ${order.subtotal.toStringAsFixed(2)}',
      );
      if (order.discount > 0) {
        _writeWrapped(
          buffer,
          'Discount: RM ${order.discount.toStringAsFixed(2)}',
        );
      }
      buffer.add(const [0x1B, 0x45, 0x01]);
      _writeWrapped(
        buffer,
        'Final total: RM ${order.finalTotal.toStringAsFixed(2)}',
      );
      buffer.add(const [0x1B, 0x45, 0x00]);
    }
    write('--------------------------------\n');
    _writeWrapped(buffer, 'Payment method: ${_paymentMethodLabel(order)}');
    if (order.paymentReference?.trim().isNotEmpty == true) {
      _writeWrapped(
        buffer,
        'Payment reference: ${order.paymentReference!.trim()}',
      );
    }
    write('================================\n');
    buffer.add(const [0x1B, 0x61, 0x01]);
    write('Thank you\n\n\n');
    buffer.add(const [0x1D, 0x56, 0x00]);
    return buffer.toBytes();
  }

  String _fulfillmentLabel(String value) {
    switch (value.trim().toLowerCase()) {
      case 'dine_in':
        return 'Dine In';
      case 'take_away':
        return 'Take Away';
      case 'pickup':
        return 'Pickup';
      default:
        return value.replaceAll('_', ' ');
    }
  }

  String _paymentMethodLabel(DirectPrintJob order) {
    if (order.paymentMode == 'token') return 'C2 Credit';
    switch (order.paymentMethod?.trim().toLowerCase()) {
      case 'manual_counter':
        return 'Counter';
      case 'manual_cash':
        return 'Cash';
      case 'manual_terminal':
        return 'Card Terminal';
      case 'duitnow_qr':
        return 'DuitNow QR';
      case 'ewallet':
        return 'E-wallet';
      case null:
      case '':
        return order.finalTotal == 0 ? 'Complimentary' : 'Direct RM';
      default:
        return order.paymentMethod!.replaceAll('_', ' ');
    }
  }

  Future<List<int>> _marketingDocket(MarketingDrinkPrintSlip slip) async {
    final buffer = BytesBuilder();
    void write(String text) => buffer.add(latin1.encode(text));
    buffer.add(const [0x1B, 0x40]);
    buffer.add(const [0x1B, 0x61, 0x01]);
    buffer.add(await _logoRaster());
    write('\n\n');
    buffer.add(const [0x1B, 0x45, 0x01]);
    write('COMPLIMENTARY / MARKETING\nNOT FOR SALE\n');
    buffer.add(const [0x1B, 0x45, 0x00]);
    write('${slip.usageRef}\n${_formatPrintedTime(slip.createdAt)}\n');
    buffer.add(const [0x1B, 0x61, 0x00]);
    _writeWrapped(buffer, 'Barista: ${slip.baristaName}');
    _writeWrapped(buffer, 'Purpose: ${slip.purpose}');
    if (slip.campaignName?.trim().isNotEmpty == true) {
      _writeWrapped(buffer, 'Campaign: ${slip.campaignName!.trim()}');
    }
    _writeWrapped(buffer, 'Reason: ${slip.reason}');
    write('--------------------------------\n');
    for (final item in slip.items) {
      buffer.add(const [0x1B, 0x45, 0x01]);
      write('${item.quantity}x ${item.name}\n');
      buffer.add(const [0x1B, 0x45, 0x00]);
    }
    write('--------------------------------\n');
    buffer.add(const [0x1B, 0x61, 0x01]);
    write('Inventory recorded\n\n\n');
    buffer.add(const [0x1D, 0x56, 0x00]);
    return buffer.toBytes();
  }

  @visibleForTesting
  Future<List<int>> buildShiftReportDocket(ShiftReportPrintSlip slip) async {
    final buffer = BytesBuilder();
    void write(String text) => buffer.add(latin1.encode(text));

    buffer.add(const [0x1B, 0x40]); // ESC @ - initialize printer.
    buffer.add(const [0x1B, 0x61, 0x01]); // Center.
    buffer.add(await _logoRaster());
    write('\n\n');
    buffer.add(const [0x1D, 0x21, 0x01]); // Tall font (2x height).
    buffer.add(const [0x1B, 0x45, 0x01]); // Bold on.
    write(
      slip.reportType == 'daily_summary'
          ? 'DAILY SHIFT SUMMARY\n'
          : 'SHIFT REPORT\n',
    );
    buffer.add(const [0x1D, 0x21, 0x00]); // Normal font size.
    buffer.add(const [0x1B, 0x45, 0x00]); // Bold off.
    write(
      slip.attendanceId > 0
          ? 'Report #${slip.attendanceId}\n'
          : 'All Shifts Today\n',
    );

    buffer.add(const [0x1B, 0x61, 0x00]); // Left.
    write('================================\n');
    _writeRow(buffer, 'Date', _formatPrintedDate(slip.clockedOutAt));
    if (slip.baristaName.length <= 22) {
      _writeRow(buffer, 'Barista', slip.baristaName);
    } else {
      _writeWrapped(buffer, 'Barista: ${slip.baristaName}');
    }
    _writeRow(
      buffer,
      'Shift',
      '${_formatPrintedClock(slip.clockedInAt)} - ${_formatPrintedClock(slip.clockedOutAt)}',
    );
    write('================================\n');

    buffer.add(const [0x1B, 0x45, 0x01]);
    write('SUMMARY\n');
    buffer.add(const [0x1B, 0x45, 0x00]);
    write('--------------------------------\n');
    _writeRow(buffer, 'Completed Orders', '${slip.orderCount}');
    _writeRow(buffer, 'Total Items', '${slip.totalItems}');
    if (slip.hasPaymentBreakdown) {
      write('--------------------------------\n');
      _writeRow(
        buffer,
        'Counter / RM',
        'RM ${slip.counterSales.toStringAsFixed(2)}',
      );
      _writeRow(
        buffer,
        'Online / RM',
        'RM ${slip.onlineSales.toStringAsFixed(2)}',
      );
      _writeRow(
        buffer,
        'Personal Credit (${slip.personalTokensUsed}t)',
        'RM ${slip.personalCreditSales.toStringAsFixed(2)}',
      );
      _writeRow(
        buffer,
        'Co. Allowance (${slip.allowanceTokensUsed}t)',
        'RM ${slip.allowanceSales.toStringAsFixed(2)}',
      );
    }
    write('--------------------------------\n');
    _writeRow(
      buffer,
      'Sales Excl. Allow.',
      'RM ${slip.salesExclAllowance.toStringAsFixed(2)}',
    );
    _writeRow(
      buffer,
      'Total Discounts',
      '-RM ${slip.discountTotal.toStringAsFixed(2)}',
    );
    _writeRow(buffer, 'Refunds', '-RM ${slip.refunded.toStringAsFixed(2)}');
    write('================================\n');
    buffer.add(const [0x1D, 0x21, 0x01]); // Tall bold NET SALES.
    buffer.add(const [0x1B, 0x45, 0x01]);
    _writeRow(
      buffer,
      'NET SALES',
      'RM ${slip.netSalesExclAllowance.toStringAsFixed(2)}',
    );
    buffer.add(const [0x1D, 0x21, 0x00]);
    buffer.add(const [0x1B, 0x45, 0x00]);
    write('================================\n');

    if (slip.items.isNotEmpty) {
      buffer.add(const [0x1B, 0x45, 0x01]);
      write('ITEM SUMMARY\n');
      buffer.add(const [0x1B, 0x45, 0x00]);
      write('--------------------------------\n');
      for (final item in slip.items) {
        _writeRow(buffer, item.name, '${item.quantity}x');
      }
      write('--------------------------------\n');
      buffer.add(const [0x1B, 0x45, 0x01]);
      _writeRow(buffer, 'TOTAL ITEMS', '${slip.totalItems}x');
      buffer.add(const [0x1B, 0x45, 0x00]);
    }
    write('================================\n');
    buffer.add(const [0x1B, 0x61, 0x01]);
    write(
      slip.reportType == 'daily_summary'
          ? 'End of summary\n\n\n'
          : 'Shift closed\n\n\n',
    );
    buffer.add(const [0x1D, 0x56, 0x00]);
    return buffer.toBytes();
  }

  void _writeRow(
    BytesBuilder buffer,
    String left,
    String right, {
    int width = 32,
  }) {
    final cleanRight = right.trim();
    if (left.length + 1 + cleanRight.length <= width) {
      final spaces = width - left.length - cleanRight.length;
      buffer.add(latin1.encode('$left${' ' * spaces}$cleanRight\n'));
      return;
    }

    final leading = RegExp(r'^\s*').firstMatch(left)?.group(0) ?? '';
    final words = left.trim().split(RegExp(r'\s+')).where((w) => w.isNotEmpty);
    var line = leading;
    final lines = <String>[];
    for (final word in words) {
      final separator = line.trim().isEmpty ? '' : ' ';
      if (line.length + separator.length + word.length > width &&
          line.trim().isNotEmpty) {
        lines.add(line);
        line = '$leading$word';
      } else {
        line = '$line$separator$word';
      }
    }
    if (line.trim().isNotEmpty || lines.isEmpty) {
      lines.add(line);
    }
    for (var i = 0; i < lines.length - 1; i++) {
      buffer.add(latin1.encode('${lines[i]}\n'));
    }

    var lastLeft = lines.last;
    final maxLastLeft = width - cleanRight.length - 1;
    if (lastLeft.length > maxLastLeft) {
      if (maxLastLeft >= 3) {
        lastLeft = '${lastLeft.substring(0, maxLastLeft - 2)}..';
      } else if (maxLastLeft > 0) {
        lastLeft = lastLeft.substring(0, maxLastLeft);
      } else {
        lastLeft = '';
      }
    }
    final spaces = (width - lastLeft.length - cleanRight.length).clamp(
      1,
      width,
    );
    buffer.add(latin1.encode('$lastLeft${' ' * spaces}$cleanRight\n'));
  }

  String _formatPrintedDate(DateTime time) {
    final local = time.toLocal();
    String pad(int value) => value.toString().padLeft(2, '0');
    return '${local.year}-${pad(local.month)}-${pad(local.day)}';
  }

  String _formatPrintedClock(DateTime time) {
    final local = time.toLocal();
    String pad(int value) => value.toString().padLeft(2, '0');
    return '${pad(local.hour)}:${pad(local.minute)}';
  }

  ({int quantity, String name}) _printedItem(DirectPrintItem item) {
    final match = RegExp(
      r'^\s*(\d+)\s*x\s+(.+)$',
      caseSensitive: false,
    ).firstMatch(item.name);
    if (match == null) return (quantity: item.quantity, name: item.name);
    return (
      quantity: int.tryParse(match.group(1)!) ?? item.quantity,
      name: match.group(2)!.trim(),
    );
  }

  void _writeWrapped(BytesBuilder buffer, String text, {String indent = ''}) {
    const maxColumns = 32;
    final words = text.split(RegExp(r'\s+')).where((word) => word.isNotEmpty);
    var line = indent;
    for (final word in words) {
      final separator = line.trim().isEmpty ? '' : ' ';
      if (line.length + separator.length + word.length > maxColumns &&
          line.trim().isNotEmpty) {
        buffer.add(latin1.encode('$line\n'));
        line = '$indent$word';
      } else {
        line = '$line$separator$word';
      }
    }
    if (line.trim().isNotEmpty) buffer.add(latin1.encode('$line\n'));
  }

  String _formatPrintedTime(DateTime time) {
    final local = time.toLocal();
    String pad(int value) => value.toString().padLeft(2, '0');
    return '${local.year}-${pad(local.month)}-${pad(local.day)} '
        '${pad(local.hour)}:${pad(local.minute)}';
  }

  Future<List<int>> _logoRaster() async {
    try {
      final asset = await rootBundle.load('assets/images/c2_logo_black.png');
      final decoded = image.decodeImage(asset.buffer.asUint8List());
      if (decoded == null) return const [];
      final resized = image.copyResize(decoded, width: 160);
      final bytesPerRow = (resized.width + 7) ~/ 8;
      final pixels = List<int>.filled(bytesPerRow * resized.height, 0);
      for (var y = 0; y < resized.height; y++) {
        for (var x = 0; x < resized.width; x++) {
          final pixel = resized.getPixel(x, y);
          final isDark = pixel.a > 32 && pixel.r + pixel.g + pixel.b < 600;
          if (isDark) {
            pixels[y * bytesPerRow + x ~/ 8] |= 0x80 >> (x % 8);
          }
        }
      }
      return <int>[
        0x1D,
        0x76,
        0x30,
        0x00,
        bytesPerRow & 0xFF,
        bytesPerRow >> 8,
        resized.height & 0xFF,
        resized.height >> 8,
        ...pixels,
      ];
    } catch (_) {
      // A logo failure must not prevent a paid order from printing.
      return const [];
    }
  }

  Future<List<int>> _testDocket({bool isSunmi = false}) async {
    final buffer = BytesBuilder();
    buffer.add(const [0x1B, 0x40, 0x1B, 0x61, 0x01]);
    buffer.add(await _logoRaster());
    buffer.add(latin1.encode('\n\nC2 COFFEE\nPRINTER TEST\n\n'));
    buffer.add(const [0x1B, 0x61, 0x00]);
    buffer.add(
      latin1.encode(
        isSunmi
            ? 'Sunmi D3 Mini Inner Printer.\nConnection successful.\nReady for new orders.\n\n\n'
            : 'Connection successful.\nThis printer is ready for new orders.\n\n\n',
      ),
    );
    buffer.add(const [0x1D, 0x56, 0x00]);
    return buffer.toBytes();
  }
}
