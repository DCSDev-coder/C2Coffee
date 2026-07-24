import 'package:flutter/material.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({Key? key}) : super(key: key);

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _currentCarouselIndex = 0;
  final PageController _pageController = PageController();

  final List<String> promoImages = [
    'assets/barista_craft_banner.png',
    'assets/promo_banner_2.png',
    'assets/promo_banner_3.png',
  ];

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFFAF4EE), // --bg-cream
      body: SafeArea(
        child: Column(
          children: [
            // Top Bar Navigation Header
            Padding(
              padding: const EdgeInsets.only(top: 16, left: 18, right: 18, bottom: 8),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  // User Greeting
                  Row(
                    children: [
                      Container(
                        width: 40,
                        height: 40,
                        decoration: BoxDecoration(
                          color: const Color(0xFFC65102),
                          shape: BoxShape.circle,
                          boxShadow: [
                            BoxShadow(
                              color: const Color(0xFFC65102).withOpacity(0.25),
                              offset: const Offset(0, 3),
                              blurRadius: 8,
                            ),
                          ],
                        ),
                        alignment: Alignment.center,
                        child: Padding(
                          padding: const EdgeInsets.all(3.0),
                          child: Image.asset('assets/c2_logo.png', fit: BoxFit.contain),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: const [
                          Text(
                            'Good morning,',
                            style: TextStyle(
                              fontFamily: 'Playfair Display',
                              fontSize: 11,
                              color: Color(0xFF4A3A2F),
                              height: 1.2,
                            ),
                          ),
                          Text(
                            'Coffeelover1',
                            style: TextStyle(
                              fontFamily: 'Playfair Display',
                              fontSize: 17,
                              fontWeight: FontWeight.w800,
                              color: Color(0xFF1C3B24),
                              height: 1.1,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                  // Actions
                  Row(
                    children: [
                      IconButton(
                        icon: const Icon(Icons.notifications_none, color: Color(0xFF1C3B24), size: 20),
                        onPressed: () {},
                        constraints: const BoxConstraints(),
                        padding: EdgeInsets.zero,
                      ),
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
                        decoration: BoxDecoration(
                          color: const Color(0xFFE56000),
                          borderRadius: BorderRadius.circular(20),
                          boxShadow: [
                            BoxShadow(
                              color: const Color(0xFFE56000).withOpacity(0.25),
                              offset: const Offset(0, 4),
                              blurRadius: 10,
                            ),
                          ],
                        ),
                        child: Row(
                          children: const [
                            Icon(Icons.account_balance_wallet_outlined, color: Colors.white, size: 14),
                            SizedBox(width: 5),
                            Text(
                              'RM0.00',
                              style: TextStyle(
                                fontFamily: 'DM Sans',
                                fontSize: 11.5,
                                fontWeight: FontWeight.w700,
                                color: Colors.white,
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

            // Scrollable Content
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.only(top: 6, left: 18, right: 18, bottom: 16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Promo Banner Carousel
                    Container(
                      height: 180, // Approximate height based on image aspect ratio
                      margin: const EdgeInsets.bottom(14),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFAF4EE),
                        borderRadius: BorderRadius.circular(20),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withOpacity(0.05),
                            offset: const Offset(0, 4),
                            blurRadius: 14,
                          ),
                        ],
                      ),
                      child: Stack(
                        children: [
                          PageView.builder(
                            controller: _pageController,
                            onPageChanged: (index) {
                              setState(() {
                                _currentCarouselIndex = index;
                              });
                            },
                            itemCount: promoImages.length,
                            itemBuilder: (context, index) {
                              return ClipRRect(
                                borderRadius: BorderRadius.circular(20),
                                child: Image.asset(
                                  promoImages[index],
                                  fit: BoxFit.cover,
                                  width: double.infinity,
                                ),
                              );
                            },
                          ),
                          // Prev/Next Arrows (simplified for Flutter)
                          Positioned(
                            left: 8,
                            top: 0,
                            bottom: 0,
                            child: Center(
                              child: _buildCarouselArrow(
                                icon: Icons.chevron_left,
                                onTap: () {
                                  if (_currentCarouselIndex > 0) {
                                    _pageController.previousPage(
                                      duration: const Duration(milliseconds: 300),
                                      curve: Curves.easeOut,
                                    );
                                  }
                                },
                              ),
                            ),
                          ),
                          Positioned(
                            right: 8,
                            top: 0,
                            bottom: 0,
                            child: Center(
                              child: _buildCarouselArrow(
                                icon: Icons.chevron_right,
                                onTap: () {
                                  if (_currentCarouselIndex < promoImages.length - 1) {
                                    _pageController.nextPage(
                                      duration: const Duration(milliseconds: 300),
                                      curve: Curves.easeOut,
                                    );
                                  }
                                },
                              ),
                            ),
                          ),
                          // Carousel Indicators
                          Positioned(
                            bottom: 10,
                            left: 0,
                            right: 0,
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                  decoration: BoxDecoration(
                                    color: Colors.black.withOpacity(0.25),
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: List.generate(promoImages.length, (index) {
                                      bool isActive = index == _currentCarouselIndex;
                                      return AnimatedContainer(
                                        duration: const Duration(milliseconds: 300),
                                        margin: EdgeInsets.only(right: index == promoImages.length - 1 ? 0 : 6),
                                        width: isActive ? 16 : 6,
                                        height: 6,
                                        decoration: BoxDecoration(
                                          color: isActive ? Colors.white : Colors.white.withOpacity(0.5),
                                          borderRadius: BorderRadius.circular(4),
                                        ),
                                      );
                                    }),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 14),

                    // Quick Action Tiles
                    Row(
                      children: [
                        Expanded(
                          child: _buildActionTile(
                            title: "MY\nORDER",
                            color: const Color(0xFFE56000),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: _buildActionTile(
                            title: "MY\nREFERRAL",
                            color: const Color(0xFF5A3214),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),

                    // Best Seller Section
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'Best Seller',
                          style: TextStyle(
                            fontFamily: 'Playfair Display',
                            fontSize: 20,
                            fontWeight: FontWeight.w800,
                            color: Color(0xFF1C3B24),
                          ),
                        ),
                        GestureDetector(
                          onTap: () {},
                          child: const Text(
                            'See all →',
                            style: TextStyle(
                              fontFamily: 'DM Sans',
                              fontSize: 12.5,
                              fontWeight: FontWeight.w600,
                              color: Color(0xFFE56000),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),

                    // Horizontal List for Best Sellers
                    SizedBox(
                      height: 200,
                      child: ListView(
                        scrollDirection: Axis.horizontal,
                        clipBehavior: Clip.none,
                        children: [
                          _buildProductCard('Shakerato Bianco', 'RM 15.90', 'assets/shakerato_bianco.png'),
                          const SizedBox(width: 10),
                          _buildProductCard('Blue Cloud Coconut Coffee', 'RM 15.90', 'assets/blue_cloud_coffee.png'),
                          const SizedBox(width: 10),
                          _buildProductCard('Bloody Peach', 'RM 15.90', 'assets/bloody_peach.png'),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),

            // Floating Bottom Navigation Bar
            Padding(
              padding: const EdgeInsets.only(bottom: 12.0),
              child: Container(
                width: MediaQuery.of(context).size.width * 0.9,
                constraints: const BoxConstraints(maxWidth: 360),
                height: 58,
                decoration: BoxDecoration(
                  color: const Color(0xFFE56000),
                  borderRadius: BorderRadius.circular(29),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFFE56000).withOpacity(0.35),
                      offset: const Offset(0, 8),
                      blurRadius: 24,
                    ),
                  ],
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                  children: [
                    _buildNavItem(Icons.home, 'Home', true),
                    _buildNavItem(Icons.restaurant_menu, 'Menu', false),
                    _buildNavItem(Icons.receipt_long, 'Orders', false),
                    _buildNavItem(Icons.card_giftcard, 'Rewards', false),
                    _buildNavItem(Icons.person_outline, 'Account', false),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCarouselArrow({required IconData icon, required VoidCallback onTap}) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 28,
        height: 28,
        decoration: BoxDecoration(
          color: const Color(0xFF1C3B24).withOpacity(0.65),
          shape: BoxShape.circle,
        ),
        child: Icon(icon, color: Colors.white, size: 18),
      ),
    );
  }

  Widget _buildActionTile({required String title, required Color color}) {
    return Container(
      height: 90,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(18),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.06),
            offset: const Offset(0, 4),
            blurRadius: 12,
          ),
        ],
      ),
      alignment: Alignment.centerLeft,
      child: Text(
        title,
        style: const TextStyle(
          fontFamily: 'Playfair Display',
          fontSize: 24,
          fontWeight: FontWeight.w900,
          color: Colors.white,
          height: 1.05,
          letterSpacing: -0.5,
        ),
      ),
    );
  }

  Widget _buildProductCard(String name, String price, String imagePath) {
    return Container(
      width: 145,
      decoration: BoxDecoration(
        color: const Color(0xFFFFF8F2),
        border: Border.all(color: const Color(0xFFF0E4D8), width: 1.5),
        borderRadius: BorderRadius.circular(18),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.03),
            offset: const Offset(0, 4),
            blurRadius: 12,
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: double.infinity,
            height: 125,
            decoration: const BoxDecoration(
              color: Color(0xFFFFF3E8),
              borderRadius: BorderRadius.only(
                topLeft: Radius.circular(16.5),
                topRight: Radius.circular(16.5),
              ),
            ),
            padding: const EdgeInsets.all(6),
            child: Image.asset(imagePath, fit: BoxFit.contain),
          ),
          Padding(
            padding: const EdgeInsets.all(10.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontFamily: 'Playfair Display',
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF1C3B24),
                    height: 1.25,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  price,
                  style: const TextStyle(
                    fontFamily: 'DM Sans',
                    fontSize: 12.5,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFFE56000),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildNavItem(IconData icon, String label, bool isActive) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: isActive ? Colors.white.withOpacity(0.22) : Colors.transparent,
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            icon,
            color: isActive ? Colors.white : Colors.white.withOpacity(0.75),
            size: 19,
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: TextStyle(
              fontFamily: 'DM Sans',
              fontSize: 9.5,
              fontWeight: FontWeight.w600,
              color: isActive ? Colors.white : Colors.white.withOpacity(0.75),
            ),
          ),
        ],
      ),
    );
  }
}
