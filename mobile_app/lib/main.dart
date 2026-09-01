import 'dart:async';

import 'package:flutter/material.dart';
import 'package:c2_coffee/authorization/login.dart';
import 'package:c2_coffee/services/app_session_service.dart';
import 'package:c2_coffee/services/secure_session_service.dart';
import 'package:c2_coffee/screens/home_page.dart';
import 'package:c2_coffee/screens/splash_screen.dart';
import 'package:c2_coffee/utils/app_colors.dart';
import 'package:c2_coffee/utils/app_notification.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await AppColors.loadTier();
  runApp(const C2CoffeeApp());
}

class C2CoffeeApp extends StatelessWidget {
  const C2CoffeeApp({super.key});

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<int>(
      valueListenable: AppColors.currentTier,
      builder: (context, tier, child) {
        return MaterialApp(
          navigatorKey: AppNotification.navigatorKey,
          title: 'C² Coffee',
          debugShowCheckedModeBanner: false,
          theme: AppColors.getThemeData(),
          builder: (context, child) =>
              AppLifecycleRefreshGate(child: child ?? const SizedBox.shrink()),
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

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _startRefreshLoop();
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
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
    } catch (_) {
      // Ignore refresh failures; the active screen will show the existing state.
    }
  }

  @override
  Widget build(BuildContext context) => widget.child;
}
