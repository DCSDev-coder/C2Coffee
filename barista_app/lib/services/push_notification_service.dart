import 'dart:async';
import 'dart:io';

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';

import 'api_service.dart';

@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  // The operating system presents the generic alert while the app is backgrounded.
}

class PushNotificationService {
  PushNotificationService._();

  static final instance = PushNotificationService._();

  StreamSubscription<String>? _tokenRefreshSubscription;
  StreamSubscription<RemoteMessage>? _foregroundSubscription;
  StreamSubscription<RemoteMessage>? _openedSubscription;
  Future<void> Function()? _onNewOrder;
  bool _initialized = false;

  Future<void> initialize() async {
    // The Barista web build has no Firebase web configuration. Push is a
    // mobile-only enhancement and must not block web sign-in or navigation.
    if (kIsWeb) return;
    if (_initialized) return;

    await FirebaseMessaging.instance.setForegroundNotificationPresentationOptions(
      alert: true,
      badge: true,
      sound: true,
    );
    _tokenRefreshSubscription = FirebaseMessaging.instance.onTokenRefresh.listen(
      _registerToken,
    );
    _foregroundSubscription = FirebaseMessaging.onMessage.listen(_handleMessage);
    _openedSubscription = FirebaseMessaging.onMessageOpenedApp.listen(_handleMessage);
    _initialized = true;
  }

  void setNewOrderHandler(Future<void> Function()? handler) {
    _onNewOrder = handler;
  }

  Future<void> syncAfterSignIn() async {
    if (kIsWeb) return;
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
    await _registerCurrentToken();
  }

  Future<void> syncExistingSession() async {
    if (kIsWeb) return;
    await initialize();
    final permission = await FirebaseMessaging.instance.getNotificationSettings();
    if (permission.authorizationStatus != AuthorizationStatus.authorized &&
        permission.authorizationStatus != AuthorizationStatus.provisional) {
      return;
    }
    await _registerCurrentToken();
  }

  Future<void> deactivateForCurrentSession() async {
    if (kIsWeb) return;
    final pushToken = await FirebaseMessaging.instance.getToken();
    if (pushToken == null || pushToken.isEmpty || !ApiService.isSignedIn) return;
    await ApiService.deactivatePushToken(pushToken);
  }

  Future<void> _registerCurrentToken() async {
    final token = await FirebaseMessaging.instance.getToken();
    if (token != null && token.isNotEmpty) await _registerToken(token);
  }

  Future<void> _registerToken(String pushToken) async {
    try {
      if (!ApiService.isSignedIn) return;
      await ApiService.registerPushToken(
        platform: Platform.isIOS ? 'ios' : 'android',
        pushToken: pushToken,
      );
    } catch (_) {
      // Notification registration must never interrupt barista sign-in.
    }
  }

  void _handleMessage(RemoteMessage message) {
    // Ignore unrecognised payloads. The server never includes order or customer
    // details in the push; the handler refreshes the authorised queue instead.
    if (message.data['type'] != 'new_order') return;
    final handler = _onNewOrder;
    if (handler != null) unawaited(handler());
  }

  void dispose() {
    _tokenRefreshSubscription?.cancel();
    _foregroundSubscription?.cancel();
    _openedSubscription?.cancel();
    _tokenRefreshSubscription = null;
    _foregroundSubscription = null;
    _openedSubscription = null;
    _onNewOrder = null;
    _initialized = false;
  }
}
