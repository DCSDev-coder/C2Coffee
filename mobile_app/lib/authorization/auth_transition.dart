import 'package:flutter/material.dart';
import '../utils/app_notification.dart';

Route<T> buildAuthRoute<T>(Widget page) {
  return PageRouteBuilder<T>(
    pageBuilder: (context, animation, secondaryAnimation) => page,
    transitionsBuilder: (context, animation, secondaryAnimation, child) {
      const curve = Curves.easeInOutCubic;
      final curvedAnimation = CurvedAnimation(
        parent: animation,
        curve: curve,
        reverseCurve: curve,
      );

      final fadeAnimation = Tween<double>(
        begin: 0.0,
        end: 1.0,
      ).animate(curvedAnimation);

      return FadeTransition(opacity: fadeAnimation, child: child);
    },
    transitionDuration: const Duration(milliseconds: 220),
    reverseTransitionDuration: const Duration(milliseconds: 180),
  );
}

void showAuthErrorBanner(BuildContext context, String message) {
  final topInset = MediaQuery.maybeOf(context)?.padding.top ?? 0.0;
  AppNotification.showError(
    context,
    message,
    topOffset: topInset + 14,
  );
}



class AuthCardEntrance extends StatefulWidget {
  final Widget child;
  final Duration duration;
  final Offset beginOffset;
  final Curve curve;

  const AuthCardEntrance({
    super.key,
    required this.child,
    this.duration = const Duration(milliseconds: 340),
    this.beginOffset = const Offset(0.0, 0.08),
    this.curve = Curves.easeOutCubic,
  });

  @override
  State<AuthCardEntrance> createState() => _AuthCardEntranceState();
}

class _AuthCardEntranceState extends State<AuthCardEntrance>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: widget.duration,
  )..forward();

  late final Animation<double> _fadeAnimation = CurvedAnimation(
    parent: _controller,
    curve: widget.curve,
  );

  late final Animation<Offset> _slideAnimation = Tween<Offset>(
    begin: widget.beginOffset,
    end: Offset.zero,
  ).animate(CurvedAnimation(
    parent: _controller,
    curve: widget.curve,
  ));

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: _fadeAnimation,
      child: SlideTransition(
        position: _slideAnimation,
        child: widget.child,
      ),
    );
  }
}
