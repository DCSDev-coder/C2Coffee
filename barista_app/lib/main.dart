import 'dart:ui';
import 'package:flutter/material.dart';
import 'screens/main_layout.dart';
import 'widgets/order_card.dart';
import 'services/api_service.dart';

final ValueNotifier<String> globalActiveBarista = ValueNotifier<String>('');
final ValueNotifier<int?> globalActiveBaristaId = ValueNotifier<int?>(null);
final ValueNotifier<String?> globalOrderSyncError = ValueNotifier<String?>(
  null,
);
final ValueNotifier<DateTime?> globalLastOrderSync = ValueNotifier<DateTime?>(
  null,
);

final ValueNotifier<List<CurrentOrder>> globalCurrentOrders =
    ValueNotifier<List<CurrentOrder>>([]);

final ValueNotifier<List<CurrentOrder>> globalHistoryOrders =
    ValueNotifier<List<CurrentOrder>>([]);

void main() {
  runApp(const BaristaApp());
}

class BaristaApp extends StatelessWidget {
  const BaristaApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Barista App',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        fontFamily: 'Afacad',
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF304A3A),
          brightness: Brightness.light,
        ),
        useMaterial3: true,
      ),
      home: const LoginPage(),
    );
  }
}

class LoginPage extends StatefulWidget {
  const LoginPage({super.key});

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final TextEditingController _usernameController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();
  bool _isPasswordVisible = false;

  @override
  void dispose() {
    _usernameController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        fit: StackFit.expand,
        children: [
          // Background Image
          Image.asset('assets/images/login_barista.jpg', fit: BoxFit.cover),

          // Dark Overlay for lower intensity
          Container(color: Colors.black.withValues(alpha: 0.4)),

          // Content
          Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 24.0),
              child: Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 380),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      // Logo
                      Image.asset('assets/images/c2_logo.png', height: 240),
                      const SizedBox(height: 32),

                      // Glassmorphic Card
                      ClipRRect(
                        borderRadius: BorderRadius.circular(24),
                        child: BackdropFilter(
                          filter: ImageFilter.blur(sigmaX: 15.0, sigmaY: 15.0),
                          child: Container(
                            padding: const EdgeInsets.all(24.0),
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.15),
                              borderRadius: BorderRadius.circular(24),
                              border: Border.all(
                                color: Colors.white.withValues(alpha: 0.3),
                                width: 1.5,
                              ),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                // Username Field
                                const Text(
                                  'Username',
                                  style: TextStyle(
                                    color: Colors.white,
                                    fontSize: 20,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                                const SizedBox(height: 8),
                                TextField(
                                  controller: _usernameController,
                                  style: const TextStyle(color: Colors.white),
                                  decoration: InputDecoration(
                                    filled: true,
                                    fillColor: Colors.white.withValues(
                                      alpha: 0.05,
                                    ),
                                    suffixIcon: const Icon(
                                      Icons.person,
                                      color: Colors.white,
                                    ),
                                    contentPadding: const EdgeInsets.symmetric(
                                      horizontal: 16,
                                      vertical: 12,
                                    ),
                                    border: OutlineInputBorder(
                                      borderRadius: BorderRadius.circular(30),
                                      borderSide: BorderSide(
                                        color: Colors.white.withValues(
                                          alpha: 0.4,
                                        ),
                                        width: 1.0,
                                      ),
                                    ),
                                    enabledBorder: OutlineInputBorder(
                                      borderRadius: BorderRadius.circular(30),
                                      borderSide: BorderSide(
                                        color: Colors.white.withValues(
                                          alpha: 0.4,
                                        ),
                                        width: 1.0,
                                      ),
                                    ),
                                    focusedBorder: OutlineInputBorder(
                                      borderRadius: BorderRadius.circular(30),
                                      borderSide: const BorderSide(
                                        color: Colors.white,
                                        width: 1.5,
                                      ),
                                    ),
                                  ),
                                ),
                                const SizedBox(height: 24),

                                // Password Field
                                const Text(
                                  'Password',
                                  style: TextStyle(
                                    color: Colors.white,
                                    fontSize: 20,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                                const SizedBox(height: 8),
                                TextField(
                                  controller: _passwordController,
                                  obscureText: !_isPasswordVisible,
                                  style: const TextStyle(color: Colors.white),
                                  decoration: InputDecoration(
                                    filled: true,
                                    fillColor: Colors.white.withValues(
                                      alpha: 0.05,
                                    ),
                                    suffixIcon: IconButton(
                                      icon: Icon(
                                        _isPasswordVisible
                                            ? Icons.visibility
                                            : Icons.visibility_off,
                                        color: Colors.white,
                                      ),
                                      onPressed: () {
                                        setState(() {
                                          _isPasswordVisible =
                                              !_isPasswordVisible;
                                        });
                                      },
                                    ),
                                    contentPadding: const EdgeInsets.symmetric(
                                      horizontal: 16,
                                      vertical: 12,
                                    ),
                                    border: OutlineInputBorder(
                                      borderRadius: BorderRadius.circular(30),
                                      borderSide: BorderSide(
                                        color: Colors.white.withValues(
                                          alpha: 0.4,
                                        ),
                                        width: 1.0,
                                      ),
                                    ),
                                    enabledBorder: OutlineInputBorder(
                                      borderRadius: BorderRadius.circular(30),
                                      borderSide: BorderSide(
                                        color: Colors.white.withValues(
                                          alpha: 0.4,
                                        ),
                                        width: 1.0,
                                      ),
                                    ),
                                    focusedBorder: OutlineInputBorder(
                                      borderRadius: BorderRadius.circular(30),
                                      borderSide: const BorderSide(
                                        color: Colors.white,
                                        width: 1.5,
                                      ),
                                    ),
                                  ),
                                ),
                                const SizedBox(height: 32),

                                // Login Button
                                ElevatedButton(
                                  onPressed: () async {
                                    final username = _usernameController.text
                                        .trim();
                                    final password = _passwordController.text
                                        .trim();

                                    if (username.isEmpty || password.isEmpty) {
                                      ScaffoldMessenger.of(
                                        context,
                                      ).showSnackBar(
                                        const SnackBar(
                                          content: Text(
                                            'Please enter both username and password',
                                          ),
                                          backgroundColor: Colors.redAccent,
                                          behavior: SnackBarBehavior.floating,
                                        ),
                                      );
                                      return;
                                    }

                                    // Validate with API
                                    final success = await ApiService.login(
                                      username,
                                      password,
                                    );
                                    if (!success) {
                                      if (!context.mounted) return;
                                      ScaffoldMessenger.of(
                                        context,
                                      ).showSnackBar(
                                        const SnackBar(
                                          content: Text(
                                            'Use a valid Barista account created in Admin Web.',
                                          ),
                                          backgroundColor: Colors.redAccent,
                                          behavior: SnackBarBehavior.floating,
                                        ),
                                      );
                                      return;
                                    }

                                    if (!context.mounted) return;
                                    Navigator.pushReplacement(
                                      context,
                                      PageRouteBuilder(
                                        pageBuilder:
                                            (
                                              context,
                                              animation,
                                              secondaryAnimation,
                                            ) => const BaristaSelectionPage(),
                                        transitionsBuilder:
                                            (
                                              context,
                                              animation,
                                              secondaryAnimation,
                                              child,
                                            ) {
                                              const begin = Offset(
                                                1.0,
                                                0.0,
                                              ); // Start from right
                                              const end = Offset.zero;
                                              const curve = Curves.ease;
                                              var tween = Tween(
                                                begin: begin,
                                                end: end,
                                              ).chain(CurveTween(curve: curve));
                                              return SlideTransition(
                                                position: animation.drive(
                                                  tween,
                                                ),
                                                child: child,
                                              );
                                            },
                                      ),
                                    );
                                  },
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: const Color(0xFF304A3A),
                                    foregroundColor: Colors.white,
                                    padding: const EdgeInsets.symmetric(
                                      vertical: 12,
                                    ),
                                    shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(30),
                                    ),
                                    elevation: 0,
                                  ),
                                  child: const Row(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      Text(
                                        'Login',
                                        style: TextStyle(
                                          fontSize: 18,
                                          fontWeight: FontWeight.w600,
                                        ),
                                      ),
                                      SizedBox(width: 8),
                                      Icon(Icons.arrow_right_alt, size: 24),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 48), // Padding below card
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class BaristaSelectionPage extends StatefulWidget {
  const BaristaSelectionPage({super.key});

  @override
  State<BaristaSelectionPage> createState() => _BaristaSelectionPageState();
}

class _BaristaSelectionPageState extends State<BaristaSelectionPage> {
  late final Future<List<BaristaStaff>> _staffFuture;

  @override
  void initState() {
    super.initState();
    _staffFuture = ApiService.fetchActiveBaristas();
  }

  void _startShift(BaristaStaff staff) {
    ApiService.selectBarista(staff);
    Navigator.pushReplacement(
      context,
      MaterialPageRoute(builder: (context) => const MainLayout()),
    );
  }

  @override
  Widget build(BuildContext context) {
    const green = Color(0xFF304A3A);
    return Scaffold(
      backgroundColor: const Color(0xFFF8F5EF),
      appBar: AppBar(
        backgroundColor: green,
        foregroundColor: Colors.white,
        title: const Text('Select Barista'),
        actions: [
          TextButton(
            onPressed: () {
              ApiService.logout();
              Navigator.pushReplacement(
                context,
                MaterialPageRoute(builder: (_) => const LoginPage()),
              );
            },
            child: const Text('Log out', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
      body: FutureBuilder<List<BaristaStaff>>(
        future: _staffFuture,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }

          final staff = snapshot.data ?? const <BaristaStaff>[];
          if (staff.isEmpty) {
            return const Center(
              child: Padding(
                padding: EdgeInsets.all(32),
                child: Text(
                  'No active baristas are available. Ask an administrator to add or activate a staff name.',
                ),
              ),
            );
          }

          return ListView.separated(
            padding: const EdgeInsets.all(24),
            itemCount: staff.length,
            separatorBuilder: (_, _) => const SizedBox(height: 12),
            itemBuilder: (context, index) {
              final member = staff[index];
              return FilledButton.tonalIcon(
                onPressed: () => _startShift(member),
                icon: CircleAvatar(
                  backgroundColor: green,
                  foregroundColor: Colors.white,
                  child: Text(member.name.substring(0, 1).toUpperCase()),
                ),
                label: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  child: Align(
                    alignment: Alignment.centerLeft,
                    child: Text(
                      member.name,
                      style: const TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ),
              );
            },
          );
        },
      ),
    );
  }
}
