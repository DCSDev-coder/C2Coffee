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
  static const _minimumDisplayDuration = Duration(seconds: 3);
  late AnimationController _progressController;

  @override
  void initState() {
    super.initState();
    _progressController = AnimationController(
      vsync: this,
      duration: _minimumDisplayDuration,
    )..forward();
    _bootstrap();
  }

  @override
  void dispose() {
    _progressController.dispose();
    super.dispose();
  }

  Future<void> _bootstrap() async {
    bool hasSession = false;
    
    await Future.wait([
      Future<void>.delayed(_minimumDisplayDuration),
      () async {
        try {
          hasSession = await SessionLifecycleService.instance.restoreSession();
        } catch (e) {
          hasSession = false;
        }
      }()
    ]);

    if (!mounted) return;

    Navigator.of(context).pushReplacement(
      MaterialPageRoute(
        builder: (_) => hasSession ? const HomePage() : const LoginPage(),
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
                          duration: _minimumDisplayDuration,
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
