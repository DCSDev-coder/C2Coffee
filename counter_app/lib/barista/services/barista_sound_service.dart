import 'dart:async';

import 'package:flutter/services.dart';

import 'api_service.dart';

enum BaristaSoundEvent { incomingOrder, clockIn, clockOut, sideWork }

class BaristaSoundService {
  BaristaSoundService._();

  static final BaristaSoundService instance = BaristaSoundService._();
  static const MethodChannel _channel = MethodChannel(
    'com.c2coffee.counter/barista_sounds',
  );

  BaristaSoundSettings _settings = const BaristaSoundSettings.defaults();

  void configure(BaristaSoundSettings settings) {
    _settings = settings;
  }

  Future<void> play(BaristaSoundEvent event) async {
    if (event == BaristaSoundEvent.incomingOrder &&
        !_settings.incomingOrderEnabled) {
      return;
    }
    final count = switch (event) {
      BaristaSoundEvent.incomingOrder => _settings.incomingOrderBeeps,
      BaristaSoundEvent.clockIn => _settings.clockInBeeps,
      BaristaSoundEvent.clockOut => _settings.clockOutBeeps,
      BaristaSoundEvent.sideWork => _settings.sideWorkBeeps,
    };
    final style = switch (event) {
      BaristaSoundEvent.incomingOrder => _settings.incomingOrderStyle,
      BaristaSoundEvent.clockIn => _settings.clockInStyle,
      BaristaSoundEvent.clockOut => _settings.clockOutStyle,
      BaristaSoundEvent.sideWork => _settings.sideWorkStyle,
    };
    if (_settings.volumePercent <= 0) return;

    try {
      await _channel.invokeMethod<void>('playBeeps', {
        'count': count,
        'volumePercent': _settings.volumePercent,
        'style': style,
      });
    } on MissingPluginException {
      await _fallback(count, style);
    } on PlatformException {
      await _fallback(count, style);
    }
  }

  Future<void> _fallback(int count, String style) async {
    // Non-Android builds cannot independently control system volume, but still
    // preserve the configured recognition pattern.
    for (var index = 0; index < count; index += 1) {
      await SystemSound.play(SystemSoundType.alert);
      if (index < count - 1) {
        await Future<void>.delayed(
          Duration(milliseconds: style == 'long' ? 760 : 240),
        );
      }
    }
  }
}
