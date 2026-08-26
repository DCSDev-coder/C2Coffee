import 'dart:async';
import 'package:flutter/material.dart';
import 'current_order_page.dart';
import '../widgets/floating_bottom_nav.dart';

import 'settings_page.dart';
import '../services/api_service.dart';
import '../widgets/order_card.dart';
import '../main.dart';

class MainLayout extends StatefulWidget {
  const MainLayout({super.key});

  @override
  State<MainLayout> createState() => _MainLayoutState();
}

class _MainLayoutState extends State<MainLayout> {
  // Start on Current Orders (index 0)
  int _currentIndex = 0;
  late final PageController _pageController;
  Timer? _refreshTimer;

  @override
  void initState() {
    super.initState();
    _pageController = PageController(initialPage: _currentIndex);
    _loadInitialOrders();
    // Auto-refresh every 10 seconds
    _refreshTimer = Timer.periodic(const Duration(seconds: 10), (_) {
      _loadInitialOrders();
    });
  }

  Future<void> _loadInitialOrders() async {
    try {
      final fetchedOrders = await ApiService.fetchOrders();
      if (fetchedOrders.isNotEmpty) {
        globalCurrentOrders.value = fetchedOrders
            .where((o) => o.status != OrderStatus.completed)
            .toList();
        globalHistoryOrders.value = fetchedOrders
            .where((o) => o.status == OrderStatus.completed)
            .toList();
      }
    } catch (e) {
      debugPrint('Failed to fetch initial orders: $e');
    }
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
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
      duration: const Duration(milliseconds: 200),
      curve: Curves.easeInOut,
    );
  }

  @override
  Widget build(BuildContext context) {
    // Map integer index to NavPage enum
    NavPage activePage;
    if (_currentIndex == 0) {
      activePage = NavPage.currentOrder;
    } else {
      activePage = NavPage.settings;
    }

    return Scaffold(
      backgroundColor: Colors.white,
      body: Stack(
        children: [
          PageView(
            physics: const BouncingScrollPhysics(),
            controller: _pageController,
            onPageChanged: (index) {
              setState(() {
                _currentIndex = index;
              });
            },
            children: [
              CurrentOrderPage(
                onSettingsTap: () => _onTabSelected(1),
              ),
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
