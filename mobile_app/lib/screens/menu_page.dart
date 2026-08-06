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
          'image': 'assets/images/drinks/MONT BROGA.png'
        },
        {
          'name': 'Shakerato Bianco',
          'price': 'RM 15.90',
          'image': 'assets/images/drinks/SHAKERATO BIANCO.png'
        },
        {
          'name': 'Yuzukano',
          'price': 'RM 16.90',
          'image': 'assets/images/drinks/YUZUKANO.png'
        },
        {
          'name': 'Senja Di Broga',
          'price': 'RM 16.90',
          'image': 'assets/images/drinks/SENJA DI BROGA.png'
        },
        {
          'name': 'Espresso Bomb',
          'price': 'RM 22.90',
          'image': 'assets/images/drinks/ESPRESSO BOMB.png'
        },
      ]
    },
    {
      'title': 'C2 BARISTA CRAFT',
      'items': [
        {
          'name': 'By Syah',
          'image': 'assets/images/drinks/PINKY BLUSH MILKSHAKE BY SYAH.png'
        },
        {
          'name': 'By Ajim',
          'image': 'assets/images/drinks/BUTTERSCOTH LATTE.png'
        },
      ]
    },
    {
      'title': 'C2 POUR OVER',
      'items': [
        {
          'name': 'V60 Brew',
          'price': 'RM 20.90',
          'image': 'assets/images/drinks/V60 BREW.png'
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
        },
        {
          'name': 'Bloody Peach',
          'price': 'RM 14.90',
          'image': 'assets/images/drinks/BLOODY PEACH.png'
        },
        {
          'name': 'Fuji Fizz',
          'price': 'RM 14.90',
          'image': 'assets/images/drinks/FUJI FIZZ.png'
        },
        {
          'name': 'Spicy Mimosa',
          'price': 'RM 13.90',
          'image': 'assets/images/drinks/SPICY MIMOSA.png'
        },
        {
          'name': 'Onde2Pop',
          'price': 'RM 13.90',
          'image': 'assets/images/drinks/ONDE-ONDE SODA.png'
        },
      ]
    },
    {
      'title': 'C2 MATCHA',
      'items': [
        {
          'name': 'Matcha Latte',
          'price': 'RM 13.90',
          'image': 'assets/images/drinks/MATCHA LATTE.png'
        },
        {
          'name': 'Monkey Matcha',
          'price': 'RM 15.90',
          'image': 'assets/images/drinks/MONKEY MATCHA.png'
        },
        {
          'name': 'Pinky Promise Matcha',
          'price': 'RM 15.90',
          'image': 'assets/images/drinks/PINKY PROMISE MATCHA.png'
        },
      ]
    },
    {
      'title': 'C2 CHOCOLATE',
      'items': [
        {
          'name': 'Milk Chocolate',
          'price': 'RM 14.90',
          'image': 'assets/images/drinks/MILK CHOCOLATE.png'
        },
        {
          'name': 'Nutty Chocolate',
          'price': 'RM 15.90',
          'image': 'assets/images/drinks/NUTTY CHOCOLATE.png'
        },
      ]
    },
    {
      'title': 'C2 COFFEE',
      'items': [
        {
          'name': 'Espresso',
          'price': 'RM 9.90',
          'image': 'assets/images/drinks/ESPRESSO.png'
        },
        {
          'name': 'Pocco Locco',
          'price': 'RM 12.90',
          'image': 'assets/images/drinks/POCCO LOCCO.png'
        },
        {
          'name': 'Latte',
          'price': 'RM 10.90',
          'image': 'assets/images/drinks/LATTE.png'
        },
        {
          'name': 'Flat white',
          'price': 'RM 10.90',
          'image': 'assets/images/drinks/FLAT WHITE.png'
        },
        {
          'name': 'Cappuccino',
          'price': 'RM 10.90',
          'image': 'assets/images/drinks/CAPPUCCINO.png'
        },
      ]
    },
    {
      'title': 'C2 FLAVOURED COFFEE',
      'items': [
        {
          'name': 'Butterscotch Latte',
          'price': 'RM 13.90',
          'image': 'assets/images/drinks/BUTTERSCOTH LATTE.png'
        },
        {
          'name': 'Hazelnut Latte',
          'price': 'RM 13.90',
          'image': 'assets/images/drinks/HAZELNUT LATTE.png'
        },
        {
          'name': 'Vanilla Latte',
          'price': 'RM 13.90',
          'image': 'assets/images/drinks/VANILLA LATTE.png'
        },
        {
          'name': 'Blue Cloud Coconut Coffee',
          'price': 'RM 15.90',
          'image': 'assets/images/drinks/BLUE CLOUD COCONUT COFFEE.png'
        },
        {
          'name': 'Mocha',
          'price': 'RM 14.90',
          'image': 'assets/images/drinks/MOCHA.png'
        },
      ]
    },
    {
      'title': 'C2 PASTRIES',
      'items': [
        {
          'name': 'Lamb Curry Puff',
          'price': 'RM 3.00',
          'image': 'assets/images/pastries/curry puff.png'
        },
        {
          'name': 'CK Biscoff',
          'price': 'RM 11.00',
          'image': 'assets/images/pastries/ck biscoff.png'
        },
        {
          'name': 'CK Red Velvet',
          'price': 'RM 11.00',
          'image': 'assets/images/pastries/ck red velvet.png'
        },
        {
          'name': 'CK Ovomaltine',
          'price': 'RM 12.00',
          'image': 'assets/images/pastries/ck ovomaltine.png'
        },
        {
          'name': 'CK Shio Pan',
          'price': 'RM 8.90',
          'image': 'assets/images/pastries/shio pan.png'
        },
        {
          'name': 'CK Brownie Tart',
          'price': 'RM 14.00',
          'image': 'assets/images/pastries/brownie.png'
        },
      ]
    },
    {
      'title': 'C2 MERCHANDISE',
      'items': [
        {
          'name': 'C2 Ceramic Mug',
          'price': 'RM 39.00',
          'image': 'assets/images/coffee_cup.png'
        },
        {
          'name': 'C2 Tumbler 500ml',
          'price': 'RM 59.00',
          'image': 'assets/images/status brew.png'
        },
        {
          'name': 'C2 Canvas Tote Bag',
          'price': 'RM 29.00',
          'image': 'assets/images/status bag.png'
        },
        {
          'name': 'C2 Drip Bag Coffee',
          'price': 'RM 45.00',
          'image': 'assets/images/pour.png'
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
          'scale': 1.9,
        },
        {
          'name': 'Fresh Sage & Driftwood',
          'price': 'RM 47.00',
          'image': 'assets/images/candles/fresh sage and driftwood.png',
          'scale': 1.9,
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
  final TextEditingController _searchController = TextEditingController();
  int _basketQuantity = 1;
  final double _basketItemPrice = 16.90;

  double get _basketSubtotal => _basketItemPrice * _basketQuantity;

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

    if (widget.initialCategoryIndex != 0) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _scrollToCategory(widget.initialCategoryIndex);
      });
    }
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    for (var category in _menuData) {
      if (category['items'] != null) {
        for (var item in category['items']) {
          if (item['image'] != null) {
            precacheImage(AssetImage(item['image']), context);
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
    const Color orangeColor = Color(0xFF2E5E58);
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
                padding: const EdgeInsets.only(
                    top: 50, bottom: 12, left: 20, right: 20),
                decoration: const BoxDecoration(
                  color: Color(0xFF2E5E58),
                  borderRadius: BorderRadius.only(
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
                                    style: const TextStyle(
                                      fontFamily: 'Afacad',
                                      fontSize: 15,
                                      color: Color(0xFF2E5E58),
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
                        : Row(
                            key: const ValueKey('menuHeader'),
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              GestureDetector(
                                onTap: () {
                                  Navigator.pushAndRemoveUntil(
                                    context,
                                    MaterialPageRoute(
                                      builder: (context) =>
                                          const InteractiveFillingLoader(
                                        targetPage: HomePage(),
                                      ),
                                    ),
                                    (route) => false,
                                  );
                                },
                                child: const Icon(Icons.arrow_back_ios,
                                    color: Colors.white, size: 20),
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
                              GestureDetector(
                                onTap: () {
                                  setState(() {
                                    _isSearching = true;
                                  });
                                },
                                child: const Icon(Icons.search,
                                    color: Colors.white, size: 22),
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
                    const Text(
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
                                    ? const Color(0xFFEDF4F3)
                                    : Colors.white,
                                border: isSelected
                                    ? const Border(
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
                                    style: const TextStyle(
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
                                    childAspectRatio:
                                        0.95, // Slightly taller to accommodate 2-line names
                                  ),
                                  itemCount: items.length,
                                  itemBuilder: (context, itemIndex) {
                                    final item = items[itemIndex];
                                    return GestureDetector(
                                      onTap: () {
                                        if (item['name'] == 'By Syah') {
                                          Navigator.push(
                                            context,
                                            MaterialPageRoute(
                                              builder: (context) =>
                                                  const InteractiveFillingLoader(
                                                targetPage: BaristaPage(
                                                  title: 'By Syah',
                                                  heroImage:
                                                      'assets/images/Syah.jpeg',
                                                  drinks: [
                                                    {
                                                      'name':
                                                          'Pink Blush Milkshake',
                                                      'price': 'RM 14.90',
                                                      'image':
                                                          'assets/images/drinks/PINKY BLUSH MILKSHAKE BY SYAH.png',
                                                    },
                                                    {
                                                      'name': 'Solero Fizz',
                                                      'price': 'RM 14.90',
                                                      'image':
                                                          'assets/images/drinks/SOLERO FIZZ.png',
                                                    },
                                                    {
                                                      'name': 'Paddle Pop',
                                                      'price': 'RM 14.90',
                                                      'image':
                                                          'assets/images/drinks/PADDLE POP.png',
                                                    },
                                                  ],
                                                ),
                                              ),
                                            ),
                                          );
                                        } else if (item['name'] == 'By Ajim') {
                                          Navigator.push(
                                            context,
                                            MaterialPageRoute(
                                              builder: (context) =>
                                                  const InteractiveFillingLoader(
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
                                                    },
                                                  ],
                                                ),
                                              ),
                                            ),
                                          );
                                        } else if (item['name'] ==
                                            'Mont Broga') {
                                          Navigator.push(
                                            context,
                                            MaterialPageRoute(
                                              builder: (context) =>
                                                  InteractiveFillingLoader(
                                                targetPage:
                                                    MontBrogaPage(item: item),
                                              ),
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
                  Navigator.pushAndRemoveUntil(
                    context,
                    MaterialPageRoute(
                      builder: (context) => const InteractiveFillingLoader(
                        targetPage: HomePage(),
                      ),
                    ),
                    (route) => false,
                  );
                } else if (index == 2) {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (context) => const InteractiveFillingLoader(
                        targetPage: OrdersPage(),
                      ),
                    ),
                  );
                } else if (index == 3) {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (context) => const InteractiveFillingLoader(
                        targetPage: RewardsPage(),
                      ),
                    ),
                  );
                } else if (index == 4) {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (context) => const InteractiveFillingLoader(
                        targetPage: ProfilePage(),
                      ),
                    ),
                  );
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
                          decoration: const BoxDecoration(
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
                            child: const Icon(Icons.arrow_back_ios,
                                color: Color(0xFF2E5E58), size: 20),
                          ),
                          const SizedBox(width: 12),
                          const Text(
                            'YOUR BASKET',
                            style: TextStyle(
                              fontFamily: 'Recoleta',
                              fontSize: 20,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF2E5E58),
                              letterSpacing: 1.0,
                            ),
                          ),
                          const Spacer(),
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 10, vertical: 4),
                            decoration: BoxDecoration(
                              color: const Color(0xFF2E5E58)
                                  .withValues(alpha: 0.1),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Text(
                              '$_basketQuantity ${_basketQuantity == 1 ? 'item' : 'items'}',
                              style: const TextStyle(
                                fontFamily: 'Afacad',
                                fontSize: 12,
                                color: Color(0xFF2E5E58),
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
                              border: Border.all(
                                  color: const Color(0xFFCFDEDB), width: 1),
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
                                      const Text(
                                        'Mont Broga',
                                        style: TextStyle(
                                          fontFamily: 'Recoleta',
                                          fontSize: 15,
                                          fontWeight: FontWeight.bold,
                                          color: Color(0xFF2E5E58),
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
                                        'RM ${(_basketItemPrice * _basketQuantity).toStringAsFixed(2)}',
                                        style: const TextStyle(
                                          fontFamily: 'Afacad',
                                          fontSize: 14,
                                          fontWeight: FontWeight.bold,
                                          color: Color(0xFF2E5E58),
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
                                              color: const Color(0xFFCFDEDB)),
                                          borderRadius:
                                              BorderRadius.circular(8),
                                        ),
                                        child: const Icon(Icons.remove,
                                            size: 16, color: Color(0xFF2E5E58)),
                                      ),
                                    ),
                                    Padding(
                                      padding: const EdgeInsets.symmetric(
                                          horizontal: 10),
                                      child: Text(
                                        '$_basketQuantity',
                                        style: const TextStyle(
                                          fontFamily: 'Afacad',
                                          fontWeight: FontWeight.bold,
                                          fontSize: 16,
                                          color: Color(0xFF2E5E58),
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
                                          color: const Color(0xFF2E5E58),
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
                      decoration: const BoxDecoration(
                        color: Colors.white,
                        border: Border(
                          top: BorderSide(color: Color(0xFFCFDEDB), width: 1),
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
                                'RM ${_basketSubtotal.toStringAsFixed(2)}',
                                style: const TextStyle(
                                  fontFamily: 'Afacad',
                                  fontSize: 14,
                                  fontWeight: FontWeight.bold,
                                  color: Color(0xFF2E5E58),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 6),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              const Text(
                                'Total',
                                style: TextStyle(
                                  fontFamily: 'Recoleta',
                                  fontSize: 16,
                                  fontWeight: FontWeight.bold,
                                  color: Color(0xFF2E5E58),
                                ),
                              ),
                              Text(
                                'RM ${_basketSubtotal.toStringAsFixed(2)}',
                                style: const TextStyle(
                                  fontFamily: 'Recoleta',
                                  fontSize: 16,
                                  fontWeight: FontWeight.bold,
                                  color: Color(0xFF2E5E58),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 16),
                          ElevatedButton(
                            onPressed: () async {
                              final nav = Navigator.of(context);
                              final qty = _basketQuantity;
                              setState(() {
                                _isCartOpen = false;
                              });
                              await Future.delayed(
                                  const Duration(milliseconds: 350));
                              final result = await nav.push(
                                MaterialPageRoute(
                                  builder: (context) =>
                                      InteractiveFillingLoader(
                                    targetPage: OrderConfirmationPage(
                                      initialQuantity: qty,
                                    ),
                                  ),
                                ),
                              );
                              // If order was placed successfully, clear the basket
                              if (result == true && mounted) {
                                setState(() => _basketQuantity = 1);
                              }
                            },
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF2E5E58),
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
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
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
          // Image
          Expanded(
            flex: 7,
            child: Padding(
              padding:
                  const EdgeInsets.only(top: 12, bottom: 8, left: 8, right: 8),
              child: Transform.scale(
                scale: item['scale'] as double? ?? 1.0,
                child: Image.asset(
                  item['image'],
                  fit: BoxFit.contain,
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

          // Name — thin, fixed height container for consistency
          SizedBox(
            height: 32, // Fixed height for 2 lines of text
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8),
              child: Text(
                item['name'],
                textAlign: TextAlign.center,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontFamily: 'Afacad',
                  fontSize: 13,
                  fontWeight: FontWeight.w300,
                  color: AppColors.charcoal,
                  height: 1.2,
                ),
              ),
            ),
          ),
          // Price — bold
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Text(
              item['price'] ?? '',
              style: const TextStyle(
                fontFamily: 'Afacad',
                fontSize: 13,
                fontWeight: FontWeight.bold,
                color: AppColors.deepTeal,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
