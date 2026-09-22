import 'dart:async';
import 'dart:io';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

import 'api_service.dart';
import 'direct_printer_service.dart';

const _orderChannelId = 'c2_order_updates';
const _orderChannelName = 'Order updates';
const _orderNotificationTitle = 'New order to prepare';
const _orderNotificationBody = 'A paid pickup order is waiting in the queue.';

@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  // Data-only high-priority pushes can start a background isolate on Android.
  // Rehydrate the signed-in session before claiming the durable server job.
  try {
    await Firebase.initializeApp();
    await ApiService.restoreSession();
    await PushNotificationService.instance.handleBackgroundMessage(message);
  } catch (error) {
    debugPrint('Background order notification could not be handled: $error');
  }
}

class PushNotificationService {
  PushNotificationService._();

  static final instance = PushNotificationService._();

  StreamSubscription<String>? _tokenRefreshSubscription;
  StreamSubscription<RemoteMessage>? _foregroundSubscription;
  StreamSubscription<RemoteMessage>? _openedSubscription;
  final FlutterLocalNotificationsPlugin _localNotifications =
      FlutterLocalNotificationsPlugin();
  Future<void> Function()? _onNewOrder;
  bool _initialized = false;

  Future<void> initialize() async {
    // The Barista web build has no Firebase web configuration. Push is a
    // mobile-only enhancement and must not block web sign-in or navigation.
    if (kIsWeb) {
      return;
    }
    if (_initialized) return;

    await FirebaseMessaging.instance
        .setForegroundNotificationPresentationOptions(
          alert: true,
          badge: true,
          sound: true,
        );
    await _configureLocalNotifications();
    _tokenRefreshSubscription = FirebaseMessaging.instance.onTokenRefresh
        .listen(_registerToken);
    _foregroundSubscription = FirebaseMessaging.onMessage.listen(
      _handleMessage,
    );
    _openedSubscription = FirebaseMessaging.onMessageOpenedApp.listen(
      _handleMessage,
    );
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

  Future<void> deactivateForCurrentSession() async {
    if (kIsWeb) {
      return;
    }
    final pushToken = await FirebaseMessaging.instance.getToken();
    if (pushToken == null || pushToken.isEmpty || !ApiService.isSignedIn) {
      return;
    }
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

  Future<void> _configureLocalNotifications() async {
    if (!Platform.isAndroid) return;

    const initializationSettings = InitializationSettings(
      android: AndroidInitializationSettings('@mipmap/ic_launcher'),
    );
    await _localNotifications.initialize(initializationSettings);

    const channel = AndroidNotificationChannel(
      _orderChannelId,
      _orderChannelName,
      description: 'Alerts for paid orders waiting to be prepared.',
      importance: Importance.max,
    );
    await _localNotifications
        .resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin
        >()
        ?.createNotificationChannel(channel);
  }

  Future<void> _handleMessage(RemoteMessage message) async {
    // Ignore unrecognised payloads. The server never includes order or customer
    // details in the push; the handler refreshes the authorised queue instead.
    if (message.data['type'] != 'new_order') return;
    await _showOrderNotification(message);
    final handler = _onNewOrder;
    if (handler != null) {
      await handler();
    }
    // The foreground screen refresh handles local printer delivery. If no
    // screen handler is registered, refresh the authorised order queue here.
    if (handler == null) await processLocalPrinterOrders();
  }

  Future<void> handleBackgroundMessage(RemoteMessage message) async {
    if (kIsWeb || message.data['type'] != 'new_order') return;
    await initialize();
    await _showOrderNotification(message);
    final processedDirectJob = await processDirectPrintJobs();
    if (!processedDirectJob) await processLocalPrinterOrders();
  }

  Future<void> _showOrderNotification(RemoteMessage message) async {
    if (kIsWeb || !Platform.isAndroid) return;
    await _localNotifications.show(
      message.messageId?.hashCode ?? DateTime.now().microsecondsSinceEpoch,
      message.data['notification_title'] ?? _orderNotificationTitle,
      message.data['notification_body'] ?? _orderNotificationBody,
      const NotificationDetails(
        android: AndroidNotificationDetails(
          _orderChannelId,
          _orderChannelName,
          channelDescription: 'Alerts for paid orders waiting to be prepared.',
          importance: Importance.max,
          priority: Priority.high,
          icon: '@mipmap/ic_launcher',
        ),
      ),
    );
  }

  /// Returns true when the server assigned at least one durable print job.
  /// Callers only fall back to local polling when no job was assigned, so the
  /// same order cannot be printed by both delivery paths.
  Future<bool> processDirectPrintJobs() async {
    if (kIsWeb || !Platform.isAndroid || !ApiService.isSignedIn) return false;
    var claimedJob = false;
    try {
      while (true) {
        final job = await ApiService.claimDirectPrintJob();
        if (job == null) return claimedJob;
        claimedJob = true;
        try {
          await DirectPrinterService.instance.printJob(job);
          await ApiService.acknowledgeDirectPrintJob(job.jobRef, printed: true);
          await DirectPrinterService.instance.markOrderObserved(job.orderRef);
        } catch (error) {
          debugPrint('Could not print job ${job.jobRef}: $error');
          try {
            await ApiService.acknowledgeDirectPrintJob(
              job.jobRef,
              printed: false,
            );
          } catch (_) {
            // The server lease makes an unacknowledged job available again.
          }
          return true;
        }
      }
    } catch (error) {
      // Tablets without a server printer assignment keep local-IP printing.
      // A claimed job is never handed to the fallback to avoid duplicates.
      debugPrint('Could not claim direct print jobs: $error');
      return claimedJob;
    }
  }

  Future<void> processLocalPrinterOrders() async {
    if (kIsWeb || !Platform.isAndroid || !ApiService.isSignedIn) return;
    try {
      final result = await ApiService.fetchOrders();
      if (!result.isSuccess) return;
      await DirectPrinterService.instance.printNewOrders(result.orders);
    } catch (error) {
      debugPrint('Could not refresh orders for local printing: $error');
    }
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
