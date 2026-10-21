import 'dart:async';

import 'package:flutter/material.dart';

enum TopNoticeType { success, error, info }

class TopNotice {
  TopNotice._();

  static OverlayEntry? _activeEntry;
  static Timer? _dismissTimer;

  static void success(
    BuildContext context,
    String message, {
    Duration duration = const Duration(seconds: 4),
  }) => _show(context, message, TopNoticeType.success, duration);

  static void error(
    BuildContext context,
    String message, {
    Duration duration = const Duration(seconds: 5),
  }) => _show(context, message, TopNoticeType.error, duration);

  static void info(
    BuildContext context,
    String message, {
    Duration duration = const Duration(seconds: 5),
  }) => _show(context, message, TopNoticeType.info, duration);

  static void dismiss() {
    _dismissTimer?.cancel();
    _dismissTimer = null;
    _activeEntry?.remove();
    _activeEntry = null;
  }

  static void _show(
    BuildContext context,
    String message,
    TopNoticeType type,
    Duration duration,
  ) {
    dismiss();
    final overlay = Overlay.of(context, rootOverlay: true);
    final entry = OverlayEntry(
      builder: (overlayContext) {
        final topInset = MediaQuery.viewPaddingOf(overlayContext).top;
        return Positioned(
          top: topInset + 16,
          left: 16,
          right: 16,
          child: Center(
            child: TweenAnimationBuilder<double>(
              duration: const Duration(milliseconds: 220),
              curve: Curves.easeOutCubic,
              tween: Tween(begin: 0, end: 1),
              builder: (_, value, child) => Transform.translate(
                offset: Offset(0, -18 * (1 - value)),
                child: Opacity(opacity: value, child: child),
              ),
              child: _TopNoticePill(
                message: message,
                type: type,
                onDismiss: dismiss,
              ),
            ),
          ),
        );
      },
    );
    _activeEntry = entry;
    overlay.insert(entry);
    _dismissTimer = Timer(duration, dismiss);
  }
}

class _TopNoticePill extends StatelessWidget {
  const _TopNoticePill({
    required this.message,
    required this.type,
    required this.onDismiss,
  });

  final String message;
  final TopNoticeType type;
  final VoidCallback onDismiss;

  @override
  Widget build(BuildContext context) {
    final (background, foreground, icon) = switch (type) {
      TopNoticeType.success => (
        const Color(0xFF234B3D),
        Colors.white,
        Icons.check_circle_outline_rounded,
      ),
      TopNoticeType.error => (
        const Color(0xFF9F3434),
        Colors.white,
        Icons.error_outline_rounded,
      ),
      TopNoticeType.info => (
        const Color(0xFF2F4D48),
        Colors.white,
        Icons.info_outline_rounded,
      ),
    };

    return Semantics(
      liveRegion: true,
      label: message,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 720),
        child: Material(
          color: background,
          elevation: 12,
          shadowColor: Colors.black38,
          borderRadius: BorderRadius.circular(999),
          clipBehavior: Clip.antiAlias,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(18, 12, 8, 12),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(icon, color: foreground, size: 23),
                const SizedBox(width: 12),
                Flexible(
                  child: Text(
                    message,
                    style: TextStyle(
                      color: foreground,
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      height: 1.25,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton(
                  tooltip: 'Dismiss message',
                  visualDensity: VisualDensity.compact,
                  onPressed: onDismiss,
                  icon: Icon(Icons.close_rounded, color: foreground, size: 21),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
