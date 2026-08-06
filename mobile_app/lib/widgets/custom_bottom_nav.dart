import 'package:flutter/material.dart';
import '../utils/app_colors.dart';

class CustomBottomNav extends StatelessWidget {
  final int selectedIndex;
  final Function(int) onItemTapped;
  final Color? orangeColor;

  const CustomBottomNav({
    super.key,
    required this.selectedIndex,
    required this.onItemTapped,
    this.orangeColor,
  });

  @override
  Widget build(BuildContext context) {
    final bool isDarkNav = AppColors.isTier3Or4;

    final Color barColor = isDarkNav ? AppColors.t2DeepForest : Colors.white;
    final Color activeColor = isDarkNav ? Colors.white : AppColors.t1DeepTeal;
    final Color inactiveColor = isDarkNav ? AppColors.t2NavInactive : Colors.grey.shade400;
    final Color activePillColor = isDarkNav
        ? Colors.white.withValues(alpha: 0.2)
        : AppColors.t1DeepTeal.withValues(alpha: 0.12);
    final Color inactiveTextColor = isDarkNav ? AppColors.t2NavInactive : Colors.grey.shade600;

    return RepaintBoundary(
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.only(left: 20, right: 20, bottom: 16),
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
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  _buildNavItem(Icons.home, Icons.home_outlined, 'Home', 0, activeColor, inactiveColor, activePillColor, inactiveTextColor),
                  _buildNavItem(Icons.local_cafe, Icons.local_cafe_outlined, 'Menu', 1, activeColor, inactiveColor, activePillColor, inactiveTextColor),
                  _buildNavItem(Icons.receipt_long, Icons.receipt_long_outlined, 'Orders', 2, activeColor, inactiveColor, activePillColor, inactiveTextColor),
                  _buildNavItem(Icons.card_giftcard, Icons.card_giftcard_outlined, 'Rewards', 3, activeColor, inactiveColor, activePillColor, inactiveTextColor),
                  _buildNavItem(Icons.person, Icons.person_outline, 'Account', 4, activeColor, inactiveColor, activePillColor, inactiveTextColor),
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
    Color activePillColor,
    Color inactiveTextColor,
  ) {
    final bool isSelected = selectedIndex == index;
    final Color iconColor = isSelected ? activeColor : inactiveColor;
    final Color textColor = isSelected ? activeColor : inactiveTextColor;

    return GestureDetector(
      onTap: () => onItemTapped(index),
      behavior: HitTestBehavior.opaque,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
            decoration: BoxDecoration(
              color: isSelected ? activePillColor : Colors.transparent,
              borderRadius: BorderRadius.circular(16),
            ),
            child: Icon(
              isSelected ? activeIcon : inactiveIcon,
              color: iconColor,
              size: 22,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: TextStyle(
              fontFamily: 'Afacad',
              fontSize: 10,
              fontWeight: isSelected ? FontWeight.bold : FontWeight.w600,
              color: textColor,
            ),
          ),
        ],
      ),
    );
  }
}
