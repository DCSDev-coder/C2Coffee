import 'dart:ui' as dart_ui;
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../utils/app_colors.dart';

class PosterPopup extends StatefulWidget {
  final VoidCallback? onClose;

  const PosterPopup({super.key, this.onClose});

  @override
  State<PosterPopup> createState() => _PosterPopupState();
}

class _PosterPopupState extends State<PosterPopup>
    with SingleTickerProviderStateMixin {
  late AnimationController _animationController;
  late Animation<double> _scaleAnimation;
  late Animation<double> _fadeAnimation;
  bool _dontShowAgain = false;

  @override
  void initState() {
    super.initState();
    _animationController = AnimationController(
      duration: const Duration(milliseconds: 400),
      vsync: this,
    );

    _scaleAnimation = Tween<double>(begin: 0.8, end: 1.0).animate(
      CurvedAnimation(parent: _animationController, curve: Curves.easeOutCubic),
    );

    _fadeAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _animationController, curve: Curves.easeOut),
    );

    _animationController.forward();
    _loadDontShowAgainState();
  }

  Future<void> _loadDontShowAgainState() async {
    final prefs = await SharedPreferences.getInstance();
    if (mounted) {
      final expiryString = prefs.getString('hide_menu_ad_popup_expiry');
      bool isHidden = false;
      if (expiryString != null) {
        final expiryDate = DateTime.tryParse(expiryString);
        if (expiryDate != null && DateTime.now().isBefore(expiryDate)) {
          isHidden = true;
        }
      }
      setState(() {
        _dontShowAgain = isHidden;
      });
    }
  }

  Future<void> _saveDontShowAgainState(bool value) async {
    final prefs = await SharedPreferences.getInstance();
    if (value) {
      // Hide for 24 hours
      final expiry = DateTime.now().add(const Duration(hours: 24));
      await prefs.setString(
          'hide_menu_ad_popup_expiry', expiry.toIso8601String());
    } else {
      await prefs.remove('hide_menu_ad_popup_expiry');
    }
  }

  @override
  void dispose() {
    _animationController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _animationController,
      builder: (context, child) {
        return Material(
          color: Colors.transparent,
          child: Stack(
            children: [
              // Dark overlay — fades only, no scale
              Positioned.fill(
                child: FadeTransition(
                  opacity: _fadeAnimation,
                  child: GestureDetector(
                    onTap: _closePopup,
                    child: BackdropFilter(
                      filter: dart_ui.ImageFilter.blur(sigmaX: 5, sigmaY: 5),
                      child: Container(
                        color: Colors.black.withValues(alpha: 0.25),
                      ),
                    ),
                  ),
                ),
              ),
              // Card — fades + scales
              Center(
                child: FadeTransition(
                  opacity: _fadeAnimation,
                  child: ScaleTransition(
                    scale: _scaleAnimation,
                    child: Container(
                      width: MediaQuery.of(context).size.width * 0.85,
                      constraints: const BoxConstraints(maxWidth: 400),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(24),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.3),
                            blurRadius: 30,
                            offset: const Offset(0, 10),
                          ),
                        ],
                      ),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(24),
                        child: Stack(
                          clipBehavior: Clip.none,
                          children: [
                            // Poster image
                            Image.asset(
                              'assets/images/poster.jpg',
                              width: double.infinity,
                              fit: BoxFit.cover,
                              errorBuilder: (context, error, stackTrace) {
                                return Container(
                                  height: 350,
                                  color: Colors.grey.shade200,
                                  child: const Center(
                                    child: Column(
                                      mainAxisAlignment:
                                          MainAxisAlignment.center,
                                      children: [
                                        Icon(
                                          Icons.image_not_supported,
                                          size: 48,
                                          color: Colors.grey,
                                        ),
                                        SizedBox(height: 8),
                                        Text(
                                          'Poster not found',
                                          style: TextStyle(
                                            fontFamily: 'Afacad',
                                            color: Colors.grey,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                );
                              },
                            ),
                            // Close button on top right
                            Positioned(
                              top: 12,
                              right: 12,
                              child: GestureDetector(
                                onTap: _closePopup,
                                child: Container(
                                  width: 36,
                                  height: 36,
                                  decoration: BoxDecoration(
                                    color: AppColors.deepTeal
                                        .withValues(alpha: 0.85),
                                    shape: BoxShape.circle,
                                    boxShadow: [
                                      BoxShadow(
                                        color: Colors.black
                                            .withValues(alpha: 0.25),
                                        blurRadius: 8,
                                        offset: const Offset(0, 2),
                                      ),
                                    ],
                                  ),
                                  child: const Icon(
                                    Icons.close,
                                    color: Colors.white,
                                    size: 18,
                                  ),
                                ),
                              ),
                            ),
                            // "Don't show again" overlay on bottom left
                            Positioned(
                              bottom: 12,
                              left: 12,
                              child: GestureDetector(
                                behavior: HitTestBehavior.opaque,
                                onTap: () {
                                  final newVal = !_dontShowAgain;
                                  setState(() {
                                    _dontShowAgain = newVal;
                                  });
                                  _saveDontShowAgainState(newVal);
                                },
                                child: Container(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 10, vertical: 5),
                                  decoration: BoxDecoration(
                                    color: Colors.black.withValues(alpha: 0.45),
                                    borderRadius: BorderRadius.circular(16),
                                  ),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      SizedBox(
                                        width: 18,
                                        height: 18,
                                        child: Checkbox(
                                          value: _dontShowAgain,
                                          activeColor: AppColors.deepTeal,
                                          checkColor: Colors.white,
                                          side: const BorderSide(
                                              color: Colors.white, width: 1.5),
                                          shape: RoundedRectangleBorder(
                                            borderRadius:
                                                BorderRadius.circular(4),
                                          ),
                                          onChanged: (bool? val) {
                                            final newVal = val ?? false;
                                            setState(() {
                                              _dontShowAgain = newVal;
                                            });
                                            _saveDontShowAgainState(newVal);
                                          },
                                        ),
                                      ),
                                      const SizedBox(width: 6),
                                      const Text(
                                        "Don't show again",
                                        style: TextStyle(
                                          fontFamily: 'Afacad',
                                          fontSize: 12,
                                          fontWeight: FontWeight.w600,
                                          color: Colors.white,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  void _closePopup() {
    _animationController.reverse().then((_) {
      if (mounted) {
        Navigator.of(context).pop();
        widget.onClose?.call();
      }
    });
  }
}

// Helper function to show the poster popup
Future<void> showPosterPopup(BuildContext context,
    {VoidCallback? onClose}) async {
  final prefs = await SharedPreferences.getInstance();
  final expiryString = prefs.getString('hide_menu_ad_popup_expiry');
  if (expiryString != null) {
    final expiryDate = DateTime.tryParse(expiryString);
    if (expiryDate != null && DateTime.now().isBefore(expiryDate)) {
      onClose?.call();
      return;
    }
  }

  if (!context.mounted) return;

  showDialog(
    context: context,
    barrierDismissible: false,
    barrierColor: Colors.transparent,
    useSafeArea: false,
    builder: (context) => PosterPopup(onClose: onClose),
  );
}
