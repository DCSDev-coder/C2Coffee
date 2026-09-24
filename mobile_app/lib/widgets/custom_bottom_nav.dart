import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import '../utils/app_colors.dart';

class CustomBottomNav extends StatefulWidget {
  final int selectedIndex;
  final Function(int) onItemTapped;
  final Color? orangeColor;
  final ScrollController? scrollController;

  static final ValueNotifier<bool> isMinimizedNotifier =
      ValueNotifier<bool>(false);

  const CustomBottomNav({
    super.key,
    required this.selectedIndex,
    required this.onItemTapped,
    this.orangeColor,
    this.scrollController,
  });

  static void switchTab(BuildContext context, Widget targetPage) {
    Navigator.pushReplacement(
      context,
      PageRouteBuilder(
        pageBuilder: (context, animation1, animation2) => targetPage,
        transitionDuration: Duration.zero,
        reverseTransitionDuration: Duration.zero,
      ),
    );
  }

  @override
  State<CustomBottomNav> createState() => _CustomBottomNavState();
}

class _CustomBottomNavState extends State<CustomBottomNav> {
  late int _localSelectedIndex;
  bool _isNavigating = false;
  double _lastOffset = 0.0;

  // Dragging interaction state
  bool _isDragging = false;
  double _dragIndicatorFraction = 0.0; // 0.0 to 4.0
  int _lastHapticIndex = -1;

  @override
  void initState() {
    super.initState();
    _localSelectedIndex = widget.selectedIndex;
    _dragIndicatorFraction = widget.selectedIndex.toDouble();
    _lastHapticIndex = widget.selectedIndex;
    _attachScrollListener();

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      if (widget.scrollController != null &&
          widget.scrollController!.hasClients) {
        _lastOffset = widget.scrollController!.offset;
        if (widget.scrollController!.offset <= 15) {
          CustomBottomNav.isMinimizedNotifier.value = false;
        }
      } else {
        CustomBottomNav.isMinimizedNotifier.value = false;
      }
    });
  }

  @override
  void didUpdateWidget(CustomBottomNav oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.selectedIndex != widget.selectedIndex) {
      _localSelectedIndex = widget.selectedIndex;
      if (!_isDragging) {
        _dragIndicatorFraction = widget.selectedIndex.toDouble();
        _lastHapticIndex = widget.selectedIndex;
      }
    }
    if (oldWidget.scrollController != widget.scrollController) {
      oldWidget.scrollController?.removeListener(_onScroll);
      _attachScrollListener();
    }
  }

  @override
  void dispose() {
    widget.scrollController?.removeListener(_onScroll);
    super.dispose();
  }

  void _attachScrollListener() {
    widget.scrollController?.addListener(_onScroll);
  }

  void _onScroll() {
    final controller = widget.scrollController;
    if (controller == null || !controller.hasClients) return;

    final currentOffset = controller.offset;
    final delta = currentOffset - _lastOffset;
    final direction = controller.position.userScrollDirection;

    // Expand back to 1.0 when at the top of the scroll view
    if (currentOffset <= 15) {
      if (CustomBottomNav.isMinimizedNotifier.value) {
        CustomBottomNav.isMinimizedNotifier.value = false;
      }
    } else if (direction == ScrollDirection.reverse && delta > 4) {
      // User is scrolling down -> minimize
      if (!CustomBottomNav.isMinimizedNotifier.value) {
        CustomBottomNav.isMinimizedNotifier.value = true;
      }
    } else if (direction == ScrollDirection.forward && delta < -4) {
      // User is scrolling up (anywhere on page) -> expand back to normal size
      if (CustomBottomNav.isMinimizedNotifier.value) {
        CustomBottomNav.isMinimizedNotifier.value = false;
      }
    }

    _lastOffset = currentOffset;
  }

  void _handleItemTapped(int index) {
    if (index == _localSelectedIndex || _isNavigating) return;

    HapticFeedback.selectionClick();
    setState(() {
      _localSelectedIndex = index;
      _dragIndicatorFraction = index.toDouble();
      _isNavigating = true;
    });

    Future.delayed(const Duration(milliseconds: 220), () {
      if (mounted) {
        widget.onItemTapped(index);
      }
    });
  }

  void _onPanStart(DragStartDetails details, BoxConstraints constraints) {
    if (_isNavigating) return;
    setState(() {
      _isDragging = true;
      _updateDragPosition(details.localPosition.dx, constraints.maxWidth);
    });
    HapticFeedback.lightImpact();
  }

  void _onPanUpdate(DragUpdateDetails details, BoxConstraints constraints) {
    if (_isNavigating) return;
    setState(() {
      _updateDragPosition(details.localPosition.dx, constraints.maxWidth);
    });
  }

  void _updateDragPosition(double localX, double totalWidth) {
    if (totalWidth <= 0) return;
    final tabWidth = totalWidth / 5.0;
    // Map touch coordinate to continuous float index [0.0, 4.0]
    final continuousIndex = ((localX - (tabWidth / 2)) / tabWidth).clamp(0.0, 4.0);
    _dragIndicatorFraction = continuousIndex;

    final hoveredIndex = continuousIndex.round().clamp(0, 4);
    if (hoveredIndex != _lastHapticIndex) {
      _lastHapticIndex = hoveredIndex;
      HapticFeedback.selectionClick();
    }
  }

  void _onPanEnd(DragEndDetails details) {
    if (_isNavigating) return;
    _finalizeDrag();
  }

  void _onPanCancel() {
    if (_isNavigating) return;
    _finalizeDrag();
  }

  void _finalizeDrag() {
    final targetIndex = _dragIndicatorFraction.round().clamp(0, 4);

    setState(() {
      _isDragging = false;
      _dragIndicatorFraction = targetIndex.toDouble();
    });

    if (targetIndex != _localSelectedIndex) {
      setState(() {
        _localSelectedIndex = targetIndex;
        _isNavigating = true;
      });
      HapticFeedback.mediumImpact();
      Future.delayed(const Duration(milliseconds: 180), () {
        if (mounted) {
          widget.onItemTapped(targetIndex);
        }
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<bool>(
      valueListenable: CustomBottomNav.isMinimizedNotifier,
      builder: (context, isMinimized, child) {
        return AnimatedScale(
          scale: isMinimized ? 0.90 : 1.0,
          duration: const Duration(milliseconds: 260),
          curve: Curves.easeOutCubic,
          alignment: Alignment.bottomCenter,
          child: _buildContent(context),
        );
      },
    );
  }

  Widget _buildContent(BuildContext context) {
    final bool isDarkNav = AppColors.isTier3Or4;

    // High-end glassmorphism palette matching modern iOS/Threads design:
    // Sleek, translucent dark/light glass with ultra-crisp optics, no thick cartoonish borders.
    final Color glassBaseColor = isDarkNav
        ? const Color(0xFF142421).withValues(alpha: 0.82)
        : Colors.white.withValues(alpha: 0.80);

    final Color glassBorderColor = isDarkNav
        ? Colors.white.withValues(alpha: 0.12)
        : Colors.white.withValues(alpha: 0.70);

    final Color activeColor =
        isDarkNav ? AppColors.secondary : AppColors.brandText;
    final Color inactiveColor =
        isDarkNav ? AppColors.t2NavInactive.withValues(alpha: 0.60) : Colors.grey.shade400;
    final Color activePillColor = isDarkNav
        ? AppColors.secondary.withValues(alpha: 0.16)
        : AppColors.secondary.withValues(alpha: 0.12);
    final Color inactiveTextColor =
        isDarkNav ? AppColors.t2NavInactive.withValues(alpha: 0.75) : Colors.grey.shade500;

    return RepaintBoundary(
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.only(left: 24, right: 24, bottom: 6),
          child: LayoutBuilder(
            builder: (context, outerConstraints) {
              return GestureDetector(
                onHorizontalDragStart: (details) =>
                    _onPanStart(details, outerConstraints),
                onHorizontalDragUpdate: (details) =>
                    _onPanUpdate(details, outerConstraints),
                onHorizontalDragEnd: _onPanEnd,
                onHorizontalDragCancel: _onPanCancel,
                behavior: HitTestBehavior.opaque,
                child: Container(
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(32),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: isDarkNav ? 0.35 : 0.08),
                        blurRadius: 24,
                        offset: const Offset(0, 8),
                      ),
                      BoxShadow(
                        color: (isDarkNav ? AppColors.secondary : Colors.black)
                            .withValues(alpha: 0.03),
                        blurRadius: 6,
                        offset: const Offset(0, 1),
                      ),
                    ],
                  ),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(32),
                    child: BackdropFilter(
                      // Real-time smooth Gaussian blur
                      filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
                      child: Container(
                        decoration: BoxDecoration(
                          color: glassBaseColor,
                          borderRadius: BorderRadius.circular(32),
                          border: Border.all(
                            color: glassBorderColor,
                            width: 0.8,
                          ),
                        ),
                        padding: const EdgeInsets.symmetric(vertical: 6),
                        child: Stack(
                          children: [
                            // Sleek sliding & draggable active indicator pill
                            Positioned.fill(
                              child: LayoutBuilder(
                                builder: (context, constraints) {
                                  final double currentFraction = _isDragging
                                      ? _dragIndicatorFraction
                                      : _localSelectedIndex.toDouble();
                                  final double alignmentX =
                                      -1.0 + (currentFraction * 0.5);

                                  return AnimatedAlign(
                                    duration: _isDragging
                                        ? Duration.zero
                                        : const Duration(milliseconds: 240),
                                    curve: Curves.easeOutCubic,
                                    alignment: Alignment(alignmentX, 0),
                                    child: Container(
                                      width: constraints.maxWidth / 5,
                                      padding: const EdgeInsets.symmetric(
                                          horizontal: 6, vertical: 2),
                                      child: AnimatedContainer(
                                        duration: const Duration(
                                            milliseconds: 160),
                                        decoration: BoxDecoration(
                                          color: activePillColor,
                                          borderRadius:
                                              BorderRadius.circular(20),
                                          border: Border.all(
                                            color: (isDarkNav
                                                    ? AppColors.secondary
                                                    : AppColors.secondary)
                                                .withValues(
                                                    alpha: _isDragging
                                                        ? 0.35
                                                        : 0.18),
                                            width: 0.8,
                                          ),
                                          boxShadow: [
                                            if (_isDragging)
                                              BoxShadow(
                                                color: activeColor.withValues(
                                                    alpha: 0.20),
                                                blurRadius: 12,
                                                spreadRadius: 1,
                                              ),
                                          ],
                                        ),
                                      ),
                                    ),
                                  );
                                },
                              ),
                            ),

                            // Interactive navigation items (consistent heights to prevent layout jumping)
                            Row(
                              children: [
                                _buildNavItem(
                                    Icons.home_rounded,
                                    Icons.home_outlined,
                                    'Home',
                                    0,
                                    activeColor,
                                    inactiveColor,
                                    inactiveTextColor),
                                _buildNavItem(
                                    Icons.local_cafe_rounded,
                                    Icons.local_cafe_outlined,
                                    'Menu',
                                    1,
                                    activeColor,
                                    inactiveColor,
                                    inactiveTextColor),
                                _buildNavItem(
                                    Icons.receipt_rounded,
                                    Icons.receipt_outlined,
                                    'Orders',
                                    2,
                                    activeColor,
                                    inactiveColor,
                                    inactiveTextColor),
                                _buildNavItem(
                                    Icons.card_giftcard_rounded,
                                    Icons.card_giftcard_outlined,
                                    'Rewards',
                                    3,
                                    activeColor,
                                    inactiveColor,
                                    inactiveTextColor),
                                _buildNavItem(
                                    Icons.person_rounded,
                                    Icons.person_outline_rounded,
                                    'Account',
                                    4,
                                    activeColor,
                                    inactiveColor,
                                    inactiveTextColor),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              );
            },
          ),
        ),
      ),
    );
  }

  Widget _buildNavItem(
    IconData activeIcon,
    IconData inactiveIcon,
    String label,
    int index,
    Color activeColor,
    Color inactiveColor,
    Color inactiveTextColor,
  ) {
    // When dragging, highlight whichever item is closest to current fraction
    final bool isHighlighted = _isDragging
        ? _dragIndicatorFraction.round() == index
        : _localSelectedIndex == index;

    final Color iconColor = isHighlighted ? activeColor : inactiveColor;
    final Color textColor = isHighlighted ? activeColor : inactiveTextColor;

    return Expanded(
      child: GestureDetector(
        onTap: () => _handleItemTapped(index),
        behavior: HitTestBehavior.opaque,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 4),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              AnimatedScale(
                scale: isHighlighted && _isDragging ? 1.10 : 1.0,
                duration: const Duration(milliseconds: 140),
                child: Icon(
                  isHighlighted ? activeIcon : inactiveIcon,
                  color: iconColor,
                  size: 23,
                ),
              ),
              const SizedBox(height: 3),
              AnimatedDefaultTextStyle(
                duration: const Duration(milliseconds: 160),
                style: TextStyle(
                  fontFamily: 'Afacad',
                  fontSize: 11,
                  letterSpacing: 0.2,
                  fontWeight: isHighlighted ? FontWeight.w600 : FontWeight.w500,
                  color: textColor,
                ),
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

