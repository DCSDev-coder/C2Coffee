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

class DirectPrinterConfig {
  const DirectPrinterConfig({required this.host, required this.port});

  static const sunmiHost = 'sunmi_inner';

  final String host;
  final int port;

  bool get isConfigured => host.isNotEmpty;
  bool get isSunmi => host == sunmiHost;
  String get displayName => isSunmi ? 'Sunmi Inner Printer (Built-in)' : '$host:$port';
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
  });

  final String jobRef;
  final DirectPrinterConfig config;
  final String orderRef;
  final String customerName;
  final bool customerIsEmployee;
  final DateTime createdAt;
  final List<DirectPrintItem> items;

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
  static const MethodChannel _sunmiChannel =
      MethodChannel('com.c2coffee.counter/sunmi_printer');

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
    if (host.isEmpty || port == null || port < 1 || port > 65535) return null;
    return DirectPrinterConfig(host: host, port: port);
  }

  Future<void> saveConfig(DirectPrinterConfig config) async {
    if (!config.isConfigured || config.port < 1 || config.port > 65535) {
      throw StateError('Enter a valid printer IP address and port.');
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
        final success = await _sunmiChannel.invokeMethod<bool>(
          'printRawData',
          {'data': Uint8List.fromList(bytes)},
        );
        if (success != true) {
          throw StateError('Sunmi inner printer did not accept print data.');
        }
        return;
      } on PlatformException catch (e) {
        throw StateError('Sunmi inner printer error: ${e.message ?? e.code}');
      }
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
