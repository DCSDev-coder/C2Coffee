import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../utils/app_colors.dart';

class AppTutorial {
  AppTutorial._();

  static const _version = 1;

  static String _preferenceKey(Object userId) =>
      'customer_tutorial_v${_version}_$userId';

  static Future<void> showIfNeeded(
    BuildContext context, {
    required Object userId,
  }) async {
    final preferences = await SharedPreferences.getInstance();
    if (preferences.getBool(_preferenceKey(userId)) == true ||
        !context.mounted) {
      return;
    }
    await show(context, userId: userId);
  }

  static Future<void> show(
    BuildContext context, {
    required Object userId,
  }) async {
    final completed = await showGeneralDialog<bool>(
      context: context,
      barrierDismissible: false,
      barrierLabel: 'App tutorial',
      barrierColor: Colors.black.withValues(alpha: 0.78),
      transitionDuration: const Duration(milliseconds: 250),
      pageBuilder: (_, __, ___) => const _TutorialDialog(),
      transitionBuilder: (_, animation, __, child) => FadeTransition(
        opacity: animation,
        child: ScaleTransition(
          scale: Tween<double>(begin: 0.96, end: 1).animate(animation),
          child: child,
        ),
      ),
    );
    if (completed == true) {
      final preferences = await SharedPreferences.getInstance();
      await preferences.setBool(_preferenceKey(userId), true);
    }
  }
}

class _TutorialStep {
  final IconData icon;
  final String title;
  final String description;

  const _TutorialStep(this.icon, this.title, this.description);
}

class _TutorialDialog extends StatefulWidget {
  const _TutorialDialog();

  @override
  State<_TutorialDialog> createState() => _TutorialDialogState();
}

class _TutorialDialogState extends State<_TutorialDialog> {
  static const _steps = [
    _TutorialStep(Icons.storefront_outlined, 'Choose your pickup outlet',
        'On Menu, tap the outlet name and arrow. The menu and pickup location update together.'),
    _TutorialStep(Icons.account_balance_wallet_outlined, 'Know your wallet',
        'Your token balance is shown on Home. Top up only through payment methods currently enabled by the cafe.'),
    _TutorialStep(Icons.local_cafe_outlined, 'Build your order',
        'Open Menu, choose an item, customize the available options, and add it to your bag.'),
    _TutorialStep(Icons.shopping_bag_outlined, 'Confirm pickup details',
        'Before placing an order, confirm the outlet, Store Pickup order type, items, vouchers, and token total.'),
    _TutorialStep(Icons.receipt_long_outlined, 'Follow order progress',
        'Orders shows each status from payment through preparation and collection. Show the order when collecting.'),
    _TutorialStep(Icons.card_giftcard_outlined, 'Use rewards safely',
        'Rewards and vouchers are linked to your account. Never share OTP codes or approve an unexpected payment.'),
  ];

  final PageController _controller = PageController();
  int _index = 0;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isLast = _index == _steps.length - 1;
    return SafeArea(
      child: Center(
        child: Material(
          color: Colors.transparent,
          child: Container(
            width: MediaQuery.sizeOf(context).width.clamp(0, 430).toDouble(),
            margin: const EdgeInsets.all(24),
            padding: const EdgeInsets.fromLTRB(24, 18, 24, 22),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(28),
              border: Border.all(
                  color: AppColors.secondary.withValues(alpha: 0.55)),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  children: [
                    Text('GUIDE ${_index + 1}/${_steps.length}',
                        style: TextStyle(
                            fontFamily: 'Afacad',
                            fontWeight: FontWeight.w700,
                            letterSpacing: 1.2,
                            color: AppColors.deepTeal)),
                    const Spacer(),
                    TextButton(
                      onPressed: () => Navigator.pop(context, true),
                      child: const Text('Skip'),
                    ),
                  ],
                ),
                SizedBox(
                  height: 300,
                  child: PageView.builder(
                    controller: _controller,
                    itemCount: _steps.length,
                    onPageChanged: (value) => setState(() => _index = value),
                    itemBuilder: (_, index) {
                      final item = _steps[index];
                      return Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Container(
                            width: 108,
                            height: 108,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: AppColors.secondary.withValues(alpha: 0.2),
                            ),
                            child: Icon(item.icon,
                                size: 52, color: AppColors.deepTeal),
                          ),
                          const SizedBox(height: 28),
                          Text(item.title,
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                  fontFamily: 'Recoleta',
                                  fontSize: 24,
                                  fontWeight: FontWeight.bold,
                                  color: AppColors.brandText)),
                          const SizedBox(height: 12),
                          Text(item.description,
                              textAlign: TextAlign.center,
                              style: const TextStyle(
                                  fontFamily: 'Afacad',
                                  fontSize: 16,
                                  height: 1.4,
                                  color: Colors.black54)),
                        ],
                      );
                    },
                  ),
                ),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: List.generate(
                    _steps.length,
                    (index) => AnimatedContainer(
                      duration: const Duration(milliseconds: 180),
                      width: index == _index ? 22 : 7,
                      height: 7,
                      margin: const EdgeInsets.symmetric(horizontal: 3),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(99),
                        color: index == _index
                            ? AppColors.secondary
                            : Colors.black12,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 22),
                FilledButton(
                  style: FilledButton.styleFrom(
                    minimumSize: const Size(double.infinity, 50),
                    backgroundColor: AppColors.deepTeal,
                  ),
                  onPressed: () {
                    if (isLast) {
                      Navigator.pop(context, true);
                    } else {
                      _controller.nextPage(
                          duration: const Duration(milliseconds: 240),
                          curve: Curves.easeOut);
                    }
                  },
                  child: Text(isLast ? 'Start ordering' : 'Next'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
