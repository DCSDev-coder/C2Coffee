import 'package:flutter/material.dart';
import '../utils/app_colors.dart';

class CustomBottomNav extends StatefulWidget {
  final int selectedIndex;
  final Function(int) onItemTapped;
  final Color? orangeColor;
  final ScrollController? scrollController;

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

  @override
  void initState() {
    super.initState();
    _localSelectedIndex = widget.selectedIndex;
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
    if (widget.scrollController == null) {
      return _buildContent(context, 1.0);
    }
    return AnimatedBuilder(
      animation: widget.scrollController!,
      builder: (context, child) {
        double offset = 0.0;
        if (widget.scrollController!.hasClients) {
          offset = widget.scrollController!.offset;
        }
        // Normalize offset between 0.0 (top) and 150.0 (scrolled)
        double progress = (offset / 150.0).clamp(0.0, 1.0);
        // Scale from 1.0 down to 0.9
        double scale = 1.0 - (0.10 * progress);
        return _buildContent(context, scale);
      },
    );
  }

  Widget _buildContent(BuildContext context, double scale) {
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

    return Transform.scale(
      scale: scale,
      alignment: Alignment.bottomCenter,
      child: RepaintBoundary(
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
