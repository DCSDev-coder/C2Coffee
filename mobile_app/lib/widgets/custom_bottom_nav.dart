import 'package:flutter/material.dart';

class CustomBottomNav extends StatelessWidget {
  final int selectedIndex;
  final Function(int) onItemTapped;
  final Color orangeColor;

  const CustomBottomNav({
    super.key,
    required this.selectedIndex,
    required this.onItemTapped,
    this.orangeColor = const Color(0xFF2E5E58),
  });

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.only(left: 20, right: 20, bottom: 16),
        child: Container(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(30),
            border: Border.all(
              color: Colors.black.withValues(alpha: 0.06),
              width: 1,
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.08),
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
                _buildNavItem(Icons.home, Icons.home_outlined, 'Home', 0),
                _buildNavItem(Icons.local_cafe, Icons.local_cafe_outlined, 'Menu', 1),
                _buildNavItem(Icons.receipt_long, Icons.receipt_long_outlined, 'Orders', 2),
                _buildNavItem(Icons.card_giftcard, Icons.card_giftcard_outlined, 'Rewards', 3),
                _buildNavItem(Icons.person, Icons.person_outline, 'Account', 4),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildNavItem(
      IconData activeIcon, IconData inactiveIcon, String label, int index) {
    final bool isSelected = selectedIndex == index;
    final Color color = isSelected ? orangeColor : Colors.grey.shade400;

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
              color: isSelected
                  ? orangeColor.withValues(alpha: 0.12)
                  : Colors.transparent,
              borderRadius: BorderRadius.circular(16),
            ),
            child: Icon(
              isSelected ? activeIcon : inactiveIcon,
              color: color,
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
              color: isSelected ? orangeColor : Colors.grey.shade600,
            ),
          ),
        ],
      ),
    );
  }
}
