import 'dart:async';
import 'dart:io';

import 'package:firebase_messaging/firebase_messaging.dart';

import 'auth_api_service.dart';
import 'secure_session_service.dart';

@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  // Notification handling is delegated to the operating system in the background.
}

class PushNotificationService {
  PushNotificationService._();

  static final instance = PushNotificationService._();

  StreamSubscription<String>? _tokenRefreshSubscription;
  bool _initialized = false;

  Future<void> initialize() async {
    if (_initialized) return;

    await FirebaseMessaging.instance.setForegroundNotificationPresentationOptions(
      alert: true,
      badge: true,
      sound: true,
    );
    _tokenRefreshSubscription = FirebaseMessaging.instance.onTokenRefresh.listen(
      _registerToken,
    );
    _initialized = true;
  }

  Future<void> syncAfterSignIn() async {
    await initialize();

    final permission = await FirebaseMessaging.instance.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );
    if (permission.authorizationStatus != AuthorizationStatus.authorized &&
        permission.authorizationStatus != AuthorizationStatus.provisional) {
      return;
    }

    final token = await FirebaseMessaging.instance.getToken();
    if (token != null && token.isNotEmpty) {
      await _registerToken(token);
    }
  }

  Future<void> deactivateForCurrentSession() async {
    final accessToken =
        await SecureSessionService.instance.getValidAccessToken();
    final pushToken = await FirebaseMessaging.instance.getToken();
    if (accessToken == null || accessToken.isEmpty ||
        pushToken == null || pushToken.isEmpty) {
      return;
    }

    await AuthApiService.instance.deactivatePushToken(
      accessToken: accessToken,
      pushToken: pushToken,
    );
  }

  Future<void> _registerToken(String pushToken) async {
    try {
      final accessToken =
          await SecureSessionService.instance.getValidAccessToken();
      if (accessToken == null || accessToken.isEmpty) return;

      final deviceFingerprint =
          await AuthApiService.instance.getOrCreateDeviceFingerprint();
      await AuthApiService.instance.registerPushToken(
        accessToken: accessToken,
        deviceFingerprint: deviceFingerprint,
        platform: Platform.isIOS ? 'ios' : 'android',
        pushToken: pushToken,
      );
    } catch (_) {
      // A delivery registration failure must not interrupt sign-in or app use.
    }
  }

  void dispose() {
    _tokenRefreshSubscription?.cancel();
    _tokenRefreshSubscription = null;
    _initialized = false;
  }
}
