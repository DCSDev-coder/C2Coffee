import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../authorization/login.dart';
import '../services/session_lifecycle_service.dart';
import '../widgets/c2_mini_loader.dart';
import 'home_page.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> with SingleTickerProviderStateMixin {
  static const _loadingDuration = Duration(milliseconds: 3200);
  static const _postCompleteDelay = Duration(milliseconds: 700);
  late AnimationController _progressController;

  @override
  void initState() {
    super.initState();
    _progressController = AnimationController(
      vsync: this,
      duration: _loadingDuration,
    );
    _bootstrap();
  }

  @override
  void dispose() {
    _progressController.dispose();
    super.dispose();
  }

  Future<void> _bootstrap() async {
    bool hasSession = false;

    // Start background session restore concurrently
    final sessionRestoreFuture = () async {
      try {
        return await SessionLifecycleService.instance.restoreSession();
      } catch (e) {
        return false;
      }
    }();

    // Run loading progress all the way to 100%
    await _progressController.forward().orCancel.catchError((_) {});

    // Ensure session restore is resolved
    hasSession = await sessionRestoreFuture;

    // Brief delay at 100% full state so the user sees completion
    await Future<void>.delayed(_postCompleteDelay);

    if (!mounted) return;

    Navigator.of(context).pushReplacement(
      PageRouteBuilder(
        pageBuilder: (_, __, ___) =>
            hasSession ? const HomePage() : const LoginPage(),
        transitionsBuilder: (_, animation, __, child) {
          return FadeTransition(opacity: animation, child: child);
        },
        transitionDuration: const Duration(milliseconds: 400),
      ),
    );
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
            SafeArea(
              child: Column(
                children: [
                  const Spacer(),
                  Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        C2MiniLoader(
                          size: 160.0,
                          duration: _loadingDuration,
                          onComplete: () {}, // Stops at 100%
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
                                  backgroundColor: Colors.white.withValues(alpha: 0.2),
                                  valueColor: const AlwaysStoppedAnimation<Color>(Color(0xFFC89662)), // Soft candle gold
                                ),
                              );
                            },
                          ),
                        ),
                        const SizedBox(height: 12),
                        AnimatedBuilder(
                          animation: _progressController,
                          builder: (context, child) {
                            return Text(
                              '${(_progressController.value * 100).toInt()}%',
                              style: const TextStyle(
                                fontFamily: 'Afacad',
                                color: Colors.white70,
                                fontSize: 14,
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
