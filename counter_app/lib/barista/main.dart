import 'dart:ui';
import 'package:counter_app/widgets/top_notice.dart';
import 'package:flutter/material.dart';
import 'screens/main_layout.dart';
import 'widgets/order_card.dart';
import 'services/api_service.dart';
import 'services/push_notification_service.dart';

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

final ValueNotifier<WorkstationAccessState?> globalWorkstationAccess =
    ValueNotifier<WorkstationAccessState?>(null);

class BaristaWorkspace extends StatefulWidget {
  const BaristaWorkspace({super.key, this.onExitRequested});

  final Future<bool> Function()? onExitRequested;

  @override
  State<BaristaWorkspace> createState() => _BaristaWorkspaceState();
}

class _BaristaWorkspaceState extends State<BaristaWorkspace> {
  bool _restoring = true;
  bool _signedIn = false;

  @override
  void initState() {
    super.initState();
    _restoreSession();
  }

  Future<void> _restoreSession() async {
    await ApiService.restoreSession();
    if (!mounted) return;
    setState(() {
      _signedIn = ApiService.isSignedIn;
      _restoring = false;
    });
  }

  Future<void> _requestExit() async {
    final allowed = await widget.onExitRequested?.call() ?? true;
    if (allowed && mounted) Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    late final Widget content;
    if (_restoring) {
      content = const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    } else if (_signedIn) {
      content = MainLayout(
        onSignedOut: () {
          if (mounted) setState(() => _signedIn = false);
        },
      );
    } else {
      content = LoginPage(
        onSignedIn: () {
          if (mounted) setState(() => _signedIn = true);
        },
        onBack: _requestExit,
      );
    }

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _requestExit();
      },
      child: content,
    );
  }
}

class LoginPage extends StatefulWidget {
  const LoginPage({super.key, required this.onSignedIn, required this.onBack});

  final VoidCallback onSignedIn;
  final Future<void> Function() onBack;

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final TextEditingController _usernameController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();
  bool _isPasswordVisible = false;
  bool _isSubmitting = false;

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

          SafeArea(
            child: Align(
              alignment: Alignment.topLeft,
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: IconButton.filledTonal(
                  tooltip: 'Back to workspaces',
                  onPressed: () => widget.onBack(),
                  icon: const Icon(Icons.arrow_back_rounded),
                ),
              ),
            ),
          ),

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
                                  onPressed: _isSubmitting
                                      ? null
                                      : () async {
                                          final username = _usernameController
                                              .text
                                              .trim();
                                          final password = _passwordController
                                              .text
                                              .trim();

                                          if (username.isEmpty ||
                                              password.isEmpty) {
                                            TopNotice.error(
                                              context,
                                              'Please enter both username and password.',
                                            );
                                            return;
                                          }

                                          setState(() => _isSubmitting = true);
                                          final result = await ApiService.login(
                                            username,
                                            password,
                                          );
                                          if (!result.isSuccess) {
                                            if (!context.mounted) return;
                                            TopNotice.error(
                                              context,
                                              result.errorMessage ??
                                                  'Unable to sign in. Please try again.',
                                            );
                                            setState(
                                              () => _isSubmitting = false,
                                            );
                                            return;
                                          }

                                          try {
                                            await PushNotificationService
                                                .instance
                                                .syncAfterSignIn();
                                          } catch (error) {
                                            // A successful sign-in must not be held
                                            // hostage by optional push registration.
                                            debugPrint(
                                              'Push registration after sign-in failed: $error',
                                            );
                                          }

                                          if (!context.mounted) return;
                                          widget.onSignedIn();
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
                                  child: Row(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: _isSubmitting
                                        ? const [
                                            SizedBox(
                                              height: 20,
                                              width: 20,
                                              child: CircularProgressIndicator(
                                                strokeWidth: 2,
                                                color: Colors.white,
                                              ),
                                            ),
                                            SizedBox(width: 10),
                                            Text('Signing in...'),
                                          ]
                                        : const [
                                            Text(
                                              'Login',
                                              style: TextStyle(
                                                fontSize: 18,
                                                fontWeight: FontWeight.w600,
                                              ),
                                            ),
                                            SizedBox(width: 8),
                                            Icon(
                                              Icons.arrow_right_alt,
                                              size: 24,
                                            ),
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
