import 'dart:convert';
import 'package:flutter/material.dart';
import 'auth_service.dart';
import 'session_manager.dart';
import 'api_client.dart';
import 'app_colors.dart';
import 'counter_menu.dart';
import 'product_detail_modal.dart';

void main() {
  runApp(const CounterApp());
}

class CounterApp extends StatelessWidget {
  const CounterApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Counter App',
      debugShowCheckedModeBanner: false,
      theme: AppColors.getThemeData(),
      home: const SplashOrLoginScreen(),
    );
  }
}

class SplashOrLoginScreen extends StatefulWidget {
  const SplashOrLoginScreen({super.key});

  @override
  State<SplashOrLoginScreen> createState() => _SplashOrLoginScreenState();
}

class _SplashOrLoginScreenState extends State<SplashOrLoginScreen> {
  final AuthService _authService = AuthService();
  bool _isChecking = true;
  bool _isLoggedIn = false;

  @override
  void initState() {
    super.initState();
    _checkDevice();
  }

  Future<void> _checkDevice() async {
    final isValid = await _authService.verifyDevice();
    if (mounted) {
      setState(() {
        _isLoggedIn = isValid;
        _isChecking = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isChecking) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    if (_isLoggedIn) {
      return CounterHomeScreen(authService: _authService);
    } else {
      return ActivationScreen(
        authService: _authService,
        onActivated: () {
          setState(() {
            _isLoggedIn = true;
          });
        },
      );
    }
  }
}

class ActivationScreen extends StatefulWidget {
  final AuthService authService;
  final VoidCallback onActivated;

  const ActivationScreen({
    super.key,
    required this.authService,
    required this.onActivated,
  });

  @override
  State<ActivationScreen> createState() => _ActivationScreenState();
}

class _ActivationScreenState extends State<ActivationScreen> {
  final TextEditingController _codeController = TextEditingController();
  bool _isLoading = false;
  String? _errorMessage;

  Future<void> _activate() async {
    if (_codeController.text.trim().isEmpty) return;
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    final result = await widget.authService.activateDevice(
      _codeController.text.trim(),
    );

    if (mounted) {
      setState(() {
        _isLoading = false;
      });
      if (result.success) {
        widget.onActivated();
      } else {
        setState(() {
          _errorMessage = result.message ?? 'Device activation failed.';
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surfaceLight,
      appBar: AppBar(title: const Text('Device Setup')),
      body: Center(
        child: SingleChildScrollView(
          child: Container(
            width: 400,
            padding: const EdgeInsets.all(32.0),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              boxShadow: const [
                BoxShadow(
                  color: Colors.black12,
                  blurRadius: 10,
                  offset: Offset(0, 4),
                ),
              ],
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.storefront, size: 64, color: AppColors.primary),
              const SizedBox(height: 16),
              Text(
                'Register POS Device',
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  color: AppColors.primary,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Enter the activation code from Admin Web.',
                textAlign: TextAlign.center,
                style: TextStyle(color: AppColors.charcoal),
              ),
              const SizedBox(height: 24),
              TextField(
                controller: _codeController,
                decoration: InputDecoration(
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                  labelText: 'Activation Code',
                  prefixIcon: const Icon(Icons.key),
                ),
              ),
              const SizedBox(height: 16),
              if (_errorMessage != null) ...[
                Text(_errorMessage!, style: const TextStyle(color: Colors.red)),
                const SizedBox(height: 16),
              ],
              SizedBox(
                width: double.infinity,
                child: _isLoading
                    ? const Center(child: CircularProgressIndicator())
                    : ElevatedButton(
                        onPressed: _activate,
                        child: const Text('Activate Device'),
                      ),
              ),
            ],
          ),
        ),
      ),
    ),
  );
}
}

class CounterHomeScreen extends StatefulWidget {
  final AuthService authService;

  const CounterHomeScreen({super.key, required this.authService});

  @override
  State<CounterHomeScreen> createState() => _CounterHomeScreenState();
}

class _CounterHomeScreenState extends State<CounterHomeScreen> {
  final SessionManager _sessionManager = SessionManager();
  final ApiClient _apiClient = ApiClient();
  final TextEditingController _phoneController = TextEditingController();

  bool _isLoading = false;
  String? _errorMessage;
  final ValueNotifier<String?> _selectedCategory = ValueNotifier(null);
  List<CounterMenuItem> _menuItems = [];
  final List<Map<String, dynamic>> _cart = [];
  final Map<String, GlobalKey> _categoryKeys = {};
  
  final ScrollController _scrollController = ScrollController();
  bool _isScrollingToCategory = false;
  
  String? _orderType; // 'Dine In' or 'Take Away'
  Map<String, dynamic>? _selectedVoucher;

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
    _sessionManager.onSessionEnded = () {
      if (mounted) {
        setState(() {
          _clearCart();
        });
      }
    };
    _loadMenu();
  }

  @override
  void dispose() {
    _scrollController.removeListener(_onScroll);
    _scrollController.dispose();
    _selectedCategory.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_isScrollingToCategory) return;
    String? activeCategory;
    for (final category in _categoryKeys.keys) {
      final key = _categoryKeys[category];
      if (key?.currentContext != null) {
        final renderBox = key!.currentContext!.findRenderObject() as RenderBox?;
        if (renderBox != null) {
          final position = renderBox.localToGlobal(Offset.zero);
          // 250 is roughly the threshold where a category title is considered "active" at the top of the view
          if (position.dy <= 250) {
            activeCategory = category;
          }
        }
      }
    }
    if (activeCategory != null && _selectedCategory.value != activeCategory) {
      _selectedCategory.value = activeCategory;
    }
  }

  Future<void> _loadMenu() async {
    final token = await widget.authService.getToken();
    if (token == null) return;
    
    try {
      final response = await _apiClient.get('/v1/counter/menu', token: token);
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        print('=============================');
        print('API DATA TYPE: ${data.runtimeType}');
        if (data is Map) {
          print('API DATA KEYS: ${data.keys.toList()}');
          if (data['categories'] != null) {
            print('CATEGORIES IS NOT NULL, length: ${(data['categories'] as List).length}');
            if ((data['categories'] as List).isNotEmpty) {
              print('FIRST CATEGORY KEYS: ${(data['categories'][0] as Map).keys.toList()}');
            }
          } else if (data['items'] != null) {
            print('ITEMS IS NOT NULL, length: ${(data['items'] as List).length}');
            if ((data['items'] as List).isNotEmpty) {
              print('FIRST ITEM KEYS: ${(data['items'][0] as Map).keys.toList()}');
            }
          }
        } else if (data is List) {
          print('DATA IS LIST, length: ${data.length}');
          if (data.isNotEmpty) {
            print('FIRST ITEM KEYS: ${(data[0] as Map).keys.toList()}');
          }
        }
        print('=============================');
        
        if (mounted) {
          setState(() {
            _menuItems = parseCounterMenu(data);
            _errorMessage = null;
          });
        }
      } else {
        print('Error fetching menu, status code: ${response.statusCode}, body: ${response.body}');
        if (mounted) {
          setState(() {
            _errorMessage = 'Failed to load menu (${response.statusCode})';
          });
        }
      }
    } catch (e, st) {
      print('Exception fetching menu: $e\n$st');
      if (mounted) {
        setState(() {
          _errorMessage = 'Network error fetching menu';
        });
      }
    }
  }

  Future<void> _startSession() async {
    final phone = _phoneController.text.trim();
    if (phone.isEmpty) return;

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    final deviceToken = await widget.authService.getToken();
    if (deviceToken != null) {
      final success = await _sessionManager.startSession(phone, deviceToken);
      if (!success) {
        if (mounted) {
          setState(() {
            _errorMessage = 'Number not found. Please try again or continue as a guest.';
          });
        }
      } else {
        _phoneController.clear();
      }
    }

    if (mounted) {
      setState(() {
        _isLoading = false;
      });
    }
  }

  void _startGuestSession() {
    _sessionManager.startGuestSession();
    _phoneController.clear();
    setState(() {});
  }

  Future<void> _endSession() async {
    await _sessionManager.endSession();
    if (mounted) {
      setState(() {
        _orderType = null;
        _selectedVoucher = null;
      });
    }
  }

  void _clearCart() {
    _cart.clear();
    _selectedVoucher = null;
  }

  void _addToCart(CounterMenuItem item, Map<String, dynamic> customization) {
    setState(() {
      _cart.add({
        'item': item,
        'customization': customization,
        'quantity': customization['quantity'] ?? 1,
      });
    });
  }

  void _removeFromCart(int index) {
    setState(() {
      _cart.removeAt(index);
    });
  }

  double _getSubtotal() {
    double total = 0.0;
    for (var cartItem in _cart) {
      final item = cartItem['item'] as CounterMenuItem;
      final customization = cartItem['customization'] as Map<String, dynamic>;
      final qty = cartItem['quantity'] as int;
      
      double price = item.priceRm;
      
      if (item.modifierGroups.isNotEmpty) {
        double adjustment = 0;
        final librarySelections = customization['librarySelections'] as Map<int, List<int>>? ?? {};
        for (final group in item.modifierGroups) {
          final selections = librarySelections[group.id] ?? [];
          for (final optionId in selections) {
            final option = group.options.firstWhere((o) => o.id == optionId);
            adjustment += double.tryParse(option.priceDeltaRm) ?? 0;
          }
        }
        price += adjustment;
      } else {
        if (item.allowEspressoShot) {
          final shots = customization['espressoShots'] as int? ?? 1;
          if (shots == 2) price += 3.00;
          if (shots == 3) price += 6.00;
        }
        if (item.allowChoiceOfMilk) {
          if (customization['milk'] == 'Oat Milk') price += 3.00;
        }
      }
      
      total += price * qty;
    }
    return total;
  }

  double _getCartTotal() {
    double total = _getSubtotal();
    if (_selectedVoucher != null) {
      if (_selectedVoucher!['discount_percent'] != null) {
        total = total * (1 - (_selectedVoucher!['discount_percent'] as double) / 100);
      } else if (_selectedVoucher!['discount_amount'] != null) {
        total -= _selectedVoucher!['discount_amount'] as double;
      }
    }
    return total > 0 ? total : 0;
  }
  
  double _getCartItemPrice(Map<String, dynamic> cartItem) {
    final item = cartItem['item'] as CounterMenuItem;
    final customization = cartItem['customization'] as Map<String, dynamic>;
    
    double price = item.priceRm;
    if (item.modifierGroups.isNotEmpty) {
      double adjustment = 0;
      final librarySelections = customization['librarySelections'] as Map<int, List<int>>? ?? {};
      for (final group in item.modifierGroups) {
        final selections = librarySelections[group.id] ?? [];
        for (final optionId in selections) {
          final option = group.options.firstWhere((o) => o.id == optionId);
          adjustment += double.tryParse(option.priceDeltaRm) ?? 0;
        }
      }
      price += adjustment;
    } else {
      if (item.allowEspressoShot) {
        final shots = customization['espressoShots'] as int? ?? 1;
        if (shots == 2) price += 3.00;
        if (shots == 3) price += 6.00;
      }
      if (item.allowChoiceOfMilk) {
        if (customization['milk'] == 'Oat Milk') price += 3.00;
      }
    }
    return price;
  }

  @override
  Widget build(BuildContext context) {
    return Listener(
      onPointerDown: (_) => _sessionManager.onUserInteraction(),
      behavior: HitTestBehavior.translucent,
      child: Scaffold(
        appBar: AppBar(
          title: Image.asset('assets/images/c2_logo.png', height: 32),
          actions: [
            if (_sessionManager.currentSession != null)
              Padding(
                padding: const EdgeInsets.only(right: 16.0),
                child: Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        _sessionManager.currentSession!.customerSummary['username'] ?? _sessionManager.currentSession!.customerSummary['customer_name'] ?? _sessionManager.currentSession!.phone,
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                      ),
                      Text(
                        'Tier: ${_sessionManager.currentSession!.customerSummary['loyalty_tier'] ?? 'None'}',
                      ),
                    ],
                  ),
                ),
              ),
            const SizedBox(width: 8),
          ],
        ),
        endDrawer: Drawer(
          width: 350,
          child: _buildCartUI(),
        ),
        floatingActionButton: _sessionManager.currentSession == null
            ? null
            : Builder(
                builder: (context) => FloatingActionButton(
                  onPressed: () => Scaffold.of(context).openEndDrawer(),
                  backgroundColor: AppColors.primary,
                  child: Stack(
                    clipBehavior: Clip.none,
                    children: [
                      const Center(
                        child: Icon(
                          Icons.shopping_bag_outlined,
                          color: Colors.white,
                          size: 28,
                        ),
                      ),
                      if (_cart.isNotEmpty)
                        Positioned(
                          top: -4,
                          right: -4,
                          child: Container(
                            width: 22,
                            height: 22,
                            decoration: BoxDecoration(
                              color: const Color(0xFFE5A93C),
                              shape: BoxShape.circle,
                              border: Border.all(color: Colors.white, width: 1.5),
                            ),
                            alignment: Alignment.center,
                            child: Text(
                              '${_cart.fold<int>(0, (sum, item) => sum + (item['quantity'] as int? ?? 1))}',
                              style: const TextStyle(
                                fontSize: 11,
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
              ),
        body: _sessionManager.currentSession == null
            ? _buildSessionStartForm()
            : _orderType == null
                ? _buildOrderTypeSelection()
                : _buildPOSView(),
      ),
    );
  }

  Widget _buildCartUI() {
    return Column(
      children: [
        Container(
          padding: EdgeInsets.only(top: MediaQuery.of(context).padding.top + 16, bottom: 16, left: 16, right: 16),
          color: AppColors.secondary.withValues(alpha: 0.1),
          width: double.infinity,
          child: const Text(
            'Your Basket',
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.bold,
              color: AppColors.primary,
            ),
          ),
        ),
        Expanded(
          child: _cart.isEmpty
              ? const Center(child: Text('Basket is empty'))
              : ListView.separated(
                  itemCount: _cart.length,
                  separatorBuilder: (context, index) => const Divider(height: 1),
                  itemBuilder: (context, index) {
                    final cartItem = _cart[index];
                    final item = cartItem['item'] as CounterMenuItem;
                    final qty = cartItem['quantity'] as int;
                    final price = _getCartItemPrice(cartItem);
                    
                    final List<String> mods = [];
                    final customization = cartItem['customization'] as Map<String, dynamic>;
                    if (customization['bean'] != null) mods.add(customization['bean']);
                    if (customization['temperature'] != null) mods.add(customization['temperature']);
                    if (customization['milk'] != null) mods.add(customization['milk']);
                    if (customization['sweetness'] != null) mods.add(customization['sweetness']);
                    if (customization['iceLevel'] != null) mods.add(customization['iceLevel']);

                    return ListTile(
                      title: Text(
                        item.name,
                        style: const TextStyle(fontWeight: FontWeight.bold),
                      ),
                      subtitle: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (mods.isNotEmpty) Text(mods.join(', '), style: const TextStyle(fontSize: 12)),
                          Text('RM ${(price * qty).toStringAsFixed(2)}', style: const TextStyle(fontWeight: FontWeight.bold, color: AppColors.primary)),
                        ],
                      ),
                      trailing: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          IconButton(
                            icon: const Icon(Icons.remove_circle_outline),
                            onPressed: () {
                              setState(() {
                                if (qty > 1) {
                                  cartItem['quantity'] = qty - 1;
                                } else {
                                  _removeFromCart(index);
                                }
                              });
                            },
                            color: Colors.red,
                          ),
                          Text('$qty', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                          IconButton(
                            icon: const Icon(Icons.add_circle_outline),
                            onPressed: () {
                              setState(() {
                                cartItem['quantity'] = qty + 1;
                              });
                            },
                            color: AppColors.primary,
                          ),
                        ],
                      ),
                    );
                  },
                ),
        ),
        Container(
          padding: const EdgeInsets.all(16.0),
          decoration: const BoxDecoration(
            color: Colors.white,
            border: Border(top: BorderSide(color: Colors.black12)),
          ),
          child: Column(
            children: [
              if (true) // Always show voucher button
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton.icon(
                    onPressed: _showVoucherSelectionDialog,
                    icon: const Icon(Icons.local_offer_outlined),
                    label: Text(_selectedVoucher != null ? 'Change Voucher' : 'Apply Voucher'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.primary,
                      side: const BorderSide(color: AppColors.primary),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                    ),
                  ),
                ),
              const SizedBox(height: 12),
              if (_selectedVoucher != null)
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('Discount (${_selectedVoucher!['name']})', style: const TextStyle(fontSize: 14, color: Colors.green)),
                    Text('- RM ${(_getSubtotal() - _getCartTotal()).toStringAsFixed(2)}', style: const TextStyle(fontSize: 14, color: Colors.green)),
                  ],
                ),
              const SizedBox(height: 4),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Total', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                  Text(
                    'RM ${_getCartTotal().toStringAsFixed(2)}',
                    style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: AppColors.accent),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _cart.isEmpty
                      ? null
                      : () {
                          Navigator.pop(context); // close drawer
                          _showOrderConfirmationDialog();
                        },
                  style: ElevatedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                  ),
                  child: const Text('Checkout', style: TextStyle(fontSize: 16)),
                ),
              ),
              const SizedBox(height: 8),
              SizedBox(
                width: double.infinity,
                child: TextButton(
                  onPressed: () {
                    Navigator.pop(context);
                    _endSession();
                  },
                  style: TextButton.styleFrom(foregroundColor: Colors.red),
                  child: const Text('Cancel Order'),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  void _showVoucherSelectionDialog() {
    if (_sessionManager.currentSession?.phone == 'Guest' && _selectedVoucher == null) {
      final mockUsers = [
        {'name': 'Ali (Gold Tier)', 'phone': '+60123456789'},
        {'name': 'Siti (Silver Tier)', 'phone': '+60198765432'},
      ];
      showDialog(
        context: context,
        builder: (context) {
          return AlertDialog(
            title: const Text('Select Customer Account', style: TextStyle(fontWeight: FontWeight.bold)),
            content: SizedBox(
              width: 300,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text('Select an account to apply their vouchers to this guest order:', style: TextStyle(color: Colors.black54)),
                  const SizedBox(height: 16),
                  ListView.builder(
                    shrinkWrap: true,
                    itemCount: mockUsers.length,
                    itemBuilder: (context, index) {
                      final u = mockUsers[index];
                      return ListTile(
                        leading: const CircleAvatar(child: Icon(Icons.person)),
                        title: Text(u['name']!, style: const TextStyle(fontWeight: FontWeight.w600)),
                        subtitle: Text(u['phone']!),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                        onTap: () {
                          Navigator.pop(context);
                          _showMockVouchers();
                        },
                      );
                    },
                  ),
                ],
              ),
            ),
            actions: [
              TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
            ],
          );
        }
      );
    } else {
      _showMockVouchers();
    }
  }

  void _showMockVouchers() {
    final vouchers = [
      {'id': 1, 'name': '10% Off Birthday Voucher', 'discount_percent': 10.0, 'discount_amount': null},
      {'id': 2, 'name': 'RM 5 Off Next Purchase', 'discount_percent': null, 'discount_amount': 5.0},
    ];

    showDialog(
      context: context,
      builder: (context) {
        return Dialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
          backgroundColor: Colors.white,
          surfaceTintColor: Colors.transparent,
          child: Container(
            width: 500,
            padding: const EdgeInsets.all(32.0),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'Available Vouchers',
                      style: TextStyle(
                        fontFamily: 'Recoleta',
                        fontSize: 28,
                        fontWeight: FontWeight.bold,
                        color: AppColors.primary,
                      ),
                    ),
                    IconButton(
                      onPressed: () => Navigator.pop(context),
                      icon: const Icon(Icons.close, color: Colors.black54),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                const Text(
                  'Select a voucher to apply to this order.',
                  style: TextStyle(
                    fontFamily: 'Afacad',
                    fontSize: 16,
                    color: Colors.black54,
                  ),
                ),
                const SizedBox(height: 32),
                ...vouchers.map((v) {
                  final isSelected = _selectedVoucher?['id'] == v['id'];
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 16.0),
                    child: InkWell(
                      onTap: () {
                        setState(() {
                          _selectedVoucher = isSelected ? null : v;
                        });
                        Navigator.pop(context);
                      },
                      borderRadius: BorderRadius.circular(16),
                      child: Container(
                        padding: const EdgeInsets.all(20),
                        decoration: BoxDecoration(
                          color: isSelected ? AppColors.primary.withValues(alpha: 0.05) : Colors.white,
                          border: Border.all(
                            color: isSelected ? AppColors.primary : Colors.black12,
                            width: isSelected ? 2 : 1,
                          ),
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: isSelected ? AppColors.primary : AppColors.surfaceLight,
                                shape: BoxShape.circle,
                              ),
                              child: Icon(
                                Icons.local_offer_outlined,
                                color: isSelected ? Colors.white : AppColors.primary,
                                size: 28,
                              ),
                            ),
                            const SizedBox(width: 16),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    v['name'] as String,
                                    style: TextStyle(
                                      fontFamily: 'Recoleta',
                                      fontSize: 20,
                                      fontWeight: FontWeight.bold,
                                      color: isSelected ? AppColors.primary : Colors.black87,
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    v['discount_percent'] != null 
                                      ? 'Enjoy ${v['discount_percent']}% off your order.'
                                      : 'Enjoy RM ${v['discount_amount']} off your order.',
                                    style: const TextStyle(
                                      fontFamily: 'Afacad',
                                      fontSize: 16,
                                      color: Colors.black54,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            if (isSelected)
                              const Icon(Icons.check_circle, color: AppColors.primary, size: 28),
                          ],
                        ),
                      ),
                    ),
                  );
                }),
                if (_selectedVoucher != null) ...[
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    child: TextButton.icon(
                      onPressed: () {
                        setState(() {
                          _selectedVoucher = null;
                        });
                        Navigator.pop(context);
                      },
                      icon: const Icon(Icons.delete_outline, color: Colors.red),
                      label: const Text('Remove Current Voucher', style: TextStyle(color: Colors.red, fontSize: 16, fontFamily: 'Afacad', fontWeight: FontWeight.bold)),
                      style: TextButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        );
      }
    );
  }
  
  void _showOrderConfirmationDialog() {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) {
        return AlertDialog(
          title: const Text('Order Confirmation', style: TextStyle(fontWeight: FontWeight.bold)),
          content: SizedBox(
            width: 400,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text('Please review the order details before proceeding.', style: TextStyle(color: Colors.black54)),
                const SizedBox(height: 16),
                ConstrainedBox(
                  constraints: const BoxConstraints(maxHeight: 300),
                  child: ListView.builder(
                    shrinkWrap: true,
                    itemCount: _cart.length,
                    itemBuilder: (context, index) {
                      final cartItem = _cart[index];
                      final item = cartItem['item'] as CounterMenuItem;
                      final qty = cartItem['quantity'] as int;
                      final price = _getCartItemPrice(cartItem);
                      
                      final List<String> mods = [];
                      final customization = cartItem['customization'] as Map<String, dynamic>;
                      if (customization['bean'] != null) mods.add(customization['bean']);
                      if (customization['temperature'] != null) mods.add(customization['temperature']);
                      if (customization['milk'] != null) mods.add(customization['milk']);
                      if (customization['sweetness'] != null) mods.add(customization['sweetness']);
                      if (customization['iceLevel'] != null) mods.add(customization['iceLevel']);

                      return Padding(
                        padding: const EdgeInsets.symmetric(vertical: 4.0),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('${qty}x ', style: const TextStyle(fontWeight: FontWeight.bold)),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(item.name, style: const TextStyle(fontWeight: FontWeight.bold)),
                                  if (mods.isNotEmpty) ...[
                                    const SizedBox(height: 2),
                                    Text(
                                      mods.join(', '),
                                      style: const TextStyle(fontSize: 12, color: Colors.black54),
                                    ),
                                  ],
                                ],
                              ),
                            ),
                            Text('RM ${(price * qty).toStringAsFixed(2)}'),
                          ],
                        ),
                      );
                    },
                  ),
                ),
                const Divider(height: 24),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Subtotal', style: TextStyle(fontSize: 16)),
                    Text('RM ${_getSubtotal().toStringAsFixed(2)}', style: const TextStyle(fontSize: 16)),
                  ],
                ),
                if (_selectedVoucher != null) ...[
                  const SizedBox(height: 8),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('Discount (${_selectedVoucher!['name']})', style: const TextStyle(fontSize: 16, color: Colors.green)),
                      Text('- RM ${(_getSubtotal() - _getCartTotal()).toStringAsFixed(2)}', style: const TextStyle(fontSize: 16, color: Colors.green)),
                    ],
                  ),
                ],
                const SizedBox(height: 12),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Total Amount', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                    Text('RM ${_getCartTotal().toStringAsFixed(2)}', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppColors.primary)),
                  ],
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Back to Cart', style: TextStyle(color: Colors.black54)),
            ),
            ElevatedButton(
              onPressed: () async {
                Navigator.pop(context);
                _showSuccessDialog(_getCartTotal());
              },
              style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
              child: const Text('Confirm & Pay', style: TextStyle(color: Colors.white)),
            ),
          ],
        );
      }
    );
  }

  void _showSuccessDialog(double totalAmount) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) {
        return SuccessDialog(totalAmount: totalAmount);
      }
    ).then((_) {
      _endSession();
    });
  }

  Widget _buildSessionStartForm() {
    return Center(
      child: SingleChildScrollView(
        child: Container(
          width: 420,
          padding: const EdgeInsets.symmetric(horizontal: 40.0, vertical: 48.0),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(24),
            boxShadow: [
              BoxShadow(
                color: AppColors.primary.withValues(alpha: 0.08),
                blurRadius: 24,
                offset: const Offset(0, 12),
              ),
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.surfaceLight,
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.account_circle_outlined, size: 56, color: AppColors.primary),
            ),
            const SizedBox(height: 24),
            const Text(
              'Member Login',
              style: TextStyle(
                fontSize: 28,
                fontWeight: FontWeight.w800,
                color: AppColors.primary,
                letterSpacing: -0.5,
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'Enter your registered phone number to access your account.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.black54, fontSize: 15, height: 1.4),
            ),
            if (_errorMessage != null) ...[
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                decoration: BoxDecoration(
                  color: Colors.red.shade50,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  _errorMessage!,
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Colors.red.shade700, fontWeight: FontWeight.w600, fontSize: 14),
                ),
              ),
            ],
            const SizedBox(height: 32),
            TextField(
              controller: _phoneController,
              keyboardType: TextInputType.phone,
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w500),
              decoration: InputDecoration(
                filled: true,
                fillColor: AppColors.surfaceLight,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(16),
                  borderSide: BorderSide.none,
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(16),
                  borderSide: const BorderSide(color: AppColors.secondary, width: 2),
                ),
                contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
                labelText: 'Phone Number (e.g. +601...)',
                labelStyle: const TextStyle(color: Colors.black54),
                prefixIcon: const Icon(Icons.phone_outlined, color: AppColors.primary),
              ),
            ),
            const SizedBox(height: 32),
            SizedBox(
              width: double.infinity,
              height: 56,
              child: _isLoading
                  ? const Center(child: CircularProgressIndicator())
                  : ElevatedButton(
                      onPressed: _startSession,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                        ),
                        elevation: 0,
                      ),
                      child: const Text(
                        'Login',
                        style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                      ),
                    ),
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              height: 56,
              child: TextButton(
                onPressed: _isLoading ? null : _startGuestSession,
                style: TextButton.styleFrom(
                  foregroundColor: AppColors.charcoal,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                  ),
                ),
                child: const Text(
                  'Continue as Guest',
                  style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
                ),
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

  Widget _buildOrderTypeSelection() {
    return Center(
      child: Container(
        width: 600,
        padding: const EdgeInsets.all(48.0),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(24),
          boxShadow: [
            BoxShadow(
              color: AppColors.primary.withValues(alpha: 0.08),
              blurRadius: 24,
              offset: const Offset(0, 12),
            ),
          ],
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text(
              'Order Type',
              style: TextStyle(
                fontFamily: 'Recoleta',
                fontSize: 32,
                fontWeight: FontWeight.bold,
                color: AppColors.primary,
              ),
            ),
            const SizedBox(height: 16),
            const Text(
              'Is this order for Dine In or Take Away?',
              style: TextStyle(
                fontFamily: 'Afacad',
                fontSize: 18,
                color: Colors.black54,
              ),
            ),
            const SizedBox(height: 48),
            Row(
              children: [
                Expanded(
                  child: InkWell(
                    onTap: () {
                      setState(() {
                        _orderType = 'Dine In';
                      });
                    },
                    borderRadius: BorderRadius.circular(16),
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 48),
                      decoration: BoxDecoration(
                        color: AppColors.surfaceLight,
                        border: Border.all(color: AppColors.primary.withValues(alpha: 0.3), width: 2),
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Column(
                        children: const [
                          Icon(Icons.restaurant, size: 64, color: AppColors.primary),
                          SizedBox(height: 16),
                          Text('Dine In', style: TextStyle(fontFamily: 'Recoleta', fontSize: 24, fontWeight: FontWeight.bold, color: AppColors.primary)),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 24),
                Expanded(
                  child: InkWell(
                    onTap: () {
                      setState(() {
                        _orderType = 'Take Away';
                      });
                    },
                    borderRadius: BorderRadius.circular(16),
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 48),
                      decoration: BoxDecoration(
                        color: AppColors.surfaceLight,
                        border: Border.all(color: AppColors.primary.withValues(alpha: 0.3), width: 2),
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Column(
                        children: const [
                          Icon(Icons.shopping_bag_outlined, size: 64, color: AppColors.primary),
                          SizedBox(height: 16),
                          Text('Take Away', style: TextStyle(fontFamily: 'Recoleta', fontSize: 24, fontWeight: FontWeight.bold, color: AppColors.primary)),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPOSView() {
    if (_errorMessage != null) {
      return Container(
        color: AppColors.surfaceLight,
        child: Center(
          child: Text(
            _errorMessage!,
            style: const TextStyle(color: Colors.red, fontSize: 16),
          ),
        ),
      );
    }
    
    if (_menuItems.isEmpty) {
      return Container(
        color: AppColors.surfaceLight,
        child: const Center(
          child: Text("No items on menu, or unable to fetch."),
        ),
      );
    }

    final categories = _menuItems.map((e) => e.categoryName ?? 'Other').toSet().toList();
    if (_selectedCategory.value == null && categories.isNotEmpty) {
      _selectedCategory.value = categories.first;
    }

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 95,
          decoration: const BoxDecoration(
            color: Colors.white,
            border: Border(right: BorderSide(color: AppColors.primary, width: 1.5)),
          ),
          padding: const EdgeInsets.symmetric(vertical: 16),
          child: ValueListenableBuilder<String?>(
            valueListenable: _selectedCategory,
            builder: (context, selectedCat, child) {
              return ListView.builder(
                itemCount: categories.length,
                itemBuilder: (context, index) {
                  final category = categories[index];
                  final isSelected = category == selectedCat;
                  return GestureDetector(
                    onTap: () async {
                      _selectedCategory.value = category;
                      final key = _categoryKeys[category];
                      if (key != null && key.currentContext != null) {
                        _isScrollingToCategory = true;
                        await Scrollable.ensureVisible(
                          key.currentContext!,
                          duration: const Duration(milliseconds: 300),
                          curve: Curves.easeInOut,
                        );
                        _isScrollingToCategory = false;
                      }
                    },
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 200),
                      padding: const EdgeInsets.symmetric(vertical: 18, horizontal: 4),
                      decoration: BoxDecoration(
                        color: isSelected ? AppColors.primary : Colors.transparent,
                        borderRadius: const BorderRadius.horizontal(right: Radius.circular(12)),
                      ),
                      alignment: Alignment.center,
                      child: Text(
                        category.toUpperCase(),
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontFamily: 'Afacad',
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          color: isSelected ? Colors.white : Colors.black87,
                          height: 1.1,
                          letterSpacing: -0.2,
                        ),
                      ),
                    ),
                  );
                },
              );
            }
          ),
        ),
        Expanded(
          child: Container(
            color: const Color(0xFFF6F5F2), // Light beige background
            child: SingleChildScrollView(
              controller: _scrollController,
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: categories.map((category) {
                  final categoryItems = _menuItems.where((e) => (e.categoryName ?? 'Other') == category).toList();
                  if (categoryItems.isEmpty) return const SizedBox.shrink();
                  
                  return Container(
                    key: _categoryKeys.putIfAbsent(category, () => GlobalKey()),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Padding(
                          padding: const EdgeInsets.only(bottom: 12, top: 4),
                          child: Text(
                            category.toUpperCase(),
                            style: const TextStyle(
                              fontFamily: 'Recoleta',
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                              color: AppColors.primary,
                            ),
                          ),
                        ),
                        LayoutBuilder(
                          builder: (context, constraints) {
                            int crossAxisCount = 2;
                            if (constraints.maxWidth > 1200) {
                              crossAxisCount = 6;
                            } else if (constraints.maxWidth > 900) {
                              crossAxisCount = 5;
                            } else if (constraints.maxWidth > 600) {
                              crossAxisCount = 4;
                            }
                            
                            return GridView.builder(
                              shrinkWrap: true,
                              physics: const NeverScrollableScrollPhysics(),
                              gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                                crossAxisCount: crossAxisCount,
                                childAspectRatio: 0.65,
                                crossAxisSpacing: 12,
                                mainAxisSpacing: 12,
                              ),
                              itemCount: categoryItems.length,
                              itemBuilder: (context, index) {
                                final item = categoryItems[index];
                                final price = item.priceRm;
                                return Container(
                                  decoration: BoxDecoration(
                                    color: Colors.white,
                                    borderRadius: BorderRadius.circular(16),
                                    boxShadow: [
                                      BoxShadow(
                                        color: Colors.black.withOpacity(0.04),
                                        blurRadius: 8,
                                        offset: const Offset(0, 2),
                                      ),
                                    ],
                                  ),
                                  child: InkWell(
                                    onTap: () async {
                                      final customization = await Navigator.of(context).push(
                                        MaterialPageRoute(
                                          builder: (context) => ProductDetailModal(item: item),
                                        ),
                                      );
                                      
                                      if (customization != null) {
                                        _addToCart(item, customization);
                                      }
                                    },
                                    borderRadius: BorderRadius.circular(16),
                                    child: Column(
                                      mainAxisAlignment: MainAxisAlignment.center,
                                      children: [
                                        Expanded(
                                          child: Padding(
                                            padding: const EdgeInsets.all(12),
                                            child: Center(
                                              child: item.imageUrl != null
                                                  ? Image.network(
                                                      item.imageUrl!,
                                                      fit: BoxFit.contain,
                                                      errorBuilder: (context, error, stackTrace) => const Icon(
                                                        Icons.coffee,
                                                        size: 48,
                                                        color: AppColors.secondary,
                                                      ),
                                                    )
                                                  : const Icon(
                                                      Icons.coffee,
                                                      size: 48,
                                                      color: AppColors.secondary,
                                                    ),
                                            ),
                                          ),
                                        ),
                                        Padding(
                                          padding: const EdgeInsets.symmetric(horizontal: 8),
                                          child: Text(
                                            item.name,
                                            maxLines: 2,
                                            textAlign: TextAlign.center,
                                            overflow: TextOverflow.ellipsis,
                                            style: const TextStyle(
                                              fontFamily: 'Recoleta',
                                              fontSize: 14,
                                              fontWeight: FontWeight.bold,
                                              color: Colors.black87,
                                              height: 1.1,
                                            ),
                                          ),
                                        ),
                                        const SizedBox(height: 4),
                                        Text(
                                          'RM ${price.toStringAsFixed(2)}',
                                          textAlign: TextAlign.center,
                                          style: const TextStyle(
                                            fontFamily: 'Afacad',
                                            fontSize: 13,
                                            fontWeight: FontWeight.bold,
                                            color: Colors.black87,
                                          ),
                                        ),
                                        const SizedBox(height: 16),
                                      ],
                                    ),
                                  ),
                                );
                              },
                            );
                          }
                        ),
                        const SizedBox(height: 24),
                      ],
                    ),
                  );
                }).toList(),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class SuccessDialog extends StatefulWidget {
  final double totalAmount;

  const SuccessDialog({super.key, required this.totalAmount});

  @override
  State<SuccessDialog> createState() => _SuccessDialogState();
}

class _SuccessDialogState extends State<SuccessDialog> with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _scaleAnimation;
  late Animation<double> _opacityAnimation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );

    _scaleAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _controller, curve: Curves.elasticOut),
    );

    _opacityAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _controller,
        curve: const Interval(0.0, 0.5, curve: Curves.easeIn),
      ),
    );

    _controller.forward();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      backgroundColor: Colors.white,
      child: Container(
        width: 400,
        padding: const EdgeInsets.all(40),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            AnimatedBuilder(
              animation: _controller,
              builder: (context, child) {
                return Transform.scale(
                  scale: _scaleAnimation.value,
                  child: Opacity(
                    opacity: _opacityAnimation.value,
                    child: child,
                  ),
                );
              },
              child: Container(
                width: 100,
                height: 100,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: AppColors.primary,
                    width: 6,
                  ),
                ),
                child: const Center(
                  child: Icon(
                    Icons.check,
                    color: AppColors.primary,
                    size: 60,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 32),
            AnimatedOpacity(
              opacity: 1.0,
              duration: const Duration(milliseconds: 500),
              child: const Text(
                'Thank you for your order!',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.bold,
                  color: Colors.black87,
                ),
              ),
            ),
            const SizedBox(height: 16),
            AnimatedOpacity(
              opacity: 1.0,
              duration: const Duration(milliseconds: 500),
              child: Text(
                'Total: RM ${widget.totalAmount.toStringAsFixed(2)}\n\nPlease proceed to pay at the counter.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 16,
                  color: Colors.grey.shade700,
                  height: 1.4,
                ),
              ),
            ),
            const SizedBox(height: 40),
            SizedBox(
              width: double.infinity,
              height: 50,
              child: ElevatedButton(
                onPressed: () => Navigator.pop(context),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: const Text(
                  'DONE',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

