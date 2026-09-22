import 'dart:async';
import 'dart:io';

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

import 'auth_api_service.dart';
import 'app_session_service.dart';
import 'secure_session_service.dart';
import '../utils/app_notification.dart';
import '../screens/my_rewards_page.dart';
import '../screens/notification_page.dart';
import '../screens/orders_page.dart';

const _customerNotificationChannelId = 'c2_order_updates';
const _customerNotificationChannelName = 'C2 updates';

@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  // Notification handling is delegated to the operating system in the background.
}

class PushNotificationService {
  PushNotificationService._();

  static final instance = PushNotificationService._();

  StreamSubscription<String>? _tokenRefreshSubscription;
  StreamSubscription<RemoteMessage>? _foregroundSubscription;
  StreamSubscription<RemoteMessage>? _openedSubscription;
  final FlutterLocalNotificationsPlugin _localNotifications =
      FlutterLocalNotificationsPlugin();
  bool _initialized = false;

  Future<void> initialize() async {
    if (_initialized) return;

    await FirebaseMessaging.instance
        .setForegroundNotificationPresentationOptions(
      alert: true,
      badge: true,
      sound: true,
    );
    await _configureLocalNotifications();
    _tokenRefreshSubscription =
        FirebaseMessaging.instance.onTokenRefresh.listen(
      _registerToken,
    );
    _foregroundSubscription =
        FirebaseMessaging.onMessage.listen(_handleMessage);
    _openedSubscription = FirebaseMessaging.onMessageOpenedApp.listen(
      (message) =>
          _handleMessage(message, showSystemNotification: false, opened: true),
    );
    FirebaseMessaging.instance.getInitialMessage().then((message) {
      if (message != null) {
        _handleMessage(message, showSystemNotification: false, opened: true);
      }
    });
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

  Future<void> syncExistingSession() async {
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
    if (token != null && token.isNotEmpty) await _registerToken(token);
  }

  Future<void> deactivateForCurrentSession() async {
    final accessToken =
        await SecureSessionService.instance.getValidAccessToken();
    final pushToken = await FirebaseMessaging.instance.getToken();
    if (accessToken == null ||
        accessToken.isEmpty ||
        pushToken == null ||
        pushToken.isEmpty) {
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

  Future<void> _configureLocalNotifications() async {
    if (!Platform.isAndroid) return;

    const initializationSettings = InitializationSettings(
      android: AndroidInitializationSettings('@mipmap/ic_launcher'),
    );
    await _localNotifications.initialize(initializationSettings);

    const channel = AndroidNotificationChannel(
      _customerNotificationChannelId,
      _customerNotificationChannelName,
      description: 'Order and account updates from C2 Coffee.',
      importance: Importance.high,
    );
    await _localNotifications
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(channel);
  }

  Future<void> _handleMessage(
    RemoteMessage message, {
    bool showSystemNotification = true,
    bool opened = false,
  }) async {
    if (showSystemNotification) {
      await _showForegroundNotification(message);
    }
    switch (message.data['type']) {
      case 'order_ready':
      case 'order_pickup_reminder':
        AppNotification.showInfo(null, 'Your order is ready for collection.');
        unawaited(AppSessionService.instance.pollActiveOrder());
        if (opened) _openNotificationDestination(const OrdersPage());
        break;
      case 'voucher_expiring':
        AppNotification.showInfo(null, 'A reward is expiring soon.');
        if (opened) _openNotificationDestination(const MyRewardsPage());
        break;
      case 'marketing_poster':
        // Marketing copy is available in the notification inbox. Keep the
        // foreground alert generic so no malformed remote payload is rendered.
        AppNotification.showInfo(
            null, 'A new C2 Coffee update is available in Notifications.');
        if (opened) _openNotificationDestination(const NotificationPage());
        break;
    }
  }

  void _openNotificationDestination(Widget page) {
    final navigator = AppNotification.navigatorKey.currentState;
    if (navigator == null) return;
    navigator.push(MaterialPageRoute(builder: (_) => page));
  }

  Future<void> _showForegroundNotification(RemoteMessage message) async {
    if (!Platform.isAndroid) return;

    final type = message.data['type'];
    final title = switch (type) {
      'order_ready' => 'Order ready for collection',
      'order_pickup_reminder' => 'Pickup reminder',
      'voucher_expiring' => 'Reward expiring soon',
      'marketing_poster' => 'New C2 Coffee update',
      _ => null,
    };
    final body = switch (type) {
      'order_ready' => 'Your order is ready to collect.',
      'order_pickup_reminder' => 'Your order is still waiting at the counter.',
      'voucher_expiring' => 'Open Rewards to use it before it expires.',
      'marketing_poster' => 'Open Notifications to see the latest update.',
      _ => null,
    };
    if (title == null || body == null) return;

    await _localNotifications.show(
      message.messageId?.hashCode ?? DateTime.now().microsecondsSinceEpoch,
      title,
      body,
      const NotificationDetails(
        android: AndroidNotificationDetails(
          _customerNotificationChannelId,
          _customerNotificationChannelName,
          channelDescription: 'Order and account updates from C2 Coffee.',
          importance: Importance.high,
          priority: Priority.high,
          icon: '@mipmap/ic_launcher',
        ),
      ),
    );
  }

  void dispose() {
    _tokenRefreshSubscription?.cancel();
    _foregroundSubscription?.cancel();
    _openedSubscription?.cancel();
    _tokenRefreshSubscription = null;
    _foregroundSubscription = null;
    _openedSubscription = null;
    _initialized = false;
  }
}
