import 'dart:async';
import 'dart:io';

import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';

import '../services/app_session_service.dart';
import '../services/catalog_api_service.dart';
import '../services/catalog_presentation.dart';
import '../services/user_service.dart';
import '../utils/app_colors.dart';
import '../widgets/catalog_product_image.dart';
import '../widgets/custom_bottom_nav.dart';
import '../widgets/order_status_banner.dart';
import '../widgets/poster_popup.dart';
import 'loading_order_page.dart';
import 'menu_page.dart';
import 'notification_page.dart';
import 'orders_page.dart';
import 'profile_page.dart';
import 'referral_page.dart';
import 'rewards_page.dart';
import 'settings_page.dart';
import 'mont_broga_page.dart';
import 'simple_product_detail_page.dart';
import 'top_up_wallet_page.dart';

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
  final AppSessionService _session = AppSessionService.instance;
  final PageController _pageController = PageController();
  final ScrollController _scrollController = ScrollController();

  File? _persistedPickedImage;
  String? _persistedPresetPath;
  bool _hasShownPoster = false;
  bool _showTokenPrice = false;
  Timer? _carouselTimer;
  int _currentBannerIndex = 0;

  @override
  void initState() {
    super.initState();
    _loadAvatarState();
    Future.microtask(() async {
      try {
        await _session.loadAuthenticatedState();
      } catch (_) {}
    });
    _carouselTimer = Timer.periodic(const Duration(seconds: 4), (_) {
      final banners =
          _session.homeBanners.where((banner) => banner.appearsOnHome).toList();
      if (!_pageController.hasClients || banners.isEmpty) return;
      _currentBannerIndex = (_currentBannerIndex + 1) % banners.length;
      _pageController.animateToPage(
        _currentBannerIndex,
        duration: const Duration(milliseconds: 350),
        curve: Curves.easeInOut,
      );
    });
    WidgetsBinding.instance.addPostFrameCallback((_) => _showPosterIfNeeded());
  }

  @override
  void dispose() {
    _carouselTimer?.cancel();
    _pageController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _loadAvatarState() async {
    if (widget.initialPickedImage != null || widget.initialPresetPath != null) {
      await UserService.saveAvatar(
        presetPath: widget.initialPresetPath,
        pickedImagePath: widget.initialPickedImage?.path,
      );
    }

    final avatarData = await UserService.getAvatar();
    if (!mounted) return;
    setState(() {
      _persistedPickedImage = avatarData['pickedImagePath'] != null
          ? File(avatarData['pickedImagePath']!)
          : null;
      _persistedPresetPath = avatarData['presetPath'];
    });
  }

  void _showPosterIfNeeded() {
    if (_hasShownPoster || !mounted) return;
    _hasShownPoster = true;
    showPosterPopup(context);
  }

  void _onBottomNavTapped(int index) {
    if (index == 1) {
      CustomBottomNav.switchTab(context, const MenuPage());
    } else if (index == 2) {
      CustomBottomNav.switchTab(
        context,
        OrdersPage(
          initialPickedImage: widget.initialPickedImage,
          initialPresetPath: widget.initialPresetPath,
          initialAvatarIndex: widget.initialAvatarIndex,
        ),
      );
    } else if (index == 3) {
      CustomBottomNav.switchTab(
        context,
        RewardsPage(
          initialPickedImage: widget.initialPickedImage,
          initialPresetPath: widget.initialPresetPath,
          initialAvatarIndex: widget.initialAvatarIndex,
        ),
      );
    } else if (index == 4) {
      CustomBottomNav.switchTab(
        context,
        ProfilePage(
          initialPickedImage: widget.initialPickedImage,
          initialPresetPath: widget.initialPresetPath,
          initialAvatarIndex: widget.initialAvatarIndex,
        ),
      );
    }
  }

  List<Map<String, dynamic>> _featuredDrinkItems() {
    final items = <Map<String, dynamic>>[];
    for (final category in _session.menuCategories) {
      for (final item in category.items) {
        if (item.isAvailable &&
            CatalogPresentation.isDrinkCategory(category.name, item)) {
          items.add(
            CatalogPresentation.toLegacyItem(
                item, category.code, category.name),
          );
        }
      }
    }
    return items.take(6).toList();
  }

  List<Map<String, dynamic>> _featuredLifestyleItems() {
    final items = <Map<String, dynamic>>[];
    for (final category in _session.menuCategories) {
      for (final item in category.items) {
        if (item.isAvailable &&
            CatalogPresentation.isLifestyleCategory(category.name, item)) {
          items.add(
            CatalogPresentation.toLegacyItem(
                item, category.code, category.name),
          );
        }
      }
    }
    return items.take(6).toList();
  }

  String _formatPrice(Map<String, dynamic> item) {
    final rawPrice = item['price']?.toString() ?? '';
    if (rawPrice.isEmpty) return '';
    final isDrink = item['isDrink'] as bool? ?? false;
    final isMerchandise = (item['isMerchandise'] as bool? ?? false) ||
        (item['isCandle'] as bool? ?? false);
    final formattedPrice = AppColors.formatDiscountedPrice(
      rawPrice,
      isDrink: isDrink,
      isMerchandise: isMerchandise,
    );
    if (!_showTokenPrice) return formattedPrice;
    final cleanPrice = formattedPrice.replaceAll('RM', '').trim();
    final val = double.tryParse(cleanPrice);
    if (val == null) return formattedPrice;
    return '${val.round()} tokens';
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _session,
      builder: (context, _) {
        final userName = _session.user?.displayName ?? 'C2 Member';
        final tokenCount = _session.tokenBalance;
        final selectedStore = _session.selectedStore;
        final featuredDrinks = _featuredDrinkItems();
        final featuredLifestyle = _featuredLifestyleItems();

        return Scaffold(
          backgroundColor: Colors.white,
          extendBody: true,
          bottomNavigationBar: CustomBottomNav(
            selectedIndex: 0,
            onItemTapped: _onBottomNavTapped,
            scrollController: _scrollController,
          ),
          body: Stack(
            children: [
              SafeArea(
                bottom: false,
                child: RefreshIndicator(
                  onRefresh: () => _session.loadAuthenticatedState(force: true),
                  child: SingleChildScrollView(
                    controller: _scrollController,
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.only(bottom: 220),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const SizedBox(height: 16),
                        _buildHeader(userName, tokenCount),
                        const SizedBox(height: 16),
                        AspectRatio(
                          aspectRatio: 1.0,
                          child: _buildHeroBanner(),
                        ),
                        const SizedBox(height: 16),
                        _buildActionButtons(),
                        const SizedBox(height: 16),
                        _buildStoreSection(selectedStore),
                        const SizedBox(height: 20),
                        if (_session.isBootstrapLoading &&
                            _session.user == null)
                          const Center(
                            child: Padding(
                              padding: EdgeInsets.symmetric(vertical: 32),
                              child: CircularProgressIndicator(),
                            ),
                          )
                        else if (_session.bootstrapError != null)
                          _buildErrorCard(
                            _session.bootstrapError!,
                            onRetry: () =>
                                _session.loadAuthenticatedState(force: true),
                          )
                        else ...[
                          _buildProductSection(
                            title: 'Featured Drinks',
                            items: featuredDrinks,
                            onSeeAll: () => InteractiveFillingLoader.show(
                              context,
                              targetPage: const MenuPage(),
                            ),
                          ),
                          const SizedBox(height: 24),
                          _buildProductSection(
                            title: featuredLifestyle.isNotEmpty
                                ? 'Lifestyle Picks'
                                : 'Store Picks',
                            items: featuredLifestyle.isNotEmpty
                                ? featuredLifestyle
                                : featuredDrinks.skip(3).toList(),
                            onSeeAll: () => InteractiveFillingLoader.show(
                              context,
                              targetPage: const MenuPage(),
                            ),
                          ),
                        ],
                      ],
                    ),
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
                  onTap: () =>
                      setState(() => _showTokenPrice = !_showTokenPrice),
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
      },
    );
  }

  Widget _buildHeader(String userName, int tokenCount) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            children: [
              GestureDetector(
                onTap: () {
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
                    color: AppColors.deepTeal,
                    shape: BoxShape.circle,
                  ),
                  alignment: Alignment.center,
                  child: ClipOval(
                    child: _persistedPickedImage != null
                        ? (kIsWeb
                            ? Image.network(
                                _persistedPickedImage!.path,
                                width: 45,
                                height: 45,
                                fit: BoxFit.cover,
                              )
                            : Image.file(
                                _persistedPickedImage!,
                                width: 45,
                                height: 45,
                                fit: BoxFit.cover,
                              ))
                        : (_persistedPresetPath != null
                            ? Image.asset(
                                _persistedPresetPath!,
                                width: 45,
                                height: 45,
                                fit: BoxFit.cover,
                              )
                            : const Icon(
                                Icons.person,
                                color: Colors.white,
                                size: 30,
                              )),
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
                    ),
                  ),
                  Text(
                    userName,
                    style: TextStyle(
                      fontFamily: 'Recoleta',
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: AppColors.deepTeal,
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
                        '$tokenCount tokens',
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
                child: Icon(
                  Icons.notifications_outlined,
                  color: AppColors.deepTeal,
                  size: 26,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildHeroBanner() {
    final banners =
        _session.homeBanners.where((banner) => banner.appearsOnHome).toList();

    if (banners.isEmpty) {
      return Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20),
        child: Container(
          decoration: BoxDecoration(
            color: AppColors.surfaceLight,
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: AppColors.border, width: 1),
          ),
          child: const Center(
            child: Padding(
              padding: EdgeInsets.all(24),
              child: Text(
                'Promotions will appear here once marketing updates them.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontFamily: 'Afacad',
                  color: Colors.black54,
                ),
              ),
            ),
          ),
        ),
      );
    }

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(24),
        child: Stack(
          children: [
            PageView.builder(
              controller: _pageController,
              itemCount: banners.length,
              onPageChanged: (index) =>
                  setState(() => _currentBannerIndex = index),
              itemBuilder: (context, index) {
                final banner = banners[index];
                return Stack(
                  fit: StackFit.expand,
                  children: [
                    _buildBannerImage(banner.imageSource),
                    Container(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [
                            Colors.transparent,
                            Colors.black.withValues(alpha: 0.55),
                          ],
                        ),
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.all(18),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.end,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            banner.title,
                            style: const TextStyle(
                              fontFamily: 'Recoleta',
                              fontSize: 22,
                              fontWeight: FontWeight.bold,
                              color: Colors.white,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            banner.subtitle,
                            style: const TextStyle(
                              fontFamily: 'Afacad',
                              fontSize: 14,
                              color: Colors.white,
                              height: 1.35,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
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
                  banners.length,
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

  Widget _buildBannerImage(String source) {
    if (source.startsWith('http://') || source.startsWith('https://')) {
      return Image.network(
        source,
        width: double.infinity,
        fit: BoxFit.cover,
      );
    }

    return Image.asset(
      source,
      width: double.infinity,
      fit: BoxFit.cover,
    );
  }

  Widget _buildActionButtons() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Row(
        children: [
          Expanded(
            child: GestureDetector(
              onTap: () => InteractiveFillingLoader.show(
                context,
                targetPage: const OrdersPage(),
              ),
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
              onTap: () => InteractiveFillingLoader.show(
                context,
                targetPage: const ReferralPage(),
              ),
              child: Container(
                height: 80,
                padding: const EdgeInsets.only(left: 20),
                decoration: BoxDecoration(
                  color: AppColors.surfaceLight,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: AppColors.border, width: 1.5),
                ),
                alignment: Alignment.centerLeft,
                child: Text(
                  'MY\nREFERRAL',
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

  Widget _buildStoreSection(StoreSummary? selectedStore) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: GestureDetector(
        onTap: _session.stores.isEmpty ? null : _showStorePicker,
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.surfaceLight,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: AppColors.border),
          ),
          child: Row(
            children: [
              Icon(Icons.storefront_outlined, color: AppColors.deepTeal),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Selected Store',
                      style: TextStyle(
                        fontFamily: 'Afacad',
                        fontSize: 12,
                        color: Colors.grey.shade700,
                      ),
                    ),
                    Text(
                      selectedStore?.name ?? 'No store available yet',
                      style: TextStyle(
                        fontFamily: 'Recoleta',
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: AppColors.deepTeal,
                      ),
                    ),
                  ],
                ),
              ),
              Text(
                _session.isMenuLoading ? 'Loading...' : 'Change',
                style: TextStyle(
                  fontFamily: 'Afacad',
                  fontWeight: FontWeight.bold,
                  color: AppColors.deepTeal,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _showStorePicker() async {
    await showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Choose Store',
                  style: TextStyle(
                    fontFamily: 'Recoleta',
                    fontSize: 22,
                    fontWeight: FontWeight.bold,
                    color: AppColors.deepTeal,
                  ),
                ),
                const SizedBox(height: 12),
                for (final store in _session.stores)
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text(
                      store.name,
                      style: const TextStyle(
                        fontFamily: 'Afacad',
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    subtitle: Text(
                      '${store.pickupLeadMinutes} min pickup lead',
                      style: const TextStyle(fontFamily: 'Afacad'),
                    ),
                    trailing: _session.selectedStore?.id == store.id
                        ? Icon(Icons.check_circle, color: AppColors.deepTeal)
                        : null,
                    onTap: () async {
                      Navigator.of(context).pop();
                      await _session.selectStore(store);
                    },
                  ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildProductSection({
    required String title,
    required List<Map<String, dynamic>> items,
    required VoidCallback onSeeAll,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                title,
                style: TextStyle(
                  fontFamily: 'Recoleta',
                  fontSize: 22,
                  fontWeight: FontWeight.bold,
                  color: AppColors.deepTeal,
                ),
              ),
              GestureDetector(
                onTap: onSeeAll,
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
        if (_session.isMenuLoading && items.isEmpty)
          const Center(
            child: Padding(
              padding: EdgeInsets.symmetric(vertical: 32),
              child: CircularProgressIndicator(),
            ),
          )
        else if (_session.menuError != null && items.isEmpty)
          _buildErrorCard(
            _session.menuError!,
            onRetry: () => _session.loadAuthenticatedState(force: true),
          )
        else if (items.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Text(
              'No live menu items are available for this store yet.',
              style: TextStyle(
                fontFamily: 'Afacad',
                fontSize: 15,
                color: Colors.grey.shade700,
              ),
            ),
          )
        else
          SizedBox(
            height: 210,
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              itemCount: items.length,
              itemBuilder: (context, index) {
                final item = items[index];
                return GestureDetector(
                  onTap: () {
                    InteractiveFillingLoader.show(
                      context,
                      targetPage: (item['isDrink'] as bool? ?? false)
                          ? MontBrogaPage(item: item)
                          : SimpleProductDetailPage(item: item),
                    );
                  },
                  child: Container(
                    width: 155,
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
                              top: 14,
                              bottom: 8,
                              left: 10,
                              right: 10,
                            ),
                            child: CatalogProductImage(
                              assetPath: item['image'] as String?,
                              imageUrl: item['image_url'] as String?,
                              fit: BoxFit.contain,
                            ),
                          ),
                        ),
                        Expanded(
                          flex: 4,
                          child: Padding(
                            padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  item['name']?.toString() ?? 'Item',
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    fontFamily: 'Recoleta',
                                    fontSize: 15,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                                Text(
                                  _formatPrice(item),
                                  style: TextStyle(
                                    fontFamily: 'Afacad',
                                    fontSize: 14,
                                    fontWeight: FontWeight.bold,
                                    color: AppColors.deepTeal,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
      ],
    );
  }

  Widget _buildErrorCard(String message, {required VoidCallback onRetry}) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: const Color(0xFFFFF5F3),
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: const Color(0xFFF1C5BB)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Unable to load live data',
              style: TextStyle(
                fontFamily: 'Recoleta',
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: AppColors.deepTeal,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              message,
              style: const TextStyle(fontFamily: 'Afacad', fontSize: 15),
            ),
            const SizedBox(height: 12),
            TextButton(
              onPressed: onRetry,
              child: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }
}
