import 'dart:async';
import 'package:flutter/material.dart';
import 'app_colors.dart';

enum NotificationType {
  success,
  error,
  warning,
  info,
}

/// Global floating notification / toast banner that floats at the top
/// of the screen just below the header, ensuring bottom navigation and action
/// buttons are never obstructed.
class AppNotification {
  AppNotification._();

  static final GlobalKey<NavigatorState> navigatorKey =
      GlobalKey<NavigatorState>();

  static OverlayEntry? _activeEntry;
  static Timer? _dismissTimer;

  /// Shows a notification banner at the top of the screen just below the header.
  static void show(
    BuildContext? context, {
    required String message,
    NotificationType type = NotificationType.info,
    IconData? icon,
    Duration duration = const Duration(milliseconds: 2800),
    double? topOffset,
    VoidCallback? onTap,
  }) {
    final overlayState = (context != null ? Overlay.maybeOf(context, rootOverlay: true) : null) ??
        navigatorKey.currentState?.overlay;

    if (overlayState == null) return;

    _dismissTimer?.cancel();
    _dismissTimer = null;
    _activeEntry?.remove();
    _activeEntry = null;

    late OverlayEntry entry;

    entry = OverlayEntry(
      builder: (overlayContext) {
        final topInset = MediaQuery.paddingOf(overlayContext).top;
        final effectiveTop = topOffset ?? (topInset + 76.0);

        return Positioned(
          left: 16,
          right: 16,
          top: effectiveTop,
          child: Material(
            color: Colors.transparent,
            child: Align(
              alignment: Alignment.topCenter,
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 520),
                child: _AppNotificationBanner(
                  message: message,
                  type: type,
                  icon: icon,
                  onDismiss: () {
                    _dismissTimer?.cancel();
                    _dismissTimer = null;
                    if (_activeEntry == entry) {
                      _activeEntry?.remove();
                      _activeEntry = null;
                    }
                  },
                  onTap: onTap,
                ),
              ),
            ),
          ),
        );
      },
    );

    _activeEntry = entry;
    overlayState.insert(entry);

    _dismissTimer = Timer(duration, () {
      if (_activeEntry == entry) {
        entry.remove();
        _activeEntry = null;
      }
    });
  }

  /// Convenience method for success notifications (e.g., added to cart, reordered)
  static void showSuccess(
    BuildContext? context,
    String message, {
    IconData? icon,
    Duration duration = const Duration(milliseconds: 2800),
    double? topOffset,
    VoidCallback? onTap,
  }) {
    show(
      context,
      message: message,
      type: NotificationType.success,
      icon: icon,
      duration: duration,
      topOffset: topOffset,
      onTap: onTap,
    );
  }

  /// Convenience method for error notifications
  static void showError(
    BuildContext? context,
    String message, {
    IconData? icon,
    Duration duration = const Duration(milliseconds: 3200),
    double? topOffset,
    VoidCallback? onTap,
  }) {
    show(
      context,
      message: message,
      type: NotificationType.error,
      icon: icon,
      duration: duration,
      topOffset: topOffset,
      onTap: onTap,
    );
  }

  /// Convenience method for warning notifications
  static void showWarning(
    BuildContext? context,
    String message, {
    IconData? icon,
    Duration duration = const Duration(milliseconds: 3000),
    double? topOffset,
    VoidCallback? onTap,
  }) {
    show(
      context,
      message: message,
      type: NotificationType.warning,
      icon: icon,
      duration: duration,
      topOffset: topOffset,
      onTap: onTap,
    );
  }

  /// Convenience method for info notifications
  static void showInfo(
    BuildContext? context,
    String message, {
    IconData? icon,
    Duration duration = const Duration(milliseconds: 2800),
    double? topOffset,
    VoidCallback? onTap,
  }) {
    show(
      context,
      message: message,
      type: NotificationType.info,
      icon: icon,
      duration: duration,
      topOffset: topOffset,
      onTap: onTap,
    );
  }

  /// Manually dismiss any active notification
  static void dismiss() {
    _dismissTimer?.cancel();
    _dismissTimer = null;
    _activeEntry?.remove();
    _activeEntry = null;
  }
}

class _AppNotificationBanner extends StatefulWidget {
  final String message;
  final NotificationType type;
  final IconData? icon;
  final VoidCallback onDismiss;
  final VoidCallback? onTap;

  const _AppNotificationBanner({
    required this.message,
    required this.type,
    this.icon,
    required this.onDismiss,
    this.onTap,
  });

  @override
  State<_AppNotificationBanner> createState() => _AppNotificationBannerState();
}

class _AppNotificationBannerState extends State<_AppNotificationBanner>
    with SingleTickerProviderStateMixin {
  late final AnimationController _animController;
  late final Animation<double> _fadeAnim;
  late final Animation<Offset> _slideAnim;

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 260),
      reverseDuration: const Duration(milliseconds: 200),
    );

    _fadeAnim = CurvedAnimation(
      parent: _animController,
      curve: Curves.easeOutCubic,
      reverseCurve: Curves.easeInCubic,
    );

    _slideAnim = Tween<Offset>(
      begin: const Offset(0, -0.25),
      end: Offset.zero,
    ).animate(CurvedAnimation(
      parent: _animController,
      curve: Curves.easeOutBack,
      reverseCurve: Curves.easeInCubic,
    ));

    _animController.forward();
  }

  @override
  void dispose() {
    _animController.dispose();
    super.dispose();
  }

  Future<void> _handleDismiss() async {
    if (!mounted) return;
    await _animController.reverse();
    widget.onDismiss();
  }

  Color get _backgroundColor {
    switch (widget.type) {
      case NotificationType.success:
        return AppColors.deepTeal;
      case NotificationType.error:
        return const Color(0xFFBA1A1A);
      case NotificationType.warning:
        return const Color(0xFFAD6D15);
      case NotificationType.info:
        return const Color(0xFF264653);
    }
  }

  Color get _borderColor {
    switch (widget.type) {
      case NotificationType.success:
        return AppColors.sageTeal.withValues(alpha: 0.35);
      case NotificationType.error:
        return const Color(0xFFFFB4AB).withValues(alpha: 0.3);
      case NotificationType.warning:
        return const Color(0xFFFFDDB3).withValues(alpha: 0.35);
      case NotificationType.info:
        return Colors.white.withValues(alpha: 0.2);
    }
  }

  IconData get _defaultIcon {
    switch (widget.type) {
      case NotificationType.success:
        return Icons.check_circle_outline_rounded;
      case NotificationType.error:
        return Icons.error_outline_rounded;
      case NotificationType.warning:
        return Icons.warning_amber_rounded;
      case NotificationType.info:
        return Icons.info_outline_rounded;
    }
  }

  @override
  Widget build(BuildContext context) {
    final effectiveIcon = widget.icon ?? _defaultIcon;

    return FadeTransition(
      opacity: _fadeAnim,
      child: SlideTransition(
        position: _slideAnim,
        child: GestureDetector(
          onTap: () {
            widget.onTap?.call();
            _handleDismiss();
          },
          onVerticalDragEnd: (details) {
            if (details.primaryVelocity != null &&
                details.primaryVelocity! < 0) {
              _handleDismiss();
            }
          },
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              color: _backgroundColor,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: _borderColor,
                width: 1,
              ),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.22),
                  blurRadius: 18,
                  offset: const Offset(0, 8),
                ),
              ],
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  effectiveIcon,
                  color: Colors.white,
                  size: 20,
                ),
                const SizedBox(width: 12),
                Flexible(
                  child: Text(
                    widget.message,
                    style: const TextStyle(
                      fontFamily: 'Afacad',
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: Colors.white,
                      height: 1.25,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                const SizedBox(width: 8),
                GestureDetector(
                  onTap: _handleDismiss,
                  behavior: HitTestBehavior.opaque,
                  child: const Padding(
                    padding: EdgeInsets.all(2.0),
                    child: Icon(
                      Icons.close_rounded,
                      color: Colors.white70,
                      size: 16,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
