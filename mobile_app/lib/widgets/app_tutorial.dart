import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../utils/app_colors.dart';

class AppTutorial {
  AppTutorial._();

  static const _version = 2;
  static bool _replayRequested = false;
  static bool _walletReplayRequested = false;

  static final GlobalKey walletKey = GlobalKey(debugLabel: 'tutorial-wallet');
  static final GlobalKey walletBalanceKey =
      GlobalKey(debugLabel: 'tutorial-wallet-balance');
  static final GlobalKey walletPackagesKey =
      GlobalKey(debugLabel: 'tutorial-wallet-packages');
  static final GlobalKey walletPaymentKey =
      GlobalKey(debugLabel: 'tutorial-wallet-payment');
  static final GlobalKey walletHistoryKey =
      GlobalKey(debugLabel: 'tutorial-wallet-history');
  static final List<GlobalKey> bottomNavKeys = List<GlobalKey>.generate(
    5,
    (index) => GlobalKey(debugLabel: 'tutorial-nav-$index'),
  );

  static void requestReplay() => _replayRequested = true;

  static void requestWalletReplay() => _walletReplayRequested = true;

  static bool consumeReplayRequest() {
    final requested = _replayRequested;
    _replayRequested = false;
    return requested;
  }

  static bool consumeWalletReplayRequest() {
    final requested = _walletReplayRequested;
    _walletReplayRequested = false;
    return requested;
  }

  static String _preferenceKey(Object userId) =>
      'customer_tutorial_v${_version}_$userId';

  static String _walletPreferenceKey(Object userId) =>
      'customer_wallet_tutorial_v1_$userId';

  static List<_TutorialStep> get _homeSteps => [
        _TutorialStep(
          targetKey: walletKey,
          icon: Icons.account_balance_wallet_outlined,
          eyebrow: 'YOUR BALANCE',
          title: 'Tokens at a glance',
          description:
              'Your available tokens are always shown here. Tap this wallet to view top-up options and transaction details.',
        ),
        _TutorialStep(
          targetKey: bottomNavKeys[1],
          icon: Icons.local_cafe_outlined,
          eyebrow: 'START HERE',
          title: 'Choose an outlet and order',
          description:
              'Open Menu, then tap the outlet name at the top to choose your pickup location. Select a drink, review every required option, and add it to your bag.',
        ),
        _TutorialStep(
          targetKey: bottomNavKeys[2],
          icon: Icons.receipt_long_outlined,
          eyebrow: 'LIVE UPDATES',
          title: 'Follow your order',
          description:
              'Orders keeps your receipts and live status in one place, from payment confirmation through brewing and ready for pickup.',
        ),
        _TutorialStep(
          targetKey: bottomNavKeys[3],
          icon: Icons.card_giftcard_outlined,
          eyebrow: 'LOYALTY',
          title: 'Check rewards and vouchers',
          description:
              'See your tier progress, available rewards, and voucher benefits here. Eligibility is confirmed again during checkout.',
        ),
        _TutorialStep(
          targetKey: bottomNavKeys[4],
          icon: Icons.person_outline_rounded,
          eyebrow: 'YOUR ACCOUNT',
          title: 'Manage your preferences',
          description:
              'Update your profile, notification preferences, support details, and replay this tutorial whenever you need it.',
        ),
      ];

  static List<_TutorialStep> get _walletSteps => [
        _TutorialStep(
          targetKey: walletBalanceKey,
          icon: Icons.account_balance_wallet_outlined,
          eyebrow: 'WALLET SUMMARY',
          title: 'Know what you can spend',
          description:
              'This card shows your available tokens, tokens reserved by pending orders, and the maximum balance your wallet can hold.',
        ),
        _TutorialStep(
          targetKey: walletPackagesKey,
          icon: Icons.add_circle_outline_rounded,
          eyebrow: 'TOP-UP AMOUNT',
          title: 'Choose a token package',
          description:
              'Select how many tokens you want to add. One C2 Token equals RM 1, and the exact charge is shown before payment.',
        ),
        _TutorialStep(
          targetKey: walletPaymentKey,
          icon: Icons.verified_user_outlined,
          eyebrow: 'SECURE PAYMENT',
          title: 'Confirm how you will pay',
          description:
              'Choose an available payment method and review the amount. Tokens are credited only after the payment provider confirms payment.',
        ),
        _TutorialStep(
          targetKey: walletHistoryKey,
          icon: Icons.history_rounded,
          eyebrow: 'ACTIVITY',
          title: 'Review every token movement',
          description:
              'Use these filters to check all, incoming, or outgoing transactions. Each entry shows the amount, reason, date, and resulting balance.',
        ),
      ];

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
    final completed = await _showSteps(context, _homeSteps);
    if (completed == true) {
      final preferences = await SharedPreferences.getInstance();
      await preferences.setBool(_preferenceKey(userId), true);
    }
  }

  static Future<void> showWalletIfNeeded(
    BuildContext context, {
    required Object userId,
  }) async {
    final preferences = await SharedPreferences.getInstance();
    if (preferences.getBool(_walletPreferenceKey(userId)) == true ||
        !context.mounted) {
      return;
    }
    final completed = await _showSteps(context, _walletSteps);
    if (completed == true) {
      await preferences.setBool(_walletPreferenceKey(userId), true);
    }
  }

  static Future<void> showWallet(
    BuildContext context, {
    required Object userId,
  }) async {
    final completed = await _showSteps(context, _walletSteps);
    if (completed == true) {
      final preferences = await SharedPreferences.getInstance();
      await preferences.setBool(_walletPreferenceKey(userId), true);
    }
  }

  static Future<bool?> _showSteps(
    BuildContext context,
    List<_TutorialStep> steps,
  ) {
    return showGeneralDialog<bool>(
      context: context,
      barrierDismissible: false,
      barrierLabel: 'App tutorial',
      barrierColor: Colors.transparent,
      transitionDuration: const Duration(milliseconds: 220),
      pageBuilder: (_, __, ___) => _TutorialSpotlight(steps: steps),
      transitionBuilder: (_, animation, __, child) => FadeTransition(
        opacity: animation,
        child: child,
      ),
    );
  }
}

class _TutorialStep {
  final GlobalKey targetKey;
  final IconData icon;
  final String eyebrow;
  final String title;
  final String description;

  const _TutorialStep({
    required this.targetKey,
    required this.icon,
    required this.eyebrow,
    required this.title,
    required this.description,
  });
}

class _TutorialSpotlight extends StatefulWidget {
  final List<_TutorialStep> steps;

  const _TutorialSpotlight({required this.steps});

  @override
  State<_TutorialSpotlight> createState() => _TutorialSpotlightState();
}

class _TutorialSpotlightState extends State<_TutorialSpotlight> {
  int _index = 0;
  Rect? _targetRect;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _updateTarget());
  }

  Future<void> _updateTarget() async {
    if (!mounted) return;
    final targetContext = widget.steps[_index].targetKey.currentContext;
    if (targetContext != null) {
      await Scrollable.ensureVisible(
        targetContext,
        duration: const Duration(milliseconds: 320),
        curve: Curves.easeOutCubic,
        alignment: 0.35,
      );
    }
    if (!mounted) return;
    final renderBox = targetContext?.findRenderObject();
    if (renderBox is RenderBox && renderBox.hasSize) {
      final origin = renderBox.localToGlobal(Offset.zero);
      setState(() => _targetRect = (origin & renderBox.size).inflate(8));
    } else {
      setState(() => _targetRect = null);
    }
  }

  void _goTo(int index) {
    setState(() {
      _index = index;
      _targetRect = null;
    });
    WidgetsBinding.instance.addPostFrameCallback((_) => _updateTarget());
  }

  @override
  Widget build(BuildContext context) {
    final step = widget.steps[_index];
    final media = MediaQuery.of(context);
    final size = media.size;
    final target = _targetRect;
    final targetIsLow = target != null && target.center.dy > size.height * 0.55;
    final cardTop = targetIsLow
        ? media.padding.top + 28
        : ((target?.bottom ?? size.height * 0.22) + 24)
            .clamp(media.padding.top + 28, size.height - 350.0)
            .toDouble();
    final isLast = _index == widget.steps.length - 1;

    return Material(
      color: Colors.transparent,
      child: Stack(
        children: [
          Positioned.fill(
            child: CustomPaint(painter: _SpotlightPainter(target)),
          ),
          if (target != null)
            Positioned.fromRect(
              rect: target,
              child: IgnorePointer(
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(24),
                    border: Border.all(color: AppColors.secondary, width: 3),
                    boxShadow: [
                      BoxShadow(
                        color: AppColors.secondary.withValues(alpha: 0.42),
                        blurRadius: 20,
                        spreadRadius: 2,
                      ),
                    ],
                  ),
                ),
              ),
            ),
          Positioned(
            top: cardTop,
            left: 20,
            right: 20,
            child: SafeArea(
              top: false,
              bottom: false,
              child: _TutorialCard(
                step: step,
                index: _index,
                count: widget.steps.length,
                isLast: isLast,
                onSkip: () => Navigator.pop(context, true),
                onBack: _index == 0 ? null : () => _goTo(_index - 1),
                onNext: () {
                  if (isLast) {
                    Navigator.pop(context, true);
                  } else {
                    _goTo(_index + 1);
                  }
                },
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _TutorialCard extends StatelessWidget {
  final _TutorialStep step;
  final int index;
  final int count;
  final bool isLast;
  final VoidCallback onSkip;
  final VoidCallback? onBack;
  final VoidCallback onNext;

  const _TutorialCard({
    required this.step,
    required this.index,
    required this.count,
    required this.isLast,
    required this.onSkip,
    required this.onBack,
    required this.onNext,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: const BoxConstraints(maxWidth: 430),
      padding: const EdgeInsets.fromLTRB(22, 18, 22, 20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(26),
        border: Border.all(
          color: AppColors.secondary.withValues(alpha: 0.55),
        ),
        boxShadow: const [
          BoxShadow(
            color: Color(0x33000000),
            blurRadius: 28,
            offset: Offset(0, 12),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: AppColors.secondary.withValues(alpha: 0.18),
                  shape: BoxShape.circle,
                ),
                child: Icon(step.icon, color: AppColors.deepTeal, size: 23),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      step.eyebrow,
                      style: TextStyle(
                        fontFamily: 'Afacad',
                        color: AppColors.deepTeal,
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 1.3,
                      ),
                    ),
                    Text(
                      'STEP ${index + 1} OF $count',
                      style: const TextStyle(
                        fontFamily: 'Afacad',
                        color: Colors.black45,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
              TextButton(onPressed: onSkip, child: const Text('Skip')),
            ],
          ),
          const SizedBox(height: 16),
          Text(
            step.title,
            style: TextStyle(
              fontFamily: 'Recoleta',
              fontSize: 24,
              fontWeight: FontWeight.bold,
              color: AppColors.brandText,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            step.description,
            style: const TextStyle(
              fontFamily: 'Afacad',
              fontSize: 17,
              height: 1.38,
              color: Colors.black87,
            ),
          ),
          const SizedBox(height: 20),
          Row(
            children: [
              if (onBack != null)
                TextButton.icon(
                  onPressed: onBack,
                  icon: const Icon(Icons.arrow_back_rounded, size: 18),
                  label: const Text('Back'),
                )
              else
                const Spacer(),
              if (onBack != null) const Spacer(),
              FilledButton.icon(
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.deepTeal,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 20,
                    vertical: 13,
                  ),
                ),
                onPressed: onNext,
                icon: Icon(
                  isLast ? Icons.check_rounded : Icons.arrow_forward_rounded,
                  size: 19,
                ),
                label: Text(isLast ? 'Got it' : 'Next'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _SpotlightPainter extends CustomPainter {
  final Rect? target;

  const _SpotlightPainter(this.target);

  @override
  void paint(Canvas canvas, Size size) {
    final path = Path()..addRect(Offset.zero & size);
    if (target != null) {
      path.addRRect(
          RRect.fromRectAndRadius(target!, const Radius.circular(24)));
      path.fillType = PathFillType.evenOdd;
    }
    canvas.drawPath(
      path,
      Paint()..color = Colors.black.withValues(alpha: 0.78),
    );
  }

  @override
  bool shouldRepaint(covariant _SpotlightPainter oldDelegate) =>
      oldDelegate.target != target;
}
