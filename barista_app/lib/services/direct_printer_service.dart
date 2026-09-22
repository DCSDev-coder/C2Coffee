import 'dart:convert';
import 'dart:io';
import 'dart:math';
import 'dart:typed_data';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:image/image.dart' as image;

import '../widgets/order_card.dart';

class DirectPrinterConfig {
  const DirectPrinterConfig({required this.host, required this.port});

  final String host;
  final int port;

  bool get isConfigured => host.isNotEmpty;
}

class DirectPrintJob {
  const DirectPrintJob({
    required this.jobRef,
    required this.config,
    required this.orderRef,
    required this.customerName,
    required this.createdAt,
    required this.items,
  });

  final String jobRef;
  final DirectPrinterConfig config;
  final String orderRef;
  final String customerName;
  final DateTime createdAt;
  final List<DirectPrintItem> items;
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
  static const _observedOrderRefsKey = 'direct_printer_observed_order_refs';

  final FlutterSecureStorage _storage = const FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
  );

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
    await _storage.write(key: _printerHostKey, value: config.host.trim());
    await _storage.write(key: _printerPortKey, value: config.port.toString());
  }

  Future<void> clearConfig() async {
    await _storage.delete(key: _printerHostKey);
    await _storage.delete(key: _printerPortKey);
  }

  /// Prevents an acknowledged server print job from being reprinted by the
  /// legacy order-polling fallback.
  Future<void> markOrderObserved(String orderRef) async {
    final stored = await _storage.read(key: _observedOrderRefsKey);
    final known = stored == null
        ? <String>{}
        : ((jsonDecode(stored) as List<dynamic>).whereType<String>().toSet());
    known.add(orderRef);
    await _saveObservedOrders(known);
  }

  /// Prints each newly seen active order once. Existing orders are remembered
  /// as a baseline so connecting a printer never reprints the current queue.
  Future<void> printNewOrders(List<CurrentOrder> orders) async {
    if (kIsWeb || !Platform.isAndroid) return;

    final stored = await _storage.read(key: _observedOrderRefsKey);
    final known = stored == null
        ? <String>{}
        : ((jsonDecode(stored) as List<dynamic>).whereType<String>().toSet());
    final config = await loadConfig();
    final active =
        orders
            .where(
              (order) =>
                  order.status != OrderStatus.completed &&
                  order.status != OrderStatus.readyForPickup,
            )
            .toList()
          ..sort((left, right) => left.orderDate.compareTo(right.orderDate));

    if (stored == null || config == null) {
      known.addAll(active.map((order) => order.orderId));
      await _saveObservedOrders(known);
      return;
    }

    for (final order in active.where(
      (order) => !known.contains(order.orderId),
    )) {
      await _send(
        config,
        await _kitchenDocket(
          DirectPrintJob(
            jobRef: order.orderId,
            config: config,
            orderRef: order.orderId,
            customerName: order.customerDetails.split(' - ').first.trim(),
            createdAt: order.orderDate,
            items: order.items
                .map(
                  (item) => DirectPrintItem(
                    name: item.title,
                    quantity: 1,
                    details: item.tags,
                  ),
                )
                .toList(),
          ),
        ),
      );
      known.add(order.orderId);
      await _saveObservedOrders(known);
    }
  }

  Future<void> _saveObservedOrders(Set<String> refs) async {
    final trimmed = refs.toList()..sort();
    if (trimmed.length > 300) {
      trimmed.removeRange(0, trimmed.length - 300);
    }
    await _storage.write(
      key: _observedOrderRefsKey,
      value: jsonEncode(trimmed),
    );
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
    await _send(config, await _testDocket());
  }

  Future<void> _send(DirectPrinterConfig config, List<int> bytes) async {
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
    _writeWrapped(buffer, 'Customer: ${order.customerName}');
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

  Future<List<int>> _testDocket() async {
    final buffer = BytesBuilder();
    buffer.add(const [0x1B, 0x40, 0x1B, 0x61, 0x01]);
    buffer.add(await _logoRaster());
    buffer.add(latin1.encode('\n\nC2 COFFEE\nPRINTER TEST\n\n'));
    buffer.add(const [0x1B, 0x61, 0x00]);
    buffer.add(
      latin1.encode(
        'Connection successful.\nThis printer is ready for new orders.\n\n\n',
      ),
    );
    buffer.add(const [0x1D, 0x56, 0x00]);
    return buffer.toBytes();
  }
}
