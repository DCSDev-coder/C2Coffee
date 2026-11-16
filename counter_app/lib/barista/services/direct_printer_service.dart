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
    required this.config,
    required this.orderRef,
    required this.customerName,
    required this.customerIsEmployee,
    required this.createdAt,
    required this.items,
    this.voucherName,
    this.voucherType,
    this.voucherCode,
    this.discount = 0,
  });

  final String jobRef;
  final DirectPrinterConfig config;
  final String orderRef;
  final String customerName;
  final bool customerIsEmployee;
  final DateTime createdAt;
  final List<DirectPrintItem> items;
  final String? voucherName;
  final String? voucherType;
  final String? voucherCode;
  final double discount;

  String get printedCustomerName =>
      customerIsEmployee ? '$customerName (Employee)' : customerName;
}

class DirectPrintItem {
  const DirectPrintItem({
    required this.name,
    required this.quantity,
    this.details = const [],
  });
  final String name;
  final int quantity;
  final List<String> details;
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
    required this.attendanceId,
    required this.baristaName,
    required this.clockedInAt,
    required this.clockedOutAt,
    required this.orderCount,
    required this.grossSales,
    required this.refunded,
    required this.netSales,
    required this.orders,
    required this.items,
  });

  factory ShiftReportPrintSlip.fromJson(
    DirectPrinterConfig config,
    Map<String, dynamic> json,
  ) {
    double money(Object? value) =>
        double.tryParse(value?.toString() ?? '') ?? 0;
    return ShiftReportPrintSlip(
      config: config,
      attendanceId: int.tryParse(json['attendance_id']?.toString() ?? '') ?? 0,
      baristaName: json['barista_name']?.toString() ?? 'Barista',
      clockedInAt: DateTime.parse(json['clocked_in_at'].toString()),
      clockedOutAt: DateTime.parse(json['clocked_out_at'].toString()),
      orderCount: int.tryParse(json['order_count']?.toString() ?? '') ?? 0,
      grossSales: money(json['gross_sales_rm']),
      refunded: money(json['refunded_rm']),
      netSales: money(json['net_sales_rm']),
      orders: (json['orders'] as List? ?? const [])
          .whereType<Map>()
          .map(
            (order) => ShiftReportOrder(
              orderRef: order['order_ref']?.toString() ?? '',
              dailyOrderNumber:
                  int.tryParse(order['daily_order_number']?.toString() ?? '') ??
                  0,
              status: order['status']?.toString() ?? '',
              paymentMethod: order['payment_method']?.toString(),
              finalTotal: money(order['final_total_rm']),
              discount: money(order['discount_total_rm']),
              refunded: money(order['refunded_rm']),
              createdAt: DateTime.parse(order['created_at'].toString()),
            ),
          )
          .toList(),
      items: (json['items'] as List? ?? const [])
          .whereType<Map>()
          .map(
            (item) => DirectPrintItem(
              name: item['name']?.toString() ?? 'Item',
              quantity: int.tryParse(item['quantity']?.toString() ?? '') ?? 0,
            ),
          )
          .toList(),
    );
  }

  final DirectPrinterConfig config;
  final int attendanceId;
  final String baristaName;
  final DateTime clockedInAt;
  final DateTime clockedOutAt;
  final int orderCount;
  final double grossSales;
  final double refunded;
  final double netSales;
  final List<ShiftReportOrder> orders;
  final List<DirectPrintItem> items;
}

class ShiftReportOrder {
  const ShiftReportOrder({
    required this.orderRef,
    required this.dailyOrderNumber,
    required this.status,
    required this.paymentMethod,
    required this.finalTotal,
    required this.discount,
    required this.refunded,
    required this.createdAt,
  });

  final String orderRef;
  final int dailyOrderNumber;
  final String status;
  final String? paymentMethod;
  final double finalTotal;
  final double discount;
  final double refunded;
  final DateTime createdAt;
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
    await _send(job.config, await _kitchenDocket(job));
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
    await _send(slip.config, await _shiftReportDocket(slip));
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
    }
    write('--------------------------------\n');
    for (final item in order.items) {
      final parsed = _printedItem(item);
      buffer.add(const [0x1B, 0x45, 0x01]);
      write('${parsed.quantity}x ${parsed.name}\n');
      buffer.add(const [0x1B, 0x45, 0x00]);
      for (final detail in item.details) {
        _writeWrapped(buffer, detail, indent: '   ');
      }
      write('\n');
    }
    write('--------------------------------\n');
    buffer.add(const [0x1B, 0x61, 0x01]);
    write('Prepare with care\n\n\n');
    buffer.add(const [0x1D, 0x56, 0x00]); // Full cut.
    return buffer.toBytes();
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

  Future<List<int>> _shiftReportDocket(ShiftReportPrintSlip slip) async {
    final buffer = BytesBuilder();
    void write(String text) => buffer.add(latin1.encode(text));
    buffer.add(const [0x1B, 0x40]);
    buffer.add(const [0x1B, 0x61, 0x01]);
    buffer.add(await _logoRaster());
    write('\n\n');
    buffer.add(const [0x1B, 0x45, 0x01]);
    write('END OF SHIFT\n');
    buffer.add(const [0x1B, 0x45, 0x00]);
    write('Report #${slip.attendanceId}\n');
    buffer.add(const [0x1B, 0x61, 0x00]);
    _writeWrapped(buffer, 'Barista: ${slip.baristaName}');
    _writeWrapped(buffer, 'Start: ${_formatPrintedTime(slip.clockedInAt)}');
    _writeWrapped(buffer, 'End: ${_formatPrintedTime(slip.clockedOutAt)}');
    write('--------------------------------\n');
    _writeWrapped(buffer, 'Orders: ${slip.orderCount}');
    _writeWrapped(
      buffer,
      'Sales after discounts: RM ${slip.grossSales.toStringAsFixed(2)}',
    );
    _writeWrapped(buffer, 'Refunds: RM ${slip.refunded.toStringAsFixed(2)}');
    buffer.add(const [0x1B, 0x45, 0x01]);
    _writeWrapped(buffer, 'Net sales: RM ${slip.netSales.toStringAsFixed(2)}');
    buffer.add(const [0x1B, 0x45, 0x00]);
    if (slip.orders.isNotEmpty) {
      write('--------------------------------\nORDERS\n');
      for (final order in slip.orders) {
        final number = order.dailyOrderNumber > 0
            ? '#${order.dailyOrderNumber}'
            : order.orderRef;
        _writeWrapped(
          buffer,
          '$number ${_formatPrintedTime(order.createdAt).substring(11)} '
          'RM ${order.finalTotal.toStringAsFixed(2)}',
        );
        _writeWrapped(
          buffer,
          '${order.status} - ${order.paymentMethod ?? 'unpaid'}',
          indent: '  ',
        );
        if (order.discount > 0) {
          _writeWrapped(
            buffer,
            'Discount RM ${order.discount.toStringAsFixed(2)}',
            indent: '  ',
          );
        }
        if (order.refunded > 0) {
          _writeWrapped(
            buffer,
            'Refunded RM ${order.refunded.toStringAsFixed(2)}',
            indent: '  ',
          );
        }
      }
    }
    if (slip.items.isNotEmpty) {
      write('--------------------------------\nITEM SUMMARY\n');
      for (final item in slip.items) {
        _writeWrapped(buffer, '${item.quantity}x ${item.name}');
      }
    }
    write('--------------------------------\n');
    buffer.add(const [0x1B, 0x61, 0x01]);
    write('Shift closed\n\n\n');
    buffer.add(const [0x1D, 0x56, 0x00]);
    return buffer.toBytes();
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
