import 'dart:ui' as dart_ui;
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/catalog_api_service.dart';
import '../utils/app_colors.dart';

class PosterPopup extends StatefulWidget {
  final HomeBanner? banner;
  final VoidCallback? onClose;

  const PosterPopup({super.key, this.banner, this.onClose});

  @override
  State<PosterPopup> createState() => _PosterPopupState();
}

class _PosterPopupState extends State<PosterPopup>
    with SingleTickerProviderStateMixin {
  late AnimationController _animationController;
  late Animation<double> _scaleAnimation;
  late Animation<double> _fadeAnimation;
  bool _dontShowAgain = false;

  String get _dismissPreferenceKey {
    final code = (widget.banner?.code ?? '').trim();
    if (code.isEmpty) {
      return 'hide_menu_ad_popup_expiry';
    }
    return 'hide_menu_ad_popup_expiry_$code';
  }

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
      final expiryString = prefs.getString(_dismissPreferenceKey);
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
      await prefs.setString(_dismissPreferenceKey, expiry.toIso8601String());
    } else {
      await prefs.remove(_dismissPreferenceKey);
    }
  }

  @override
  void dispose() {
    _animationController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final banner = widget.banner;

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
                      constraints: const BoxConstraints(maxWidth: 420),
                      decoration: BoxDecoration(
                        color: Colors.white,
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
                          children: [
                            AspectRatio(
                              aspectRatio: 0.82,
                              child: Stack(
                                fit: StackFit.expand,
                                children: [
                                  _buildPosterImage(banner),
                                  Positioned(
                                    left: 14,
                                    bottom: 14,
                                    child: GestureDetector(
                                      behavior: HitTestBehavior.opaque,
                                      onTap: () {
                                        final newVal = !_dontShowAgain;
                                        setState(() {
                                          _dontShowAgain = newVal;
                                        });
                                        _saveDontShowAgainState(newVal);
                                      },
                                      child: AnimatedContainer(
                                        duration:
                                            const Duration(milliseconds: 180),
                                        padding: const EdgeInsets.symmetric(
                                          horizontal: 12,
                                          vertical: 9,
                                        ),
                                        decoration: BoxDecoration(
                                          color: Colors.black.withValues(
                                            alpha: 0.42,
                                          ),
                                          borderRadius:
                                              BorderRadius.circular(999),
                                          border: Border.all(
                                            color: Colors.white.withValues(
                                              alpha: 0.18,
                                            ),
                                          ),
                                        ),
                                        child: Row(
                                          mainAxisSize: MainAxisSize.min,
                                          children: [
                                            AnimatedContainer(
                                              duration: const Duration(
                                                milliseconds: 180,
                                              ),
                                              width: 18,
                                              height: 18,
                                              decoration: BoxDecoration(
                                                color: _dontShowAgain
                                                    ? AppColors.deepTeal
                                                    : Colors.transparent,
                                                borderRadius:
                                                    BorderRadius.circular(5),
                                                border: Border.all(
                                                  color: Colors.white,
                                                  width: 1.5,
                                                ),
                                              ),
                                              child: _dontShowAgain
                                                  ? const Icon(
                                                      Icons.check,
                                                      size: 12,
                                                      color: Colors.white,
                                                    )
                                                  : null,
                                            ),
                                            const SizedBox(width: 8),
                                            const Text(
                                              "Don't show again",
                                              style: TextStyle(
                                                fontFamily: 'Afacad',
                                                fontSize: 12,
                                                fontWeight: FontWeight.w700,
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
                            Positioned(
                              top: 12,
                              right: 12,
                              child: GestureDetector(
                                onTap: _closePopup,
                                child: Container(
                                  width: 36,
                                  height: 36,
                                  decoration: BoxDecoration(
                                    color: AppColors.deepTeal.withValues(alpha: 0.85),
                                    shape: BoxShape.circle,
                                    boxShadow: [
                                      BoxShadow(
                                        color: Colors.black.withValues(alpha: 0.25),
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

  Widget _buildPosterImage(HomeBanner? banner) {
    final resolvedSource = resolveCatalogImageSource(banner?.imageSource);
    if (resolvedSource == null) {
      return Container(
        color: const Color(0xFFF3F4F6),
        alignment: Alignment.center,
        child: const Text(
          'Poster unavailable',
          style: TextStyle(
            fontFamily: 'Afacad',
            fontSize: 14,
            fontWeight: FontWeight.w700,
            color: Color(0xFF6B7280),
          ),
        ),
      );
    }

    if (resolvedSource.startsWith('http://') ||
        resolvedSource.startsWith('https://')) {
      return Image.network(
        resolvedSource,
        width: double.infinity,
        fit: BoxFit.cover,
        errorBuilder: (context, error, stackTrace) =>
            _buildPosterFallback(),
      );
    }

    return Image.asset(
      resolvedSource,
      width: double.infinity,
      fit: BoxFit.cover,
      errorBuilder: (context, error, stackTrace) => _buildPosterFallback(),
    );
  }

  Widget _buildPosterFallback() {
    return Container(
      color: const Color(0xFFF3F4F6),
      alignment: Alignment.center,
      child: Image.asset(
        'assets/images/c2_logo.png',
        width: 84,
        height: 84,
        fit: BoxFit.contain,
      ),
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
    {HomeBanner? banner, VoidCallback? onClose}) async {
  if (banner == null) {
    onClose?.call();
    return;
  }

  final prefs = await SharedPreferences.getInstance();
  final code = banner.code.trim();
  final dismissKey = code.isEmpty
      ? 'hide_menu_ad_popup_expiry'
      : 'hide_menu_ad_popup_expiry_$code';
  final expiryString = prefs.getString(dismissKey);
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
    builder: (context) => PosterPopup(banner: banner, onClose: onClose),
  );
}
