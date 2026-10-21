import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:counter_app/widgets/top_notice.dart';
import 'barista/main.dart' as barista;
import 'app_update_service.dart';
import 'auth_service.dart';
import 'session_manager.dart';
import 'api_client.dart';
import 'app_colors.dart';
import 'counter_menu.dart';
import 'device_printer_worker.dart';
import 'product_detail_modal.dart';

void main() {
  runApp(const CounterApp());
}

class CounterApp extends StatelessWidget {
  const CounterApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'C2 Store',
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
      return WorkspaceSelectionScreen(authService: _authService);
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
                const Icon(
                  Icons.storefront,
                  size: 64,
                  color: AppColors.primary,
                ),
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
                  style: TextStyle(
                    fontFamily: 'Afacad',
                    color: AppColors.charcoal,
                  ),
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
                  Text(
                    _errorMessage!,
                    style: const TextStyle(
                      fontFamily: 'Afacad',
                      color: Colors.red,
                    ),
                  ),
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

class WorkspaceSelectionScreen extends StatefulWidget {
  const WorkspaceSelectionScreen({super.key, required this.authService});

  final AuthService authService;

  @override
  State<WorkspaceSelectionScreen> createState() =>
      _WorkspaceSelectionScreenState();
}

class _WorkspaceSelectionScreenState extends State<WorkspaceSelectionScreen> {
  late final DevicePrinterWorker _printerWorker;
  final AppUpdateService _appUpdateService = AppUpdateService();

  @override
  void initState() {
    super.initState();
    _printerWorker = DevicePrinterWorker(authService: widget.authService)
      ..start();
  }

  @override
  void dispose() {
    _printerWorker.dispose();
    _appUpdateService.dispose();
    super.dispose();
  }

  Future<void> _openCounter() async {
    await Navigator.of(context).push<void>(
      MaterialPageRoute(
        builder: (_) => CounterHomeScreen(authService: widget.authService),
      ),
    );
  }

  Future<void> _openBarista() async {
    await Navigator.of(context).push<void>(
      MaterialPageRoute(
        builder: (_) => barista.BaristaWorkspace(
          onExitRequested: () =>
              _confirmAdministratorWorkspaceExit(context, widget.authService),
        ),
      ),
    );
  }

  Future<void> _checkForUpdate() async {
    showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (_) => const AlertDialog(
        content: Row(
          children: [
            CircularProgressIndicator(),
            SizedBox(width: 20),
            Expanded(child: Text('Checking for updates…')),
          ],
        ),
      ),
    );

    try {
      final check = await _appUpdateService.checkForUpdate();
      if (!mounted) return;
      Navigator.of(context, rootNavigator: true).pop();
      if (!check.updateAvailable) {
        await showDialog<void>(
          context: context,
          builder: (dialogContext) => AlertDialog(
            icon: const Icon(Icons.check_circle_outline_rounded),
            title: const Text('C2 Store is up to date'),
            content: Text(
              'Installed version ${check.installedVersionName} is the latest available version.',
            ),
            actions: [
              FilledButton(
                onPressed: () => Navigator.pop(dialogContext),
                child: const Text('Close'),
              ),
            ],
          ),
        );
        return;
      }
      await _showAvailableUpdate(check);
    } catch (error) {
      if (!mounted) return;
      Navigator.of(context, rootNavigator: true).pop();
      await showDialog<void>(
        context: context,
        builder: (dialogContext) => AlertDialog(
          icon: const Icon(Icons.cloud_off_outlined),
          title: const Text('Unable to check for updates'),
          content: Text(_friendlyUpdateError(error)),
          actions: [
            FilledButton(
              onPressed: () => Navigator.pop(dialogContext),
              child: const Text('Close'),
            ),
          ],
        ),
      );
    }
  }

  Future<void> _showAvailableUpdate(AppUpdateCheck check) async {
    await showDialog<void>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        icon: const Icon(Icons.system_update_alt_rounded),
        title: Text('C2 Store ${check.release.versionName} is available'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Installed version: ${check.installedVersionName}'),
            if (check.release.releaseNotes != null) ...[
              const SizedBox(height: 16),
              const Text(
                'What’s new',
                style: TextStyle(fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 4),
              Text(check.release.releaseNotes!),
            ],
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text('Later'),
          ),
          FilledButton.icon(
            onPressed: () async {
              Navigator.pop(dialogContext);
              await _installUpdate(check.release);
            },
            icon: const Icon(Icons.download_rounded),
            label: const Text('Download update'),
          ),
        ],
      ),
    );
  }

  Future<void> _installUpdate(AppRelease release) async {
    try {
      if (!await _appUpdateService.canInstallPackages()) {
        await _appUpdateService.openInstallPermissionSettings();
        if (!mounted) return;
        TopNotice.info(
          context,
          'Allow C2 Store to install apps, then return and select Update again.',
          duration: const Duration(seconds: 6),
        );
        return;
      }

      await _appUpdateService.downloadAndInstall(release);
      if (!mounted) return;
      await showDialog<void>(
        context: context,
        builder: (dialogContext) => AlertDialog(
          icon: const Icon(Icons.downloading_rounded),
          title: const Text('Update download started'),
          content: const Text(
            'Android will open the installer after the APK is downloaded and verified. Keep C2 Store open or watch the download notification.',
          ),
          actions: [
            FilledButton(
              onPressed: () => Navigator.pop(dialogContext),
              child: const Text('OK'),
            ),
          ],
        ),
      );
    } catch (error) {
      if (!mounted) return;
      await showDialog<void>(
        context: context,
        builder: (dialogContext) => AlertDialog(
          icon: const Icon(Icons.error_outline_rounded),
          title: const Text('Update could not start'),
          content: Text(_friendlyUpdateError(error)),
          actions: [
            FilledButton(
              onPressed: () => Navigator.pop(dialogContext),
              child: const Text('Close'),
            ),
          ],
        ),
      );
    }
  }

  String _friendlyUpdateError(Object error) {
    if (error is TimeoutException) {
      return 'The update server did not respond. Check the internet connection and try again.';
    }
    if (error is PlatformException && error.message?.isNotEmpty == true) {
      return error.message!;
    }
    if (error is FormatException) return error.message;
    return 'Check the internet connection and the cPanel update files, then try again.';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surfaceLight,
      appBar: AppBar(
        title: const Text('C2 Store'),
        actions: [
          PopupMenuButton<_WorkspaceMenuAction>(
            tooltip: 'Device settings',
            icon: const Icon(Icons.settings_outlined),
            onSelected: (action) async {
              switch (action) {
                case _WorkspaceMenuAction.update:
                  await _checkForUpdate();
                case _WorkspaceMenuAction.exit:
                  await SystemNavigator.pop();
              }
            },
            itemBuilder: (_) => const [
              PopupMenuItem(
                value: _WorkspaceMenuAction.update,
                child: ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: Icon(Icons.system_update_alt_rounded),
                  title: Text('Update'),
                ),
              ),
              PopupMenuItem(
                value: _WorkspaceMenuAction.exit,
                child: ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: Icon(Icons.exit_to_app_rounded),
                  title: Text('Exit'),
                ),
              ),
            ],
          ),
          const SizedBox(width: 12),
        ],
      ),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 900),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Center(
                    child: Image.asset(
                      'assets/images/c2_logo.png',
                      height: 120,
                    ),
                  ),
                  const SizedBox(height: 24),
                  Text(
                    'Choose workspace',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                      fontFamily: 'Recoleta',
                      color: AppColors.primary,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'This device remains securely assigned to its outlet. Staff access is verified separately.',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontFamily: 'Afacad',
                      color: AppColors.charcoal,
                      fontSize: 18,
                    ),
                  ),
                  const SizedBox(height: 32),
                  LayoutBuilder(
                    builder: (context, constraints) {
                      final stacked = constraints.maxWidth < 680;
                      final counterCard = _WorkspaceCard(
                        icon: Icons.point_of_sale_rounded,
                        title: 'Counter',
                        description:
                            'Start a customer session, build an order and manage the counter cart.',
                        buttonLabel: 'Open Counter',
                        onPressed: _openCounter,
                      );
                      final baristaCard = _WorkspaceCard(
                        icon: Icons.coffee_maker_rounded,
                        title: 'Barista Workspace',
                        description:
                            'Sign in to manage orders, attendance, preparation and the outlet printer.',
                        buttonLabel: 'Barista Login',
                        onPressed: _openBarista,
                      );
                      if (!stacked) {
                        return Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Expanded(child: counterCard),
                            const SizedBox(width: 20),
                            Expanded(child: baristaCard),
                          ],
                        );
                      }
                      return Column(
                        children: [
                          counterCard,
                          const SizedBox(height: 20),
                          baristaCard,
                        ],
                      );
                    },
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

enum _WorkspaceMenuAction { update, exit }

class _WorkspaceCard extends StatelessWidget {
  const _WorkspaceCard({
    required this.icon,
    required this.title,
    required this.description,
    required this.buttonLabel,
    required this.onPressed,
  });

  final IconData icon;
  final String title;
  final String description;
  final String buttonLabel;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: const BoxConstraints(minHeight: 290),
      padding: const EdgeInsets.all(28),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: AppColors.primary.withValues(alpha: .14)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x12000000),
            blurRadius: 24,
            offset: Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(
              color: AppColors.secondary.withValues(alpha: .18),
              borderRadius: BorderRadius.circular(18),
            ),
            child: Icon(icon, size: 34, color: AppColors.primary),
          ),
          const SizedBox(height: 24),
          Text(
            title,
            style: const TextStyle(
              fontFamily: 'Recoleta',
              color: AppColors.primary,
              fontSize: 28,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 10),
          Text(
            description,
            style: const TextStyle(
              fontFamily: 'Afacad',
              color: AppColors.charcoal,
              fontSize: 18,
              height: 1.35,
            ),
          ),
          const SizedBox(height: 24),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: onPressed,
              icon: const Icon(Icons.arrow_forward_rounded),
              label: Text(buttonLabel),
            ),
          ),
        ],
      ),
    );
  }
}

Future<bool> _confirmAdministratorWorkspaceExit(
  BuildContext context,
  AuthService authService,
) async {
  return await showDialog<bool>(
        context: context,
        barrierDismissible: false,
        builder: (_) =>
            _AdministratorWorkspaceExitDialog(authService: authService),
      ) ??
      false;
}

class _AdministratorWorkspaceExitDialog extends StatefulWidget {
  const _AdministratorWorkspaceExitDialog({required this.authService});

  final AuthService authService;

  @override
  State<_AdministratorWorkspaceExitDialog> createState() =>
      _AdministratorWorkspaceExitDialogState();
}

class _AdministratorWorkspaceExitDialogState
    extends State<_AdministratorWorkspaceExitDialog> {
  final TextEditingController _passwordController = TextEditingController();
  bool _submitting = false;
  bool _obscurePassword = true;
  String? _errorMessage;

  @override
  void dispose() {
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _confirm() async {
    if (_submitting || _passwordController.text.isEmpty) return;
    setState(() {
      _submitting = true;
      _errorMessage = null;
    });
    final result = await widget.authService.verifyAdministratorPassword(
      _passwordController.text,
    );
    if (!mounted) return;
    if (result.success) {
      Navigator.of(context).pop(true);
      return;
    }
    setState(() {
      _submitting = false;
      _errorMessage = result.message;
      _passwordController.clear();
    });
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      icon: const Icon(Icons.admin_panel_settings_outlined),
      title: const Text('Are you sure?'),
      content: SizedBox(
        width: 420,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text(
              'Returning to workspace selection allows access to another workspace. Please call an administrator to continue.',
            ),
            const SizedBox(height: 18),
            TextField(
              controller: _passwordController,
              autofocus: true,
              enabled: !_submitting,
              obscureText: _obscurePassword,
              textInputAction: TextInputAction.done,
              onSubmitted: (_) => _confirm(),
              decoration: InputDecoration(
                labelText: 'Administrator password',
                prefixIcon: const Icon(Icons.lock_outline_rounded),
                suffixIcon: IconButton(
                  onPressed: _submitting
                      ? null
                      : () => setState(
                          () => _obscurePassword = !_obscurePassword,
                        ),
                  icon: Icon(
                    _obscurePassword
                        ? Icons.visibility_outlined
                        : Icons.visibility_off_outlined,
                  ),
                ),
                border: const OutlineInputBorder(),
                errorText: _errorMessage,
              ),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: _submitting
              ? null
              : () => Navigator.of(context).pop(false),
          child: const Text('Stay here'),
        ),
        FilledButton.icon(
          onPressed: _submitting ? null : _confirm,
          icon: _submitting
              ? const SizedBox.square(
                  dimension: 16,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Icon(Icons.lock_open_rounded),
          label: Text(_submitting ? 'Verifying…' : 'Return to workspaces'),
        ),
      ],
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

  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = '';

  Future<void> _requestWorkspaceExit() async {
    final allowed = await _confirmAdministratorWorkspaceExit(
      context,
      widget.authService,
    );
    if (allowed && mounted) Navigator.of(context).pop();
  }

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
    _sessionManager.onSessionEnded = () {
      if (mounted) {
        setState(() {
          _clearCart();
          _searchController.clear();
        });
      }
    };
    _searchController.addListener(() {
      setState(() {
        _searchQuery = _searchController.text;
      });
    });
    _loadMenu();
  }

  @override
  void dispose() {
    _sessionManager.onSessionEnded = null;
    unawaited(_sessionManager.endSession());
    _clearCart();
    _scrollController.removeListener(_onScroll);
    _scrollController.dispose();
    _selectedCategory.dispose();
    _phoneController.dispose();
    _searchController.dispose();
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
        if (mounted) {
          setState(() {
            _menuItems = parseCounterMenu(data);
            _errorMessage = null;
          });
        }
      } else {
        debugPrint(
          'Counter menu request failed with HTTP ${response.statusCode}.',
        );
        if (mounted) {
          setState(() {
            _errorMessage = 'Failed to load menu (${response.statusCode})';
          });
        }
      }
    } catch (e, st) {
      debugPrint('Counter menu request failed: $e\n$st');
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
        final librarySelections =
            customization['librarySelections'] as Map<int, List<int>>? ?? {};
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
        total =
            total *
            (1 - (_selectedVoucher!['discount_percent'] as double) / 100);
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
      final librarySelections =
          customization['librarySelections'] as Map<int, List<int>>? ?? {};
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
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) unawaited(_requestWorkspaceExit());
      },
      child: Listener(
        onPointerDown: (_) => _sessionManager.onUserInteraction(),
        behavior: HitTestBehavior.translucent,
        child: Scaffold(
          appBar: AppBar(
            automaticallyImplyLeading: false,
            leading: IconButton(
              tooltip: 'Return to workspace selection',
              onPressed: _requestWorkspaceExit,
              icon: const Icon(Icons.arrow_back_rounded),
            ),
            title: Row(
              children: [Image.asset('assets/images/c2_logo.png', height: 32)],
            ),
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
                                  .customerSummary['username'] ??
                              _sessionManager
                                  .currentSession!
                                  .customerSummary['customer_name'] ??
                              _sessionManager.currentSession!.phone,
                          style: const TextStyle(
                            fontFamily: 'Afacad',
                            fontWeight: FontWeight.bold,
                            fontSize: 20,
                          ),
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
          endDrawer: Drawer(width: 350, child: _buildCartUI()),
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
                                border: Border.all(
                                  color: Colors.white,
                                  width: 1.5,
                                ),
                              ),
                              alignment: Alignment.center,
                              child: Text(
                                '${_cart.fold<int>(0, (sum, item) => sum + (item['quantity'] as int? ?? 1))}',
                                style: const TextStyle(
                                  fontFamily: 'Afacad',
                                  fontSize: 17,
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
      ),
    );
  }

  Widget _buildCartUI() {
    return Column(
      children: [
        Container(
          padding: EdgeInsets.only(
            top: MediaQuery.of(context).padding.top + 16,
            bottom: 16,
            left: 16,
            right: 16,
          ),
          color: AppColors.secondary.withValues(alpha: 0.1),
          width: double.infinity,
          child: const Text(
            'Your Basket',
            style: TextStyle(
              fontFamily: 'Recoleta',
              fontSize: 26,
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
                  separatorBuilder: (context, index) =>
                      const Divider(height: 1),
                  itemBuilder: (context, index) {
                    final cartItem = _cart[index];
                    final item = cartItem['item'] as CounterMenuItem;
                    final qty = cartItem['quantity'] as int;
                    final price = _getCartItemPrice(cartItem);

                    final List<String> mods = [];
                    final customization =
                        cartItem['customization'] as Map<String, dynamic>;
                    if (customization['bean'] != null) {
                      mods.add(customization['bean']);
                    }
                    if (customization['temperature'] != null) {
                      mods.add(customization['temperature']);
                    }
                    if (customization['milk'] != null) {
                      mods.add(customization['milk']);
                    }
                    if (customization['sweetness'] != null) {
                      mods.add(customization['sweetness']);
                    }
                    if (customization['iceLevel'] != null) {
                      mods.add(customization['iceLevel']);
                    }

                    return ListTile(
                      title: Text(
                        item.name,
                        style: const TextStyle(
                          fontFamily: 'Afacad',
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      subtitle: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (mods.isNotEmpty)
                            Text(
                              mods.join(', '),
                              style: const TextStyle(
                                fontFamily: 'Afacad',
                                fontSize: 18,
                              ),
                            ),
                          Text(
                            'RM ${(price * qty).toStringAsFixed(2)}',
                            style: const TextStyle(
                              fontFamily: 'Afacad',
                              fontWeight: FontWeight.bold,
                              color: AppColors.primary,
                            ),
                          ),
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
                          Text(
                            '$qty',
                            style: const TextStyle(
                              fontFamily: 'Afacad',
                              fontSize: 22,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
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
                    label: Text(
                      _selectedVoucher != null
                          ? 'Change Voucher'
                          : 'Apply Voucher',
                    ),
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
                    Text(
                      'Discount (${_selectedVoucher!['name']})',
                      style: const TextStyle(
                        fontFamily: 'Afacad',
                        fontSize: 20,
                        color: Colors.green,
                      ),
                    ),
                    Text(
                      '- RM ${(_getSubtotal() - _getCartTotal()).toStringAsFixed(2)}',
                      style: const TextStyle(
                        fontFamily: 'Afacad',
                        fontSize: 20,
                        color: Colors.green,
                      ),
                    ),
                  ],
                ),
              const SizedBox(height: 4),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Total',
                    style: TextStyle(
                      fontFamily: 'Recoleta',
                      fontSize: 24,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  Text(
                    'RM ${_getCartTotal().toStringAsFixed(2)}',
                    style: const TextStyle(
                      fontFamily: 'Recoleta',
                      fontSize: 30,
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
                      : () {
                          Navigator.pop(context); // close drawer
                          _showOrderConfirmationDialog();
                        },
                  style: ElevatedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                  ),
                  child: const Text(
                    'Checkout',
                    style: TextStyle(fontFamily: 'Afacad', fontSize: 22),
                  ),
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
    if (_sessionManager.currentSession?.phone == 'Guest' &&
        _selectedVoucher == null) {
      final mockUsers = [
        {'name': 'Ali (Gold Tier)', 'phone': '+60123456789'},
        {'name': 'Siti (Silver Tier)', 'phone': '+60198765432'},
      ];
      showDialog(
        context: context,
        builder: (context) {
          return AlertDialog(
            title: const Text(
              'Select Customer Account',
              style: TextStyle(
                fontFamily: 'Afacad',
                fontWeight: FontWeight.bold,
              ),
            ),
            content: SizedBox(
              width: 300,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text(
                    'Select an account to apply their vouchers to this guest order:',
                    style: TextStyle(
                      fontFamily: 'Afacad',
                      color: Colors.black54,
                    ),
                  ),
                  const SizedBox(height: 16),
                  ListView.builder(
                    shrinkWrap: true,
                    itemCount: mockUsers.length,
                    itemBuilder: (context, index) {
                      final u = mockUsers[index];
                      return ListTile(
                        leading: const CircleAvatar(child: Icon(Icons.person)),
                        title: Text(
                          u['name']!,
                          style: const TextStyle(
                            fontFamily: 'Afacad',
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        subtitle: Text(u['phone']!),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(8),
                        ),
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
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('Cancel'),
              ),
            ],
          );
        },
      );
    } else {
      _showMockVouchers();
    }
  }

  void _showMockVouchers() {
    final vouchers = [
      {
        'id': 1,
        'name': '10% Off Birthday Voucher',
        'discount_percent': 10.0,
        'discount_amount': null,
      },
      {
        'id': 2,
        'name': 'RM 5 Off Next Purchase',
        'discount_percent': null,
        'discount_amount': 5.0,
      },
    ];

    showDialog(
      context: context,
      builder: (context) {
        return Dialog(
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(24),
          ),
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
                        fontSize: 34,
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
                    fontSize: 22,
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
                          color: isSelected
                              ? AppColors.primary.withValues(alpha: 0.05)
                              : Colors.white,
                          border: Border.all(
                            color: isSelected
                                ? AppColors.primary
                                : Colors.black12,
                            width: isSelected ? 2 : 1,
                          ),
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: isSelected
                                    ? AppColors.primary
                                    : AppColors.surfaceLight,
                                shape: BoxShape.circle,
                              ),
                              child: Icon(
                                Icons.local_offer_outlined,
                                color: isSelected
                                    ? Colors.white
                                    : AppColors.primary,
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
                                      fontSize: 26,
                                      fontWeight: FontWeight.bold,
                                      color: isSelected
                                          ? AppColors.primary
                                          : Colors.black87,
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    v['discount_percent'] != null
                                        ? 'Enjoy ${v['discount_percent']}% off your order.'
                                        : 'Enjoy RM ${v['discount_amount']} off your order.',
                                    style: const TextStyle(
                                      fontFamily: 'Afacad',
                                      fontSize: 22,
                                      color: Colors.black54,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            if (isSelected)
                              const Icon(
                                Icons.check_circle,
                                color: AppColors.primary,
                                size: 28,
                              ),
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
                      label: const Text(
                        'Remove Current Voucher',
                        style: TextStyle(
                          color: Colors.red,
                          fontSize: 22,
                          fontFamily: 'Afacad',
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      style: TextButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        );
      },
    );
  }

  void _showOrderConfirmationDialog() {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) {
        return AlertDialog(
          title: const Text(
            'Order Confirmation',
            style: TextStyle(fontFamily: 'Afacad', fontWeight: FontWeight.bold),
          ),
          content: SizedBox(
            width: 400,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text(
                  'Please review the order details before proceeding.',
                  style: TextStyle(fontFamily: 'Afacad', color: Colors.black54),
                ),
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
                      final customization =
                          cartItem['customization'] as Map<String, dynamic>;
                      if (customization['bean'] != null) {
                        mods.add(customization['bean']);
                      }
                      if (customization['temperature'] != null) {
                        mods.add(customization['temperature']);
                      }
                      if (customization['milk'] != null) {
                        mods.add(customization['milk']);
                      }
                      if (customization['sweetness'] != null) {
                        mods.add(customization['sweetness']);
                      }
                      if (customization['iceLevel'] != null) {
                        mods.add(customization['iceLevel']);
                      }

                      return Padding(
                        padding: const EdgeInsets.symmetric(vertical: 4.0),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              '${qty}x ',
                              style: const TextStyle(
                                fontFamily: 'Afacad',
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    item.name,
                                    style: const TextStyle(
                                      fontFamily: 'Afacad',
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                  if (mods.isNotEmpty) ...[
                                    const SizedBox(height: 2),
                                    Text(
                                      mods.join(', '),
                                      style: const TextStyle(
                                        fontFamily: 'Afacad',
                                        fontSize: 18,
                                        color: Colors.black54,
                                      ),
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
                    const Text(
                      'Subtotal',
                      style: TextStyle(fontFamily: 'Afacad', fontSize: 22),
                    ),
                    Text(
                      'RM ${_getSubtotal().toStringAsFixed(2)}',
                      style: const TextStyle(
                        fontFamily: 'Afacad',
                        fontSize: 22,
                      ),
                    ),
                  ],
                ),
                if (_selectedVoucher != null) ...[
                  const SizedBox(height: 8),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'Discount (${_selectedVoucher!['name']})',
                        style: const TextStyle(
                          fontFamily: 'Afacad',
                          fontSize: 22,
                          color: Colors.green,
                        ),
                      ),
                      Text(
                        '- RM ${(_getSubtotal() - _getCartTotal()).toStringAsFixed(2)}',
                        style: const TextStyle(
                          fontFamily: 'Afacad',
                          fontSize: 22,
                          color: Colors.green,
                        ),
                      ),
                    ],
                  ),
                ],
                const SizedBox(height: 12),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'Total Amount',
                      style: TextStyle(
                        fontFamily: 'Recoleta',
                        fontSize: 24,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    Text(
                      'RM ${_getCartTotal().toStringAsFixed(2)}',
                      style: const TextStyle(
                        fontFamily: 'Recoleta',
                        fontSize: 24,
                        fontWeight: FontWeight.bold,
                        color: AppColors.primary,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text(
                'Back to Cart',
                style: TextStyle(fontFamily: 'Afacad', color: Colors.black54),
              ),
            ),
            ElevatedButton(
              onPressed: () async {
                Navigator.pop(context);
                if (!mounted) return;
                await showDialog<void>(
                  context: context,
                  builder: (dialogContext) => AlertDialog(
                    title: const Text('Counter checkout is not enabled'),
                    content: const Text(
                      'This Counter build can prepare a quote, but it cannot create or charge a production order yet. Please complete the order through the approved customer checkout flow.',
                    ),
                    actions: [
                      TextButton(
                        onPressed: () => Navigator.pop(dialogContext),
                        child: const Text('Close'),
                      ),
                    ],
                  ),
                );
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
              ),
              child: const Text(
                'Review Checkout Status',
                style: TextStyle(fontFamily: 'Afacad', color: Colors.white),
              ),
            ),
          ],
        );
      },
    );
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
                  fontFamily: 'Recoleta',
                  fontSize: 34,
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
                  fontFamily: 'Afacad',
                  color: Colors.black54,
                  fontSize: 21,
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
                      fontFamily: 'Afacad',
                      color: Colors.red.shade700,
                      fontWeight: FontWeight.w600,
                      fontSize: 20,
                    ),
                  ),
                ),
              ],
              const SizedBox(height: 32),
              TextField(
                controller: _phoneController,
                keyboardType: TextInputType.phone,
                style: const TextStyle(
                  fontFamily: 'Afacad',
                  fontSize: 22,
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
                    horizontal: 20,
                    vertical: 20,
                  ),
                  labelText: 'Phone Number (e.g. +601...)',
                  labelStyle: const TextStyle(
                    fontFamily: 'Afacad',
                    color: Colors.black54,
                  ),
                  prefixIcon: const Icon(
                    Icons.phone_outlined,
                    color: AppColors.primary,
                  ),
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
                          style: TextStyle(
                            fontFamily: 'Afacad',
                            fontSize: 22,
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
                    style: TextStyle(
                      fontFamily: 'Afacad',
                      fontSize: 21,
                      fontWeight: FontWeight.w600,
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
                fontSize: 38,
                fontWeight: FontWeight.bold,
                color: AppColors.primary,
              ),
            ),
            const SizedBox(height: 16),
            const Text(
              'Is this order for Dine In or Take Away?',
              style: TextStyle(
                fontFamily: 'Afacad',
                fontSize: 24,
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
                        border: Border.all(
                          color: AppColors.primary.withValues(alpha: 0.3),
                          width: 2,
                        ),
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Column(
                        children: const [
                          Icon(
                            Icons.restaurant,
                            size: 64,
                            color: AppColors.primary,
                          ),
                          SizedBox(height: 16),
                          Text(
                            'Dine In',
                            style: TextStyle(
                              fontFamily: 'Recoleta',
                              fontSize: 30,
                              fontWeight: FontWeight.bold,
                              color: AppColors.primary,
                            ),
                          ),
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
                        border: Border.all(
                          color: AppColors.primary.withValues(alpha: 0.3),
                          width: 2,
                        ),
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Column(
                        children: const [
                          Icon(
                            Icons.shopping_bag_outlined,
                            size: 64,
                            color: AppColors.primary,
                          ),
                          SizedBox(height: 16),
                          Text(
                            'Take Away',
                            style: TextStyle(
                              fontFamily: 'Recoleta',
                              fontSize: 30,
                              fontWeight: FontWeight.bold,
                              color: AppColors.primary,
                            ),
                          ),
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
            style: const TextStyle(
              fontFamily: 'Afacad',
              color: Colors.red,
              fontSize: 22,
            ),
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

    final filteredItems = _searchQuery.isEmpty
        ? _menuItems
        : _menuItems
              .where(
                (item) => item.name.toLowerCase().contains(
                  _searchQuery.toLowerCase(),
                ),
              )
              .toList();

    final categories = filteredItems
        .map((e) => e.categoryName ?? 'Other')
        .toSet()
        .toList();
    if (_selectedCategory.value == null && categories.isNotEmpty) {
      _selectedCategory.value = categories.first;
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          height: 64,
          color: Colors.white,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: ValueListenableBuilder<String?>(
            valueListenable: _selectedCategory,
            builder: (context, selectedCat, child) {
              return ListView.builder(
                scrollDirection: Axis.horizontal,
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
                      margin: const EdgeInsets.only(right: 8),
                      padding: const EdgeInsets.symmetric(horizontal: 24),
                      decoration: BoxDecoration(
                        color: isSelected
                            ? AppColors.primary
                            : Colors.grey.shade100,
                        borderRadius: BorderRadius.circular(24),
                      ),
                      alignment: Alignment.center,
                      child: Text(
                        category.toUpperCase(),
                        style: TextStyle(
                          fontFamily: 'Afacad',
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: isSelected ? Colors.white : Colors.black87,
                        ),
                      ),
                    ),
                  );
                },
              );
            },
          ),
        ),
        Expanded(
          child: Container(
            color: Colors.white,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(16.0, 16.0, 16.0, 8.0),
                  child: Container(
                    height: 54,
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(27),
                      border: Border.all(
                        color: AppColors.primary.withValues(alpha: 0.15),
                        width: 1.5,
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: AppColors.primary.withValues(alpha: 0.06),
                          blurRadius: 12,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: Center(
                      child: TextField(
                        controller: _searchController,
                        textAlignVertical: TextAlignVertical.center,
                        decoration: InputDecoration(
                          hintText: 'Search for your favorite drinks...',
                          hintStyle: TextStyle(
                            fontFamily: 'Afacad',
                            fontSize: 21,
                            color: Colors.grey.shade500,
                          ),
                          prefixIcon: const Padding(
                            padding: EdgeInsets.only(left: 16.0, right: 8.0),
                            child: Icon(
                              Icons.search,
                              color: AppColors.primary,
                              size: 24,
                            ),
                          ),
                          suffixIcon: _searchQuery.isNotEmpty
                              ? IconButton(
                                  icon: const Icon(
                                    Icons.cancel,
                                    color: Colors.grey,
                                    size: 20,
                                  ),
                                  onPressed: () {
                                    _searchController.clear();
                                  },
                                )
                              : null,
                          border: InputBorder.none,
                          isCollapsed: true,
                          contentPadding: EdgeInsets.zero,
                        ),
                        style: const TextStyle(
                          fontFamily: 'Afacad',
                          fontSize: 22,
                          color: Colors.black87,
                        ),
                      ),
                    ),
                  ),
                ),
                Expanded(
                  child: SingleChildScrollView(
                    controller: _scrollController,
                    padding: const EdgeInsets.all(16.0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: categories.map((category) {
                        final categoryItems = filteredItems
                            .where(
                              (e) => (e.categoryName ?? 'Other') == category,
                            )
                            .toList();
                        if (categoryItems.isEmpty) {
                          return const SizedBox.shrink();
                        }

                        return Container(
                          key: _categoryKeys.putIfAbsent(
                            category,
                            () => GlobalKey(),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Padding(
                                padding: const EdgeInsets.only(
                                  bottom: 12,
                                  top: 4,
                                ),
                                child: Text(
                                  category.toUpperCase(),
                                  style: const TextStyle(
                                    fontFamily: 'Recoleta',
                                    fontSize: 32,
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
                                    physics:
                                        const NeverScrollableScrollPhysics(),
                                    gridDelegate:
                                        SliverGridDelegateWithFixedCrossAxisCount(
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
                                          borderRadius: BorderRadius.circular(
                                            16,
                                          ),
                                          border: Border.all(
                                            color: Colors.grey.shade300,
                                            width: 1,
                                          ),
                                          boxShadow: [
                                            BoxShadow(
                                              color: Colors.black.withValues(
                                                alpha: 0.04,
                                              ),
                                              blurRadius: 8,
                                              offset: const Offset(0, 2),
                                            ),
                                          ],
                                        ),
                                        child: InkWell(
                                          onTap: () async {
                                            final customization =
                                                await Navigator.of(
                                                  context,
                                                ).push(
                                                  MaterialPageRoute(
                                                    builder: (context) =>
                                                        ProductDetailModal(
                                                          item: item,
                                                        ),
                                                  ),
                                                );

                                            if (customization != null) {
                                              _addToCart(item, customization);
                                            }
                                          },
                                          borderRadius: BorderRadius.circular(
                                            16,
                                          ),
                                          child: Column(
                                            mainAxisAlignment:
                                                MainAxisAlignment.center,
                                            children: [
                                              Expanded(
                                                child: Padding(
                                                  padding: const EdgeInsets.all(
                                                    12,
                                                  ),
                                                  child: Center(
                                                    child: item.imageUrl != null
                                                        ? Image.network(
                                                            item.imageUrl!,
                                                            fit: BoxFit.contain,
                                                            errorBuilder:
                                                                (
                                                                  context,
                                                                  error,
                                                                  stackTrace,
                                                                ) => const Icon(
                                                                  Icons.coffee,
                                                                  size: 48,
                                                                  color: AppColors
                                                                      .secondary,
                                                                ),
                                                          )
                                                        : const Icon(
                                                            Icons.coffee,
                                                            size: 48,
                                                            color: AppColors
                                                                .secondary,
                                                          ),
                                                  ),
                                                ),
                                              ),
                                              Padding(
                                                padding:
                                                    const EdgeInsets.symmetric(
                                                      horizontal: 8,
                                                    ),
                                                child: Text(
                                                  item.name,
                                                  maxLines: 2,
                                                  textAlign: TextAlign.center,
                                                  overflow:
                                                      TextOverflow.ellipsis,
                                                  style: const TextStyle(
                                                    fontFamily: 'Recoleta',
                                                    fontSize: 20,
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
                                                  fontSize: 19,
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
                                },
                              ),
                              const SizedBox(height: 24),
                            ],
                          ),
                        );
                      }).toList(),
                    ),
                  ),
                ),
              ],
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

class _SuccessDialogState extends State<SuccessDialog>
    with SingleTickerProviderStateMixin {
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

    _scaleAnimation = Tween<double>(
      begin: 0.0,
      end: 1.0,
    ).animate(CurvedAnimation(parent: _controller, curve: Curves.elasticOut));

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
                  border: Border.all(color: AppColors.primary, width: 6),
                ),
                child: const Center(
                  child: Icon(Icons.check, color: AppColors.primary, size: 60),
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
                  fontFamily: 'Recoleta',
                  fontSize: 30,
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
                  fontFamily: 'Afacad',
                  fontSize: 22,
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
                    fontFamily: 'Recoleta',
                    fontSize: 24,
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
