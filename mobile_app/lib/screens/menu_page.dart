import 'dart:async';

import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';

import '../services/app_session_service.dart';
import '../services/catalog_presentation.dart';
import '../services/cart_service.dart';
import '../services/catalog_api_service.dart';
import '../utils/app_colors.dart';
import '../services/customer_data_service.dart';
import '../services/secure_session_service.dart';
import '../widgets/catalog_product_image.dart';
import '../widgets/custom_bottom_nav.dart';
import '../widgets/app_page_shell.dart';
import '../widgets/token_price_pair.dart';
import 'home_page.dart';
import 'loading_order_page.dart';
import 'order_confirmation_page.dart';
import 'orders_page.dart';
import 'profile_page.dart';
import 'rewards_page.dart';
import 'mont_broga_page.dart';
import 'simple_product_detail_page.dart';

class MenuPage extends StatefulWidget {
  final int initialCategoryIndex;
  final String? initialCategoryCode;

  const MenuPage(
      {super.key, this.initialCategoryIndex = 0, this.initialCategoryCode});

  @override
  State<MenuPage> createState() => _MenuPageState();
}

class _MenuPageState extends State<MenuPage> {
  final AppSessionService _session = AppSessionService.instance;
  final CartService _cart = CartService.instance;
  final ScrollController _scrollController = ScrollController();
  final ScrollController _sidebarScrollController = ScrollController();
  final TextEditingController _searchController = TextEditingController();
  final Map<int, GlobalKey> _sectionKeys = {};
  final PageController _voucherBannerController = PageController();

  bool _isSearching = false;
  bool _showTokenPrice = true;
  bool _isAutoScrolling = false;
  _MenuSortOrder _sortOrder = _MenuSortOrder.menuOrder;
  int _selectedCategoryIndex = 0;
  int _voucherBannerIndex = 0;
  Timer? _voucherBannerTimer;
  List<RewardVoucher> _voucherBanners = const [];

  @override
  void initState() {
    super.initState();
    _selectedCategoryIndex = widget.initialCategoryIndex;
    _scrollController.addListener(_onScroll);
    _searchController.addListener(() => setState(() {}));
    _session.addListener(_onSessionChanged);
    Future.microtask(() async {
      try {
        await _session.loadAuthenticatedState();
      } catch (_) {}
      if (!mounted) return;
      await _loadMenuPreferences();
      if (!mounted) return;
      await _loadVoucherBanners();
      if (!mounted) return;
      await _precacheMenuImages();
      if (!mounted) return;
      _ensureSectionKeys(_uiSections.length);
      if (_uiSections.isNotEmpty) {
        final categoryIndex = widget.initialCategoryCode == null
            ? -1
            : _uiSections.indexWhere(
                (section) => section.key == widget.initialCategoryCode);
        final safeIndex =
            (categoryIndex >= 0 ? categoryIndex : widget.initialCategoryIndex)
                .clamp(0, _uiSections.length - 1);
        _selectedCategoryIndex = safeIndex;
      }
    });
  }

  void _onSessionChanged() {
    if (!mounted) return;
    final bannerCount = _menuVoucherBanners.length;
    if (bannerCount == 0) {
      _voucherBannerIndex = 0;
    } else if (_voucherBannerIndex >= bannerCount) {
      _voucherBannerIndex = 0;
    }
    _startVoucherBannerTimer();
    setState(() {});
  }

  @override
  void dispose() {
    _session.removeListener(_onSessionChanged);
    _scrollController
      ..removeListener(_onScroll)
      ..dispose();
    _sidebarScrollController.dispose();
    _searchController.dispose();
    _voucherBannerTimer?.cancel();
    _voucherBannerController.dispose();
    super.dispose();
  }

  Future<void> _loadVoucherBanners() async {
    try {
      final accessToken =
          await SecureSessionService.instance.getValidAccessToken();
      if (accessToken == null || accessToken.isEmpty) return;
      final vouchers = await CustomerDataService.instance.getRewardVouchers(
        accessToken: accessToken,
        // Menu banners must only advertise vouchers the customer can redeem.
        // History can contain expired, revoked, and retired templates.
        onlyActive: true,
      );
      if (!mounted) return;
      setState(() {
        _voucherBanners = vouchers
            .where((voucher) =>
                voucher.template.imageUrl?.trim().isNotEmpty ?? false)
            .toList();
      });
      _startVoucherBannerTimer();
    } catch (_) {
      // Menu loading must not be blocked if rewards cannot be loaded.
    }
  }

  void _startVoucherBannerTimer() {
    _voucherBannerTimer?.cancel();
    if (_menuVoucherBanners.length < 2) return;
    _voucherBannerTimer = Timer.periodic(const Duration(seconds: 5), (_) {
      if (!mounted || !_voucherBannerController.hasClients) return;
      final bannerCount = _menuVoucherBanners.length;
      if (bannerCount < 2) return;
      final nextIndex = (_voucherBannerIndex + 1) % bannerCount;
      _voucherBannerController.animateToPage(
        nextIndex,
        duration: const Duration(milliseconds: 360),
        curve: Curves.easeInOut,
      );
    });
  }

  List<_MenuVoucherBanner> get _menuVoucherBanners {
    return _voucherBanners
        .where(
            (voucher) => voucher.template.imageUrl?.trim().isNotEmpty ?? false)
        .map(_MenuVoucherBanner.fromIssuedVoucher)
        .toList();
  }

  List<_MenuSection> get _uiSections {
    final query = _searchController.text.trim().toLowerCase();
    final sections = <String, _MenuSectionBuilder>{};

    for (var categoryIndex = 0;
        categoryIndex < _session.menuCategories.length;
        categoryIndex++) {
      final category = _session.menuCategories[categoryIndex];
      for (final item in category.items.where((item) => item.isAvailable)) {
        final legacyItem = CatalogPresentation.toLegacyItem(
            item, category.code, category.name);
        if (query.isNotEmpty) {
          final name = legacyItem['name']?.toString().toLowerCase() ?? '';
          if (!name.contains(query)) {
            continue;
          }
        }
        final sectionTitle =
            CatalogPresentation.displayCategoryName(category.name);
        final sectionKey = category.code;
        final sectionSortOrder = categoryIndex * 1000;

        final builder = sections.putIfAbsent(
          sectionKey,
          () => _MenuSectionBuilder(
            key: sectionKey,
            title: sectionTitle,
            sidebarLabel: CatalogPresentation.sidebarLabel(sectionTitle),
            sortOrder: sectionSortOrder,
          ),
        );
        builder.items.add(legacyItem);
      }
    }

    return sections.values
        .where((section) => section.items.isNotEmpty)
        .map(
          (section) => _MenuSection(
            key: section.key,
            title: section.title,
            sidebarLabel: section.sidebarLabel,
            sortOrder: section.sortOrder,
            items: List.unmodifiable(_sortSectionItems(section.items)),
          ),
        )
        .toList()
      ..sort((a, b) => a.sortOrder.compareTo(b.sortOrder) != 0
          ? a.sortOrder.compareTo(b.sortOrder)
          : a.title.compareTo(b.title));
  }

  String get _menuPreferencesKey {
    final userId = _session.user?.id;
    return 'menu_preferences_${userId ?? 'guest'}';
  }

  Future<void> _loadMenuPreferences() async {
    final preferences = await SharedPreferences.getInstance();
    final savedSort = preferences.getString('${_menuPreferencesKey}_sort');

    if (!mounted) return;
    setState(() {
      _sortOrder = _MenuSortOrder.values.firstWhere(
        (value) => value.name == savedSort,
        orElse: () => _MenuSortOrder.menuOrder,
      );
    });
  }

  Future<void> _saveMenuPreferences() async {
    final preferences = await SharedPreferences.getInstance();
    await preferences.setString(
      '${_menuPreferencesKey}_sort',
      _sortOrder.name,
    );
  }

  List<Map<String, dynamic>> _sortSectionItems(
    List<Map<String, dynamic>> items,
  ) {
    final sortedItems = List<Map<String, dynamic>>.from(items);
    if (_sortOrder == _MenuSortOrder.menuOrder) {
      return sortedItems;
    }

    sortedItems.sort((first, second) {
      final firstAmount = _rmAmountForItem(first) ?? double.infinity;
      final secondAmount = _rmAmountForItem(second) ?? double.infinity;
      final firstName = first['name']?.toString() ?? '';
      final secondName = second['name']?.toString() ?? '';
      final nameComparison =
          firstName.toLowerCase().compareTo(secondName.toLowerCase());
      final priceComparison = firstAmount.compareTo(secondAmount);

      switch (_sortOrder) {
        case _MenuSortOrder.menuOrder:
          return 0;
        case _MenuSortOrder.nameAToZ:
          return nameComparison;
        case _MenuSortOrder.nameZToA:
          return -nameComparison;
        case _MenuSortOrder.priceLowToHigh:
          return priceComparison != 0 ? priceComparison : nameComparison;
        case _MenuSortOrder.priceHighToLow:
          return priceComparison != 0 ? -priceComparison : nameComparison;
      }
    });
    return sortedItems;
  }

  void _ensureSectionKeys(int length) {
    if (_sectionKeys.length == length &&
        _sectionKeys.keys.every((index) => index < length)) {
      return;
    }
    _sectionKeys.clear();
    for (var index = 0; index < length; index++) {
      _sectionKeys[index] = GlobalKey();
    }
  }

  Future<void> _precacheMenuImages() async {
    final imageUrls = _uiSections
        .expand((section) => section.items)
        .map((item) => item['image_url']?.toString())
        .toList();
    await precacheCatalogProductImages(context, imageUrls);
  }

  void _onScroll() {
    if (_isAutoScrolling || _uiSections.isEmpty) return;

    final activationLine = MediaQuery.sizeOf(context).height * 0.66;
    var newIndex = 0;
    for (var i = 0; i < _uiSections.length; i++) {
      final key = _sectionKeys[i];
      if (key?.currentContext == null) continue;
      final box = key!.currentContext!.findRenderObject() as RenderBox?;
      if (box == null || !box.hasSize || !box.attached) continue;
      final position = box.localToGlobal(Offset.zero);
      if (position.dy <= activationLine) {
        newIndex = i;
      }
    }

    if (newIndex != _selectedCategoryIndex) {
      setState(() => _selectedCategoryIndex = newIndex);
      if (_sidebarScrollController.hasClients) {
        final targetOffset = (newIndex * 56.0) - 120;
        final clampedOffset = targetOffset.clamp(
          0.0,
          _sidebarScrollController.position.maxScrollExtent,
        );
        _sidebarScrollController.animateTo(
          clampedOffset,
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOut,
        );
      }
    }
  }

  Future<void> _scrollToCategory(int index) async {
    if (index < 0 || index >= _uiSections.length) return;
    setState(() => _selectedCategoryIndex = index);
    final key = _sectionKeys[index];
    if (key?.currentContext == null) return;

    _isAutoScrolling = true;
    await Scrollable.ensureVisible(
      key!.currentContext!,
      duration: const Duration(milliseconds: 350),
      curve: Curves.easeInOut,
      alignment: 0,
    );
    await Future<void>.delayed(const Duration(milliseconds: 100));
    _isAutoScrolling = false;
  }

  int? _tokenPriceForItem(Map<String, dynamic> item) {
    final displayedTokenPrice = item['displayTokenPrice'];
    if (displayedTokenPrice is num) {
      return displayedTokenPrice.toInt();
    }

    final baseTokenPrice = item['basePriceToken'];
    if (baseTokenPrice is num) {
      return baseTokenPrice.toInt();
    }

    final legacyTokenPrice = item['tokenPrice'];
    if (legacyTokenPrice is num) {
      return legacyTokenPrice.toInt();
    }

    final tokenPrices = item['tokenPrices'];
    if (tokenPrices is Map) {
      final tierKey = _session.tier;
      final tierTokenPrice = tokenPrices[tierKey];
      if (tierTokenPrice is num) return tierTokenPrice.toInt();
      if (tierTokenPrice is String) return int.tryParse(tierTokenPrice);
    }

    return null;
  }

  String _rmPriceForItem(Map<String, dynamic> item) {
    final rawPrice = item['displayPriceRm']?.toString() ??
        item['basePriceRm']?.toString() ??
        item['price']?.toString() ??
        '';
    if (rawPrice.isEmpty) return '';
    return AppColors.formatRmPrice(rawPrice);
  }

  double? _rmAmountForItem(Map<String, dynamic> item) {
    final rawPrice = item['displayPriceRm']?.toString() ??
        item['basePriceRm']?.toString() ??
        item['price']?.toString();
    if (rawPrice == null || rawPrice.trim().isEmpty) return null;
    return double.tryParse(
      rawPrice.replaceAll(RegExp(r'[^0-9.]'), ''),
    );
  }

  Future<void> _showMenuFilters() async {
    final selection = await showModalBottomSheet<_MenuFilterSelection>(
      context: context,
      showDragHandle: true,
      backgroundColor: Colors.white,
      builder: (context) {
        var selectedSortOrder = _sortOrder;

        return StatefulBuilder(
          builder: (context, setSheetState) => SafeArea(
            top: false,
            child: ConstrainedBox(
              constraints: BoxConstraints(
                maxHeight: MediaQuery.sizeOf(context).height * 0.72,
              ),
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 4, 20, 20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Sort menu',
                      style: TextStyle(
                        fontFamily: 'Recoleta',
                        fontSize: 23,
                        fontWeight: FontWeight.bold,
                        color: AppColors.deepTeal,
                      ),
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'Sort items within each category.',
                      style: TextStyle(
                        fontFamily: 'Afacad',
                        fontSize: 16,
                        color: Colors.black54,
                      ),
                    ),
                    const SizedBox(height: 10),
                    Expanded(
                      child: RadioGroup<_MenuSortOrder>(
                        groupValue: selectedSortOrder,
                        onChanged: (value) {
                          if (value == null) return;
                          setSheetState(() => selectedSortOrder = value);
                        },
                        child: ListView(
                          children: [
                            for (final sort in _MenuSortOrder.values)
                              RadioListTile<_MenuSortOrder>(
                                contentPadding: EdgeInsets.zero,
                                dense: true,
                                value: sort,
                                title: Text(
                                  sort.label,
                                  style: const TextStyle(fontFamily: 'Afacad'),
                                ),
                                activeColor: AppColors.deepTeal,
                              ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton(
                            onPressed: () => Navigator.pop(
                              context,
                              const _MenuFilterSelection(
                                sortOrder: _MenuSortOrder.menuOrder,
                              ),
                            ),
                            style: OutlinedButton.styleFrom(
                              foregroundColor: AppColors.deepTeal,
                              side: BorderSide(color: AppColors.deepTeal),
                            ),
                            child: const Text('Reset'),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: FilledButton(
                            onPressed: () => Navigator.pop(
                              context,
                              _MenuFilterSelection(
                                sortOrder: selectedSortOrder,
                              ),
                            ),
                            style: FilledButton.styleFrom(
                              backgroundColor: AppColors.deepTeal,
                            ),
                            child: const Text('Apply'),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );

    if (selection == null || !mounted) return;
    setState(() {
      _sortOrder = selection.sortOrder;
      _selectedCategoryIndex = 0;
    });
    await _saveMenuPreferences();
  }

  int _displayTokenValueForItem(Map<String, dynamic> item) {
    final tokenPrice = _tokenPriceForItem(item);
    if (tokenPrice != null) return tokenPrice;

    final rmPrice = _rmPriceForItem(item);
    final cleanPrice = rmPrice.replaceAll('RM', '').trim();
    final parsedPrice = double.tryParse(cleanPrice);
    if (parsedPrice == null) return 0;
    return parsedPrice.floor();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: Listenable.merge([_session, _cart]),
      builder: (context, _) {
        final sections = _uiSections;
        _ensureSectionKeys(sections.length);

        return AppPageShell(
          title: 'MENU',
          onBack: () {},
          showBackButton: false,
          customHeader: SizedBox(
            height: 44,
            child: Stack(
              alignment: Alignment.center,
              children: [
                // Left-aligned Filter Button
                Align(
                  alignment: Alignment.centerLeft,
                  child: GestureDetector(
                    onTap: _showMenuFilters,
                    behavior: HitTestBehavior.opaque,
                    child: Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.12),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(
                        Icons.tune,
                        color: Colors.white,
                        size: 20,
                      ),
                    ),
                  ),
                ),

                // Center Title "MENU" that fades out & scales as search expands
                AnimatedOpacity(
                  opacity: _isSearching ? 0.0 : 1.0,
                  duration: const Duration(milliseconds: 220),
                  curve: Curves.easeInOut,
                  child: AnimatedScale(
                    scale: _isSearching ? 0.85 : 1.0,
                    duration: const Duration(milliseconds: 220),
                    curve: Curves.easeInOut,
                    child: const Text(
                      'MENU',
                      style: TextStyle(
                        fontFamily: 'Recoleta',
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                        letterSpacing: 1.2,
                      ),
                    ),
                  ),
                ),

                // Search Bar that morphs and expands from right side towards center
                Align(
                  alignment: Alignment.centerRight,
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 280),
                    curve: Curves.easeOutCubic,
                    width: _isSearching
                        ? MediaQuery.sizeOf(context).width - 80
                        : 36,
                    height: 38,
                    decoration: BoxDecoration(
                      color: _isSearching
                          ? Colors.white
                          : Colors.white.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(22),
                      boxShadow: _isSearching
                          ? [
                              BoxShadow(
                                color: Colors.black.withValues(alpha: 0.15),
                                blurRadius: 10,
                                offset: const Offset(0, 2),
                              )
                            ]
                          : null,
                    ),
                    clipBehavior: Clip.antiAlias,
                    child: _isSearching
                        ? SingleChildScrollView(
                            scrollDirection: Axis.horizontal,
                            physics: const NeverScrollableScrollPhysics(),
                            child: SizedBox(
                              width: MediaQuery.sizeOf(context).width - 80,
                              height: 38,
                              child: Row(
                                children: [
                                  const Padding(
                                    padding: EdgeInsets.only(left: 12, right: 6),
                                    child: Icon(
                                      Icons.search,
                                      color: Color(0xFF6B7280),
                                      size: 18,
                                    ),
                                  ),
                                  Expanded(
                                    child: TextField(
                                      controller: _searchController,
                                      autofocus: true,
                                      textAlignVertical:
                                          TextAlignVertical.center,
                                      style: TextStyle(
                                        fontFamily: 'Afacad',
                                        fontSize: 15,
                                        color: AppColors.brandText,
                                        fontWeight: FontWeight.w500,
                                      ),
                                      decoration: const InputDecoration(
                                        hintText: 'Search menu items...',
                                        hintStyle: TextStyle(
                                          fontFamily: 'Afacad',
                                          fontSize: 14,
                                          color: Color(0xFF9CA3AF),
                                        ),
                                        border: InputBorder.none,
                                        isDense: true,
                                        contentPadding: EdgeInsets.symmetric(
                                          vertical: 8,
                                        ),
                                      ),
                                    ),
                                  ),
                                  GestureDetector(
                                    onTap: () {
                                      FocusScope.of(context).unfocus();
                                      setState(() {
                                        _isSearching = false;
                                        _searchController.clear();
                                      });
                                    },
                                    behavior: HitTestBehavior.opaque,
                                    child: const Padding(
                                      padding:
                                          EdgeInsets.symmetric(horizontal: 10),
                                      child: Icon(
                                        Icons.close,
                                        color: Color(0xFF6B7280),
                                        size: 18,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          )
                        : GestureDetector(
                            onTap: () => setState(() => _isSearching = true),
                            behavior: HitTestBehavior.opaque,
                            child: const SizedBox(
                              width: 36,
                              height: 38,
                              child: Center(
                                child: Icon(
                                  Icons.search,
                                  color: Colors.white,
                                  size: 20,
                                ),
                              ),
                            ),
                          ),
                  ),
                ),
              ],
            ),
          ),
          backgroundColor: Colors.white,
          scrollable: false,
          extendBody: true,
          resizeToAvoidBottomInset: false,
          bodyPadding: EdgeInsets.zero,
          bottomNavigationBar: CustomBottomNav(
            selectedIndex: 1,
            scrollController: _scrollController,
            onItemTapped: (index) {
              if (index == 0) {
                CustomBottomNav.switchTab(context, const HomePage());
              } else if (index == 2) {
                CustomBottomNav.switchTab(context, const OrdersPage());
              } else if (index == 3) {
                CustomBottomNav.switchTab(context, const RewardsPage());
              } else if (index == 4) {
                CustomBottomNav.switchTab(context, const ProfilePage());
              }
            },
          ),
          overlay: Stack(
            children: [
              Positioned(
                right: 18,
                bottom: 146 + MediaQuery.paddingOf(context).bottom,
                child: GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: () {
                    setState(() => _showTokenPrice = !_showTokenPrice);
                  },
                  child: Container(
                    width: 56,
                    height: 56,
                    decoration: BoxDecoration(
                      color: _showTokenPrice
                          ? const Color(0xFFE5A93C)
                          : const Color(0xFFFAF7F2),
                      shape: BoxShape.circle,
                      border: Border.all(
                          color: _showTokenPrice
                              ? const Color(0xFFE5A93C)
                              : AppColors.border,
                          width: 1.5),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.16),
                          blurRadius: 10,
                          offset: const Offset(0, 3),
                        ),
                      ],
                    ),
                    child: Center(
                      child: Text(
                        'Press\nMe',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontFamily: 'Afacad',
                          fontSize: 13,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 0.2,
                          color: _showTokenPrice
                              ? Colors.white
                              : AppColors.deepTeal,
                          height: 1.05,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
              if (_cart.items.isNotEmpty)
                Positioned(
                  right: 18,
                  bottom: 72 + MediaQuery.paddingOf(context).bottom,
                  child: _buildCheckoutBar(),
                ),
            ],
          ),
          child: Column(
            children: [
              _buildStoreBar(),
              const SizedBox(height: 10),
              Expanded(
                child: _buildBody(sections),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildVoucherBanner() {
    final banners = _menuVoucherBanners;
    return AspectRatio(
      // Voucher artwork uses the same 2:1 ratio enforced by Admin uploads.
      aspectRatio: 2 / 1,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(18),
        child: ColoredBox(
          color: AppColors.surfaceLight,
          child: Stack(
            fit: StackFit.expand,
            children: [
              PageView.builder(
                controller: _voucherBannerController,
                itemCount: banners.length,
                onPageChanged: (index) =>
                    setState(() => _voucherBannerIndex = index),
                itemBuilder: (context, index) {
                  final banner = banners[index];
                  return GestureDetector(
                    onTap: () => _openVoucherBanner(banner),
                    child: Semantics(
                      button: true,
                      label: '${banner.actionLabel}: ${banner.title}',
                      child: Stack(
                        fit: StackFit.expand,
                        children: [
                          _buildVoucherBannerArtwork(banner),
                          DecoratedBox(
                            decoration: BoxDecoration(
                              gradient: LinearGradient(
                                begin: Alignment.topCenter,
                                end: Alignment.bottomCenter,
                                colors: [
                                  Colors.transparent,
                                  Colors.black.withValues(alpha: 0.72),
                                ],
                                stops: const [0.35, 1],
                              ),
                            ),
                          ),
                          Positioned(
                            left: 14,
                            right: 14,
                            bottom: 16,
                            child: Row(
                              children: [
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Text(
                                        banner.eyebrow,
                                        style: const TextStyle(
                                          fontFamily: 'Afacad',
                                          fontSize: 11,
                                          fontWeight: FontWeight.w700,
                                          letterSpacing: 1.1,
                                          color: Colors.white70,
                                        ),
                                      ),
                                      const SizedBox(height: 1),
                                      Text(
                                        banner.title,
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: const TextStyle(
                                          fontFamily: 'Recoleta',
                                          fontSize: 20,
                                          fontWeight: FontWeight.bold,
                                          color: Colors.white,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 10,
                                    vertical: 7,
                                  ),
                                  decoration: BoxDecoration(
                                    color: Colors.white,
                                    borderRadius: BorderRadius.circular(999),
                                  ),
                                  child: Text(
                                    banner.actionLabel,
                                    style: TextStyle(
                                      fontFamily: 'Afacad',
                                      fontSize: 13,
                                      fontWeight: FontWeight.w700,
                                      color: AppColors.deepTeal,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
              if (banners.length > 1)
                Positioned(
                  left: 0,
                  right: 0,
                  bottom: 8,
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: List.generate(
                      banners.length,
                      (index) => AnimatedContainer(
                        duration: const Duration(milliseconds: 180),
                        width: index == _voucherBannerIndex ? 16 : 6,
                        height: 6,
                        margin: const EdgeInsets.symmetric(horizontal: 3),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(
                            alpha: index == _voucherBannerIndex ? 0.96 : 0.52,
                          ),
                          borderRadius: BorderRadius.circular(999),
                        ),
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildVoucherBannerArtwork(_MenuVoucherBanner banner) {
    return CatalogProductImage(
      imageUrl: resolveCatalogImageSource(banner.imageSource),
      fit: BoxFit.cover,
    );
  }

  void _openVoucherBanner(_MenuVoucherBanner banner) {
    CustomBottomNav.switchTab(context, const RewardsPage());
  }

  Widget _buildStoreBar() {
    return _buildStoreHeader();
  }

  void _openStoreDirection() {
    final storeName = _session.selectedStore?.name ?? 'C2 Coffee Eco Forest';
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) {
        return Container(
          margin: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(24),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.12),
                blurRadius: 20,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: SafeArea(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: AppColors.secondary.withValues(alpha: 0.15),
                          shape: BoxShape.circle,
                        ),
                        child: Icon(
                          Icons.near_me_rounded,
                          color: AppColors.deepTeal,
                          size: 22,
                        ),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Get Directions',
                              style: TextStyle(
                                fontFamily: 'Recoleta',
                                fontSize: 18,
                                fontWeight: FontWeight.bold,
                                color: AppColors.brandText,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              storeName,
                              style: const TextStyle(
                                fontFamily: 'Afacad',
                                fontSize: 13,
                                color: Colors.black54,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),
                  ListTile(
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                    tileColor: const Color(0xFFF7F8F9),
                    leading: const Icon(
                      Icons.map_rounded,
                      color: Color(0xFF4285F4),
                      size: 28,
                    ),
                    title: const Text(
                      'Google Maps',
                      style: TextStyle(
                        fontFamily: 'Afacad',
                        fontWeight: FontWeight.w600,
                        fontSize: 16,
                      ),
                    ),
                    trailing: const Icon(
                      Icons.arrow_forward_ios_rounded,
                      size: 14,
                      color: Colors.black45,
                    ),
                    onTap: () async {
                      Navigator.pop(sheetContext);
                      final googleMapsUri = Uri.parse(
                        'https://share.google/vxhKkaQTBIOH0iO3C',
                      );
                      if (await canLaunchUrl(googleMapsUri)) {
                        await launchUrl(
                          googleMapsUri,
                          mode: LaunchMode.externalApplication,
                        );
                      }
                    },
                  ),
                  const SizedBox(height: 10),
                  ListTile(
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                    tileColor: const Color(0xFFF7F8F9),
                    leading: const Icon(
                      Icons.navigation_rounded,
                      color: Color(0xFF33CCFF),
                      size: 28,
                    ),
                    title: const Text(
                      'Waze',
                      style: TextStyle(
                        fontFamily: 'Afacad',
                        fontWeight: FontWeight.w600,
                        fontSize: 16,
                      ),
                    ),
                    trailing: const Icon(
                      Icons.arrow_forward_ios_rounded,
                      size: 14,
                      color: Colors.black45,
                    ),
                    onTap: () async {
                      Navigator.pop(sheetContext);
                      final encodedName = Uri.encodeComponent(storeName);
                      final wazeAppUri = Uri.parse('waze://?q=$encodedName&navigate=yes');
                      final wazeWebUri = Uri.parse('https://www.waze.com/ul?q=$encodedName&navigate=yes');

                      if (await canLaunchUrl(wazeAppUri)) {
                        await launchUrl(
                          wazeAppUri,
                          mode: LaunchMode.externalApplication,
                        );
                      } else if (await canLaunchUrl(wazeWebUri)) {
                        await launchUrl(
                          wazeWebUri,
                          mode: LaunchMode.externalApplication,
                        );
                      }
                    },
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildStoreHeader() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      color: Colors.white,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  _session.selectedStore?.name ?? 'C2 Coffee Eco Forest',
                  style: TextStyle(
                    fontFamily: 'Recoleta',
                    fontWeight: FontWeight.bold,
                    fontSize: 16,
                    color: AppColors.deepTeal,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Row(
                  children: [
                    Container(
                      width: 7,
                      height: 7,
                      decoration: const BoxDecoration(
                        color: Color(0xFF10B981),
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 5),
                    const Text(
                      'Open for Store Pickup',
                      style: TextStyle(
                        fontFamily: 'Afacad',
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                        color: Colors.black54,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          InkWell(
            onTap: _openStoreDirection,
            borderRadius: BorderRadius.circular(20),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
              decoration: BoxDecoration(
                color: AppColors.secondary.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                  color: AppColors.secondary.withValues(alpha: 0.35),
                  width: 0.8,
                ),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    Icons.directions_outlined,
                    size: 16,
                    color: AppColors.deepTeal,
                  ),
                  const SizedBox(width: 5),
                  Text(
                    'Direction',
                    style: TextStyle(
                      fontFamily: 'Afacad',
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: AppColors.deepTeal,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCheckoutBar() {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () {
        InteractiveFillingLoader.show(
          context,
          targetPage: const OrderConfirmationPage(),
        );
      },
      child: Container(
        width: 56,
        height: 56,
        decoration: BoxDecoration(
          color: AppColors.deepTeal,
          shape: BoxShape.circle,
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.16),
              blurRadius: 12,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            const Center(
              child: Icon(
                Icons.shopping_bag_outlined,
                color: Colors.white,
                size: 24,
              ),
            ),
            Positioned(
              top: -2,
              right: -2,
              child: Container(
                width: 20,
                height: 20,
                decoration: BoxDecoration(
                  color: const Color(0xFFE5A93C),
                  shape: BoxShape.circle,
                  border: Border.all(color: Colors.white, width: 1.5),
                ),
                alignment: Alignment.center,
                child: Text(
                  '${_cart.items.length}',
                  style: const TextStyle(
                    fontFamily: 'Afacad',
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                    height: 1,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBody(List<_MenuSection> sections) {
    if (_session.isBootstrapLoading && _session.user == null) {
      return _buildMenuLoadingState();
    }

    if (_session.bootstrapError != null) {
      return _buildMessageState(
        title: 'Unable to load account data',
        message: _session.bootstrapError!,
        onRetry: () => _session.loadAuthenticatedState(force: true),
      );
    }

    if (_session.isMenuLoading && sections.isEmpty) {
      return _buildMenuLoadingState();
    }

    if (_session.menuError != null && sections.isEmpty) {
      return _buildMessageState(
        title: 'Unable to load menu',
        message: _session.menuError!,
        onRetry: () => _session.loadAuthenticatedState(force: true),
      );
    }

    if (sections.isEmpty) {
      return _buildMessageState(
        title: 'No menu available',
        message: 'This store does not have live menu items yet.',
      );
    }

    final safeSelectedIndex =
        _selectedCategoryIndex.clamp(0, sections.length - 1);

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 96,
          color: Colors.white,
          child: ListView.builder(
            controller: _sidebarScrollController,
            padding: const EdgeInsets.only(bottom: 170),
            itemCount: sections.length,
            itemBuilder: (context, index) {
              final isSelected = index == safeSelectedIndex;
              return GestureDetector(
                onTap: () => _scrollToCategory(index),
                child: Container(
                  height: 55,
                  decoration: BoxDecoration(
                    color: isSelected ? AppColors.surfaceLight : Colors.white,
                    border: isSelected
                        ? Border(
                            left: BorderSide(
                              color: AppColors.deepTeal,
                              width: 3,
                            ),
                          )
                        : null,
                  ),
                  padding: const EdgeInsets.symmetric(horizontal: 4),
                  child: Center(
                    child: SizedBox(
                      width: 84,
                      child: FittedBox(
                        fit: BoxFit.scaleDown,
                        child: Text(
                          sections[index].sidebarLabel,
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontFamily: 'Afacad',
                            fontSize: 11,
                            fontWeight:
                                isSelected ? FontWeight.bold : FontWeight.w600,
                            color: isSelected
                                ? AppColors.deepTeal
                                : Colors.black87,
                            height: 1.1,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              );
            },
          ),
        ),
        Container(width: 1, color: Colors.grey.shade300),
        Expanded(
          child: SingleChildScrollView(
            controller: _scrollController,
            padding: const EdgeInsets.only(
              left: 12,
              right: 12,
              top: 12,
              bottom: 120,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (_menuVoucherBanners.isNotEmpty) ...[
                  _buildVoucherBanner(),
                  const SizedBox(height: 16),
                ],
                for (var index = 0; index < sections.length; index++)
                  _buildSection(sections[index], index),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildMenuLoadingState() {
    return Row(
      children: [
        Container(
          width: 80,
          color: Colors.white,
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 18),
          child: const Column(
            children: [
              C2ImageSkeleton(
                  height: 14,
                  borderRadius: BorderRadius.all(Radius.circular(7))),
              SizedBox(height: 26),
              C2ImageSkeleton(
                  height: 14,
                  borderRadius: BorderRadius.all(Radius.circular(7))),
              SizedBox(height: 26),
              C2ImageSkeleton(
                  height: 14,
                  borderRadius: BorderRadius.all(Radius.circular(7))),
              SizedBox(height: 26),
              C2ImageSkeleton(
                  height: 14,
                  borderRadius: BorderRadius.all(Radius.circular(7))),
            ],
          ),
        ),
        Container(width: 1, color: AppColors.border),
        Expanded(
          child: GridView.builder(
            padding: const EdgeInsets.all(12),
            itemCount: 6,
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              crossAxisSpacing: 12,
              mainAxisSpacing: 12,
              childAspectRatio: 0.65,
            ),
            itemBuilder: (_, __) => Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: AppColors.border),
              ),
              child: const Column(
                children: [
                  Expanded(
                    flex: 6,
                    child: C2ImageSkeleton(
                      width: double.infinity,
                      borderRadius: BorderRadius.all(Radius.circular(14)),
                    ),
                  ),
                  SizedBox(height: 14),
                  C2ImageSkeleton(
                    width: double.infinity,
                    height: 15,
                    borderRadius: BorderRadius.all(Radius.circular(8)),
                  ),
                  SizedBox(height: 8),
                  Align(
                    alignment: Alignment.centerLeft,
                    child: C2ImageSkeleton(
                      width: 50,
                      height: 12,
                      borderRadius: BorderRadius.all(Radius.circular(6)),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildSection(_MenuSection section, int index) {
    return Column(
      key: _sectionKeys[index],
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(bottom: 6, top: 4),
          child: Text(
            section.title,
            style: TextStyle(
              fontFamily: 'Recoleta',
              fontSize: 16,
              fontWeight: FontWeight.bold,
              color: AppColors.deepTeal,
            ),
          ),
        ),
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          padding: EdgeInsets.zero,
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 2,
            crossAxisSpacing: 12,
            mainAxisSpacing: 12,
            childAspectRatio: 0.65,
          ),
          itemCount: section.items.length,
          itemBuilder: (context, itemIndex) {
            final item = section.items[itemIndex];
            return GestureDetector(
              onTap: () {
                InteractiveFillingLoader.show(
                  context,
                  targetPage: _detailPageForItem(item),
                );
              },
              child: _buildMenuItemCard(item),
            );
          },
        ),
        const SizedBox(height: 16),
      ],
    );
  }

  Widget _detailPageForItem(Map<String, dynamic> item) {
    final isDrink = item['isDrink'] as bool? ?? false;
    if (isDrink) {
      return MontBrogaPage(item: item);
    }
    return SimpleProductDetailPage(item: item);
  }

  Widget _buildMenuItemCard(Map<String, dynamic> item) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.border),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            flex: 6,
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Center(
                child: CatalogProductImage(
                  assetPath: item['image'] as String?,
                  imageUrl: item['image_url'] as String?,
                ),
              ),
            ),
          ),
          Expanded(
            flex: 4,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Text(
                      item['name']?.toString() ?? 'Item',
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontFamily: 'Recoleta',
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                  AnimatedSwitcher(
                    duration: const Duration(milliseconds: 200),
                    child: _showTokenPrice
                        ? TokenPricePair(
                            key: const ValueKey('tokenPrice'),
                            tokenValue: _displayTokenValueForItem(item),
                            tokenFontSize: 13,
                            tokenColor: AppColors.deepTeal,
                          )
                        : Text(
                            _rmPriceForItem(item),
                            key: const ValueKey('rmPrice'),
                            style: TextStyle(
                              fontFamily: 'Afacad',
                              fontSize: 14,
                              fontWeight: FontWeight.bold,
                              color: AppColors.deepTeal,
                            ),
                          ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMessageState({
    required String title,
    required String message,
    Future<void> Function()? onRetry,
  }) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
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
            const SizedBox(height: 8),
            Text(
              message,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontFamily: 'Afacad',
                fontSize: 15,
              ),
            ),
            if (onRetry != null) ...[
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: onRetry,
                child: const Text('Retry'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _MenuSection {
  final String key;
  final String title;
  final String sidebarLabel;
  final int sortOrder;
  final List<Map<String, dynamic>> items;

  const _MenuSection({
    required this.key,
    required this.title,
    required this.sidebarLabel,
    required this.sortOrder,
    required this.items,
  });
}

class _MenuVoucherBanner {
  final String imageSource;
  final RewardVoucher voucher;

  const _MenuVoucherBanner({
    required this.imageSource,
    required this.voucher,
  });

  String get eyebrow => 'YOUR AVAILABLE REWARD';

  String get title {
    final value = voucher.template.displayLabel;
    return value.trim().isEmpty ? 'View reward' : value;
  }

  String get actionLabel => 'View reward';

  factory _MenuVoucherBanner.fromIssuedVoucher(RewardVoucher voucher) {
    return _MenuVoucherBanner(
      imageSource: voucher.template.imageUrl ?? '',
      voucher: voucher,
    );
  }
}

enum _MenuSortOrder {
  menuOrder('Menu order'),
  nameAToZ('Name: A to Z'),
  nameZToA('Name: Z to A'),
  priceLowToHigh('Price: low to high'),
  priceHighToLow('Price: high to low');

  final String label;

  const _MenuSortOrder(this.label);
}

class _MenuFilterSelection {
  final _MenuSortOrder sortOrder;

  const _MenuFilterSelection({
    required this.sortOrder,
  });
}

class _MenuSectionBuilder {
  final String key;
  final String title;
  final String sidebarLabel;
  final int sortOrder;
  final List<Map<String, dynamic>> items = [];

  _MenuSectionBuilder({
    required this.key,
    required this.title,
    required this.sidebarLabel,
    required this.sortOrder,
  });
}
