import 'dart:async';

import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:geolocator/geolocator.dart';

import '../services/app_session_service.dart';
import '../services/catalog_presentation.dart';
import '../services/cart_service.dart';
import '../services/catalog_api_service.dart';
import '../utils/app_colors.dart';
import '../utils/app_notification.dart';
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
  bool _showScrollToTop = false;
  bool _isAutoScrolling = false;
  _MenuSortOrder _sortOrder = _MenuSortOrder.menuOrder;
  int _selectedCategoryIndex = 0;
  int _voucherBannerIndex = 0;
  Timer? _voucherBannerTimer;
  List<RewardVoucher> _voucherBanners = const [];
  Map<int, double> _storeDistancesKm = const {};

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
    final shouldShowScrollToTop =
        _scrollController.hasClients && _scrollController.offset > 520;
    if (shouldShowScrollToTop != _showScrollToTop && mounted) {
      setState(() => _showScrollToTop = shouldShowScrollToTop);
    }

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

  Future<void> _scrollToTop() async {
    if (!_scrollController.hasClients) return;
    setState(() => _selectedCategoryIndex = 0);
    await _scrollController.animateTo(
      0,
      duration: const Duration(milliseconds: 480),
      curve: Curves.easeOutCubic,
    );
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
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      builder: (context) {
        var selectedSortOrder = _sortOrder;

        return StatefulBuilder(
          builder: (context, setSheetState) => SafeArea(
            top: false,
            child: SizedBox(
              width: double.infinity,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Center(
                      child: Container(
                        width: 44,
                        height: 4,
                        decoration: BoxDecoration(
                          color: AppColors.border,
                          borderRadius: BorderRadius.circular(99),
                        ),
                      ),
                    ),
                    const SizedBox(height: 20),
                    Row(
                      children: [
                        Container(
                          width: 46,
                          height: 46,
                          decoration: BoxDecoration(
                            color: AppColors.surfaceLight,
                            borderRadius: BorderRadius.circular(15),
                          ),
                          child: Icon(Icons.tune_rounded,
                              color: AppColors.deepTeal),
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Arrange your menu',
                                style: TextStyle(
                                  fontFamily: 'Recoleta',
                                  fontSize: 23,
                                  fontWeight: FontWeight.bold,
                                  color: AppColors.brandText,
                                ),
                              ),
                              const SizedBox(height: 2),
                              const Text(
                                'Choose how items appear in every category.',
                                style: TextStyle(
                                  fontFamily: 'Afacad',
                                  fontSize: 16,
                                  color: Colors.black54,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 20),
                    Container(
                      decoration: BoxDecoration(
                        color: const Color(0xFFFAFAF8),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: AppColors.border),
                      ),
                      child: RadioGroup<_MenuSortOrder>(
                        groupValue: selectedSortOrder,
                        onChanged: (value) {
                          if (value == null) return;
                          setSheetState(() => selectedSortOrder = value);
                        },
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            for (final sort in _MenuSortOrder.values)
                              Material(
                                color: Colors.transparent,
                                child: RadioListTile<_MenuSortOrder>(
                                  contentPadding: const EdgeInsets.symmetric(
                                    horizontal: 10,
                                  ),
                                  value: sort,
                                  title: Text(
                                    sort.label,
                                    style: TextStyle(
                                      fontFamily: 'Afacad',
                                      fontSize: 17,
                                      fontWeight: selectedSortOrder == sort
                                          ? FontWeight.w700
                                          : FontWeight.w500,
                                      color: AppColors.brandText,
                                    ),
                                  ),
                                  activeColor: AppColors.deepTeal,
                                ),
                              ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 18),
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
                              padding: const EdgeInsets.symmetric(vertical: 14),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(14),
                              ),
                            ),
                            child: const Text(
                              'Reset',
                              style: TextStyle(
                                fontFamily: 'Afacad',
                                fontSize: 17,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
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
                              padding: const EdgeInsets.symmetric(vertical: 14),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(14),
                              ),
                            ),
                            child: const Text(
                              'Apply',
                              style: TextStyle(
                                fontFamily: 'Afacad',
                                fontSize: 17,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
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
                        fontSize: 22,
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
                                    padding:
                                        EdgeInsets.only(left: 12, right: 6),
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
                                        fontSize: 17,
                                        color: AppColors.brandText,
                                        fontWeight: FontWeight.w500,
                                      ),
                                      decoration: const InputDecoration(
                                        hintText: 'Search menu items...',
                                        hintStyle: TextStyle(
                                          fontFamily: 'Afacad',
                                          fontSize: 16,
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
              if (_showScrollToTop)
                Positioned(
                  right: 18,
                  bottom: (_cart.items.isNotEmpty ? 158 : 94) +
                      MediaQuery.paddingOf(context).bottom,
                  child: Semantics(
                    button: true,
                    label: 'Back to top',
                    child: Material(
                      color: AppColors.deepTeal,
                      elevation: 5,
                      shadowColor: Colors.black26,
                      shape: const CircleBorder(),
                      child: InkWell(
                        customBorder: const CircleBorder(),
                        onTap: _scrollToTop,
                        child: const SizedBox(
                          width: 48,
                          height: 48,
                          child: Icon(
                            Icons.keyboard_arrow_up_rounded,
                            color: Colors.white,
                            size: 30,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              Positioned(
                right: 18,
                bottom: (_cart.items.isNotEmpty ? 218 : 154) +
                    MediaQuery.paddingOf(context).bottom,
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
                          fontSize: 15,
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
                  left: 54,
                  right: 54,
                  bottom: 80 + MediaQuery.paddingOf(context).bottom,
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
                                          fontSize: 13,
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
                                          fontSize: 22,
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
                                      fontSize: 15,
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

  Future<void> _showStorePicker() async {
    await _loadStoreDistances();
    if (!mounted) return;
    final stores = List<StoreSummary>.from(_session.stores)
      ..sort((a, b) {
        final aDistance = _storeDistancesKm[a.id];
        final bDistance = _storeDistancesKm[b.id];
        if (aDistance == null && bDistance == null) {
          return a.name.compareTo(b.name);
        }
        if (aDistance == null) return 1;
        if (bDistance == null) return -1;
        return aDistance.compareTo(bDistance);
      });
    final selected = await showModalBottomSheet<StoreSummary>(
      context: context,
      showDragHandle: true,
      builder: (sheetContext) => SafeArea(
        child: ConstrainedBox(
          constraints: BoxConstraints(
              maxHeight: MediaQuery.sizeOf(sheetContext).height * 0.7),
          child: Column(
            children: [
              const ListTile(
                title: Text('Choose pickup outlet',
                    style: TextStyle(
                        fontFamily: 'Recoleta', fontWeight: FontWeight.bold)),
                subtitle: Text('Nearest outlets appear first.'),
              ),
              Expanded(
                  child: ListView(
                      children: stores
                          .map((store) => ListTile(
                                leading: Icon(
                                  store.id == _session.selectedStore?.id
                                      ? Icons.radio_button_checked
                                      : Icons.radio_button_off,
                                  color: AppColors.deepTeal,
                                ),
                                title: Text(store.name),
                                subtitle: Text(
                                    '${store.isOpenNow ? 'Open' : 'Closed'}${_distanceLabel(store)}'),
                                trailing: store.isOpenNow
                                    ? const Icon(Icons.chevron_right)
                                    : null,
                                enabled: store.isOpenNow,
                                onTap: store.isOpenNow
                                    ? () => Navigator.pop(sheetContext, store)
                                    : null,
                              ))
                          .toList())),
            ],
          ),
        ),
      ),
    );
    if (!mounted ||
        selected == null ||
        selected.id == _session.selectedStore?.id) {
      return;
    }

    if (!_cart.isEmpty && _cart.storeId != selected.id) {
      final confirmed = await showDialog<bool>(
            context: context,
            builder: (dialogContext) => AlertDialog(
              title: const Text('Change pickup outlet?'),
              content: const Text(
                  'Your bag contains items from another outlet. Changing outlet will clear the bag.'),
              actions: [
                TextButton(
                    onPressed: () => Navigator.pop(dialogContext, false),
                    child: const Text('Keep current outlet')),
                FilledButton(
                    onPressed: () => Navigator.pop(dialogContext, true),
                    child: const Text('Clear bag and change')),
              ],
            ),
          ) ??
          false;
      if (!confirmed || !mounted) return;
      _cart.clear();
    }

    await _session.selectStore(selected);
    if (!mounted) return;
    _sectionKeys.clear();
    setState(() => _selectedCategoryIndex = 0);
    if (_scrollController.hasClients) {
      _scrollController.jumpTo(0);
    }
  }

  String _distanceLabel(StoreSummary store) {
    final distance = _storeDistancesKm[store.id];
    if (distance == null) return '';
    return distance < 1
        ? ' · ${(distance * 1000).round()} m'
        : ' · ${distance.toStringAsFixed(1)} km';
  }

  Future<void> _loadStoreDistances() async {
    try {
      if (!await Geolocator.isLocationServiceEnabled()) return;
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        return;
      }
      final position = await Geolocator.getCurrentPosition(
          locationSettings:
              const LocationSettings(accuracy: LocationAccuracy.medium));
      final distances = <int, double>{};
      for (final store in _session.stores) {
        if (store.latitude == null || store.longitude == null) continue;
        distances[store.id] = Geolocator.distanceBetween(position.latitude,
                position.longitude, store.latitude!, store.longitude!) /
            1000;
      }
      if (mounted) setState(() => _storeDistancesKm = distances);
    } catch (_) {
      // Manual outlet selection remains available if location cannot be read.
    }
  }

  void _openStoreDirection() {
    final store = _session.selectedStore;
    final storeName = store?.name ?? 'C2 Coffee';
    final destination = _navigationDestination(store);
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      builder: (sheetContext) {
        return SafeArea(
          top: false,
          child: SizedBox(
            width: double.infinity,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 22),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Center(
                    child: Container(
                      width: 44,
                      height: 4,
                      decoration: BoxDecoration(
                        color: AppColors.border,
                        borderRadius: BorderRadius.circular(99),
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),
                  Container(
                    padding: const EdgeInsets.all(18),
                    decoration: BoxDecoration(
                      gradient: AppColors.headerGradient,
                      borderRadius: BorderRadius.circular(22),
                    ),
                    child: Row(
                      children: [
                        Container(
                          width: 48,
                          height: 48,
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.16),
                            borderRadius: BorderRadius.circular(16),
                          ),
                          child: const Icon(
                            Icons.near_me_rounded,
                            color: Colors.white,
                            size: 25,
                          ),
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'Choose your route',
                                style: TextStyle(
                                  fontFamily: 'Recoleta',
                                  fontSize: 22,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.white,
                                ),
                              ),
                              const SizedBox(height: 3),
                              Text(
                                storeName,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  fontFamily: 'Afacad',
                                  fontSize: 16,
                                  color: Colors.white.withValues(alpha: 0.82),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 14),
                  Text(
                    destination,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontFamily: 'Afacad',
                      fontSize: 15,
                      color: Colors.black54,
                      height: 1.25,
                    ),
                  ),
                  const SizedBox(height: 18),
                  _DirectionOption(
                    icon: Icons.map_rounded,
                    iconColor: const Color(0xFF4285F4),
                    title: 'Google Maps',
                    subtitle: 'Open the exact outlet location',
                    onTap: () async {
                      Navigator.pop(sheetContext);
                      await _launchGoogleMaps(store, destination);
                    },
                  ),
                  const SizedBox(height: 12),
                  _DirectionOption(
                    icon: Icons.navigation_rounded,
                    iconColor: const Color(0xFF20B8E8),
                    title: 'Waze',
                    subtitle: 'Start turn-by-turn navigation',
                    onTap: () async {
                      Navigator.pop(sheetContext);
                      await _launchWaze(store, destination);
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

  String _navigationDestination(StoreSummary? store) {
    if (store?.code.toUpperCase() == 'C2-BROGA') {
      return '42-1, Jalan Eco Forest 6/1C, Eco Forest, 43500 Semenyih, Selangor';
    }
    if (store?.addressLabel.isNotEmpty == true) return store!.addressLabel;
    return store?.name ?? 'C2 Coffee';
  }

  String? _coordinatePair(StoreSummary? store) {
    // The legacy C2-BROGA database row can contain its former Broga pin.
    // Use the canonical Eco Forest address above until that row is corrected.
    if (store?.code.toUpperCase() == 'C2-BROGA') return null;
    if (store?.latitude == null || store?.longitude == null) return null;
    return '${store!.latitude},${store.longitude}';
  }

  Future<void> _launchGoogleMaps(
    StoreSummary? store,
    String destination,
  ) async {
    final query = _coordinatePair(store) ?? destination;
    final uri = Uri.https(
      'www.google.com',
      '/maps/search/',
      {'api': '1', 'query': query},
    );
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  Future<void> _launchWaze(StoreSummary? store, String destination) async {
    final coordinates = _coordinatePair(store);
    final appUri = coordinates == null
        ? Uri.parse(
            'waze://?q=${Uri.encodeComponent(destination)}&navigate=yes')
        : Uri.parse('waze://?ll=$coordinates&navigate=yes');
    final webUri = coordinates == null
        ? Uri.https('www.waze.com', '/ul', {
            'q': destination,
            'navigate': 'yes',
          })
        : Uri.https('www.waze.com', '/ul', {
            'll': coordinates,
            'navigate': 'yes',
          });

    if (await canLaunchUrl(appUri)) {
      await launchUrl(appUri, mode: LaunchMode.externalApplication);
      return;
    }
    await launchUrl(webUri, mode: LaunchMode.externalApplication);
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
                InkWell(
                  onTap: _showStorePicker,
                  borderRadius: BorderRadius.circular(8),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Flexible(
                        child: Text(
                          _session.selectedStore?.name ?? 'Choose an outlet',
                          style: TextStyle(
                            fontFamily: 'Recoleta',
                            fontWeight: FontWeight.bold,
                            fontSize: 18,
                            color: AppColors.deepTeal,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      const SizedBox(width: 3),
                      Icon(Icons.keyboard_arrow_down_rounded,
                          size: 20, color: AppColors.deepTeal),
                    ],
                  ),
                ),
                const SizedBox(height: 2),
                Row(
                  children: [
                    Container(
                      width: 7,
                      height: 7,
                      decoration: BoxDecoration(
                        color: _session.selectedStore?.isOpenNow == true
                            ? const Color(0xFF10B981)
                            : Colors.grey,
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 5),
                    Text(
                      _session.selectedStore?.isOpenNow == true
                          ? 'Open for Store Pickup'
                          : 'Closed',
                      style: TextStyle(
                        fontFamily: 'Afacad',
                        fontSize: 15,
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
                      fontSize: 15,
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
    final isOpen = _session.selectedStore?.isOpenNow == true;
    final itemCount = _cart.items.length;
    return Material(
      color: isOpen ? AppColors.deepTeal : Colors.grey.shade600,
      elevation: 8,
      shadowColor: Colors.black.withValues(alpha: 0.24),
      borderRadius: BorderRadius.circular(30),
      child: InkWell(
        borderRadius: BorderRadius.circular(30),
        onTap: isOpen
            ? () {
                InteractiveFillingLoader.show(
                  context,
                  targetPage: const OrderConfirmationPage(),
                );
              }
            : () => AppNotification.showWarning(
                  context,
                  'This outlet is currently closed. Choose an open outlet to order.',
                ),
        child: Container(
          height: 54,
          padding: const EdgeInsets.symmetric(horizontal: 15),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(30),
            border: Border.all(
              color: Colors.white.withValues(alpha: 0.18),
            ),
          ),
          child: Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.14),
                  shape: BoxShape.circle,
                ),
                child: Stack(
                  clipBehavior: Clip.none,
                  children: [
                    const Center(
                      child: Icon(
                        Icons.shopping_bag_outlined,
                        color: Colors.white,
                        size: 21,
                      ),
                    ),
                    Positioned(
                      top: -4,
                      right: -4,
                      child: Container(
                        constraints: const BoxConstraints(
                          minWidth: 20,
                          minHeight: 20,
                        ),
                        padding: const EdgeInsets.symmetric(horizontal: 5),
                        decoration: BoxDecoration(
                          color: const Color(0xFFE5A93C),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: Colors.white, width: 1.5),
                        ),
                        alignment: Alignment.center,
                        child: Text(
                          '$itemCount',
                          style: const TextStyle(
                            fontFamily: 'Afacad',
                            fontSize: 12,
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
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Checkout',
                      style: TextStyle(
                        fontFamily: 'Afacad',
                        fontSize: 17,
                        fontWeight: FontWeight.w800,
                        color: Colors.white,
                        height: 1,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '$itemCount ${itemCount == 1 ? 'item' : 'items'} in your bag',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontFamily: 'Afacad',
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                        color: Colors.white.withValues(alpha: 0.72),
                        height: 1,
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.14),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.arrow_forward_rounded,
                  color: Colors.white,
                  size: 20,
                ),
              ),
            ],
          ),
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
                            fontSize: 13,
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
    final crossAxisCount =
        MediaQuery.orientationOf(context) == Orientation.landscape ? 3 : 2;
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
            gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: crossAxisCount,
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
    final crossAxisCount =
        MediaQuery.orientationOf(context) == Orientation.landscape ? 3 : 2;
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
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: AppColors.deepTeal,
            ),
          ),
        ),
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          padding: EdgeInsets.zero,
          gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: crossAxisCount,
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
                    child: _ResponsiveMenuItemName(
                      name: item['name']?.toString() ?? 'Item',
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
                              fontSize: 16,
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
                fontSize: 24,
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
                fontSize: 17,
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

class _ResponsiveMenuItemName extends StatelessWidget {
  final String name;

  const _ResponsiveMenuItemName({required this.name});

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        const sizes = <double>[17, 16, 15, 14, 13];
        final words = name.trim().split(RegExp(r'\s+'));

        for (final fontSize in sizes) {
          final style = TextStyle(
            fontFamily: 'Recoleta',
            fontSize: fontSize,
            fontWeight: FontWeight.bold,
            height: 1.12,
          );
          final fullLine = TextPainter(
            text: TextSpan(text: name, style: style),
            textDirection: TextDirection.ltr,
            maxLines: 1,
          )..layout(maxWidth: constraints.maxWidth);

          if (!fullLine.didExceedMaxLines) {
            return Text(
              name,
              maxLines: 1,
              softWrap: false,
              overflow: TextOverflow.ellipsis,
              style: style,
            );
          }

          if (words.length < 2) continue;
          var splitAfter = 0;
          for (var index = 1; index < words.length; index++) {
            final firstLine = words.take(index).join(' ');
            final painter = TextPainter(
              text: TextSpan(text: firstLine, style: style),
              textDirection: TextDirection.ltr,
              maxLines: 1,
            )..layout(maxWidth: constraints.maxWidth);
            if (painter.didExceedMaxLines) break;
            splitAfter = index;
          }

          if (splitAfter > 0) {
            final firstLine = words.take(splitAfter).join(' ');
            final secondLine = words.skip(splitAfter).join(' ');
            return Text(
              '$firstLine\n$secondLine',
              maxLines: 2,
              softWrap: false,
              overflow: TextOverflow.ellipsis,
              style: style,
            );
          }
        }

        return Text(
          name,
          maxLines: 1,
          softWrap: false,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(
            fontFamily: 'Recoleta',
            fontSize: 13,
            fontWeight: FontWeight.bold,
          ),
        );
      },
    );
  }
}

class _DirectionOption extends StatelessWidget {
  final IconData icon;
  final Color iconColor;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  const _DirectionOption({
    required this.icon,
    required this.iconColor,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: const Color(0xFFFAFAF8),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(18),
        side: BorderSide(color: AppColors.border),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(18),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 15),
          child: Row(
            children: [
              Container(
                width: 46,
                height: 46,
                decoration: BoxDecoration(
                  color: iconColor.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Icon(icon, color: iconColor, size: 25),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: TextStyle(
                        fontFamily: 'Afacad',
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                        color: AppColors.brandText,
                      ),
                    ),
                    Text(
                      subtitle,
                      style: const TextStyle(
                        fontFamily: 'Afacad',
                        fontSize: 14,
                        color: Colors.black54,
                      ),
                    ),
                  ],
                ),
              ),
              const Icon(
                Icons.arrow_forward_ios_rounded,
                size: 15,
                color: Colors.black38,
              ),
            ],
          ),
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
