import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
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

  @override
  void initState() {
    super.initState();
    _localSelectedIndex = widget.selectedIndex;
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

    setState(() {
      _localSelectedIndex = index;
      _isNavigating = true;
    });

    Future.delayed(const Duration(milliseconds: 250), () {
      if (mounted) {
        widget.onItemTapped(index);
      }
    });
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

    final Color barColor = isDarkNav ? AppColors.t2DeepForest : Colors.white;
    final Color activeColor = isDarkNav ? Colors.white : AppColors.t1DeepTeal;
    final Color inactiveColor =
        isDarkNav ? AppColors.t2NavInactive : Colors.grey.shade400;
    final Color activePillColor = isDarkNav
        ? Colors.white.withValues(alpha: 0.2)
        : AppColors.t1DeepTeal.withValues(alpha: 0.12);
    final Color inactiveTextColor =
        isDarkNav ? AppColors.t2NavInactive : Colors.grey.shade600;

    return RepaintBoundary(
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.only(left: 20, right: 20),
            child: Container(
              decoration: BoxDecoration(
                color: barColor,
                borderRadius: BorderRadius.circular(30),
                border: Border.all(
                  color: isDarkNav
                      ? Colors.white.withValues(alpha: 0.12)
                      : Colors.black.withValues(alpha: 0.06),
                  width: 1,
                ),
                boxShadow: [
                  BoxShadow(
                    color: isDarkNav
                        ? AppColors.t2DeepForest.withValues(alpha: 0.35)
                        : Colors.black.withValues(alpha: 0.08),
                    blurRadius: 16,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 8),
                child: Stack(
                  children: [
                    // Sliding pill background
                    Positioned.fill(
                      child: AnimatedAlign(
                        duration: const Duration(milliseconds: 250),
                        curve: Curves.easeOutCubic,
                        alignment:
                            Alignment(-1.0 + (_localSelectedIndex * 0.5), 0),
                        child: LayoutBuilder(builder: (context, constraints) {
                          return Container(
                            width: constraints.maxWidth / 5,
                            padding: const EdgeInsets.symmetric(
                                horizontal: 4, vertical: 0),
                            child: Container(
                              decoration: BoxDecoration(
                                color: activePillColor,
                                borderRadius: BorderRadius.circular(20),
                              ),
                            ),
                          );
                        }),
                      ),
                    ),
                    // Icons
                    Row(
                      children: [
                        _buildNavItem(Icons.home, Icons.home_outlined, 'Home',
                            0, activeColor, inactiveColor, inactiveTextColor),
                        _buildNavItem(
                            Icons.local_cafe,
                            Icons.local_cafe_outlined,
                            'Menu',
                            1,
                            activeColor,
                            inactiveColor,
                            inactiveTextColor),
                        _buildNavItem(
                            Icons.receipt_long,
                            Icons.receipt_long_outlined,
                            'Orders',
                            2,
                            activeColor,
                            inactiveColor,
                            inactiveTextColor),
                        _buildNavItem(
                            Icons.card_giftcard,
                            Icons.card_giftcard_outlined,
                            'Rewards',
                            3,
                            activeColor,
                            inactiveColor,
                            inactiveTextColor),
                        _buildNavItem(
                            Icons.person,
                            Icons.person_outline,
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
    final bool isSelected = _localSelectedIndex == index;
    final Color iconColor = isSelected ? activeColor : inactiveColor;
    final Color textColor = isSelected ? activeColor : inactiveTextColor;

    return Expanded(
      child: GestureDetector(
        onTap: () => _handleItemTapped(index),
        behavior: HitTestBehavior.opaque,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Icon(
                isSelected ? activeIcon : inactiveIcon,
                color: iconColor,
                size: 26,
              ),
            ),
            if (isSelected) ...[
              const SizedBox(height: 2),
              Text(
                label,
                style: TextStyle(
                  fontFamily: 'Afacad',
                  fontSize: 10,
                  fontWeight: FontWeight.bold,
                  color: textColor,
                ),
              ),
            ]
          ],
        ),
      ),
    );
  }
}
