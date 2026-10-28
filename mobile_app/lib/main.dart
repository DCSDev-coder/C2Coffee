import 'dart:async';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:c2_coffee/authorization/login.dart';
import 'package:c2_coffee/services/app_session_service.dart';
import 'package:c2_coffee/services/app_update_service.dart';
import 'package:c2_coffee/services/secure_session_service.dart';
import 'package:c2_coffee/services/push_notification_service.dart';
import 'package:c2_coffee/screens/home_page.dart';
import 'package:c2_coffee/screens/splash_screen.dart';
import 'package:c2_coffee/utils/app_colors.dart';
import 'package:c2_coffee/utils/app_notification.dart';

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
  static const _updateCheckCooldown = Duration(minutes: 15);
  Timer? _refreshTimer;
  Timer? _updateTimer;
  final MobileAppUpdateService _updateService = MobileAppUpdateService();
  DateTime? _lastUpdateCheck;
  bool _updateCheckInProgress = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _startRefreshLoop();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _checkForUpdate();
    });
    _updateTimer = Timer.periodic(const Duration(hours: 6), (_) {
      _checkForUpdate(force: true);
    });
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    _updateTimer?.cancel();
    _updateService.dispose();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _startRefreshLoop();
      _checkForUpdate();
    } else if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.inactive ||
        state == AppLifecycleState.detached) {
      _refreshTimer?.cancel();
      _refreshTimer = null;
    }
  }

  Future<void> _checkForUpdate({bool force = false}) async {
    if (!mounted || _updateCheckInProgress) return;
    final lastCheck = _lastUpdateCheck;
    if (!force &&
        lastCheck != null &&
        DateTime.now().difference(lastCheck) < _updateCheckCooldown) {
      return;
    }
    _updateCheckInProgress = true;
    _lastUpdateCheck = DateTime.now();
    try {
      final check = await _updateService.checkForUpdate();
      if (!mounted || !await _updateService.shouldPrompt(check)) return;
      await _updateService.markPrompted(check);
      if (!mounted) return;
      await showDialog<void>(
        context: context,
        barrierDismissible: !check.mandatory,
        builder: (dialogContext) => AlertDialog(
          icon: const Icon(Icons.system_update_alt_rounded),
          title: const Text('C2 Coffee update available'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Version ${check.release.versionName} is ready to install.'),
              if (check.release.releaseNotes != null) ...[
                const SizedBox(height: 14),
                const Text('What’s new',
                    style: TextStyle(fontWeight: FontWeight.w700)),
                const SizedBox(height: 4),
                Text(check.release.releaseNotes!),
              ],
            ],
          ),
          actions: [
            if (!check.mandatory)
              TextButton(
                onPressed: () => Navigator.pop(dialogContext),
                child: const Text('Later'),
              ),
            FilledButton.icon(
              onPressed: () async {
                final opened = await _updateService.openStore(check.release);
                if (!dialogContext.mounted) return;
                if (opened) {
                  Navigator.pop(dialogContext);
                } else {
                  ScaffoldMessenger.of(dialogContext).showSnackBar(
                    const SnackBar(
                        content: Text('Unable to open the app store.')),
                  );
                }
              },
              icon: const Icon(Icons.open_in_new_rounded),
              label: const Text('Update now'),
            ),
          ],
        ),
      );
    } catch (_) {
      // Update checks are optional. Network or an unpublished manifest must
      // never prevent the customer from opening the app.
    } finally {
      _updateCheckInProgress = false;
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
