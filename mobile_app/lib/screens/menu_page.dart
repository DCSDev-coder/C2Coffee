import 'package:flutter/material.dart';
import '../widgets/custom_bottom_nav.dart';
import 'orders_page.dart';
import 'loading_order_page.dart';
import 'profile_page.dart';
import 'order_confirmation_page.dart';
import 'home_page.dart';
import 'barista_page.dart';
import 'rewards_page.dart';
import '../widgets/order_status_banner.dart';

class MenuPage extends StatefulWidget {
  const MenuPage({super.key});

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
          'price': 'RM 22.00',
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
          'price': 'RM 20.00',
          'image': 'assets/images/drinks/V60 BREW.png'
        },
      ]
    },
    {
      'title': 'C2 MOCKTAILS',
      'items': [
        {
          'name': 'Boijito',
          'price': 'RM 15.00',
          'image': 'assets/images/drinks/BOIJITO.png'
        },
        {
          'name': 'Bloody Peach',
          'price': 'RM 14.90',
          'image': 'assets/images/drinks/PEACHY JASMINE.png'
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
          'price': 'RM 9.00',
          'image': 'assets/images/drinks/ESPRESSO.png'
        },
        {
          'name': 'Pocco Locco',
          'price': 'RM 12.90',
          'image': 'assets/images/drinks/POCCO LOCCO.png'
        },
        {
          'name': 'Latte',
          'price': 'RM 10.00',
          'image': 'assets/images/drinks/LATTE.png'
        },
        {
          'name': 'Flat white',
          'price': 'RM 10.00',
          'image': 'assets/images/drinks/FLAT WHITE.png'
        },
        {
          'name': 'Cappuccino',
          'price': 'RM 10.00',
          'image': 'assets/images/drinks/CAPPUCCINO.png'
        },
      ]
    },
    {
      'title': 'C2 FLAVOURED COFFEE',
      'items': [
        {
          'name': 'Butterscotch Latte',
          'price': 'RM 13.00',
          'image': 'assets/images/drinks/BUTTERSCOTH LATTE.png'
        },
        {
          'name': 'Hazelnut Latte',
          'price': 'RM 13.00',
          'image': 'assets/images/drinks/HAZELNUT LATTE.png'
        },
        {
          'name': 'Vanilla Latte',
          'price': 'RM 13.00',
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
  ];

  // Map to store keys for each section header
  final Map<int, GlobalKey> _sectionKeys = {};
  bool _isSearching = false;
  final TextEditingController _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    for (int i = 0; i < _categories.length; i++) {
      _sectionKeys[i] = GlobalKey();
    }
    _scrollController.addListener(_onScroll);
    _searchController.addListener(() {
      setState(() {});
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    _scrollController.removeListener(_onScroll);
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    // A robust implementation would use a scroll package or calculate exact offsets.
    // For this implementation, the tap scroll works well.
  }

  void _scrollToCategory(int index) {
    setState(() {
      _selectedCategoryIndex = index;
    });

    final key = _sectionKeys[index];
    if (key != null && key.currentContext != null) {
      Scrollable.ensureVisible(
        key.currentContext!,
        duration: const Duration(milliseconds: 400),
        curve: Curves.easeInOut,
        alignment: 0.0, // align to top
      );
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
    const Color orangeColor = Color(0xFFE76D00);
    const Color bgColor = Color(0xFFF6F6F6);

    return Scaffold(
      backgroundColor: bgColor,
      resizeToAvoidBottomInset:
          false, // Prevents bottom UI elements from moving up when keyboard appears
      extendBody: true,
      bottomNavigationBar: CustomBottomNav(
        selectedIndex: 1, // Menu is index 1
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
      body: Stack(
        children: [
          // Main Content
          Column(
            children: [
              // Custom Header (matches other pages)
              Container(
                padding: const EdgeInsets.only(
                    top: 60, bottom: 20, left: 20, right: 20),
                decoration: const BoxDecoration(
                  color: orangeColor,
                  borderRadius: BorderRadius.only(
                    bottomLeft: Radius.circular(20),
                    bottomRight: Radius.circular(20),
                  ),
                ),
                child: SizedBox(
                  height: 48,
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
                                      fontSize: 16,
                                    ),
                                    decoration: const InputDecoration(
                                      hintText: 'Search',
                                      hintStyle: TextStyle(
                                        color: Colors.grey,
                                        fontFamily: 'Afacad',
                                        fontSize: 16,
                                      ),
                                      border: InputBorder.none,
                                      isDense: true,
                                      contentPadding: EdgeInsets.symmetric(
                                          horizontal: 16, vertical: 10),
                                    ),
                                  ),
                                ),
                              ),
                              IconButton(
                                icon: const Icon(Icons.close,
                                    color: Colors.white),
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
                                    color: Colors.white, size: 24),
                              ),
                              const Text(
                                'MENU',
                                style: TextStyle(
                                  fontFamily: 'Recoleta',
                                  fontSize: 24,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.white,
                                ),
                              ),
                              GestureDetector(
                                onTap: () {
                                  setState(() {
                                    _isSearching = true;
                                  });
                                },
                                child: const Icon(Icons.search,
                                    color: Colors.white, size: 28),
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
                        padding: const EdgeInsets.only(
                            bottom:
                                220), // Padding for bottom nav & status banner
                        itemCount: _categories.length,
                        itemBuilder: (context, index) {
                          final isSelected = index == _selectedCategoryIndex;
                          return GestureDetector(
                            onTap: () => _scrollToCategory(index),
                            child: Container(
                              height: 55, // Reduced from 70 to prevent clashing
                              color: isSelected ? orangeColor : Colors.white,
                              padding:
                                  const EdgeInsets.symmetric(horizontal: 4),
                              child: Center(
                                child: Text(
                                  _categories[index],
                                  textAlign: TextAlign.center,
                                  style: TextStyle(
                                    fontFamily: 'Afacad',
                                    fontSize: 11,
                                    fontWeight: FontWeight.bold,
                                    color: isSelected
                                        ? Colors.white
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
                            bottom:
                                220), // Increased to allow scrolling past the status banner
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
                                        1.0, // Increased to make cards shorter
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

          // Floating Checkout Bar
          Positioned(
            bottom: 120, // Positioned above the floating CustomBottomNav
            left: 16,
            right: 16,
            child: Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(24),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.1),
                    blurRadius: 15,
                    offset: const Offset(0, 5),
                  ),
                ],
              ),
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Text(
                        'Total',
                        style: TextStyle(
                          fontFamily: 'Recoleta',
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      RichText(
                        text: const TextSpan(
                          children: [
                            TextSpan(
                              text: 'RM ',
                              style: TextStyle(
                                fontFamily: 'Afacad',
                                fontSize: 12,
                                color: Colors.black87,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            TextSpan(
                              text: '15.90',
                              style: TextStyle(
                                fontFamily: 'Afacad',
                                fontSize: 18,
                                color: Colors.black,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  Row(
                    children: [
                      ElevatedButton(
                        onPressed: () async {
                          final result = await Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (context) =>
                                  const InteractiveFillingLoader(
                                targetPage: OrderConfirmationPage(),
                              ),
                            ),
                          );
                          if (result == true) {
                            // Global state is handled by order_confirmation_page directly
                          }
                        },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: orangeColor,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(20),
                          ),
                          padding: const EdgeInsets.symmetric(
                              horizontal: 24, vertical: 10),
                        ),
                        child: const Text(
                          'CHECKOUT',
                          style: TextStyle(
                            fontFamily: 'Afacad',
                            fontWeight: FontWeight.bold,
                            fontSize: 16,
                            color: Colors.white,
                          ),
                        ),
                      ),
                      const SizedBox(width: 16),
                      GestureDetector(
                        onTap: () async {
                          final result = await Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (context) =>
                                  const InteractiveFillingLoader(
                                targetPage: OrderConfirmationPage(),
                              ),
                            ),
                          );
                          if (result == true) {
                            // Global state is handled by order_confirmation_page directly
                          }
                        },
                        child: Stack(
                          clipBehavior: Clip.none,
                          children: [
                            const Icon(Icons.shopping_basket,
                                size: 28, color: Colors.black87),
                            Positioned(
                              right: -4,
                              top: -4,
                              child: Container(
                                padding: const EdgeInsets.all(4),
                                decoration: const BoxDecoration(
                                  color: orangeColor,
                                  shape: BoxShape.circle,
                                ),
                                child: const Text(
                                  '1',
                                  style: TextStyle(
                                    color: Colors.white,
                                    fontSize: 10,
                                    fontWeight: FontWeight.bold,
                                  ),
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
            ),
          ),

          // Global Order Status Banner overlay
          const OrderStatusBanner(),
        ],
      ),
    );
  }

  Widget _buildMenuItemCard(Map<String, dynamic> item) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          // Image
          Expanded(
            child: Padding(
              padding:
                  const EdgeInsets.only(top: 12, bottom: 8, left: 8, right: 8),
              child: Image.asset(
                item['image'],
                fit: BoxFit.contain,
              ),
            ),
          ),

          // Details
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8),
            child: Text(
              item['name'],
              textAlign: TextAlign.center,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontFamily: 'Afacad',
                fontSize: 14,
                fontWeight: FontWeight.bold,
                color: Colors.black87,
                height: 1.1,
              ),
            ),
          ),
          const SizedBox(height: 4),
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Text(
              item['price'] ?? '',
              style: TextStyle(
                fontFamily: 'Afacad',
                fontSize: 13,
                fontWeight: FontWeight.w500,
                color: Colors.grey.shade600,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
