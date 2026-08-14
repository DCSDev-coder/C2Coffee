import 'package:flutter/material.dart';

import '../services/app_session_service.dart';
import '../services/catalog_presentation.dart';
import '../services/cart_service.dart';
import '../utils/app_colors.dart';
import '../widgets/catalog_product_image.dart';
import '../widgets/custom_bottom_nav.dart';
import '../widgets/order_status_banner.dart';
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

  const MenuPage({super.key, this.initialCategoryIndex = 0});

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

  bool _isSearching = false;
  bool _showTokenPrice = false;
  bool _isAutoScrolling = false;
  int _selectedCategoryIndex = 0;

  @override
  void initState() {
    super.initState();
    _selectedCategoryIndex = widget.initialCategoryIndex;
    _scrollController.addListener(_onScroll);
    _searchController.addListener(() => setState(() {}));
    Future.microtask(() async {
      try {
        await _session.loadAuthenticatedState();
      } catch (_) {}
      if (!mounted) return;
      await _precacheMenuImages();
      if (!mounted) return;
      _ensureSectionKeys(_uiSections.length);
      if (_uiSections.isNotEmpty) {
        final safeIndex =
            widget.initialCategoryIndex.clamp(0, _uiSections.length - 1);
        _selectedCategoryIndex = safeIndex;
      }
    });
  }

  @override
  void dispose() {
    _scrollController
      ..removeListener(_onScroll)
      ..dispose();
    _sidebarScrollController.dispose();
    _searchController.dispose();
    super.dispose();
  }

  List<_MenuSection> get _uiSections {
    final sections = <_MenuSection>[];
    final query = _searchController.text.trim().toLowerCase();

    for (final category in _session.menuCategories) {
      final items = category.items
          .where((item) => item.isAvailable)
          .map(
            (item) => CatalogPresentation.toLegacyItem(
                item, category.code, category.name),
          )
          .where((item) {
        if (query.isEmpty) return true;
        final name = item['name']?.toString().toLowerCase() ?? '';
        return name.contains(query);
      }).toList();

      sections.add(
        _MenuSection(
          id: category.id,
          title: category.name,
          sidebarLabel: CatalogPresentation.sidebarLabel(category.name),
          items: items,
        ),
      );
    }

    return sections.where((section) => section.items.isNotEmpty).toList();
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

  String _formatPrice(Map<String, dynamic> item) {
    final rawPrice = item['price']?.toString() ?? '';
    if (rawPrice.isEmpty) return '';
    final formattedPrice = AppColors.formatDiscountedPrice(
      rawPrice,
      isDrink: item['isDrink'] as bool? ?? false,
      isMerchandise: (item['isMerchandise'] as bool? ?? false) ||
          (item['isCandle'] as bool? ?? false),
    );
    if (!_showTokenPrice) return formattedPrice;
    final cleanPrice = formattedPrice.replaceAll('RM', '').trim();
    final parsed = double.tryParse(cleanPrice);
    if (parsed == null) return formattedPrice;
    return '${parsed.round()} tokens';
  }

  @override
  Widget build(BuildContext context) {
    final sections = _uiSections;
    _ensureSectionKeys(sections.length);

    return AnimatedBuilder(
      animation: Listenable.merge([_session, _cart]),
      builder: (context, _) {
        return Scaffold(
          backgroundColor: Colors.white,
          resizeToAvoidBottomInset: false,
          body: Stack(
            children: [
              Column(
                children: [
                  _buildHeader(),
                  _buildStoreBar(),
                  Expanded(
                    child: _buildBody(sections),
                  ),
                ],
              ),
              Positioned(
                bottom: 0,
                left: 0,
                right: 0,
                child: CustomBottomNav(
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
              ),
              OrderStatusBanner(
                leftOffset: 88,
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
              if (!_cart.isEmpty)
                Positioned(
                  bottom: 162 + MediaQuery.paddingOf(context).bottom,
                  right: 20,
                  child: GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onTap: () {
                      InteractiveFillingLoader.show(
                        context,
                        targetPage: const OrderConfirmationPage(),
                      );
                    },
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 12,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.deepTeal,
                        borderRadius: BorderRadius.circular(22),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.18),
                            blurRadius: 12,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(
                            Icons.shopping_bag_outlined,
                            color: Colors.white,
                            size: 20,
                          ),
                          const SizedBox(width: 8),
                          Text(
                            '${_cart.items.length} item${_cart.items.length == 1 ? '' : 's'}',
                            style: const TextStyle(
                              fontFamily: 'Afacad',
                              fontSize: 14,
                              fontWeight: FontWeight.bold,
                              color: Colors.white,
                            ),
                          ),
                        ],
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

  Widget _buildHeader() {
    return Container(
      width: double.infinity,
      padding: EdgeInsets.only(
        top: MediaQuery.paddingOf(context).top + 14,
        bottom: 16,
        left: 20,
        right: 20,
      ),
      decoration: BoxDecoration(
        color: AppColors.deepTeal,
        borderRadius: const BorderRadius.only(
          bottomLeft: Radius.circular(20),
          bottomRight: Radius.circular(20),
        ),
      ),
      child: SizedBox(
        height: 48,
        child: AnimatedSwitcher(
          duration: const Duration(milliseconds: 300),
          child: _isSearching
              ? Row(
                  key: const ValueKey('searchBar'),
                  children: [
                    Expanded(
                      child: Container(
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: TextField(
                          controller: _searchController,
                          textAlignVertical: TextAlignVertical.center,
                          style: TextStyle(
                            fontFamily: 'Afacad',
                            fontSize: 15,
                            color: AppColors.deepTeal,
                          ),
                          decoration: const InputDecoration(
                            hintText: 'Search menu',
                            border: InputBorder.none,
                            isDense: true,
                            contentPadding: EdgeInsets.symmetric(
                              horizontal: 14,
                              vertical: 8,
                            ),
                          ),
                        ),
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close,
                          color: Colors.white, size: 20),
                      onPressed: () {
                        setState(() {
                          _isSearching = false;
                          _searchController.clear();
                        });
                      },
                    ),
                  ],
                )
              : Stack(
                  key: const ValueKey('menuHeader'),
                  alignment: Alignment.center,
                  children: [
                    Align(
                      alignment: Alignment.centerLeft,
                      child: GestureDetector(
                        onTap: () => InteractiveFillingLoader.showPop(context),
                        child: const Icon(
                          Icons.arrow_back_ios,
                          color: Colors.white,
                          size: 20,
                        ),
                      ),
                    ),
                    const Text(
                      'MENU',
                      style: TextStyle(
                        fontFamily: 'Recoleta',
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                        letterSpacing: 1,
                      ),
                    ),
                    Align(
                      alignment: Alignment.centerRight,
                      child: GestureDetector(
                        onTap: () => setState(() => _isSearching = true),
                        child: const Icon(Icons.search,
                            color: Colors.white, size: 22),
                      ),
                    ),
                  ],
                ),
        ),
      ),
    );
  }

  Widget _buildStoreBar() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      color: Colors.white,
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _session.selectedStore?.name ?? 'No store selected',
                  style: TextStyle(
                    fontFamily: 'Recoleta',
                    fontWeight: FontWeight.bold,
                    fontSize: 16,
                    color: AppColors.deepTeal,
                  ),
                ),
                Text(
                  _session.selectedStore != null
                      ? '${_session.selectedStore!.pickupLeadMinutes} min pickup lead'
                      : 'Live store data will appear here',
                  style: const TextStyle(
                    fontFamily: 'Afacad',
                    fontSize: 13,
                    color: Colors.black54,
                  ),
                ),
              ],
            ),
          ),
          PopupMenuButton<int>(
            tooltip: 'Switch store',
            onSelected: (storeId) async {
              final store = _session.stores.firstWhere((s) => s.id == storeId);
              await _session.selectStore(store);
            },
            itemBuilder: (context) => [
              for (final store in _session.stores)
                PopupMenuItem<int>(
                  value: store.id,
                  child: Text(store.name),
                ),
            ],
            child: Row(
              children: [
                Text(
                  'Change',
                  style: TextStyle(
                    fontFamily: 'Afacad',
                    fontWeight: FontWeight.bold,
                    color: AppColors.deepTeal,
                  ),
                ),
                Icon(Icons.keyboard_arrow_down, color: AppColors.deepTeal),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBody(List<_MenuSection> sections) {
    if (_session.isBootstrapLoading && _session.user == null) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_session.bootstrapError != null) {
      return _buildMessageState(
        title: 'Unable to load account data',
        message: _session.bootstrapError!,
        onRetry: () => _session.loadAuthenticatedState(force: true),
      );
    }

    if (_session.isMenuLoading && sections.isEmpty) {
      return const Center(child: CircularProgressIndicator());
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
          width: 80,
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
                    child: Text(
                      sections[index].sidebarLabel,
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontFamily: 'Afacad',
                        fontSize: 11,
                        fontWeight:
                            isSelected ? FontWeight.bold : FontWeight.w600,
                        color: isSelected ? AppColors.deepTeal : Colors.black87,
                        height: 1.1,
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
                for (var index = 0; index < sections.length; index++)
                  _buildSection(sections[index], index),
              ],
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
            childAspectRatio: 0.72,
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
  final int id;
  final String title;
  final String sidebarLabel;
  final List<Map<String, dynamic>> items;

  const _MenuSection({
    required this.id,
    required this.title,
    required this.sidebarLabel,
    required this.items,
  });
}
