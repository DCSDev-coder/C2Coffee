import 'dart:async';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:c2_coffee/authorization/login.dart';
import 'package:c2_coffee/services/app_session_service.dart';
import 'package:c2_coffee/services/secure_session_service.dart';
import 'package:c2_coffee/services/push_notification_service.dart';
import 'package:c2_coffee/services/notification_service.dart';
import 'package:c2_coffee/screens/home_page.dart';
import 'package:c2_coffee/screens/splash_screen.dart';
import 'package:c2_coffee/utils/app_colors.dart';
import 'package:c2_coffee/utils/app_notification.dart';
import 'package:c2_coffee/widgets/payment_service_notice_popup.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);
  await Firebase.initializeApp();
  FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
  await PushNotificationService.instance.initialize();
  await AppColors.loadTier();
  runApp(const C2CoffeeApp());
}

class C2CoffeeApp extends StatelessWidget {
  const C2CoffeeApp({super.key});

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: Listenable.merge(
          [AppColors.currentTier, AppColors.appearanceVersion]),
      builder: (context, child) {
        return MaterialApp(
          navigatorKey: AppNotification.navigatorKey,
          title: 'C² Coffee',
          debugShowCheckedModeBanner: false,
          theme: AppColors.getThemeData(),
          builder: (context, child) => MediaQuery.withClampedTextScaling(
            // Keep labels readable by default while protecting compact cards
            // and controls from large accessibility-scale overflows.
            minScaleFactor: 1.08,
            maxScaleFactor: 1.25,
            child: AppLifecycleRefreshGate(
              child: child ?? const SizedBox.shrink(),
            ),
          ),
          home: const SplashScreen(),
          routes: {
            '/login': (context) => const LoginPage(),
            '/login_backup': (context) => const LoginPage(),
            '/home': (context) => const HomePage(),
            '/splash': (context) => const SplashScreen(),
          },
        );
      },
    );
  }
}

class AppLifecycleRefreshGate extends StatefulWidget {
  final Widget child;

  const AppLifecycleRefreshGate({super.key, required this.child});

  @override
  State<AppLifecycleRefreshGate> createState() =>
      _AppLifecycleRefreshGateState();
}

class _AppLifecycleRefreshGateState extends State<AppLifecycleRefreshGate>
    with WidgetsBindingObserver {
  static const _refreshInterval = Duration(seconds: 45);
  Timer? _refreshTimer;
  bool _checkingPaymentNotices = false;
  final Set<int> _shownPaymentNoticeIds = <int>{};
  int? _paymentNoticeUserId;
  DateTime? _lastPaymentNoticeCheckAt;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    AppSessionService.instance.addListener(_handleSessionStateChanged);
    _startRefreshLoop();
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    AppSessionService.instance.removeListener(_handleSessionStateChanged);
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  void _handleSessionStateChanged() {
    final userId = AppSessionService.instance.user?.id;
    if (userId == null) {
      _paymentNoticeUserId = null;
      _lastPaymentNoticeCheckAt = null;
      _shownPaymentNoticeIds.clear();
      return;
    }
    if (_paymentNoticeUserId != userId) {
      _paymentNoticeUserId = userId;
      _lastPaymentNoticeCheckAt = null;
      _shownPaymentNoticeIds.clear();
    }
    unawaited(_checkPaymentNoticesForCurrentSession());
  }

  Future<void> _checkPaymentNoticesForCurrentSession() async {
    final accessToken =
        await SecureSessionService.instance.getValidAccessToken();
    if (accessToken == null || accessToken.isEmpty) return;
    await _showPaymentNoticeIfNeeded(accessToken);
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _startRefreshLoop();
    } else if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.inactive ||
        state == AppLifecycleState.detached) {
      _refreshTimer?.cancel();
      _refreshTimer = null;
    }
  }

  void _startRefreshLoop() {
    _refreshTimer?.cancel();
    _refreshTimer = Timer.periodic(_refreshInterval, (_) {
      _refreshIfSignedIn();
    });
    _refreshIfSignedIn();
  }

  Future<void> _refreshIfSignedIn() async {
    try {
      final accessToken =
          await SecureSessionService.instance.getValidAccessToken();
      if (accessToken == null || accessToken.isEmpty) return;
      await AppSessionService.instance.loadAuthenticatedState(force: true);
      unawaited(_showPaymentNoticeIfNeeded(accessToken));
    } catch (_) {
      // Ignore refresh failures; the active screen will show the existing state.
    }
  }

  Future<void> _showPaymentNoticeIfNeeded(String accessToken) async {
    if (_checkingPaymentNotices) return;
    final now = DateTime.now();
    if (_lastPaymentNoticeCheckAt != null &&
        now.difference(_lastPaymentNoticeCheckAt!) < _refreshInterval) {
      return;
    }
    _lastPaymentNoticeCheckAt = now;
    _checkingPaymentNotices = true;
    try {
      final notices = await NotificationService.instance
          .getPaymentServiceNotices(accessToken: accessToken);
      final pending = notices.where(
        (notice) =>
            !notice.isPopupDismissed &&
            !_shownPaymentNoticeIds.contains(notice.id),
      );
      if (pending.isEmpty) return;

      final notice = pending.first;
      final popupContext = AppNotification.navigatorKey.currentContext;
      if (popupContext == null || !popupContext.mounted) return;
      _shownPaymentNoticeIds.add(notice.id);
      await showPaymentServiceNoticePopup(popupContext, notice);
    } catch (_) {
      // The pinned inbox notice remains available if popup loading fails.
    } finally {
      _checkingPaymentNotices = false;
    }
  }

  @override
  Widget build(BuildContext context) => widget.child;
}
