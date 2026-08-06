import 'dart:io';
import 'package:flutter/material.dart';
import 'dart:async';
import 'package:flutter/foundation.dart' show kIsWeb;
import '../services/user_service.dart';
import '../widgets/custom_bottom_nav.dart';
import 'loading_order_page.dart';
import 'orders_page.dart';
import 'profile_page.dart';
import 'top_up_wallet_page.dart';
import 'notification_page.dart';
import 'settings_page.dart';
import 'referral_page.dart';
import 'menu_page.dart';
import 'rewards_page.dart';
import 'mont_broga_page.dart';
import 'simple_product_detail_page.dart';
import '../utils/app_colors.dart';
import '../widgets/order_status_banner.dart';
import '../widgets/poster_popup.dart'; // Add this import

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
  File? _persistedPickedImage;
  String? _persistedPresetPath;
  bool _hasShownPoster = false; // Add this
  bool _showTokenPrice = false;

  final PageController _pageController = PageController();
  Timer? _carouselTimer;
  int _currentBannerIndex = 0;

  String _formatPrice(
    String? rawPrice, {
    bool isDrink = false,
    bool isMerchandise = false,
  }) {
    if (rawPrice == null || rawPrice.isEmpty) return '';
    final formattedPrice = AppColors.formatDiscountedPrice(
      rawPrice,
      isDrink: isDrink,
      isMerchandise: isMerchandise,
    );
    if (!_showTokenPrice) return formattedPrice;
    final cleanPrice = formattedPrice.replaceAll('RM', '').trim();
    final val = double.tryParse(cleanPrice);
    if (val != null) {
      final tokens = val.round();
      return '$tokens tokens';
    }
    return formattedPrice;
  }

  final List<String> _banners = [
    'assets/images/operationhour.jpeg',
    'assets/images/happyhour.jpeg',
    'assets/images/incaseofemergency.jpeg',
  ];

  String _username = 'Guest';

  @override
  void initState() {
    super.initState();
    _loadAvatarState();
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

    // Show poster popup after a short delay when home page loads
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _showPosterIfNeeded();
    });
  }

  void _showPosterIfNeeded() {
    // Only show the poster once
    if (!_hasShownPoster && mounted) {
      _hasShownPoster = true;
      // Show the poster popup
      showPosterPopup(context);
    }
  }

  @override
  void dispose() {
    _carouselTimer?.cancel();
    _pageController.dispose();
    super.dispose();
  }

  Future<void> _loadAvatarState() async {
    if (widget.initialPickedImage != null || widget.initialPresetPath != null) {
      await UserService.saveAvatar(
          presetPath: widget.initialPresetPath,
          pickedImagePath: widget.initialPickedImage?.path);
    }

    final avatarData = await UserService.getAvatar();
    final profileData = await UserService.getUserProfile();
    setState(() {
      if (avatarData['pickedImagePath'] != null) {
        _persistedPickedImage = File(avatarData['pickedImagePath']!);
      } else {
        _persistedPickedImage = null;
      }
      _persistedPresetPath = avatarData['presetPath'];

      if (profileData['username'] != null &&
          profileData['username']!.isNotEmpty) {
        _username = profileData['username']!;
      }
    });
  }

  void _onBottomNavTapped(int index) {
    if (index == 1) {
      InteractiveFillingLoader.show(context, targetPage: const MenuPage());
    } else if (index == 2) {
      InteractiveFillingLoader.show(
        context,
        targetPage: OrdersPage(
          initialPickedImage: widget.initialPickedImage,
          initialPresetPath: widget.initialPresetPath,
          initialAvatarIndex: widget.initialAvatarIndex,
        ),
      );
    } else if (index == 3) {
      InteractiveFillingLoader.show(
        context,
        targetPage: RewardsPage(
          initialPickedImage: widget.initialPickedImage,
          initialPresetPath: widget.initialPresetPath,
          initialAvatarIndex: widget.initialAvatarIndex,
        ),
      );
    } else if (index == 4) {
      InteractiveFillingLoader.show(
        context,
        targetPage: ProfilePage(
          initialPickedImage: widget.initialPickedImage,
          initialPresetPath: widget.initialPresetPath,
          initialAvatarIndex: widget.initialAvatarIndex,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      extendBody: true,
      bottomNavigationBar: CustomBottomNav(
        selectedIndex: 0,
        onItemTapped: _onBottomNavTapped,
      ),
      body: Stack(
        children: [
          SafeArea(
            bottom: false,
            child: SingleChildScrollView(
              padding: const EdgeInsets.only(bottom: 220),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SizedBox(height: 16),
                  _buildHeader(),
                  const SizedBox(height: 16),
                  AspectRatio(
                    aspectRatio: 1.0,
                    child: _buildHeroBanner(),
                  ),
                  const SizedBox(height: 16),
                  _buildActionButtons(),
                  const SizedBox(height: 16),
                  _buildBestSellerSection(),
                ],
              ),
            ),
          ),
          OrderStatusBanner(
            rightOffset: 90,
            bottomOffset: 90 + MediaQuery.paddingOf(context).bottom,
          ),
          Positioned(
            bottom: 90 + MediaQuery.paddingOf(context).bottom,
            right: 20,
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: () {
                setState(() => _showTokenPrice = !_showTokenPrice);
              },
              child: Container(
                width: 60,
                height: 60,
                decoration: BoxDecoration(
                  color: _showTokenPrice
                      ? const Color(0xFFE5A93C)
                      : const Color(0xFFFAF7F2),
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: const Color(0xFFE5A93C),
                    width: 2,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.18),
                      blurRadius: 12,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Center(
                  child: Icon(
                    Icons.monetization_on_rounded,
                    size: 30,
                    color: _showTokenPrice
                        ? Colors.white
                        : const Color(0xFFE5A93C),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHeader() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            children: [
              GestureDetector(
                onTap: () async {
                  InteractiveFillingLoader.show(
                    context,
                    targetPage: SettingsPage(
                      onProfileUpdated: _loadAvatarState,
                      returnPage: const HomePage(),
                    ),
                  );
                },
                child: Container(
                  width: 45,
                  height: 45,
                  decoration: BoxDecoration(
                    color: _persistedPickedImage == null &&
                            _persistedPresetPath != null
                        ? AppColors.deepTeal
                        : AppColors.deepTeal,
                    shape: BoxShape.circle,
                  ),
                  alignment: Alignment.center,
                  child: ClipOval(
                    child: _persistedPickedImage != null
                        ? (kIsWeb
                            ? Image.network(_persistedPickedImage!.path,
                                width: 45, height: 45, fit: BoxFit.cover)
                            : Image.file(_persistedPickedImage!,
                                width: 45, height: 45, fit: BoxFit.cover))
                        : (_persistedPresetPath != null
                            ? Image.asset(_persistedPresetPath!,
                                width: 45, height: 45, fit: BoxFit.cover)
                            : const Icon(Icons.person,
                                color: Colors.white, size: 30)),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    (() {
                      final hour = DateTime.now().hour;
                      if (hour < 12) return 'Good morning,';
                      if (hour < 17) return 'Good afternoon,';
                      return 'Good evening,';
                    })(),
                    style: const TextStyle(
                      fontFamily: 'Afacad',
                      fontSize: 12,
                      color: Colors.grey,
                      height: 1.0,
                    ),
                  ),
                  Text(
                    _username,
                    style: TextStyle(
                      fontFamily: 'Recoleta',
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: AppColors.deepTeal,
                      height: 1.0,
                    ),
                  ),
                ],
              ),
            ],
          ),
          Row(
            children: [
              GestureDetector(
                onTap: () {
                  InteractiveFillingLoader.show(
                    context,
                    targetPage: const TopUpWalletPage(),
                  );
                },
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFAF7F2),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: AppColors.softGold.withValues(alpha: 0.45),
                      width: 1.2,
                    ),
                  ),
                  child: Row(
                    children: [
                      Image.asset(
                        'assets/images/wallet.png',
                        width: 32,
                        height: 32,
                      ),
                      const SizedBox(width: 6),
                      Text(
                        '0 tokens',
                        style: TextStyle(
                          fontFamily: 'Afacad',
                          fontWeight: FontWeight.bold,
                          color: AppColors.softGold,
                          fontSize: 14,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 12),
              GestureDetector(
                onTap: () {
                  InteractiveFillingLoader.show(
                    context,
                    targetPage: const NotificationPage(),
                  );
                },
                child: Stack(
                  clipBehavior: Clip.none,
                  children: [
                    Icon(
                      Icons.notifications_outlined,
                      color: AppColors.deepTeal,
                      size: 26,
                    ),
                    Positioned(
                      right: 1,
                      top: 1,
                      child: Container(
                        width: 8,
                        height: 8,
                        decoration: BoxDecoration(
                          color: AppColors.terracotta,
                          shape: BoxShape.circle,
                        ),
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
                  fit: BoxFit.cover,
                );
              },
            ),
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
                          ? AppColors.softGold
                          : Colors.white.withValues(alpha: 0.6),
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

  Widget _buildActionButtons() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Row(
        children: [
          Expanded(
            child: GestureDetector(
              onTap: () {
                InteractiveFillingLoader.show(
                  context,
                  targetPage: const OrdersPage(),
                );
              },
              child: Container(
                height: 80,
                padding: const EdgeInsets.only(left: 20),
                decoration: BoxDecoration(
                  color: AppColors.deepTeal,
                  borderRadius: BorderRadius.circular(20),
                ),
                alignment: Alignment.centerLeft,
                child: const Text(
                  'MY\nORDER',
                  textAlign: TextAlign.left,
                  style: TextStyle(
                    fontFamily: 'Recoleta',
                    fontSize: 24,
                    fontWeight: FontWeight.w900,
                    color: Colors.white,
                    height: 0.9,
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: GestureDetector(
              onTap: () {
                InteractiveFillingLoader.show(
                  context,
                  targetPage: const ReferralPage(),
                );
              },
              child: Container(
                height: 80,
                padding: const EdgeInsets.only(left: 20),
                decoration: BoxDecoration(
                  color: AppColors.surfaceLight,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                    color: AppColors.border,
                    width: 1.5,
                  ),
                ),
                alignment: Alignment.centerLeft,
                child: Text(
                  'MY\nREFERRAL',
                  textAlign: TextAlign.left,
                  style: TextStyle(
                    fontFamily: 'Recoleta',
                    fontSize: 22,
                    fontWeight: FontWeight.w900,
                    color: AppColors.deepTeal,
                    height: 0.9,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBestSellerSection() {
    final List<Map<String, dynamic>> bestSellerDrinks = [
      {
        'name': 'Shakerato Bianco',
        'price': 'RM 16.90',
        'image': 'assets/images/drinks/SHAKERATO BIANCO.png',
        'desc': 'Chilled, shaken espresso with sweet silky and refreshing cream.',
        'scale': 1.2,
      },
      {
        'name': 'Blue Cloud Coconut Coffee',
        'price': 'RM 13.90',
        'image': 'assets/images/drinks/BLUE CLOUD COCONUT COFFEE.png',
        'scale': 1.0,
      },
      {
        'name': 'Bloody Peach',
        'price': 'RM 15.90',
        'image': 'assets/images/drinks/BLOODY PEACH.png',
        'scale': 1.2,
      },
    ];

    final List<Map<String, dynamic>> bestSellerCandles = [
      {
        'name': 'Gunung Candle',
        'price': 'RM 47.00',
        'image': 'assets/images/candles/gunung.png',
        'scale': 1.5,
      },
      {
        'name': 'Crushed Lime & Seasalt',
        'price': 'RM 47.00',
        'image': 'assets/images/candles/crushed lime and seasalt.png',
        'scale': 1.5,
      },
      {
        'name': 'Fresh Sage & Driftwood',
        'price': 'RM 47.00',
        'image': 'assets/images/candles/fresh sage and driftwood.png',
        'scale': 1.5,
      },
      {
        'name': 'Tobacco Vanilla',
        'price': 'RM 47.00',
        'image': 'assets/images/candles/tobacco vanilla.png',
        'scale': 1.5,
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
              Text(
                'Best Seller Drink',
                style: TextStyle(
                  fontFamily: 'Recoleta',
                  fontSize: 22,
                  fontWeight: FontWeight.bold,
                  color: AppColors.deepTeal,
                ),
              ),
              GestureDetector(
                onTap: () {
                  InteractiveFillingLoader.show(
                    context,
                    targetPage: const MenuPage(),
                  );
                },
                child: Row(
                  children: [
                    Text(
                      'See all',
                      style: TextStyle(
                        fontFamily: 'Afacad',
                        fontSize: 14,
                        fontWeight: FontWeight.bold,
                        color: AppColors.deepTeal,
                      ),
                    ),
                    const SizedBox(width: 4),
                    Icon(
                      Icons.arrow_forward_rounded,
                      size: 16,
                      color: AppColors.deepTeal,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        _buildProductRow(bestSellerDrinks),
        const SizedBox(height: 24),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Best Seller Candle',
                style: TextStyle(
                  fontFamily: 'Recoleta',
                  fontSize: 22,
                  fontWeight: FontWeight.bold,
                  color: AppColors.deepTeal,
                ),
              ),
              GestureDetector(
                onTap: () {
                  InteractiveFillingLoader.show(
                    context,
                    targetPage: const MenuPage(initialCategoryIndex: 10),
                  );
                },
                child: Row(
                  children: [
                    Text(
                      'See all',
                      style: TextStyle(
                        fontFamily: 'Afacad',
                        fontSize: 14,
                        fontWeight: FontWeight.bold,
                        color: AppColors.deepTeal,
                      ),
                    ),
                    const SizedBox(width: 4),
                    Icon(
                      Icons.arrow_forward_rounded,
                      size: 16,
                      color: AppColors.deepTeal,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        _buildProductRow(bestSellerCandles),
        const SizedBox(height: 10),
      ],
    );
  }

  Widget _buildProductRow(List<Map<String, dynamic>> items) {
    const double cardWidth = 155;
    const double cardHeight = 210;

    return SizedBox(
      height: cardHeight,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: items.length,
        itemBuilder: (context, index) {
          final item = items[index];
          final bool isDrink =
              (item['image'] as String).toLowerCase().contains('drinks');
          return GestureDetector(
            onTap: () {
              if (isDrink) {
                InteractiveFillingLoader.show(
                  context,
                  targetPage: MontBrogaPage(item: item),
                );
              } else {
                InteractiveFillingLoader.show(
                  context,
                  targetPage: SimpleProductDetailPage(item: item),
                );
              }
            },
            child: Container(
              width: cardWidth,
              margin: const EdgeInsets.symmetric(horizontal: 6),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.border, width: 1),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.03),
                    blurRadius: 6,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  Expanded(
                    flex: 7,
                    child: Padding(
                      padding: const EdgeInsets.only(
                          top: 14, bottom: 8, left: 10, right: 10),
                      child: Transform.scale(
                        scale: (item['image'] as String)
                                .toLowerCase()
                                .contains('candle')
                            ? 1.5
                            : 1.0,
                        child: Image.asset(
                          item['image'] as String,
                          fit: BoxFit.contain,
                          errorBuilder: (context, error, stackTrace) =>
                              const Center(
                            child: Icon(
                              Icons.image_outlined,
                              size: 32,
                              color: Colors.grey,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                  // Item Name — Fixed height so 1-line and 2-line titles reserve identical space, keeping image size constant
                  SizedBox(
                    height: 36,
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 10),
                      child: Center(
                        child: Text(
                          item['name'] as String,
                          textAlign: TextAlign.center,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontFamily: 'Afacad',
                            fontSize: 14,
                            fontWeight: FontWeight.w300,
                            color: AppColors.charcoal,
                            height: 1.2,
                          ),
                        ),
                      ),
                    ),
                  ),

                  // Price — Fixed height so every card has identical layout proportions
                  SizedBox(
                    height: 34,
                    child: Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: Center(
                        child: Text(
                          _formatPrice(
                            item['price'] as String?,
                            isDrink: (item['image'] as String)
                                .toLowerCase()
                                .contains('drinks'),
                            isMerchandise: (item['image'] as String)
                                    .toLowerCase()
                                    .contains('candle') ||
                                (item['image'] as String)
                                    .toLowerCase()
                                    .contains('merchandies'),
                          ),
                          style: TextStyle(
                            fontFamily: 'Afacad',
                            fontSize: 14,
                            fontWeight: FontWeight.bold,
                            color: _showTokenPrice
                                ? const Color(0xFFD97706)
                                : AppColors.deepTeal,
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}
