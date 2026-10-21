import 'package:flutter/material.dart';

enum NavPage { currentOrder, timetable, sideWork, settings }

class FloatingBottomNav extends StatelessWidget {
  const FloatingBottomNav({
    super.key,
    required this.activePage,
    required this.onTabSelected,
  });

  final NavPage activePage;
  final ValueChanged<int> onTabSelected;

  static const _darkGreen = Color(0xFF304A3A);

  @override
  Widget build(BuildContext context) {
    final screenWidth = MediaQuery.sizeOf(context).width;
    final barWidth = (screenWidth - 32).clamp(0.0, 720.0);
    final horizontalOffset = (screenWidth - barWidth) / 2;
    const items = [
      (Icons.shopping_basket_outlined, Icons.shopping_basket_rounded, 'Orders'),
      (
        Icons.calendar_month_outlined,
        Icons.calendar_month_rounded,
        'Timetable',
      ),
      (Icons.checklist_outlined, Icons.checklist_rounded, 'Side work'),
      (Icons.settings_outlined, Icons.settings_rounded, 'Settings'),
    ];

    return Positioned(
      left: horizontalOffset,
      right: horizontalOffset,
      bottom: 20,
      child: SafeArea(
        top: false,
        child: Material(
          color: _darkGreen,
          elevation: 14,
          shadowColor: Colors.black26,
          borderRadius: BorderRadius.circular(30),
          child: SizedBox(
            height: 76,
            child: Row(
              children: List.generate(items.length, (index) {
                final selected = activePage.index == index;
                final item = items[index];
                return Expanded(
                  child: Semantics(
                    selected: selected,
                    button: true,
                    label: item.$3,
                    child: InkWell(
                      borderRadius: BorderRadius.circular(28),
                      onTap: () => onTabSelected(index),
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 180),
                        margin: const EdgeInsets.symmetric(
                          horizontal: 5,
                          vertical: 8,
                        ),
                        decoration: BoxDecoration(
                          color: selected ? Colors.white : Colors.transparent,
                          borderRadius: BorderRadius.circular(22),
                        ),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              selected ? item.$2 : item.$1,
                              color: selected ? _darkGreen : Colors.white70,
                              size: 24,
                            ),
                            const SizedBox(height: 3),
                            Text(
                              item.$3,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                color: selected ? _darkGreen : Colors.white70,
                                fontSize: 12,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                );
              }),
            ),
          ),
        ),
      ),
    );
  }
}
