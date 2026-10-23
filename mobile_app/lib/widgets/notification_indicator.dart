import 'package:flutter/material.dart';

import '../services/notification_service.dart';

class NotificationIndicator extends StatelessWidget {
  final Widget child;
  final bool lightBackground;

  const NotificationIndicator({
    super.key,
    required this.child,
    this.lightBackground = false,
  });

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<NotificationIndicatorState>(
      valueListenable: NotificationService.instance.indicator,
      builder: (context, state, _) {
        if (!state.hasIndicator) return child;
        final indicatorColor = state.hasUnreadUpdates
            ? Colors.red.shade600
            : Colors.orange.shade700;
        return Stack(
          clipBehavior: Clip.none,
          children: [
            child,
            Positioned(
              right: -4,
              top: -4,
              child: _Dot(
                color: indicatorColor,
                borderColor:
                    lightBackground ? Colors.white : Colors.transparent,
                size: 9,
              ),
            ),
          ],
        );
      },
    );
  }
}

class _Dot extends StatelessWidget {
  final Color color;
  final Color borderColor;
  final double size;

  const _Dot({
    required this.color,
    required this.borderColor,
    required this.size,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: color,
        shape: BoxShape.circle,
        border: borderColor == Colors.transparent
            ? null
            : Border.all(color: borderColor, width: 1.5),
      ),
    );
  }
}
