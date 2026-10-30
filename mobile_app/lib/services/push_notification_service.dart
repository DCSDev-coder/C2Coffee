import 'dart:async';
import 'dart:io';

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

import 'auth_api_service.dart';
import 'app_session_service.dart';
import 'notification_service.dart';
import 'secure_session_service.dart';
import '../utils/app_notification.dart';
import '../screens/my_rewards_page.dart';
import '../screens/notification_page.dart';
import '../screens/orders_page.dart';
import '../screens/top_up_wallet_page.dart';

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
  Timer? _registrationRetryTimer;
  int _registrationRetryCount = 0;
  final FlutterLocalNotificationsPlugin _localNotifications =
      FlutterLocalNotificationsPlugin();
  bool _initialized = false;

  static const _apnsWaitInterval = Duration(milliseconds: 250);
  static const _apnsWaitAttempts = 20;
  static const _registrationRetryDelay = Duration(seconds: 5);
  static const _maximumRegistrationRetries = 3;

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
      _handleTokenRefresh,
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

    await _syncRegistrationToken();
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
    await _syncRegistrationToken();
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

  Future<void> _handleTokenRefresh(String pushToken) async {
    if (!await _apnsTokenIsAvailable(wait: false)) {
      _scheduleRegistrationRetry();
      return;
    }
    if (!await _registerToken(pushToken)) {
      _scheduleRegistrationRetry();
    }
  }

  Future<void> _syncRegistrationToken() async {
    if (!await _apnsTokenIsAvailable(wait: true)) {
      if (kDebugMode) {
        debugPrint(
          '[push] APNs token is not ready. FCM registration will retry.',
        );
      }
      _scheduleRegistrationRetry();
      return;
    }

    final pushToken = await FirebaseMessaging.instance.getToken();
    if (pushToken == null || pushToken.isEmpty) {
      _scheduleRegistrationRetry();
      return;
    }

    if (await _registerToken(pushToken)) {
      _registrationRetryTimer?.cancel();
      _registrationRetryTimer = null;
      _registrationRetryCount = 0;
    } else {
      _scheduleRegistrationRetry();
    }
  }

  Future<bool> _apnsTokenIsAvailable({required bool wait}) async {
    if (!Platform.isIOS) return true;

    final attempts = wait ? _apnsWaitAttempts : 1;
    for (var attempt = 0; attempt < attempts; attempt++) {
      final apnsToken = await FirebaseMessaging.instance.getAPNSToken();
      if (apnsToken != null && apnsToken.isNotEmpty) {
        if (kDebugMode) {
          debugPrint('[push] APNs token is ready.');
        }
        return true;
      }
      if (attempt < attempts - 1) {
        await Future<void>.delayed(_apnsWaitInterval);
      }
    }
    return false;
  }

  void _scheduleRegistrationRetry() {
    if (_registrationRetryTimer != null ||
        _registrationRetryCount >= _maximumRegistrationRetries) {
      return;
    }
    _registrationRetryCount++;
    _registrationRetryTimer = Timer(_registrationRetryDelay, () {
      _registrationRetryTimer = null;
      unawaited(_syncRegistrationToken());
    });
  }

  Future<bool> _registerToken(String pushToken) async {
    try {
      final accessToken =
          await SecureSessionService.instance.getValidAccessToken();
      if (accessToken == null || accessToken.isEmpty) return false;

      final deviceFingerprint =
          await AuthApiService.instance.getOrCreateDeviceFingerprint();
      await AuthApiService.instance.registerPushToken(
        accessToken: accessToken,
        deviceFingerprint: deviceFingerprint,
        platform: Platform.isIOS ? 'ios' : 'android',
        pushToken: pushToken,
      );
      if (kDebugMode) {
        debugPrint('[push] FCM token registered with the C2 Coffee API.');
      }
      return true;
    } catch (error) {
      if (kDebugMode) {
        debugPrint('[push] FCM token registration failed: $error');
      }
      // A delivery registration failure must not interrupt sign-in or app use.
      return false;
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
      case 'voucher_start_reminder':
        AppNotification.showInfo(null, 'A voucher is now available.');
        if (opened) _openNotificationDestination(const MyRewardsPage());
        break;
      case 'voucher_end_reminder':
        AppNotification.showInfo(null, 'A voucher is ending soon.');
        if (opened) _openNotificationDestination(const MyRewardsPage());
        break;
      case 'marketing_poster':
        // Marketing copy is available in the notification inbox. Keep the
        // foreground alert generic so no malformed remote payload is rendered.
        _refreshNotificationInbox();
        if (!opened) {
          AppNotification.showInfo(
            null,
            'A new C2 Coffee update is available in Notifications.',
            onTap: () => _openNotificationDestination(const NotificationPage()),
          );
        }
        if (opened) _openNotificationDestination(const NotificationPage());
        break;
      case 'customer_message':
        _refreshNotificationInbox();
        if (!opened) {
          AppNotification.showInfo(
            null,
            'A new C2 Coffee message is available in Notifications.',
            onTap: () => _openNotificationDestination(const NotificationPage()),
          );
        }
        if (opened) _openNotificationDestination(const NotificationPage());
        break;
      case 'payment_service_notice':
        _refreshNotificationInbox();
        AppNotification.showWarning(
          null,
          'A scheduled payment service notice is available in Notifications.',
          onTap: () => _openNotificationDestination(const NotificationPage()),
        );
        if (opened) _openNotificationDestination(const NotificationPage());
        break;
      case 'token_topup_paid':
        AppNotification.showSuccess(
            null, 'Your top-up is complete and your C2 Tokens are ready.');
        if (opened) _openNotificationDestination(const TopUpWalletPage());
        break;
      case 'token_topup_failed':
        AppNotification.showError(
            null, 'Your top-up was unsuccessful. No C2 Tokens were added.');
        if (opened) _openNotificationDestination(const TopUpWalletPage());
        break;
      case 'token_topup_cancelled':
        AppNotification.showInfo(
            null, 'Your top-up was cancelled. No C2 Tokens were added.');
        if (opened) _openNotificationDestination(const TopUpWalletPage());
        break;
      case 'token_topup_refunded':
        AppNotification.showInfo(
            null, 'Your top-up refund has been processed.');
        if (opened) _openNotificationDestination(const TopUpWalletPage());
        break;
      case 'token_topup_review':
        AppNotification.showWarning(
            null, 'Your top-up needs review. Open Notifications for details.');
        if (opened) _openNotificationDestination(const TopUpWalletPage());
        break;
    }
  }

  void _refreshNotificationInbox() {
    NotificationService.instance.notifyInboxChanged();
    unawaited(NotificationService.instance.refreshIndicator());
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
      'voucher_start_reminder' => 'Voucher is available',
      'voucher_end_reminder' => 'Voucher ends soon',
      'marketing_poster' => 'New C2 Coffee update',
      'customer_message' => 'New C2 Coffee message',
      'payment_service_notice' => 'Payment service notice',
      'token_topup_paid' => 'Top-up complete',
      'token_topup_failed' => 'Top-up unsuccessful',
      'token_topup_cancelled' => 'Top-up cancelled',
      'token_topup_refunded' => 'Top-up refunded',
      'token_topup_review' => 'Top-up under review',
      _ => null,
    };
    final body = switch (type) {
      'order_ready' => 'Your order is ready to collect.',
      'order_pickup_reminder' => 'Your order is still waiting at the counter.',
      'voucher_expiring' => 'Open Rewards to use it before it expires.',
      'voucher_start_reminder' => 'Open Rewards to use your voucher.',
      'voucher_end_reminder' => 'Open Rewards to use it before it ends.',
      'marketing_poster' => 'Open Notifications to see the latest update.',
      'customer_message' => 'Open Notifications to read the latest message.',
      'payment_service_notice' =>
        'Open Notifications to check the affected payment method and time.',
      'token_topup_paid' => 'Your C2 Tokens are ready in your wallet.',
      'token_topup_failed' => 'No C2 Tokens were added.',
      'token_topup_cancelled' => 'No C2 Tokens were added.',
      'token_topup_refunded' => 'Open your wallet for the latest status.',
      'token_topup_review' => 'Open Notifications for details.',
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
    _registrationRetryTimer?.cancel();
    _tokenRefreshSubscription = null;
    _foregroundSubscription = null;
    _openedSubscription = null;
    _registrationRetryTimer = null;
    _registrationRetryCount = 0;
    _initialized = false;
  }
}
