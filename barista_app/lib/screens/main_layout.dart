import 'package:flutter/material.dart';
import 'current_order_page.dart';
import 'history_page.dart';
import '../widgets/floating_bottom_nav.dart';

import 'settings_page.dart';

class MainLayout extends StatefulWidget {
  const MainLayout({super.key});

  @override
  State<MainLayout> createState() => _MainLayoutState();
}

class _MainLayoutState extends State<MainLayout> {
  // Start on Current Orders (index 1)
  int _currentIndex = 1;
  late final PageController _pageController;

  @override
  void initState() {
    super.initState();
    _pageController = PageController(initialPage: _currentIndex);
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  void _onTabSelected(int index) {
    if (_currentIndex == index) return;
    setState(() {
      _currentIndex = index;
    });
    _pageController.animateToPage(
      index,
      duration: const Duration(milliseconds: 350),
      curve: Curves.easeOutCubic,
    );
  }

  @override
  Widget build(BuildContext context) {
    // Map integer index to NavPage enum
    NavPage activePage;
    if (_currentIndex == 0) {
      activePage = NavPage.history;
    } else if (_currentIndex == 1) {
      activePage = NavPage.currentOrder;
    } else {
      activePage = NavPage.settings;
    }

    return Scaffold(
      backgroundColor: Colors.white,
      body: Stack(
        children: [
          PageView(
            controller: _pageController,
            onPageChanged: (index) {
              setState(() {
                _currentIndex = index;
              });
            },
            children: [
              const HistoryPage(),
              const CurrentOrderPage(),
              const SettingsPage(),
            ],
          ),
          
          FloatingBottomNav(
            activePage: activePage,
            onTabSelected: _onTabSelected,
            pageController: _pageController,
          ),
        ],
      ),
    );
  }
}
