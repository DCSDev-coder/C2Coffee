import 'dart:async';
import 'dart:developer' as developer;

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_crashlytics/firebase_crashlytics.dart';
import 'package:flutter/foundation.dart';

class AppDiagnostics {
  const AppDiagnostics._();

  static Future<void> initialize() async {
    FlutterError.onError = (details) {
      developer.log(
        details.exceptionAsString(),
        name: 'counter_app.flutter',
        error: details.exception,
        stackTrace: details.stack,
      );
      unawaited(_recordFlutterError(details));
    };

    PlatformDispatcher.instance.onError = (error, stack) {
      developer.log(
        'Unhandled platform error',
        name: 'counter_app.platform',
        error: error,
        stackTrace: stack,
      );
      unawaited(_recordError(error, stack, fatal: true));
      return true;
    };

    try {
      await Firebase.initializeApp();
      await FirebaseCrashlytics.instance.setCrashlyticsCollectionEnabled(true);
    } on Object catch (error, stack) {
      developer.log(
        'Crashlytics is not configured for this build.',
        name: 'counter_app.diagnostics',
        error: error,
        stackTrace: stack,
      );
    }
  }

  static Future<void> _recordFlutterError(FlutterErrorDetails details) {
    return _recordError(
      details.exception,
      details.stack ?? StackTrace.current,
      fatal: true,
    );
  }

  static Future<void> _recordError(
    Object error,
    StackTrace stack, {
    required bool fatal,
  }) async {
    try {
      if (Firebase.apps.isNotEmpty) {
        await FirebaseCrashlytics.instance.recordError(
          error,
          stack,
          fatal: fatal,
        );
      }
    } on Object catch (recordingError, recordingStack) {
      developer.log(
        'Unable to record diagnostics.',
        name: 'counter_app.diagnostics',
        error: recordingError,
        stackTrace: recordingStack,
      );
    }
  }
}
