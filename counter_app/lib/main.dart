import 'dart:convert';
import 'package:flutter/material.dart';
import 'auth_service.dart';
import 'counter_menu.dart';
import 'session_manager.dart';
import 'api_client.dart';
import 'app_colors.dart';

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
  String _selectedCountryCode = '+60';

  static const _countryCodes = <String, String>{
    '+60': 'Malaysia (+60)',
    '+65': 'Singapore (+65)',
    '+62': 'Indonesia (+62)',
    '+66': 'Thailand (+66)',
    '+61': 'Australia (+61)',
    '+44': 'United Kingdom (+44)',
    '+1': 'United States / Canada (+1)',
    '+81': 'Japan (+81)',
    '+82': 'South Korea (+82)',
    '+86': 'China (+86)',
  };

  bool _isLoading = false;
  String? _errorMessage;
  List<CounterMenuItem> _menuItems = [];
  bool _isMenuLoading = true;
  String? _menuError;
  final Map<String, int> _cart = {}; // key: item ID, value: quantity

  @override
  void initState() {
    super.initState();
    _loadMenu();
  }

  Future<void> _loadMenu() async {
    final token = await widget.authService.getToken();
    if (token == null) {
      if (mounted) {
        setState(() {
          _isMenuLoading = false;
          _menuError = 'This counter device is not activated.';
        });
      }
      return;
    }

    if (mounted) {
      setState(() {
        _isMenuLoading = true;
        _menuError = null;
      });
    }

    try {
      final response = await _apiClient.get('/v1/counter/menu', token: token);
      if (response.statusCode == 200) {
        final items = parseCounterMenu(jsonDecode(response.body));
        if (mounted) {
          setState(() {
            _menuItems = items;
            _isMenuLoading = false;
            _menuError = items.isEmpty
                ? 'No available items are configured for this outlet.'
                : null;
          });
        }
      } else if (mounted) {
        setState(() {
          _isMenuLoading = false;
          _menuError = 'Unable to load the menu (${response.statusCode}).';
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _isMenuLoading = false;
          _menuError = 'Unable to reach the menu service. Please retry.';
        });
      }
    }
  }

  Future<void> _startSession() async {
    final localNumber = _phoneController.text.trim();
    if (localNumber.isEmpty) return;
    final digits = localNumber.replaceAll(RegExp(r'[^0-9]'), '');
    if (digits.isEmpty) return;
    final phone =
        '$_selectedCountryCode${digits.startsWith('0') ? digits.substring(1) : digits}';

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
            _errorMessage =
                'Number not found. Please try again or continue as a guest.';
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
    _clearCart();
    setState(() {}); // Rebuild UI to show login form
  }

  void _clearCart() {
    _cart.clear();
  }

  void _addToCart(String itemId) {
    setState(() {
      _cart[itemId] = (_cart[itemId] ?? 0) + 1;
    });
  }

  void _removeFromCart(String itemId) {
    setState(() {
      if (_cart.containsKey(itemId) && _cart[itemId]! > 1) {
        _cart[itemId] = _cart[itemId]! - 1;
      } else {
        _cart.remove(itemId);
      }
    });
  }

  double _getCartTotal() {
    double total = 0.0;
    for (var entry in _cart.entries) {
      final item = _menuItems.firstWhere(
        (item) => item.id == entry.key,
        orElse: () => throw StateError('Cart item is missing from the menu.'),
      );
      total += item.priceRm * entry.value;
    }
    return total;
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
                        _sessionManager
                                .currentSession!
                                .customerSummary['customer_name'] ??
                            _sessionManager.currentSession!.phone,
                        style: const TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 14,
                        ),
                      ),
                      Text(
                        'Tier: ${_sessionManager.currentSession!.customerSummary['loyalty_tier'] ?? 'None'}',
                        style: const TextStyle(
                          fontSize: 12,
                          color: Colors.white70,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
          ],
        ),
        body: _sessionManager.currentSession == null
            ? _buildSessionStartForm()
            : _buildPOSView(),
      ),
    );
  }

  Widget _buildSessionStartForm() {
    return Center(
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
              child: const Icon(
                Icons.account_circle_outlined,
                size: 56,
                color: AppColors.primary,
              ),
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
              style: TextStyle(
                color: Colors.black54,
                fontSize: 15,
                height: 1.4,
              ),
            ),
            if (_errorMessage != null) ...[
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 12,
                ),
                decoration: BoxDecoration(
                  color: Colors.red.shade50,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  _errorMessage!,
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: Colors.red.shade700,
                    fontWeight: FontWeight.w600,
                    fontSize: 14,
                  ),
                ),
              ),
            ],
            const SizedBox(height: 32),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SizedBox(
                  width: 148,
                  child: DropdownButtonFormField<String>(
                    initialValue: _selectedCountryCode,
                    isExpanded: true,
                    decoration: InputDecoration(
                      filled: true,
                      fillColor: AppColors.surfaceLight,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(16),
                        borderSide: BorderSide.none,
                      ),
                      labelText: 'Country',
                    ),
                    items: _countryCodes.entries
                        .map(
                          (entry) => DropdownMenuItem<String>(
                            value: entry.key,
                            child: Text(
                              entry.value,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        )
                        .toList(),
                    onChanged: (value) {
                      if (value != null) {
                        setState(() => _selectedCountryCode = value);
                      }
                    },
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: TextField(
                    controller: _phoneController,
                    keyboardType: TextInputType.phone,
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w500,
                    ),
                    decoration: InputDecoration(
                      filled: true,
                      fillColor: AppColors.surfaceLight,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(16),
                        borderSide: BorderSide.none,
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(16),
                        borderSide: const BorderSide(
                          color: AppColors.secondary,
                          width: 2,
                        ),
                      ),
                      contentPadding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 20,
                      ),
                      labelText: 'Phone number',
                      hintText: 'e.g. 013 860 1915',
                      labelStyle: const TextStyle(color: Colors.black54),
                      prefixIcon: const Icon(
                        Icons.phone_outlined,
                        color: AppColors.primary,
                      ),
                    ),
                  ),
                ),
              ],
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
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                        ),
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
    );
  }

  Widget _buildPOSView() {
    return Row(
      children: [
        // Menu Area
        Expanded(
          flex: 2,
          child: Container(
            color: AppColors.surfaceLight,
            padding: const EdgeInsets.all(16.0),
            child: _isMenuLoading
                ? const Center(child: CircularProgressIndicator())
                : _menuItems.isEmpty
                ? Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(_menuError ?? 'No menu items are available.'),
                        const SizedBox(height: 12),
                        OutlinedButton.icon(
                          onPressed: _loadMenu,
                          icon: const Icon(Icons.refresh),
                          label: const Text('Retry menu'),
                        ),
                      ],
                    ),
                  )
                : GridView.builder(
                    gridDelegate:
                        const SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: 3,
                          childAspectRatio: 1.0,
                          crossAxisSpacing: 16,
                          mainAxisSpacing: 16,
                        ),
                    itemCount: _menuItems.length,
                    itemBuilder: (context, index) {
                      final item = _menuItems[index];
                      final itemId = item.id;
                      final price = item.priceRm;
                      return Card(
                        elevation: 4,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: InkWell(
                          onTap: () => _addToCart(itemId),
                          borderRadius: BorderRadius.circular(12),
                          child: Padding(
                            padding: const EdgeInsets.all(16.0),
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                SizedBox(
                                  height: 96,
                                  width: double.infinity,
                                  child: item.imageUrl == null
                                      ? const Icon(
                                          Icons.coffee,
                                          size: 48,
                                          color: AppColors.secondary,
                                        )
                                      : Image.network(
                                          item.imageUrl!,
                                          fit: BoxFit.contain,
                                          errorBuilder: (_, _, _) => const Icon(
                                            Icons.coffee,
                                            size: 48,
                                            color: AppColors.secondary,
                                          ),
                                          loadingBuilder:
                                              (
                                                context,
                                                child,
                                                loadingProgress,
                                              ) {
                                                if (loadingProgress == null) {
                                                  return child;
                                                }
                                                return const Center(
                                                  child:
                                                      CircularProgressIndicator(),
                                                );
                                              },
                                        ),
                                ),
                                const SizedBox(height: 8),
                                Text(
                                  item.name,
                                  textAlign: TextAlign.center,
                                  style: const TextStyle(
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  'RM ${price.toStringAsFixed(2)}',
                                  style: const TextStyle(
                                    color: AppColors.accent,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      );
                    },
                  ),
          ),
        ),
        // Cart Area
        Container(
          width: 350,
          color: Colors.white,
          child: Column(
            children: [
              Container(
                padding: const EdgeInsets.all(16.0),
                color: AppColors.secondary.withValues(alpha: 0.1),
                width: double.infinity,
                child: const Text(
                  'Current Order',
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: AppColors.primary,
                  ),
                ),
              ),
              Expanded(
                child: _cart.isEmpty
                    ? const Center(child: Text('Cart is empty'))
                    : ListView.separated(
                        itemCount: _cart.length,
                        separatorBuilder: (context, index) =>
                            const Divider(height: 1),
                        itemBuilder: (context, index) {
                          final itemId = _cart.keys.elementAt(index);
                          final count = _cart[itemId]!;
                          final item = _menuItems.firstWhere(
                            (item) => item.id == itemId,
                            orElse: () => throw StateError(
                              'Cart item is missing from the menu.',
                            ),
                          );
                          final itemName = item.name;
                          final price = item.priceRm;

                          return ListTile(
                            title: Text(
                              itemName,
                              style: const TextStyle(
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            subtitle: Text(
                              'RM ${(price * count).toStringAsFixed(2)}',
                            ),
                            trailing: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                IconButton(
                                  icon: const Icon(Icons.remove_circle_outline),
                                  color: AppColors.accent,
                                  onPressed: () => _removeFromCart(itemId),
                                ),
                                Text(
                                  '$count',
                                  style: const TextStyle(fontSize: 16),
                                ),
                                IconButton(
                                  icon: const Icon(Icons.add_circle_outline),
                                  color: AppColors.primary,
                                  onPressed: () => _addToCart(itemId),
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
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'Total',
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        Text(
                          'RM ${_getCartTotal().toStringAsFixed(2)}',
                          style: const TextStyle(
                            fontSize: 24,
                            fontWeight: FontWeight.bold,
                            color: AppColors.accent,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: _cart.isEmpty
                            ? null
                            : () async {
                                // Note: According to API constraints, checkout is purely local clearing
                                // until the payment provider is fully implemented.
                                await _endSession();
                              },
                        style: ElevatedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 16),
                        ),
                        child: const Text(
                          'Checkout using Cash',
                          style: TextStyle(fontSize: 16),
                        ),
                      ),
                    ),
                    const SizedBox(height: 8),
                    SizedBox(
                      width: double.infinity,
                      child: TextButton(
                        onPressed: _endSession,
                        style: TextButton.styleFrom(
                          foregroundColor: Colors.red,
                        ),
                        child: const Text('Cancel Order'),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
