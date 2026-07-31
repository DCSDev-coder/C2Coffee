import 'dart:io';
import 'package:flutter/material.dart';
import '../widgets/custom_bottom_nav.dart';
import 'home_page.dart';
import 'menu_page.dart';
import 'loading_order_page.dart';
import 'order_details_page.dart';
import 'profile_page.dart';
import 'rewards_page.dart';
import '../widgets/order_status_banner.dart';

class OrdersPage extends StatefulWidget {
  final File? initialPickedImage;
  final String? initialPresetPath;
  final int initialAvatarIndex;

  const OrdersPage({
    super.key,
    this.initialPickedImage,
    this.initialPresetPath,
    this.initialAvatarIndex = 0,
  });

  @override
  State<OrdersPage> createState() => _OrdersPageState();
}

class _OrdersPageState extends State<OrdersPage>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final Color orangeColor = const Color(0xFFE66B00);
  final Color bgColor = const Color(0xFFFAF4EE);

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
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  void _onBottomNavTapped(int index) {
    if (index == 0) {
      Navigator.pushAndRemoveUntil(
        context,
        MaterialPageRoute(
          builder: (context) => InteractiveFillingLoader(
              targetPage: HomePage(
            initialPickedImage: widget.initialPickedImage,
            initialPresetPath: widget.initialPresetPath,
            initialAvatarIndex: widget.initialAvatarIndex,
          )),
        ),
        (route) => false,
      );
    } else if (index == 1) {
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(
          builder: (context) => const InteractiveFillingLoader(
            targetPage: MenuPage(),
          ),
        ),
      );
    } else if (index == 3) {
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(
          builder: (context) => InteractiveFillingLoader(
            targetPage: RewardsPage(
              initialPickedImage: widget.initialPickedImage,
              initialPresetPath: widget.initialPresetPath,
              initialAvatarIndex: widget.initialAvatarIndex,
            ),
          ),
        ),
      );
    } else if (index == 4) {
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (context) => InteractiveFillingLoader(
            targetPage: ProfilePage(
              initialPickedImage: widget.initialPickedImage,
              initialPresetPath: widget.initialPresetPath,
              initialAvatarIndex: widget.initialAvatarIndex,
            ),
          ),
        ),
      );
    } else if (index != 2) {
      Navigator.pop(context);
    }
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) {
        if (didPop) return;
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(
            builder: (context) => InteractiveFillingLoader(
              targetPage: HomePage(
                initialPickedImage: widget.initialPickedImage,
                initialPresetPath: widget.initialPresetPath,
                initialAvatarIndex: widget.initialAvatarIndex,
              ),
            ),
          ),
        );
      },
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
                  padding: const EdgeInsets.only(
                      top: 60, bottom: 20, left: 20, right: 20),
                  decoration: BoxDecoration(
                    color: orangeColor,
                    borderRadius: const BorderRadius.only(
                      bottomLeft: Radius.circular(20),
                      bottomRight: Radius.circular(20),
                    ),
                  ),
                  child: Row(
                    children: [
                      GestureDetector(
                        onTap: () {
                          Navigator.pushAndRemoveUntil(
                            context,
                            MaterialPageRoute(
                              builder: (context) => InteractiveFillingLoader(
                                  targetPage: HomePage(
                                initialPickedImage: widget.initialPickedImage,
                                initialPresetPath: widget.initialPresetPath,
                                initialAvatarIndex: widget.initialAvatarIndex,
                              )),
                            ),
                            (route) => false,
                          );
                        },
                        child: const Icon(Icons.arrow_back_ios,
                            color: Colors.white, size: 24),
                      ),
                      const Expanded(
                        child: Center(
                          child: Text(
                            'MY ORDER',
                            style: TextStyle(
                              fontFamily: 'Recoleta',
                              fontSize: 28,
                              fontWeight: FontWeight.w900,
                              color: Colors.white,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 24), // Balance the back button
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
                    unselectedLabelColor: orangeColor.withValues(alpha: 0.6),
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
            const OrderStatusBanner(),
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
                if (item['name'] != 'Mont Broga') {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (context) => OrderDetailsPage(item: item),
                    ),
                  );
                }
              },
              child: _buildHistoryCard(item),
            ),
          ),
        );
      },
    );
  }

  Widget _buildStoreOrderCard() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Pickup',
                style: TextStyle(
                  fontFamily: 'Recoleta',
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF4A3424),
                ),
              ),
              Text(
                'Finished',
                style: TextStyle(
                  fontFamily: 'Afacad',
                  fontSize: 12,
                  color: Colors.black54,
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
                        const Text(
                          'Mont Broga',
                          style: TextStyle(
                            fontFamily: 'Recoleta',
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        Text(
                          'x1',
                          style: TextStyle(
                            fontFamily: 'Afacad',
                            fontSize: 20,
                            fontWeight: FontWeight.bold,
                            color: orangeColor,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'Dato Blend / Hot / Fresh Milk /\nReg. Sweet / Reg. Ice /\nTake Away',
                      style: TextStyle(
                        fontFamily: 'Afacad',
                        fontSize: 14,
                        color: Colors.black87,
                      ),
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'Remarks: None',
                      style: TextStyle(
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
          const SizedBox(height: 16),
          const Divider(height: 1),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              const Text(
                '1 item  ',
                style: TextStyle(
                  fontFamily: 'Afacad',
                  fontSize: 14,
                  color: Colors.black87,
                ),
              ),
              RichText(
                text: const TextSpan(
                  text: 'RM ',
                  style: TextStyle(
                    fontFamily: 'Afacad',
                    fontSize: 14,
                    color: Colors.black87,
                  ),
                  children: [
                    TextSpan(
                      text: '16.90',
                      style: TextStyle(
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
    );
  }

  Widget _buildHistoryCard(Map<String, dynamic> item) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 10,
            offset: const Offset(0, 4),
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
                      style: const TextStyle(
                        fontFamily: 'Recoleta',
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    Text(
                      'x${item['quantity']}',
                      style: TextStyle(
                        fontFamily: 'Afacad',
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                        color: orangeColor,
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
