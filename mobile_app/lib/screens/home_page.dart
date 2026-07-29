import 'dart:io';
import 'package:flutter/material.dart';
import 'dart:async';
import '../widgets/custom_bottom_nav.dart';
import 'loading_order_page.dart';
import 'orders_page.dart';
import 'profile_page.dart';

class HomePage extends StatefulWidget {
  final File? initialPickedImage;
  final String? initialPresetPath;
  final int initialAvatarIndex;

  const HomePage({
    super.key,
    this.initialPickedImage,
    this.initialPresetPath,
    this.initialAvatarIndex = 0,
  });

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  int _selectedIndex = 0;

  final PageController _pageController = PageController();
  Timer? _carouselTimer;
  int _currentBannerIndex = 0;

  final List<String> _banners = [
    'assets/images/operationhour.jpeg',
    'assets/images/happyhour.jpeg',
    'assets/images/incaseofemergency.jpeg',
  ];

  @override
  void initState() {
    super.initState();
    _carouselTimer = Timer.periodic(const Duration(seconds: 4), (Timer timer) {
      if (_currentBannerIndex < _banners.length - 1) {
        _currentBannerIndex++;
      } else {
        _currentBannerIndex = 0;
      }

      if (_pageController.hasClients) {
        _pageController.animateToPage(
          _currentBannerIndex,
          duration: const Duration(milliseconds: 350),
          curve: Curves.easeIn,
        );
      }
    });
  }

  @override
  void dispose() {
    _carouselTimer?.cancel();
    _pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    const Color orangeColor = Color(0xFFE66B00); // Bright orange from the image
    const Color darkBrownColor = Color(0xFF6B3A1A); // Dark brown for referral

    return Scaffold(
      backgroundColor: const Color(0xFFFAF4EE),
      body: SafeArea(
        bottom: false,
        child: Stack(
          children: [
            // Content
            Positioned.fill(
              child: SingleChildScrollView(
                padding: const EdgeInsets.only(
                    bottom: 130), // Increased space for bottom bar
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SizedBox(height: 16),
                    _buildHeader(orangeColor),
                    const SizedBox(height: 16),
                    AspectRatio(
                      aspectRatio: 1.0,
                      child: _buildHeroBanner(),
                    ),
                    const SizedBox(height: 16),
                    _buildActionButtons(orangeColor, darkBrownColor),
                    const SizedBox(height: 16),
                    _buildBestSellerSection(orangeColor),
                  ],
                ),
              ),
            ),

            // Custom Glass Bottom Navigation Bar
            Positioned(
              bottom: 0,
              left: 0,
              right: 0,
              child: CustomBottomNav(
                selectedIndex: 0, // Home is index 0
                onItemTapped: (index) {
                  if (index == 2) {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                          builder: (context) => InteractiveFillingLoader(
                              targetPage: OrdersPage(
                                initialPickedImage: widget.initialPickedImage,
                                initialPresetPath: widget.initialPresetPath,
                                initialAvatarIndex: widget.initialAvatarIndex,
                              ))),
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
                  } else {
                    setState(() => _selectedIndex = index);
                  }
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader(Color orangeColor) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          // Left side: Logo and Greeting
          Row(
            children: [
              // C2 Logo
              Container(
                width: 45,
                height: 45,
                decoration: BoxDecoration(
                  color: orangeColor,
                  shape: BoxShape.circle,
                ),
                alignment: Alignment.center,
                child: Padding(
                  padding: const EdgeInsets.all(6.0),
                  child: Image.asset(
                    'assets/images/c2_logo.png',
                    fit: BoxFit.contain,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              // Greeting Text
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: const [
                  Text(
                    'Good morning,',
                    style: TextStyle(
                      fontFamily: 'Afacad',
                      fontSize: 12,
                      color: Colors.grey,
                    ),
                  ),
                  Text(
                    'Coffeelover1',
                    style: TextStyle(
                      fontFamily: 'Recoleta',
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF5A3118),
                    ),
                  ),
                ],
              ),
            ],
          ),

          // Right side: Bell and Wallet
          Row(
            children: [
              const Icon(
                Icons.notifications,
                color: Colors.black87,
                size: 26,
              ),
              const SizedBox(width: 12),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: orangeColor,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Row(
                  children: const [
                    Icon(
                      Icons.account_balance_wallet,
                      color: Colors.white,
                      size: 16,
                    ),
                    SizedBox(width: 6),
                    Text(
                      'RM0.00',
                      style: TextStyle(
                        fontFamily: 'Afacad',
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                        fontSize: 14,
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

  Widget _buildHeroBanner() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(24),
        child: Stack(
          children: [
            PageView.builder(
              controller: _pageController,
              onPageChanged: (int index) {
                setState(() {
                  _currentBannerIndex = index;
                });
              },
              itemCount: _banners.length,
              itemBuilder: (context, index) {
                return Image.asset(
                  _banners[index],
                  width: double.infinity,
                  fit: BoxFit
                      .cover, // Ensures image reaches corners to get rounded edges
                );
              },
            ),
            // Indicator dots
            Positioned(
              bottom: 12,
              left: 0,
              right: 0,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(
                  _banners.length,
                  (index) => AnimatedContainer(
                    duration: const Duration(milliseconds: 300),
                    margin: const EdgeInsets.symmetric(horizontal: 4),
                    width: _currentBannerIndex == index ? 20 : 8,
                    height: 8,
                    decoration: BoxDecoration(
                      color: _currentBannerIndex == index
                          ? Colors.white
                          : Colors.white.withValues(alpha: 0.5),
                      borderRadius: BorderRadius.circular(4),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildActionButtons(Color orangeColor, Color darkBrownColor) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Row(
        children: [
          Expanded(
            child: GestureDetector(
              onTap: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                      builder: (context) => const InteractiveFillingLoader(
                          targetPage: OrdersPage())),
                );
              },
              child: Container(
                height: 80,
                padding: const EdgeInsets.only(left: 20),
                decoration: BoxDecoration(
                  color: orangeColor,
                  borderRadius: BorderRadius.circular(20),
                ),
                alignment: Alignment.centerLeft,
                child: const Text(
                  'MY\nORDER',
                  textAlign: TextAlign.left,
                  style: TextStyle(
                    fontFamily: 'Recoleta',
                    fontSize: 24,
                    fontWeight: FontWeight.w900, // Extra bold
                    color: Colors.white,
                    height: 0.9, // Tighter line height
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Container(
              height: 80,
              padding: const EdgeInsets.only(left: 20),
              decoration: BoxDecoration(
                color: darkBrownColor,
                borderRadius: BorderRadius.circular(20),
              ),
              alignment: Alignment.centerLeft,
              child: const Text(
                'MY\nREFERRAL',
                textAlign: TextAlign.left,
                style: TextStyle(
                  fontFamily: 'Recoleta',
                  fontSize: 22, // Slightly smaller to fit "REFERRAL"
                  fontWeight: FontWeight.w900, // Extra bold
                  color: Colors.white,
                  height: 0.9, // Tighter line height
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBestSellerSection(Color orangeColor) {
    final List<Map<String, dynamic>> bestSellers = [
      {
        'name': 'Shakerato Bianco',
        'price': 'RM 15.90',
        'image': 'assets/images/shakerato_bianco.png',
      },
      {
        'name': 'Blue Cloud Coconut Coffee',
        'price': 'RM 15.90',
        'image': 'assets/images/blue_cloud_coffee.png',
      },
      {
        'name': 'Bloody Peach',
        'price': 'RM 15.90',
        'image': 'assets/images/bloody_peach.png',
        'scale': 1.0,
      },
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Best Seller',
                style: TextStyle(
                  fontFamily: 'Recoleta',
                  fontSize: 22,
                  fontWeight: FontWeight.bold,
                  color: Colors.black87,
                ),
              ),
              Row(
                children: [
                  Text(
                    'See all',
                    style: TextStyle(
                      fontFamily: 'Afacad',
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                      color: orangeColor,
                    ),
                  ),
                  const SizedBox(width: 4),
                  Icon(
                    Icons.arrow_forward_rounded,
                    size: 16,
                    color: orangeColor,
                  ),
                ],
              )
            ],
          ),
        ),
        const SizedBox(height: 12),
        SizedBox(
          height: 220, // Increased to match new card height and fit text
          child: ListView.builder(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            itemCount: bestSellers.length,
            itemBuilder: (context, index) {
              final item = bestSellers[index];
              return Container(
                width: 150, // Increased width
                margin: const EdgeInsets.symmetric(horizontal: 6),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFF7F0), // slightly warm beige
                  borderRadius: BorderRadius.circular(24),
                  border: Border.all(color: const Color(0xFFC87023), width: 2),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.all(8.0),
                        child: Center(
                          child: Transform.scale(
                            scale: item['scale'] as double? ?? 1.0,
                            child: Image.asset(
                              item['image'] as String,
                              fit: BoxFit.contain,
                            ),
                          ),
                        ),
                      ),
                    ),
                    Divider(
                      color: const Color(0xFFC87023),
                      height: 1,
                      thickness: 1.5,
                    ),
                    Container(
                      height: 56,
                      padding:
                          const EdgeInsets.only(left: 12, right: 12, top: 12),
                      alignment: Alignment.centerLeft,
                      child: Text(
                        item['name'] as String,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontFamily: 'Recoleta',
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: Colors.black,
                          height: 1.1,
                        ),
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.only(
                          left: 12, right: 12, bottom: 16, top: 12),
                      child: Text(
                        item['price']!,
                        style: const TextStyle(
                          fontFamily: 'Afacad',
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFFF1801C),
                        ),
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
        ),
        const SizedBox(height: 10),
      ],
    );
  }
}
