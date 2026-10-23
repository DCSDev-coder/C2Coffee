import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';

import 'api_client.dart';
import 'auth_service.dart';
import 'barista/services/barista_sound_service.dart';
import 'barista/services/api_service.dart';
import 'barista/services/direct_printer_service.dart';

/// Polls the durable print queue with the activated outlet-device credential.
///
/// This worker belongs to the application shell, so changing between Counter
/// and Barista workspaces or signing a staff member out does not stop printing.
class DevicePrinterWorker {
  DevicePrinterWorker({required AuthService authService})
    : _authService = authService;

  static const Duration _pollInterval = Duration(seconds: 5);

  final AuthService _authService;
  final ApiClient _apiClient = ApiClient();
  Timer? _timer;
  bool _polling = false;

  final ValueNotifier<String?> lastError = ValueNotifier<String?>(null);

  void start() {
    if (_timer != null) return;
    unawaited(_poll());
    _timer = Timer.periodic(_pollInterval, (_) => unawaited(_poll()));
  }

  void stop() {
    _timer?.cancel();
    _timer = null;
  }

  void dispose() {
    stop();
    lastError.dispose();
  }

  Future<void> _poll() async {
    if (_polling) return;
    _polling = true;
    try {
      final token = await _authService.getToken();
      if (token == null || token.isEmpty) return;
      final workstationKey = await DirectPrinterService.instance
          .workstationKey();

      while (true) {
        final response = await _apiClient.post(
          '/v1/counter/direct-print-jobs/claim',
          const {},
          token: token,
          headers: {'x-c2-workstation-key': workstationKey},
        );
        if (response.statusCode == 204) {
          lastError.value = null;
          return;
        }
        if (response.statusCode != 200) {
          lastError.value = _safeMessage(
            response.body,
            'Printer queue unavailable (${response.statusCode}).',
          );
          return;
        }

        final payload = jsonDecode(response.body) as Map<String, dynamic>;
        final soundSettings = BaristaSoundSettings.fromJson(
          payload['sound_settings'] as Map<String, dynamic>? ?? const {},
        );
        BaristaSoundService.instance.configure(soundSettings);
        final job = _parseJobPayload(payload);
        try {
          // Start both actions from the same claimed print job. A sound
          // failure must never prevent the order from being printed.
          final beep = BaristaSoundService.instance
              .play(BaristaSoundEvent.incomingOrder)
              .catchError((_) {});
          await Future.wait<void>([
            beep,
            DirectPrinterService.instance.printJob(job),
          ]);
          await _acknowledge(
            token: token,
            workstationKey: workstationKey,
            jobRef: job.jobRef,
            printed: true,
          );
          lastError.value = null;
        } catch (error) {
          lastError.value = error.toString().replaceFirst('Bad state: ', '');
          try {
            await _acknowledge(
              token: token,
              workstationKey: workstationKey,
              jobRef: job.jobRef,
              printed: false,
              errorCode: 'device_print_failed',
            );
          } catch (_) {
            // An unacknowledged dispatch is made available by the server lease.
          }
          return;
        }
      }
    } catch (error) {
      lastError.value = 'Printer worker could not reach the server.';
      debugPrint('Device printer worker failed: $error');
    } finally {
      _polling = false;
    }
  }

  DirectPrintJob _parseJobPayload(Map<String, dynamic> json) {
    final printer = json['printer'] as Map<String, dynamic>;
    final order = json['order'] as Map<String, dynamic>;
    return DirectPrintJob(
      jobRef: json['job_ref'].toString(),
      config: DirectPrinterConfig(
        host: printer['host'].toString(),
        port: (printer['port'] as num).toInt(),
      ),
      orderRef: order['order_ref'].toString(),
      customerName: order['customer_name']?.toString().trim().isNotEmpty == true
          ? order['customer_name'].toString().trim()
          : 'Guest',
      customerIsEmployee: order['is_employee'] == true,
      createdAt: DateTime.parse(order['created_at'].toString()),
      items: (order['items'] as List).map((item) {
        final value = item as Map<String, dynamic>;
        return DirectPrintItem(
          name: value['name'].toString(),
          quantity: (value['quantity'] as num).toInt(),
          details: (value['details'] as List? ?? const [])
              .map((detail) => detail.toString())
              .toList(),
        );
      }).toList(),
    );
  }

  Future<void> _acknowledge({
    required String token,
    required String workstationKey,
    required String jobRef,
    required bool printed,
    String? errorCode,
  }) async {
    final response = await _apiClient.post(
      '/v1/counter/direct-print-jobs/acknowledge',
      {
        'job_ref': jobRef,
        'outcome': printed ? 'printed' : 'failed',
        'error_code': ?errorCode,
      },
      token: token,
      headers: {'x-c2-workstation-key': workstationKey},
    );
    if (response.statusCode != 200) {
      throw StateError(
        _safeMessage(response.body, 'The print result was not acknowledged.'),
      );
    }
  }

  String _safeMessage(String body, String fallback) {
    try {
      final payload = jsonDecode(body) as Map<String, dynamic>;
      final error = payload['error'];
      if (error is Map<String, dynamic>) {
        final message = error['message'];
        if (message is String && message.trim().isNotEmpty) return message;
      }
    } catch (_) {
      // Return the safe local message for malformed server responses.
    }
    return fallback;
  }
}
