import 'package:flutter/material.dart';

import '../utils/app_colors.dart';
import '../widgets/app_page_shell.dart';
import '../widgets/app_tutorial.dart';
import 'home_page.dart';
import 'top_up_wallet_page.dart';

class TutorialPage extends StatelessWidget {
  const TutorialPage({super.key});

  static const _guides = <_GuideSection>[
    _GuideSection(
      number: '01',
      icon: Icons.storefront_outlined,
      title: 'Choose your pickup outlet',
      description:
          'Open Menu and check the outlet shown at the top. Change it before ordering if you want to collect from another C2 Coffee outlet.',
      tip:
          'Availability, operating hours, and pickup are based on this outlet.',
    ),
    _GuideSection(
      number: '02',
      icon: Icons.local_cafe_outlined,
      title: 'Build your drink carefully',
      description:
          'Select a menu item and review every option group. Required groups marked “Pick 1 *” must be chosen before the item can be added to your bag.',
      tip: 'The app will highlight any required choice you missed.',
    ),
    _GuideSection(
      number: '03',
      icon: Icons.account_balance_wallet_outlined,
      title: 'Pay with C2 Tokens',
      description:
          'Orders use your prepaid C2 Token balance. One token equals RM 1. Top up from Wallet, choose a package and complete payment with an available method.',
      tip: 'Tokens appear only after the payment provider confirms the top-up.',
    ),
    _GuideSection(
      number: '04',
      icon: Icons.confirmation_number_outlined,
      title: 'Use vouchers and rewards',
      description:
          'Check Rewards for tier progress and available benefits. Apply an eligible voucher during checkout and complete OTP verification when requested.',
      tip: 'Eligibility and discount value are confirmed again before payment.',
    ),
    _GuideSection(
      number: '05',
      icon: Icons.receipt_long_outlined,
      title: 'Follow your order status',
      description:
          'Open Orders to see payment confirmation, store acceptance, brewing progress, and when your order is ready for pickup.',
      tip: 'Keep notifications enabled so you do not miss the ready alert.',
    ),
    _GuideSection(
      number: '06',
      icon: Icons.group_add_outlined,
      title: 'Invite friends responsibly',
      description:
          'Open My Referral to share your referral details. Any reward depends on the active campaign rules and successful qualifying activity.',
      tip:
          'Referral rewards are not issued for incomplete or ineligible activity.',
    ),
  ];

  void _replayHomeTour(BuildContext context) {
    AppTutorial.requestReplay();
    Navigator.pushAndRemoveUntil(
      context,
      MaterialPageRoute<void>(builder: (_) => const HomePage()),
      (route) => false,
    );
  }

  void _replayWalletTour(BuildContext context) {
    AppTutorial.requestWalletReplay();
    Navigator.push(
      context,
      MaterialPageRoute<void>(builder: (_) => const TopUpWalletPage()),
    );
  }

  @override
  Widget build(BuildContext context) {
    return AppPageShell(
      title: 'TUTORIAL',
      onBack: () => Navigator.pop(context),
      backgroundColor: const Color(0xFFF8FAF9),
      bodyPadding: const EdgeInsets.fromLTRB(20, 22, 20, 36),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _IntroCard(
            onReplayHome: () => _replayHomeTour(context),
            onReplayWallet: () => _replayWalletTour(context),
          ),
          const SizedBox(height: 28),
          Text(
            'How C2 Coffee works',
            style: TextStyle(
              fontFamily: 'Recoleta',
              fontSize: 25,
              fontWeight: FontWeight.bold,
              color: AppColors.textDark,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            'Follow these steps from choosing an outlet to collecting your order.',
            style: TextStyle(
              fontFamily: 'Afacad',
              fontSize: 16,
              height: 1.35,
              color: AppColors.textMuted,
            ),
          ),
          const SizedBox(height: 18),
          for (var index = 0; index < _guides.length; index++) ...[
            _GuideCard(section: _guides[index]),
            if (index < _guides.length - 1) const SizedBox(height: 14),
          ],
          const SizedBox(height: 24),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              color: AppColors.surfaceLight,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: AppColors.border),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(Icons.help_outline_rounded,
                    color: AppColors.deepTeal, size: 24),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    'Need help with an order, top-up, or account? Return to Settings and open Contact Support.',
                    style: TextStyle(
                      fontFamily: 'Afacad',
                      fontSize: 15,
                      height: 1.35,
                      color: AppColors.textDark,
                    ),
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

class _IntroCard extends StatelessWidget {
  final VoidCallback onReplayHome;
  final VoidCallback onReplayWallet;

  const _IntroCard({
    required this.onReplayHome,
    required this.onReplayWallet,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [AppColors.deepTeal, AppColors.secondary],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(22),
        boxShadow: [
          BoxShadow(
            color: AppColors.deepTeal.withValues(alpha: 0.18),
            blurRadius: 18,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.16),
              borderRadius: BorderRadius.circular(14),
            ),
            child: const Icon(Icons.auto_stories_outlined,
                color: Colors.white, size: 26),
          ),
          const SizedBox(height: 16),
          const Text(
            'Learn at your own pace',
            style: TextStyle(
              fontFamily: 'Recoleta',
              fontSize: 25,
              fontWeight: FontWeight.bold,
              color: Colors.white,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Read the full guide below or replay an interactive tour that highlights the important controls on screen.',
            style: TextStyle(
              fontFamily: 'Afacad',
              fontSize: 16,
              height: 1.35,
              color: Colors.white.withValues(alpha: 0.88),
            ),
          ),
          const SizedBox(height: 18),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              _TourButton(
                label: 'Replay Home Tour',
                icon: Icons.home_outlined,
                onPressed: onReplayHome,
                filled: true,
              ),
              _TourButton(
                label: 'Wallet Tour',
                icon: Icons.account_balance_wallet_outlined,
                onPressed: onReplayWallet,
                filled: false,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _TourButton extends StatelessWidget {
  final String label;
  final IconData icon;
  final VoidCallback onPressed;
  final bool filled;

  const _TourButton({
    required this.label,
    required this.icon,
    required this.onPressed,
    required this.filled,
  });

  @override
  Widget build(BuildContext context) {
    final foreground = filled ? AppColors.deepTeal : Colors.white;
    return OutlinedButton.icon(
      onPressed: onPressed,
      icon: Icon(icon, size: 18),
      label: Text(label),
      style: OutlinedButton.styleFrom(
        foregroundColor: foreground,
        backgroundColor: filled ? Colors.white : Colors.transparent,
        side: BorderSide(color: Colors.white.withValues(alpha: 0.72)),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        textStyle: const TextStyle(
          fontFamily: 'Afacad',
          fontSize: 15,
          fontWeight: FontWeight.w600,
        ),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      ),
    );
  }
}

class _GuideCard extends StatelessWidget {
  final _GuideSection section;

  const _GuideCard({required this.section});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.border),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.035),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: AppColors.surfaceLight,
                  borderRadius: BorderRadius.circular(15),
                ),
                child: Icon(section.icon, color: AppColors.deepTeal, size: 25),
              ),
              const SizedBox(width: 13),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'STEP ${section.number}',
                      style: TextStyle(
                        fontFamily: 'Afacad',
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 1.1,
                        color: AppColors.supportingText,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      section.title,
                      style: TextStyle(
                        fontFamily: 'Recoleta',
                        fontSize: 19,
                        fontWeight: FontWeight.bold,
                        color: AppColors.textDark,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Text(
            section.description,
            style: TextStyle(
              fontFamily: 'Afacad',
              fontSize: 16,
              height: 1.4,
              color: AppColors.textDark,
            ),
          ),
          const SizedBox(height: 13),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 11),
            decoration: BoxDecoration(
              color: AppColors.softGold.withValues(alpha: 0.13),
              borderRadius: BorderRadius.circular(13),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(Icons.lightbulb_outline_rounded,
                    color: AppColors.softGold, size: 19),
                const SizedBox(width: 9),
                Expanded(
                  child: Text(
                    section.tip,
                    style: TextStyle(
                      fontFamily: 'Afacad',
                      fontSize: 14,
                      height: 1.3,
                      color: AppColors.textDark,
                    ),
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

class _GuideSection {
  final String number;
  final IconData icon;
  final String title;
  final String description;
  final String tip;

  const _GuideSection({
    required this.number,
    required this.icon,
    required this.title,
    required this.description,
    required this.tip,
  });
}
