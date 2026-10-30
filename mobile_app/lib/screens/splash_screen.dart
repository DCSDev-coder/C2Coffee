import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../authorization/login.dart';
import '../services/session_lifecycle_service.dart';
import '../services/app_session_service.dart';
import '../services/session_restore_policy.dart';
import '../utils/app_colors.dart';
import '../widgets/c2_mini_loader.dart';
import 'home_page.dart';
import 'maintenance_page.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen>
    with TickerProviderStateMixin {
  static const _splashBackground = Color(0xFF8F2A08);
  static const _loadingDuration = Duration(milliseconds: 3200);
  static const _postCompleteDelay = Duration(milliseconds: 700);
  static const _introDuration = Duration(milliseconds: 1500);
  late AnimationController _progressController;
  late AnimationController _introController;
  bool _restoreUnavailable = false;
  bool _isRetrying = false;

  @override
  void initState() {
    super.initState();
    _progressController = AnimationController(
      vsync: this,
      duration: _loadingDuration,
    );
    _introController = AnimationController(
      vsync: this,
      duration: _introDuration,
    )..forward();
    _bootstrap();
  }

  @override
  void dispose() {
    _progressController.dispose();
    _introController.dispose();
    super.dispose();
  }

  Future<void> _bootstrap() async {
    SessionRestoreOutcome restoreOutcome = SessionRestoreOutcome.signedOut;

    // Start background session restore concurrently
    final sessionRestoreFuture = () async {
      try {
        return await SessionLifecycleService.instance.restoreSession();
      } catch (e) {
        return SessionRestoreOutcome.unavailable;
      }
    }();

    // Run loading progress all the way to 100%
    await _progressController.forward().orCancel.catchError((_) {});

    // Ensure session restore is resolved
    restoreOutcome = await sessionRestoreFuture;

    // Brief delay at 100% full state so the user sees completion
    await Future<void>.delayed(_postCompleteDelay);

    if (!mounted) return;

    if (restoreOutcome == SessionRestoreOutcome.unavailable) {
      setState(() => _restoreUnavailable = true);
      return;
    }

    Navigator.of(context).pushReplacement(
      PageRouteBuilder(
        pageBuilder: (_, __, ___) =>
            restoreOutcome == SessionRestoreOutcome.restored
                ? (AppSessionService.instance.maintenance.blocked
                    ? const MaintenancePage()
                    : const HomePage())
                : const LoginPage(),
        transitionsBuilder: (_, animation, __, child) {
          return FadeTransition(opacity: animation, child: child);
        },
        transitionDuration: const Duration(milliseconds: 400),
      ),
    );
  }

  Future<void> _retryRestore() async {
    if (_isRetrying) return;
    setState(() {
      _isRetrying = true;
      _restoreUnavailable = false;
    });
    _progressController.reset();
    _introController
      ..reset()
      ..forward();
    await _bootstrap();
    if (mounted) setState(() => _isRetrying = false);
  }

  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: const SystemUiOverlayStyle(
        statusBarColor: Colors.transparent,
        statusBarIconBrightness: Brightness.light,
        statusBarBrightness: Brightness.dark,
        systemNavigationBarColor: Colors.white,
        systemNavigationBarIconBrightness: Brightness.dark,
      ),
      child: Scaffold(
        body: Stack(
          children: [
            Positioned.fill(
              child: Container(color: Colors.black),
            ),
            Positioned.fill(
              child: ClipRect(
                child: Transform.scale(
                  scale: 1.18,
                  alignment: Alignment.center,
                  child: Image.asset(
                    'assets/images/splashscreen.png',
                    fit: BoxFit.cover,
                    alignment: Alignment.center,
                  ),
                ),
              ),
            ),
            Positioned.fill(
              child: Container(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.centerLeft,
                    end: Alignment.centerRight,
                    colors: [
                      Colors.black.withValues(alpha: 0.28),
                      Colors.black.withValues(alpha: 0.36),
                    ],
                  ),
                ),
              ),
            ),
            Positioned.fill(
              child: AnimatedBuilder(
                animation: _introController,
                builder: (context, child) {
                  final orangeOpacity = TweenSequence<double>([
                    TweenSequenceItem(
                      tween: ConstantTween(1.0),
                      weight: 62,
                    ),
                    TweenSequenceItem(
                      tween: Tween(begin: 1.0, end: 0.0),
                      weight: 38,
                    ),
                  ]).transform(_introController.value);
                  return Opacity(
                    opacity: orangeOpacity,
                    child: const ColoredBox(color: _splashBackground),
                  );
                },
              ),
            ),
            SafeArea(
              child: Column(
                children: [
                  const Spacer(),
                  Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        SizedBox(
                          height: 210,
                          width: 210,
                          child: AnimatedBuilder(
                            animation: _introController,
                            builder: (context, child) {
                              final progress = CurvedAnimation(
                                parent: _introController,
                                curve: Curves.easeOutCubic,
                              ).value;
                              final iconOpacity = TweenSequence<double>([
                                TweenSequenceItem(
                                  tween: Tween(begin: 0.0, end: 1.0),
                                  weight: 18,
                                ),
                                TweenSequenceItem(
                                  tween: ConstantTween(1.0),
                                  weight: 57,
                                ),
                                TweenSequenceItem(
                                  tween: Tween(begin: 1.0, end: 0.0),
                                  weight: 25,
                                ),
                              ]).transform(_introController.value);
                              final loaderOpacity = CurvedAnimation(
                                parent: _introController,
                                curve: const Interval(
                                  0.86,
                                  1.0,
                                  curve: Curves.easeIn,
                                ),
                              ).value;

                              return Stack(
                                alignment: Alignment.center,
                                children: [
                                  Opacity(
                                    opacity: loaderOpacity,
                                    child: C2MiniLoader(
                                      size: 160.0,
                                      duration: _loadingDuration,
                                      onComplete: () {},
                                    ),
                                  ),
                                  Opacity(
                                    opacity: iconOpacity,
                                    child: Transform.scale(
                                      scale: 0.76 + (progress * 0.30),
                                      child: ClipRRect(
                                        borderRadius: BorderRadius.circular(30),
                                        child: Image.asset(
                                          'assets/images/icon_app_2_1024.png',
                                          width: 190,
                                          height: 190,
                                          fit: BoxFit.cover,
                                        ),
                                      ),
                                    ),
                                  ),
                                ],
                              );
                            },
                          ),
                        ),
                        const SizedBox(height: 48),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 64.0),
                          child: AnimatedBuilder(
                            animation: _progressController,
                            builder: (context, child) {
                              return ClipRRect(
                                borderRadius: BorderRadius.circular(8),
                                child: LinearProgressIndicator(
                                  value: _progressController.value,
                                  minHeight: 6,
                                  backgroundColor:
                                      Colors.white.withValues(alpha: 0.2),
                                  valueColor: AlwaysStoppedAnimation<Color>(
                                      AppColors.secondary),
                                ),
                              );
                            },
                          ),
                        ),
                        const SizedBox(height: 12),
                        if (_restoreUnavailable)
                          Column(
                            children: [
                              const Text(
                                'We could not restore your session. Check your connection and try again.',
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                    fontFamily: 'Afacad',
                                    color: Colors.white70,
                                    fontSize: 17),
                              ),
                              const SizedBox(height: 12),
                              FilledButton(
                                onPressed: _isRetrying ? null : _retryRestore,
                                child: Text(_isRetrying
                                    ? 'TRYING AGAIN...'
                                    : 'TRY AGAIN'),
                              ),
                            ],
                          )
                        else
                          AnimatedBuilder(
                            animation: _progressController,
                            builder: (context, child) {
                              return Text(
                                '${(_progressController.value * 100).toInt()}%',
                                style: const TextStyle(
                                  fontFamily: 'Afacad',
                                  color: Colors.white70,
                                  fontSize: 16,
                                  fontWeight: FontWeight.bold,
                                ),
                              );
                            },
                          ),
                      ],
                    ),
                  ),
                  const Spacer(),
                  const SizedBox(height: 20),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
