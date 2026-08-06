import 'package:flutter/material.dart';
import '../widgets/custom_bottom_nav.dart';
import 'home_page.dart';
import 'menu_page.dart';
import 'profile_page.dart';
import 'rewards_page.dart';
import 'loading_order_page.dart';
import 'dart:io';
import 'order_details_page.dart';
import '../widgets/order_status_banner.dart';
import '../utils/app_colors.dart';

class OrdersPage extends StatefulWidget {
  final File? initialPickedImage;
  final String? initialPresetPath;
  final int initialAvatarIndex;
  final int initialTabIndex;

  const OrdersPage({
    super.key,
    this.initialPickedImage,
    this.initialPresetPath,
    this.initialAvatarIndex = 0,
    this.initialTabIndex = 0,
  });

  @override
  State<OrdersPage> createState() => _OrdersPageState();
}

class _OrdersPageState extends State<OrdersPage>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  Color get orangeColor => AppColors.deepTeal;
  final Color bgColor = Colors.white;

  final List<Map<String, dynamic>> _purchaseHistory = [
    {
      'id': '1',
      'date': '11/02/2026',
      'time': '10.30 am',
      'name': 'Mont Broga',
      'details':
          'Dato Blend / Hot / Fresh Milk /\nReg. Sweet / Reg. Ice /\nTake Away',
      'remarks': 'None',
      'quantity': 1,
      'image': 'assets/images/drinks/SHAKERATO BIANCO.png',
    },
    {
      'id': '2',
      'date': '11/02/2026',
      'time': '10.30 am',
      'name': 'Mont Broga',
      'details':
          'Dato Blend / Hot / Fresh Milk /\nReg. Sweet / Reg. Ice /\nTake Away',
      'remarks': 'None',
      'quantity': 1,
      'image': 'assets/images/drinks/SHAKERATO BIANCO.png',
    },
  ];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(
      length: 2,
      vsync: this,
      initialIndex: widget.initialTabIndex,
    );
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  void _onBottomNavTapped(int index) {
    if (index == 2) return;

    Widget target;
    switch (index) {
      case 0:
        target = HomePage(
          initialPickedImage: widget.initialPickedImage,
          initialPresetPath: widget.initialPresetPath,
          initialAvatarIndex: widget.initialAvatarIndex,
        );
        break;
      case 1:
        target = const MenuPage();
        break;
      case 3:
        target = RewardsPage(
          initialPickedImage: widget.initialPickedImage,
          initialPresetPath: widget.initialPresetPath,
          initialAvatarIndex: widget.initialAvatarIndex,
        );
        break;
      case 4:
        target = ProfilePage(
          initialPickedImage: widget.initialPickedImage,
          initialPresetPath: widget.initialPresetPath,
          initialAvatarIndex: widget.initialAvatarIndex,
        );
        break;
      default:
        return;
    }

    InteractiveFillingLoader.show(context, targetPage: target);
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: true,
      child: Scaffold(
        backgroundColor: bgColor,
        extendBody: true,
        bottomNavigationBar: CustomBottomNav(
          selectedIndex: 2,
          onItemTapped: _onBottomNavTapped,
        ),
        body: Stack(
          children: [
            Column(
              children: [
                // Header
                Container(
                  width: double.infinity,
                  padding: EdgeInsets.only(
                      top: MediaQuery.paddingOf(context).top + 14,
                      bottom: 16,
                      left: 20,
                      right: 20),
                  decoration: BoxDecoration(
                    color: AppColors.deepTeal,
                    borderRadius: const BorderRadius.only(
                      bottomLeft: Radius.circular(20),
                      bottomRight: Radius.circular(20),
                    ),
                  ),
                  child: Stack(
                    alignment: Alignment.center,
                    children: [
                      Align(
                        alignment: Alignment.centerLeft,
                        child: GestureDetector(
                          onTap: () =>
                              InteractiveFillingLoader.showPop(context),
                          child: const Icon(Icons.arrow_back_ios,
                              color: Colors.white, size: 20),
                        ),
                      ),
                      const Text(
                        'MY ORDER',
                        style: TextStyle(
                          fontFamily: 'Recoleta',
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                          color: Colors.white,
                          letterSpacing: 1.0,
                        ),
                      ),
                    ],
                  ),
                ),

                // Tabs
                Container(
                  alignment: Alignment.centerLeft,
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: TabBar(
                    controller: _tabController,
                    isScrollable: true,
                    tabAlignment: TabAlignment.start,
                    dividerColor: Colors.transparent,
                    indicatorColor: orangeColor,
                    labelColor: orangeColor,
                    unselectedLabelColor: Colors.grey.shade500,
                    indicatorSize: TabBarIndicatorSize.label,
                    labelStyle: const TextStyle(
                      fontFamily: 'Afacad',
                      fontWeight: FontWeight.bold,
                      fontSize: 16,
                    ),
                    tabs: const [
                      Tab(text: 'Stores Orders'),
                      Tab(text: 'Purchase History'),
                    ],
                  ),
                ),

                // Tab Content
                Expanded(
                  child: TabBarView(
                    controller: _tabController,
                    physics: const NeverScrollableScrollPhysics(),
                    children: [
                      _buildStoresOrdersTab(),
                      _buildPurchaseHistoryTab(),
                    ],
                  ),
                ),
              ],
            ),
            OrderStatusBanner(
                bottomOffset: 90 + MediaQuery.paddingOf(context).bottom),
          ],
        ),
      ),
    );
  }

  Widget _buildStoresOrdersTab() {
    return ListView(
      padding: const EdgeInsets.only(left: 16, right: 16, top: 16, bottom: 120),
      children: [
        _buildStoreOrderCard(),
        const SizedBox(height: 24),
        const Center(
          child: Text(
            'All loading completed',
            style: TextStyle(
              fontFamily: 'Afacad',
              fontSize: 14,
              color: Colors.black87,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildPurchaseHistoryTab() {
    return ListView.builder(
      padding: const EdgeInsets.only(left: 16, right: 16, top: 16, bottom: 120),
      itemCount: _purchaseHistory.length + 1,
      itemBuilder: (context, index) {
        if (index == _purchaseHistory.length) {
          return const Padding(
            padding: EdgeInsets.only(top: 24),
            child: Center(
              child: Text(
                'All loading completed',
                style: TextStyle(
                  fontFamily: 'Afacad',
                  fontSize: 14,
                  color: Colors.black87,
                ),
              ),
            ),
          );
        }

        final item = _purchaseHistory[index];
        return Padding(
          padding: const EdgeInsets.only(bottom: 16),
          child: Dismissible(
            key: Key(item['id']),
            direction: DismissDirection.endToStart,
            background: Container(
              alignment: Alignment.centerRight,
              padding: const EdgeInsets.symmetric(horizontal: 20),
              decoration: BoxDecoration(
                color: Colors.red,
                borderRadius: BorderRadius.circular(16),
              ),
              child: const Icon(Icons.delete, color: Colors.white),
            ),
            onDismissed: (direction) {
              setState(() {
                _purchaseHistory.removeAt(index);
              });
            },
            child: GestureDetector(
              onTap: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (context) => OrderDetailsPage(item: item),
                  ),
                );
              },
              child: _buildHistoryCard(item),
            ),
          ),
        );
      },
    );
  }

  Widget _buildStoreOrderCard() {
    return GestureDetector(
      onTap: () {
        InteractiveFillingLoader.show(
          context,
          targetPage: OrderDetailsPage(
            item: {
              'name': 'Mont Broga',
              'price': AppColors.formatDiscountedPrice('RM 16.90', isDrink: true),
              'image': 'assets/images/drinks/SHAKERATO BIANCO.png',
              'status': 'Finished',
              'id': 'store-1',
              'date': '29/04',
              'time': '16:04',
              'quantity': 1,
              'details':
                  'Dato Blend / Hot / Fresh Milk /\nReg. Sweet / Reg. Ice /\nTake Away',
              'remarks': 'None',
            },
          ),
        );
      },
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: AppColors.border,
            width: 1,
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.03),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Pickup',
                  style: TextStyle(
                    fontFamily: 'Recoleta',
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: AppColors.deepTeal,
                  ),
                ),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: AppColors.accent.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    'Finished',
                    style: TextStyle(
                      fontFamily: 'Afacad',
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                      color: AppColors.accent,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Image.asset(
                  'assets/images/drinks/SHAKERATO BIANCO.png',
                  width: 60,
                  height: 80,
                  fit: BoxFit.contain,
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            'Mont Broga',
                            style: TextStyle(
                              fontFamily: 'Recoleta',
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                              color: AppColors.deepTeal,
                            ),
                          ),
                          Text(
                            'x1',
                            style: TextStyle(
                              fontFamily: 'Afacad',
                              fontSize: 20,
                              fontWeight: FontWeight.bold,
                              color: AppColors.deepTeal,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Dato Blend / Hot / Fresh Milk /\nReg. Sweet / Reg. Ice /\nTake Away',
                        style: TextStyle(
                          fontFamily: 'Afacad',
                          fontSize: 14,
                          color: AppColors.charcoal,
                        ),
                      ),
                      const SizedBox(height: 4),
                      const Text(
                        'Remarks: None',
                        style: TextStyle(
                          fontFamily: 'Afacad',
                          fontSize: 14,
                          color: Colors.black54,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            const Divider(height: 1),
            const SizedBox(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                RichText(
                  text: TextSpan(
                    text: 'RM ',
                    style: TextStyle(
                      fontFamily: 'Afacad',
                      fontSize: 16,
                      color: AppColors.deepTeal,
                      fontWeight: FontWeight.bold,
                    ),
                    children: [
                      TextSpan(
                        text: AppColors.getDiscountedDrinkPrice(16.90)
                            .toStringAsFixed(2),
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHistoryCard(Map<String, dynamic> item) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: AppColors.border,
          width: 1,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Image.asset(
            item['image'],
            width: 60,
            height: 80,
            fit: BoxFit.contain,
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${item['date']} . ${item['time']}',
                  style: const TextStyle(
                    fontFamily: 'Afacad',
                    fontSize: 12,
                    color: Colors.black54,
                  ),
                ),
                const SizedBox(height: 4),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      item['name'],
                      style: TextStyle(
                        fontFamily: 'Recoleta',
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: AppColors.deepTeal,
                      ),
                    ),
                    Text(
                      'x${item['quantity']}',
                      style: TextStyle(
                        fontFamily: 'Afacad',
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                        color: AppColors.deepTeal,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  item['details'],
                  style: const TextStyle(
                    fontFamily: 'Afacad',
                    fontSize: 14,
                    color: Colors.black87,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Remarks: ${item['remarks']}',
                  style: const TextStyle(
                    fontFamily: 'Afacad',
                    fontSize: 14,
                    color: Colors.black87,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
