import 'package:flutter/material.dart';
import '../widgets/custom_bottom_nav.dart';
import 'orders_page.dart';
import 'loading_order_page.dart';
import 'profile_page.dart';
import 'order_confirmation_page.dart';
import 'home_page.dart';
import 'barista_page.dart';
import 'rewards_page.dart';
import '../utils/app_colors.dart';
import '../widgets/order_status_banner.dart';
import 'mont_broga_page.dart';
import 'simple_product_detail_page.dart';

class MenuPage extends StatefulWidget {
  final int initialCategoryIndex;

  const MenuPage({super.key, this.initialCategoryIndex = 0});

  @override
  State<MenuPage> createState() => _MenuPageState();
}

class _MenuPageState extends State<MenuPage> {
  final ScrollController _scrollController = ScrollController();

  // List of categories and their corresponding keys for scrolling
  final List<String> _categories = [
    'C2 COFFEE\nCRAFT',
    'C2 BARISTA\nCRAFT',
    'C2 POUR\nOVER',
    'C2\nMOCKTAILS',
    'C2\nMATCHA',
    'C2\nCHOCOLATE',
    'C2\nCOFFEE',
    'C2 FLAVOURED\nCOFFEE',
    'C2\nPASTRIES',
    'C2\nMERCHANDISE',
    'C2\nCANDLE',
  ];

  int _selectedCategoryIndex = 0;

  // Category data
  final List<Map<String, dynamic>> _menuData = [
    {
      'title': 'C2 COFFEE CRAFT',
      'items': [
        {
          'name': 'Mont Broga',
          'price': 'RM 16.90',
          'image': 'assets/images/drinks/MONT BROGA.png',
          'desc':
              'Black coffee layered with orangey cold foam and orange zest.',
          'scale': 1.4,
        },
        {
          'name': 'Shakerato Bianco',
          'price': 'RM 16.90',
          'image': 'assets/images/drinks/SHAKERATO BIANCO.png',
          'desc':
              'Chilled, shaken espresso with sweet silky and refreshing cream.',
          'scale': 1.5,
        },
        {
          'name': 'Yuzukano',
          'price': 'RM 16.90',
          'image': 'assets/images/drinks/YUZUKANO.png',
          'desc':
              'Crisp espresso infused with refreshing Japanese yuzu citrus puree.',
          'scale': 1.5,
        },
        {
          'name': 'Senja Di Broga',
          'price': 'RM 16.90',
          'image': 'assets/images/drinks/SENJA DI BROGA.png',
          'desc':
              'Sunset-inspired specialty brew with tropical fruit notes and velvety foam.',
          'scale': 1.5,
        },
        {
          'name': 'Espresso Bomb',
          'price': 'RM 15.90',
          'image': 'assets/images/drinks/ESPRESSO BOMB.png',
          'desc':
              'An intense double-shot espresso bomb poured over chilled creamy layers.',
          'scale': 1.5,
        },
      ]
    },
    {
      'title': 'C2 BARISTA CRAFT',
      'items': [
        {
          'name': 'By Syah',
          'image': 'assets/images/drinks/PINKY BLUSH MILKSHAKE BY SYAH.png',
          'scale': 1.5,
        },
        {
          'name': 'By Ajim',
          'image': 'assets/images/drinks/CLOUDY JASMINE.png',
          'scale': 1.5,
        },
      ]
    },
    {
      'title': 'C2 POUR OVER',
      'items': [
        {
          'name': 'V60 Brew',
          'price': 'RM 20.90',
          'image': 'assets/images/drinks/V60 BREW.png',
          'scale': 1.5,
        },
      ]
    },
    {
      'title': 'C2 MOCKTAILS',
      'items': [
        {
          'name': 'Boijito',
          'price': 'RM 15.90',
          'image': 'assets/images/drinks/BOIJITO.png',
          'scale': 1.5,
        },
        {
          'name': 'Bloody Peach',
          'price': 'RM 15.90',
          'image': 'assets/images/drinks/BLOODY PEACH.png',
          'scale': 1.5,
        },
        {
          'name': 'Fuji Fizz',
          'price': 'RM 15.90',
          'image': 'assets/images/drinks/FUJI FIZZ.png',
          'scale': 1.5,
        },
        {
          'name': 'Spicy Mimosa',
          'price': 'RM 15.90',
          'image': 'assets/images/drinks/SPICY MIMOSA.png',
          'scale': 1.5,
        },
        {
          'name': 'Onde2Pop',
          'price': 'RM 15.90',
          'image': 'assets/images/drinks/ONDE-ONDE SODA.png',
          'scale': 1.5,
        },
      ]
    },
    {
      'title': 'C2 MATCHA',
      'items': [
        {
          'name': 'Matcha Latte',
          'price': 'RM 12.90',
          'image': 'assets/images/drinks/MATCHA LATTE.png',
          'scale': 1.5,
        },
        {
          'name': 'Monkey Matcha',
          'price': 'RM 15.90',
          'image': 'assets/images/drinks/MONKEY MATCHA.png',
          'scale': 1.5,
        },
        {
          'name': 'Pinky Promise Matcha',
          'price': 'RM 15.90',
          'image': 'assets/images/drinks/PINKY PROMISE MATCHA.png',
          'scale': 1.8,
        },
      ]
    },
    {
      'title': 'C2 CHOCOLATE',
      'items': [
        {
          'name': 'Milk Chocolate',
          'price': 'RM 14.90',
          'image': 'assets/images/drinks/MILK CHOCOLATE.png',
          'scale': 1.5,
        },
        {
          'name': 'Nutty Chocolate',
          'price': 'RM 16.90',
          'image': 'assets/images/drinks/NUTTY CHOCOLATE.png',
          'scale': 1.5,
        },
      ]
    },
    {
      'title': 'C2 COFFEE',
      'items': [
        {
          'name': 'Espresso',
          'price': 'RM 5.90',
          'image': 'assets/images/drinks/ESPRESSO.png',
          'scale': 1.5,
        },
        {
          'name': 'Pocco Locco',
          'price': 'RM 9.90',
          'image': 'assets/images/drinks/POCCO LOCCO.png',
          'scale': 1.5,
        },
        {
          'name': 'Latte',
          'price': 'RM 10.90',
          'image': 'assets/images/drinks/LATTE.png',
          'scale': 1.5,
        },
        {
          'name': 'Flat white',
          'price': 'RM 10.90',
          'image': 'assets/images/drinks/FLAT WHITE.png',
          'scale': 1.5,
        },
        {
          'name': 'Cappuccino',
          'price': 'RM 10.90',
          'image': 'assets/images/drinks/CAPPUCCINO.png',
          'scale': 1.5,
        },
      ]
    },
    {
      'title': 'C2 FLAVOURED COFFEE',
      'items': [
        {
          'name': 'Butterscotch Latte',
          'price': 'RM 13.90',
          'image': 'assets/images/drinks/BUTTERSCOTH LATTE.png',
          'scale': 1.5,
        },
        {
          'name': 'Hazelnut Latte',
          'price': 'RM 13.90',
          'image': 'assets/images/drinks/HAZELNUT LATTE.png',
          'scale': 1.5,
        },
        {
          'name': 'Vanilla Latte',
          'price': 'RM 13.90',
          'image': 'assets/images/drinks/VANILLA LATTE.png',
          'scale': 1.5,
        },
        {
          'name': 'Blue Cloud Coconut Coffee',
          'price': 'RM 15.90',
          'image': 'assets/images/drinks/BLUE CLOUD COCONUT COFFEE.png',
          'scale': 1.8,
        },
        {
          'name': 'Mocha',
          'price': 'RM 16.90',
          'image': 'assets/images/drinks/MOCHA.png',
          'scale': 1.5,
        },
      ]
    },
    {
      'title': 'C2 PASTRIES',
      'items': [
        {
          'name': 'Lamb Curry Puff',
          'price': 'RM 3.00',
          'image': 'assets/images/pastries/curry puff.png',
          'scale': 2.8,
        },
      ]
    },
    {
      'title': 'C2 MERCHANDISE',
      'items': [
        {
          'name': 'C2 Cup Cream',
          'price': 'RM 39.00',
          'image': 'assets/images/merchandies/cream.png',
          'scale': 1.5,
        },
        {
          'name': 'C2 Cup Dark Blue',
          'price': 'RM 39.00',
          'image': 'assets/images/merchandies/dark blue.png',
          'scale': 1.5,
        },
        {
          'name': 'C2 Cup Green',
          'price': 'RM 39.00',
          'image': 'assets/images/merchandies/green.png',
          'scale': 1.5,
        },
        {
          'name': 'C2 Cup Light Purple',
          'price': 'RM 39.00',
          'image': 'assets/images/merchandies/light purple.png',
          'scale': 2.0,
        },
        {
          'name': 'C2 Cup Light Blue',
          'price': 'RM 39.00',
          'image': 'assets/images/merchandies/light blue.png',
          'scale': 1.5,
        },
      ]
    },
    {
      'title': 'C2 CANDLE',
      'items': [
        {
          'name': 'Gunung Candle',
          'price': 'RM 47.00',
          'image': 'assets/images/candles/gunung.png',
          'scale': 2.0,
        },
        {
          'name': 'Crushed Lime & Seasalt',
          'price': 'RM 47.00',
          'image': 'assets/images/candles/crushed lime and seasalt.png',
          'scale': 2.8,
        },
        {
          'name': 'Fresh Sage & Driftwood',
          'price': 'RM 47.00',
          'image': 'assets/images/candles/fresh sage and driftwood.png',
          'scale': 2.8,
        },
        {
          'name': 'Tobacco Vanilla',
          'price': 'RM 47.00',
          'image': 'assets/images/candles/tobacco vanilla.png',
          'scale': 2.0,
        },
      ]
    },
  ];

  // Map to store keys for each section header
  final Map<int, GlobalKey> _sectionKeys = {};
  final ScrollController _sidebarScrollController = ScrollController();
  bool _isSearching = false;
  bool _isCartOpen = false;
  bool _isAutoScrolling = false;
  bool _showTokenPrice = false;
  final TextEditingController _searchController = TextEditingController();
  int _basketQuantity = 1;
  double get _basketItemPrice => AppColors.getDiscountedDrinkPrice(16.90);

  double get _basketSubtotal => _basketItemPrice * _basketQuantity;

  bool _isDrinkItem(Map<String, dynamic> item) {
    final image = (item['image']?.toString() ?? '').toLowerCase();
    if (image.contains('pastries') ||
        image.contains('merchandies') ||
        image.contains('candle')) {
      return false;
    }
    return true;
  }

  bool _isMerchandiseItem(Map<String, dynamic> item) {
    final image = (item['image']?.toString() ?? '').toLowerCase();
    return image.contains('merchandies') || image.contains('candle');
  }

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

  @override
  void initState() {
    super.initState();
    _selectedCategoryIndex = widget.initialCategoryIndex;
    for (int i = 0; i < _categories.length; i++) {
      _sectionKeys[i] = GlobalKey();
    }
    _scrollController.addListener(_onScroll);
    _searchController.addListener(() {
      setState(() {});
    });

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (widget.initialCategoryIndex != 0) {
        _scrollToCategory(widget.initialCategoryIndex);
      }
    });
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _precacheMenuImages();
  }

  void _precacheMenuImages() {
    for (final section in _menuData) {
      final items = section['items'] as List<Map<String, dynamic>>? ?? [];
      for (final item in items) {
        final img = item['image'] as String?;
        if (img != null && img.isNotEmpty) {
          precacheImage(AssetImage(img), context);
        }
        final images = item['images'] as List<String>?;
        if (images != null) {
          for (final subImg in images) {
            precacheImage(AssetImage(subImg), context);
          }
        }
      }
    }
  }

  @override
  void dispose() {
    _searchController.dispose();
    _scrollController.removeListener(_onScroll);
    _scrollController.dispose();
    _sidebarScrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_isAutoScrolling) return;

    int newIndex = 0;

    // If reached near bottom, activate the last category
    if (_scrollController.hasClients &&
        _scrollController.position.maxScrollExtent > 0 &&
        _scrollController.position.pixels >=
            _scrollController.position.maxScrollExtent - 120) {
      newIndex = _categories.length - 1;
    } else {
      for (int i = 0; i < _categories.length; i++) {
        final key = _sectionKeys[i];
        if (key?.currentContext != null) {
          final RenderBox? box =
              key!.currentContext!.findRenderObject() as RenderBox?;
          if (box != null && box.hasSize && box.attached) {
            final position = box.localToGlobal(Offset.zero);
            if (position.dy <= 240) {
              newIndex = i;
            }
          }
        }
      }
    }

    if (newIndex != _selectedCategoryIndex) {
      setState(() {
        _selectedCategoryIndex = newIndex;
      });
      if (_sidebarScrollController.hasClients) {
        final targetOffset = (newIndex * 55.0) - 100;
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

  void _scrollToCategory(int index) {
    setState(() {
      _selectedCategoryIndex = index;
    });

    final key = _sectionKeys[index];
    if (key != null && key.currentContext != null) {
      _isAutoScrolling = true;
      Scrollable.ensureVisible(
        key.currentContext!,
        duration: const Duration(milliseconds: 400),
        curve: Curves.easeInOut,
        alignment: 0.0, // align to top
      ).then((_) {
        Future.delayed(const Duration(milliseconds: 100), () {
          if (mounted) {
            _isAutoScrolling = false;
          }
        });
      });
    }
  }

  List<Map<String, dynamic>> get _filteredMenuData {
    if (!_isSearching || _searchController.text.isEmpty) {
      return _menuData;
    }
    final query = _searchController.text.toLowerCase();
    final List<Map<String, dynamic>> filtered = [];

    for (var section in _menuData) {
      final items = section['items'] as List<Map<String, dynamic>>;
      final filteredItems = items.where((item) {
        final name = (item['name'] as String).toLowerCase();
        return name.contains(query);
      }).toList();

      filtered.add({
        'title': section['title'],
        'items': filteredItems,
      });
    }
    return filtered;
  }

  @override
  Widget build(BuildContext context) {
    Color orangeColor = AppColors.deepTeal;
    const Color bgColor = Colors.white;

    return Scaffold(
      backgroundColor: bgColor,
      resizeToAvoidBottomInset: false,
      body: Stack(
        children: [
          // Main Content
          Column(
            children: [
              // Custom Header
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
                child: SizedBox(
                  height: 38,
                  child: AnimatedSwitcher(
                    duration: const Duration(milliseconds: 300),
                    transitionBuilder:
                        (Widget child, Animation<double> animation) {
                      return FadeTransition(
                        opacity: animation,
                        child: SlideTransition(
                          position: Tween<Offset>(
                            begin: const Offset(0.2, 0.0),
                            end: Offset.zero,
                          ).animate(CurvedAnimation(
                            parent: animation,
                            curve: Curves.easeOutCubic,
                          )),
                          child: child,
                        ),
                      );
                    },
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
                                      hintText: 'Search',
                                      hintStyle: TextStyle(
                                        color: Colors.grey,
                                        fontFamily: 'Afacad',
                                        fontSize: 15,
                                      ),
                                      border: InputBorder.none,
                                      isDense: true,
                                      contentPadding: EdgeInsets.symmetric(
                                          horizontal: 14, vertical: 8),
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
                                  onTap: () =>
                                      InteractiveFillingLoader.showPop(context),
                                  child: const Icon(Icons.arrow_back_ios,
                                      color: Colors.white, size: 20),
                                ),
                              ),
                              const Text(
                                'MENU',
                                style: TextStyle(
                                  fontFamily: 'Recoleta',
                                  fontSize: 20,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.white,
                                  letterSpacing: 1.0,
                                ),
                              ),
                              Align(
                                alignment: Alignment.centerRight,
                                child: GestureDetector(
                                  onTap: () {
                                    setState(() {
                                      _isSearching = true;
                                    });
                                  },
                                  child: const Icon(Icons.search,
                                      color: Colors.white, size: 22),
                                ),
                              ),
                            ],
                          ),
                  ),
                ),
              ),

              // Location Header
              Container(
                width: double.infinity,
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                color: Colors.white,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Eco Forest, Semenyih',
                      style: TextStyle(
                        fontFamily: 'Recoleta',
                        fontWeight: FontWeight.bold,
                        fontSize: 16,
                        color: orangeColor,
                      ),
                    ),
                    Text(
                      'A latte love makes perfect scents ☕︎♡',
                      style: TextStyle(
                        fontFamily: 'Afacad',
                        fontSize: 13,
                        color: Colors.black54,
                      ),
                    ),
                  ],
                ),
              ),

              // Main Content Area
              Expanded(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Sidebar
                    Container(
                      width: 80,
                      color: Colors.white,
                      child: ListView.builder(
                        controller: _sidebarScrollController,
                        padding: const EdgeInsets.only(
                            bottom:
                                170), // Padding for bottom nav & status banner
                        itemCount: _categories.length,
                        itemBuilder: (context, index) {
                          final isSelected = index == _selectedCategoryIndex;
                          return GestureDetector(
                            onTap: () => _scrollToCategory(index),
                            child: Container(
                              height: 55, // Reduced from 70 to prevent clashing
                              decoration: BoxDecoration(
                                color: isSelected
                                    ? AppColors.surfaceLight
                                    : Colors.white,
                                border: isSelected
                                    ? Border(
                                        left: BorderSide(
                                          color: orangeColor,
                                          width: 3,
                                        ),
                                      )
                                    : null,
                              ),
                              padding:
                                  const EdgeInsets.symmetric(horizontal: 4),
                              child: Center(
                                child: Text(
                                  _categories[index],
                                  textAlign: TextAlign.center,
                                  style: TextStyle(
                                    fontFamily: 'Afacad',
                                    fontSize: 11,
                                    fontWeight: isSelected
                                        ? FontWeight.bold
                                        : FontWeight.w600,
                                    color: isSelected
                                        ? orangeColor
                                        : Colors.black87,
                                    height: 1.1,
                                  ),
                                ),
                              ),
                            ),
                          );
                        },
                      ),
                    ),

                    // Divider
                    Container(width: 1, color: Colors.grey.shade300),

                    // Right Content Area (Drinks)
                    Expanded(
                      child: SingleChildScrollView(
                        controller: _scrollController,
                        padding: const EdgeInsets.only(
                            left: 12,
                            right: 12,
                            top: 12,
                            bottom: 120), // Clearance for bottom nav bar
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children:
                              _filteredMenuData.asMap().entries.map((entry) {
                            final sectionIndex = entry.key;
                            final section = entry.value;
                            final items =
                                section['items'] as List<Map<String, dynamic>>;

                            if (items.isEmpty) {
                              return SizedBox(key: _sectionKeys[sectionIndex]);
                            }

                            return Column(
                              key: _sectionKeys[sectionIndex],
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Padding(
                                  padding:
                                      const EdgeInsets.only(bottom: 2, top: 4),
                                  child: Text(
                                    section['title'],
                                    style: TextStyle(
                                      fontFamily: 'Recoleta',
                                      fontSize: 16,
                                      fontWeight: FontWeight.bold,
                                      color: orangeColor,
                                    ),
                                  ),
                                ),
                                GridView.builder(
                                  shrinkWrap: true,
                                  physics: const NeverScrollableScrollPhysics(),
                                  padding: EdgeInsets.zero,
                                  gridDelegate:
                                      const SliverGridDelegateWithFixedCrossAxisCount(
                                    crossAxisCount: 2,
                                    crossAxisSpacing: 12,
                                    mainAxisSpacing: 12,
                                    childAspectRatio: 0.72,
                                  ),
                                  itemCount: items.length,
                                  itemBuilder: (context, itemIndex) {
                                    final item = items[itemIndex];
                                    return GestureDetector(
                                      onTap: () {
                                        if (item['name'] == 'By Syah') {
                                          InteractiveFillingLoader.show(
                                            context,
                                            targetPage: BaristaPage(
                                              title: 'By Syah',
                                              heroImage:
                                                  'assets/images/Syah.jpeg',
                                              drinks: [
                                                {
                                                  'name':
                                                      'Pinky Blush Milkshake',
                                                  'price': 'RM 14.90',
                                                  'image':
                                                      'assets/images/drinks/PINKY BLUSH MILKSHAKE BY SYAH.png',
                                                  'scale': 1.5,
                                                },
                                                {
                                                  'name': 'Solero Fizz',
                                                  'price': 'RM 14.90',
                                                  'image':
                                                      'assets/images/drinks/SOLERO FIZZ.png',
                                                  'scale': 1.4,
                                                },
                                                {
                                                  'name': 'Paddle Pop',
                                                  'price': 'RM 14.90',
                                                  'image':
                                                      'assets/images/drinks/PADDLE POP.png',
                                                  'scale': 1.4,
                                                },
                                              ],
                                            ),
                                          );
                                        } else if (item['name'] == 'By Ajim') {
                                          InteractiveFillingLoader.show(
                                            context,
                                            targetPage: BaristaPage(
                                              title: 'By Ajim',
                                              heroImage:
                                                  'assets/images/FKP01925.jpg',
                                              drinks: [
                                                {
                                                  'name': 'Cloudy Jasmine',
                                                  'price': 'RM 14.90',
                                                  'image':
                                                      'assets/images/drinks/CLOUDY JASMINE.png',
                                                  'scale': 1.5,
                                                },
                                              ],
                                            ),
                                          );
                                        } else if (!_isDrinkItem(item)) {
                                          InteractiveFillingLoader.show(
                                            context,
                                            targetPage: SimpleProductDetailPage(
                                                item: item),
                                          );
                                        } else {
                                          InteractiveFillingLoader.show(
                                            context,
                                            targetPage: MontBrogaPage(
                                              item: {
                                                ...item,
                                                'category': section['title'],
                                              },
                                            ),
                                          );
                                        }
                                      },
                                      child: _buildMenuItemCard(item),
                                    );
                                  },
                                ),
                                const SizedBox(height: 16),
                              ],
                            );
                          }).toList(),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),

          // Navigation bar — inside Stack so cart panel can slide over it
          Positioned(
            bottom: 0,
            left: 0,
            right: 0,
            child: CustomBottomNav(
              selectedIndex: 1,
              onItemTapped: (index) {
                if (index == 0) {
                  InteractiveFillingLoader.show(context,
                      targetPage: const HomePage());
                } else if (index == 2) {
                  InteractiveFillingLoader.show(context,
                      targetPage: const OrdersPage());
                } else if (index == 3) {
                  InteractiveFillingLoader.show(context,
                      targetPage: const RewardsPage());
                } else if (index == 4) {
                  InteractiveFillingLoader.show(context,
                      targetPage: const ProfilePage());
                }
              },
            ),
          ),

          // Global Order Status Banner — above nav bar, beside basket FAB
          if (!_isCartOpen)
            OrderStatusBanner(
              leftOffset: 88,
              rightOffset: 90,
              bottomOffset: 90 + MediaQuery.paddingOf(context).bottom,
            ),

          // Circle Coin FAB (above basket FAB) — visible only when cart is closed
          if (!_isCartOpen)
            Positioned(
              bottom: 160 + MediaQuery.paddingOf(context).bottom,
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

          // Basket FAB (bottom right) — visible only when cart is closed
          if (!_isCartOpen)
            Positioned(
              bottom: 90 + MediaQuery.paddingOf(context).bottom,
              right: 20,
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: () => setState(() => _isCartOpen = true),
                child: Container(
                  width: 60,
                  height: 60,
                  decoration: BoxDecoration(
                    color: AppColors.deepTeal,
                    borderRadius: BorderRadius.circular(18),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.22),
                        blurRadius: 14,
                        offset: const Offset(0, 5),
                      ),
                    ],
                  ),
                  child: Stack(
                    clipBehavior: Clip.none,
                    children: [
                      const Center(
                        child: Icon(Icons.shopping_basket,
                            size: 28, color: Colors.white),
                      ),
                      Positioned(
                        right: 8,
                        top: 8,
                        child: Container(
                          padding: const EdgeInsets.all(4),
                          decoration: BoxDecoration(
                            color: AppColors.terracotta,
                            shape: BoxShape.circle,
                          ),
                          child: Text(
                            '$_basketQuantity',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                              height: 1.0,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),

          // Dim overlay — BEFORE the cart panel so panel stays clickable
          if (_isCartOpen)
            Positioned(
              top: 0,
              left: 0,
              bottom: 0,
              right: MediaQuery.sizeOf(context).width * 0.15,
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: () => setState(() => _isCartOpen = false),
                child: Container(
                  color: Colors.black.withValues(alpha: 0.45),
                ),
              ),
            ),

          AnimatedPositioned(
            duration: const Duration(milliseconds: 350),
            curve: Curves.easeOutCubic,
            top: 0,
            bottom: 0,
            right: _isCartOpen ? 0 : -MediaQuery.sizeOf(context).width * 0.85,
            width: MediaQuery.sizeOf(context).width * 0.85,
            child: Material(
              elevation: 24,
              shadowColor: Colors.black38,
              borderRadius: const BorderRadius.only(
                topLeft: Radius.circular(24),
                bottomLeft: Radius.circular(24),
              ),
              child: Container(
                decoration: const BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.only(
                    topLeft: Radius.circular(24),
                    bottomLeft: Radius.circular(24),
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Panel header
                    Container(
                      padding: EdgeInsets.only(
                        top: MediaQuery.paddingOf(context).top + 25,
                        bottom: 16,
                        left: 20,
                        right: 20,
                      ),
                      decoration: const BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.only(
                          topLeft: Radius.circular(24),
                        ),
                      ),
                      child: Row(
                        children: [
                          GestureDetector(
                            onTap: () => setState(() => _isCartOpen = false),
                            child: Icon(Icons.arrow_back_ios,
                                color: AppColors.deepTeal, size: 20),
                          ),
                          const SizedBox(width: 12),
                          Text(
                            'YOUR BASKET',
                            style: TextStyle(
                              fontFamily: 'Recoleta',
                              fontSize: 20,
                              fontWeight: FontWeight.bold,
                              color: AppColors.deepTeal,
                              letterSpacing: 1.0,
                            ),
                          ),
                          const Spacer(),
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 10, vertical: 4),
                            decoration: BoxDecoration(
                              color: AppColors.deepTeal.withValues(alpha: 0.1),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Text(
                              '$_basketQuantity ${_basketQuantity == 1 ? 'item' : 'items'}',
                              style: TextStyle(
                                fontFamily: 'Afacad',
                                fontSize: 12,
                                color: AppColors.deepTeal,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),

                    // Cart items list
                    Expanded(
                      child: ListView(
                        padding: const EdgeInsets.all(20),
                        children: [
                          // Sample cart item
                          Container(
                            padding: const EdgeInsets.all(14),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(14),
                              border:
                                  Border.all(color: AppColors.border, width: 1),
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.black.withValues(alpha: 0.03),
                                  blurRadius: 6,
                                  offset: const Offset(0, 2),
                                ),
                              ],
                            ),
                            child: Row(
                              children: [
                                ClipRRect(
                                  borderRadius: BorderRadius.circular(10),
                                  child: Image.asset(
                                    'assets/images/drinks/MONT BROGA.png',
                                    width: 60,
                                    height: 60,
                                    fit: BoxFit.contain,
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        'Mont Broga',
                                        style: TextStyle(
                                          fontFamily: 'Recoleta',
                                          fontSize: 15,
                                          fontWeight: FontWeight.bold,
                                          color: AppColors.deepTeal,
                                        ),
                                      ),
                                      const SizedBox(height: 2),
                                      const Text(
                                        'Regular Ice · Regular Sweet',
                                        style: TextStyle(
                                          fontFamily: 'Afacad',
                                          fontSize: 12,
                                          color: Colors.black54,
                                        ),
                                      ),
                                      const SizedBox(height: 4),
                                      Text(
                                        _formatPrice(
                                            'RM ${(_basketItemPrice * _basketQuantity).toStringAsFixed(2)}'),
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
                                // Quantity controls
                                Row(
                                  children: [
                                    GestureDetector(
                                      behavior: HitTestBehavior.opaque,
                                      onTap: () {
                                        if (_basketQuantity > 1) {
                                          setState(() => _basketQuantity--);
                                        }
                                      },
                                      child: Container(
                                        width: 32,
                                        height: 32,
                                        decoration: BoxDecoration(
                                          border: Border.all(
                                              color: AppColors.border),
                                          borderRadius:
                                              BorderRadius.circular(8),
                                        ),
                                        child: Icon(Icons.remove,
                                            size: 16,
                                            color: AppColors.deepTeal),
                                      ),
                                    ),
                                    Padding(
                                      padding: const EdgeInsets.symmetric(
                                          horizontal: 10),
                                      child: Text(
                                        '$_basketQuantity',
                                        style: TextStyle(
                                          fontFamily: 'Afacad',
                                          fontWeight: FontWeight.bold,
                                          fontSize: 16,
                                          color: AppColors.deepTeal,
                                        ),
                                      ),
                                    ),
                                    GestureDetector(
                                      behavior: HitTestBehavior.opaque,
                                      onTap: () {
                                        setState(() => _basketQuantity++);
                                      },
                                      child: Container(
                                        width: 32,
                                        height: 32,
                                        decoration: BoxDecoration(
                                          color: AppColors.deepTeal,
                                          borderRadius:
                                              BorderRadius.circular(8),
                                        ),
                                        child: const Icon(Icons.add,
                                            size: 16, color: Colors.white),
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),

                    // Order summary & Place Order
                    Container(
                      padding: EdgeInsets.only(
                        left: 20,
                        right: 20,
                        top: 16,
                        bottom: 24 + MediaQuery.paddingOf(context).bottom,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        border: Border(
                          top: BorderSide(color: AppColors.border, width: 1),
                        ),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              const Text(
                                'Subtotal',
                                style: TextStyle(
                                  fontFamily: 'Afacad',
                                  fontSize: 14,
                                  color: Colors.black54,
                                ),
                              ),
                              Text(
                                _formatPrice(
                                    'RM ${_basketSubtotal.toStringAsFixed(2)}'),
                                style: TextStyle(
                                  fontFamily: 'Afacad',
                                  fontSize: 14,
                                  fontWeight: FontWeight.bold,
                                  color: AppColors.deepTeal,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 6),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                'Total',
                                style: TextStyle(
                                  fontFamily: 'Recoleta',
                                  fontSize: 16,
                                  fontWeight: FontWeight.bold,
                                  color: AppColors.deepTeal,
                                ),
                              ),
                              Text(
                                _formatPrice(
                                    'RM ${_basketSubtotal.toStringAsFixed(2)}'),
                                style: TextStyle(
                                  fontFamily: 'Recoleta',
                                  fontSize: 16,
                                  fontWeight: FontWeight.bold,
                                  color: AppColors.deepTeal,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 16),
                          ElevatedButton(
                            onPressed: () async {
                              final qty = _basketQuantity;
                              setState(() {
                                _isCartOpen = false;
                                _basketQuantity = 1;
                              });
                              await Future.delayed(
                                  const Duration(milliseconds: 350));
                              if (context.mounted) {
                                InteractiveFillingLoader.show(
                                  context,
                                  targetPage: OrderConfirmationPage(
                                    initialQuantity: qty,
                                  ),
                                );
                              }
                            },
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppColors.deepTeal,
                              elevation: 0,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(14),
                              ),
                              padding: const EdgeInsets.symmetric(vertical: 14),
                            ),
                            child: const Text(
                              'PLACE ORDER',
                              style: TextStyle(
                                fontFamily: 'Afacad',
                                fontWeight: FontWeight.bold,
                                fontSize: 16,
                                color: Colors.white,
                                letterSpacing: 0.5,
                              ),
                            ),
                          ),
                        ],
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
  }

  Widget _buildMenuItemCard(Map<String, dynamic> item) {
    if (item['name'] == 'By Syah' || item['name'] == 'By Ajim') {
      return _buildBaristaCraftCard(item);
    }

    final bool isCandle =
        item['image']?.toString().toLowerCase().contains('candle') ?? false;
    final double itemScale = isCandle ? 1.5 : 1.0;

    return Container(
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
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          // Product Image Container Box
          Expanded(
            child: Padding(
              padding:
                  const EdgeInsets.only(top: 8, bottom: 4, left: 8, right: 8),
              child: Center(
                child: Transform.scale(
                  scale: itemScale,
                  child: Image.asset(
                    item['image'],
                    fit: BoxFit.contain,
                    gaplessPlayback: true,
                    errorBuilder: (context, error, stackTrace) => const Center(
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
          ),

          const SizedBox(height: 2),

          // Item Name — Fixed height so 1-line and 2-line titles reserve identical space, keeping image size constant
          SizedBox(
            height: 34,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8),
              child: Center(
                child: Text(
                  item['name'],
                  textAlign: TextAlign.center,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontFamily: 'Afacad',
                    fontSize: 13.5,
                    fontWeight: FontWeight.normal,
                    color: AppColors.charcoal,
                    height: 1.15,
                  ),
                ),
              ),
            ),
          ),

          // Price — Fixed height so every card has identical layout proportions
          SizedBox(
            height: 26,
            child: item['price'] != null
                ? Padding(
                    padding: const EdgeInsets.only(bottom: 6, top: 2),
                    child: Text(
                      _formatPrice(
                        item['price'],
                        isDrink: _isDrinkItem(item),
                        isMerchandise: _isMerchandiseItem(item),
                      ),
                      style: TextStyle(
                        fontFamily: 'Afacad',
                        fontSize: 13.5,
                        fontWeight: FontWeight.bold,
                        color: _showTokenPrice
                            ? const Color(0xFFD97706)
                            : AppColors.deepTeal,
                      ),
                    ),
                  )
                : const SizedBox.shrink(),
          ),
        ],
      ),
    );
  }

  Widget _buildBaristaCraftCard(Map<String, dynamic> item) {
    final isSyah = item['name'] == 'By Syah';
    final avatarImage =
        isSyah ? 'assets/images/Syah.jpeg' : 'assets/images/FKP01925.jpg';
    final bgGradient = isSyah
        ? const LinearGradient(
            colors: [Color(0xFFFFFDF9), Color(0xFFF9F2E6)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          )
        : const LinearGradient(
            colors: [Color(0xFFF4F9F8), Color(0xFFE6F2F0)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          );

    final accentColor =
        isSyah ? const Color(0xFFD4AF7A) : const Color(0xFF6F9F96);
    final borderColor =
        isSyah ? const Color(0xFFE8D7B8) : const Color(0xFF6F9F96);

    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        gradient: bgGradient,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: borderColor,
          width: 1.5,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Stack(
        children: [
          // Background subtle pattern watermark accent
          Positioned(
            right: -15,
            top: -15,
            child: Container(
              width: 75,
              height: 75,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: accentColor.withValues(alpha: 0.12),
              ),
            ),
          ),

          // Barista Circle Avatar Icon (top-right corner)
          Positioned(
            top: 8,
            right: 8,
            child: Container(
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(color: Colors.white, width: 2),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.12),
                    blurRadius: 4,
                  ),
                ],
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(14),
                child: Image.asset(
                  avatarImage,
                  width: 26,
                  height: 26,
                  fit: BoxFit.cover,
                ),
              ),
            ),
          ),

          Padding(
            padding: const EdgeInsets.all(10),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                const SizedBox(height: 14),

                // Drink Showcase Container
                Expanded(
                  child: Center(
                    child: Transform.scale(
                      scale: (item['scale'] as double? ?? 1.3),
                      child: Image.asset(
                        item['image'],
                        fit: BoxFit.contain,
                        gaplessPlayback: true,
                      ),
                    ),
                  ),
                ),

                const SizedBox(height: 6),

                // Barista Title Name
                Text(
                  item['name'],
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontFamily: 'Recoleta',
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: AppColors.deepTeal,
                  ),
                ),

                const SizedBox(height: 8),

                // Explore CTA Pill Button
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(vertical: 6),
                  decoration: BoxDecoration(
                    color:
                        isSyah ? const Color(0xFFD4AF7A) : AppColors.deepTeal,
                    borderRadius: BorderRadius.circular(12),
                    boxShadow: [
                      BoxShadow(
                        color: (isSyah
                                ? const Color(0xFFD4AF7A)
                                : AppColors.deepTeal)
                            .withValues(alpha: 0.25),
                        blurRadius: 4,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: const [
                      Text(
                        'View Collection',
                        style: TextStyle(
                          fontFamily: 'Afacad',
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          color: Colors.white,
                        ),
                      ),
                      SizedBox(width: 4),
                      Icon(
                        Icons.arrow_forward_ios_rounded,
                        size: 10,
                        color: Colors.white,
                      ),
                    ],
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
