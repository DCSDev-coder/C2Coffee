import 'dart:async';
import 'package:flutter/material.dart';
import 'current_order_page.dart';
import '../widgets/floating_bottom_nav.dart';

import 'settings_page.dart';
import '../services/api_service.dart';
import '../services/direct_printer_service.dart';
import '../services/push_notification_service.dart';
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
  bool _isRefreshingOrders = false;

  @override
  void initState() {
    super.initState();
    _pageController = PageController(initialPage: _currentIndex);
    PushNotificationService.instance.setNewOrderHandler(_handleNewOrderPush);
    _loadInitialOrders();
    // Keep the queue current without relying on a manual refresh.
    _refreshTimer = Timer.periodic(const Duration(seconds: 5), (_) {
      _loadInitialOrders();
    });
  }

  Future<void> _loadInitialOrders() async {
    if (_isRefreshingOrders) return;
    _isRefreshingOrders = true;
    try {
      final result = await ApiService.fetchOrders();
      if (!result.isSuccess) {
        globalOrderSyncError.value = result.errorMessage;
        return;
      }
      final fetchedOrders = result.orders;
      globalCurrentOrders.value = fetchedOrders
          .where(
            (o) =>
                o.status != OrderStatus.completed &&
                o.status != OrderStatus.readyForPickup,
          )
          .toList();
      globalHistoryOrders.value = fetchedOrders
          .where((o) => o.status == OrderStatus.completed)
          .toList();
      globalOrderSyncError.value = null;
      globalLastOrderSync.value = DateTime.now();
      final processedDirectJob =
          await PushNotificationService.instance.processDirectPrintJobs();
      if (!processedDirectJob) {
        await DirectPrinterService.instance.printNewOrders(fetchedOrders);
      }
    } catch (e) {
      debugPrint('Failed to fetch initial orders: $e');
    } finally {
      _isRefreshingOrders = false;
    }
  }

  Future<void> _handleNewOrderPush() async {
    await _loadInitialOrders();
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('A new order is waiting to be prepared.')),
    );
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    PushNotificationService.instance.setNewOrderHandler(null);
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
              CurrentOrderPage(onSettingsTap: () => _onTabSelected(1)),
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
