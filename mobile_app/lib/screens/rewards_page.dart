import 'package:flutter/material.dart';
import '../services/app_session_service.dart';
import '../services/catalog_api_service.dart';
import '../widgets/custom_bottom_nav.dart';
import 'home_page.dart';
import 'menu_page.dart';
import 'orders_page.dart';
import 'profile_page.dart';
import 'loading_order_page.dart';
import 'referral_page.dart';
import 'dart:io';
import '../widgets/order_status_banner.dart';
import 'my_rewards_page.dart';
import '../utils/app_colors.dart';
import '../widgets/app_page_shell.dart';

class RewardsPage extends StatefulWidget {
  final File? initialPickedImage;
  final String? initialPresetPath;
  final int initialAvatarIndex;

  const RewardsPage({
    super.key,
    this.initialPickedImage,
    this.initialPresetPath,
    this.initialAvatarIndex = 0,
  });

  @override
  State<RewardsPage> createState() => _RewardsPageState();
}

class _RewardsPageState extends State<RewardsPage> {
  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();
  final AppSessionService _session = AppSessionService.instance;
  final ScrollController _scrollController = ScrollController();
  Color get orangeColor => AppColors.deepTeal;
  final Color beigeBg = Colors.white;
  int _selectedTier = 0;
  String? _selectedTierCode;
  bool _isFaqsOpen = false;

  List<LoyaltyTier> get _availableTiers {
    final tiers = _session.loyaltyTiers.where((tier) => tier.isActive).toList();
    tiers.sort((a, b) {
      final cupsComparison = a.minCups.compareTo(b.minCups);
      if (cupsComparison != 0) return cupsComparison;
      return a.sortOrder.compareTo(b.sortOrder);
    });
    return tiers;
  }

  @override
  void initState() {
    super.initState();
    _syncTierFromSession();
    _session.addListener(_handleSessionChanged);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _session.loadAuthenticatedState(force: true);
    });
  }

  @override
  void dispose() {
    _session.removeListener(_handleSessionChanged);
    _scrollController.dispose();
    super.dispose();
  }

  void _handleSessionChanged() {
    _syncTierFromSession();
    if (mounted) {
      setState(() {});
    }
  }

  void _syncTierFromSession() {
    final tiers = _availableTiers;
    if (tiers.isEmpty) {
      _selectedTier = 0;
      _selectedTierCode = null;
      return;
    }

    // Keep the tier the customer chose open while background data refreshes.
    // Fall back to the current tier only when the chosen tier no longer exists.
    if (_selectedTierCode != null) {
      final selectedIndex = tiers.indexWhere(
        (tier) => tier.code.trim().toLowerCase() == _selectedTierCode,
      );
      if (selectedIndex >= 0) {
        _selectedTier = selectedIndex;
        return;
      }
    }

    final currentTierIndex = _currentTierIndex();
    _selectedTier = currentTierIndex.clamp(0, tiers.length - 1);
    _selectedTierCode = tiers[_selectedTier].code.trim().toLowerCase();
  }

  int _currentTierIndex() {
    final tierCode = _session.tier.trim().toLowerCase();
    final index = _availableTiers.indexWhere(
      (tier) => tier.code.trim().toLowerCase() == tierCode,
    );
    return index >= 0 ? index : 0;
  }

  LoyaltyTier? _currentTier() {
    final tiers = _availableTiers;
    if (tiers.isEmpty) return null;
    final index = _currentTierIndex().clamp(0, tiers.length - 1);
    return tiers[index];
  }

  LoyaltyTier? _nextTier() {
    final tiers = _availableTiers;
    final currentIndex = _currentTierIndex();
    if (currentIndex < 0 || currentIndex + 1 >= tiers.length) {
      return null;
    }
    return tiers[currentIndex + 1];
  }

  int _progressTargetCups() {
    final nextTier = _nextTier();
    return nextTier?.minCups ?? _session.cupsLast180d;
  }

  String _currentTierLabel() => _currentTier()?.name ?? 'Member';

  void _onBottomNavTapped(int index) {
    if (index == 3) return;
    if (index == 0) {
      CustomBottomNav.switchTab(
        context,
        HomePage(
          initialPickedImage: widget.initialPickedImage,
          initialPresetPath: widget.initialPresetPath,
          initialAvatarIndex: widget.initialAvatarIndex,
        ),
      );
    } else if (index == 1) {
      CustomBottomNav.switchTab(context, const MenuPage());
    } else if (index == 2) {
      CustomBottomNav.switchTab(
        context,
        OrdersPage(
          initialPickedImage: widget.initialPickedImage,
          initialPresetPath: widget.initialPresetPath,
          initialAvatarIndex: widget.initialAvatarIndex,
        ),
      );
    } else if (index == 4) {
      CustomBottomNav.switchTab(
        context,
        ProfilePage(
          initialPickedImage: widget.initialPickedImage,
          initialPresetPath: widget.initialPresetPath,
          initialAvatarIndex: widget.initialAvatarIndex,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return AppPageShell(
      scaffoldKey: _scaffoldKey,
      endDrawer: _buildFaqsDrawer(),
      onEndDrawerChanged: (isOpen) {
        setState(() {
          _isFaqsOpen = isOpen;
        });
      },
      title: 'C2 COFFEE SQUAD',
      titleWidget: FittedBox(
          fit: BoxFit.scaleDown,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text(
                'C2 COFFEE SQUAD',
                style: TextStyle(
                  fontFamily: 'Recoleta',
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                  letterSpacing: 1.0,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                _currentTierLabel().toUpperCase(),
                style: const TextStyle(
                  fontFamily: 'Afacad',
                  fontSize: 14,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                  letterSpacing: 1.2,
                ),
              ),
            ],
          )),
      onBack: () {},
      showBackButton: false,
      backgroundColor: beigeBg,
      scrollController: _scrollController,
      bodyPadding: EdgeInsets.only(
        bottom: 180 + MediaQuery.paddingOf(context).bottom,
      ),
      bottomNavigationBar: CustomBottomNav(
        selectedIndex: 3,
        onItemTapped: _onBottomNavTapped,
        scrollController: _scrollController,
      ),
      extendBody: true,
      overlay: OrderStatusBanner(
        bottomOffset: 90 + MediaQuery.paddingOf(context).bottom,
      ),
      child: Column(
        children: [
          const SizedBox(height: 16),
          _buildPointsCard(),
          const SizedBox(height: 16),
          _buildActionCards(),
          const SizedBox(height: 24),
          _buildTierSection(),
          const SizedBox(height: 24),
          _buildFaqsCard(),
        ],
      ),
    );
  }

  Widget _buildPointsCard() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 20),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: AppColors.border,
          width: 1,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        children: [
          // Card image
          Center(
            child: ClipRRect(
              borderRadius: BorderRadius.circular(16),
              child: Image.asset(
                'assets/images/card.png',
                fit: BoxFit.contain,
                height: 240,
              ),
            ),
          ),
          const SizedBox(height: 24),
          // Tokens and Cups
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Tokens
              Expanded(
                child: Column(
                  children: [
                    Text(
                      '${_session.tokenBalance}',
                      style: TextStyle(
                        fontFamily: 'Recoleta',
                        fontSize: 32,
                        fontWeight: FontWeight.bold,
                        color: AppColors.softGold,
                        height: 1.1,
                      ),
                    ),
                    const Text(
                      'tokens',
                      style: TextStyle(
                        fontFamily: 'Afacad',
                        fontSize: 16,
                        color: Colors.black54,
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                width: 1,
                height: 50,
                color: AppColors.border,
              ),
              // Cups
              Expanded(
                child: Column(
                  children: [
                    Text(
                      '${_session.cupsLast180d}',
                      style: TextStyle(
                        fontFamily: 'Recoleta',
                        fontSize: 32,
                        fontWeight: FontWeight.bold,
                        color: AppColors.deepTeal,
                        height: 1.1,
                      ),
                    ),
                    const Text(
                      'cups collected',
                      style: TextStyle(
                        fontFamily: 'Afacad',
                        fontSize: 16,
                        color: Colors.black54,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      _getTierProgressLabel(),
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        fontFamily: 'Afacad',
                        fontSize: 11,
                        color: Colors.black45,
                        height: 1.1,
                      ),
                    ),
                    const SizedBox(height: 8),
                    // Progress bar
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(4),
                        child: LinearProgressIndicator(
                          value: (_session.cupsLast180d /
                                  (_progressTargetCups() <= 0
                                      ? 1
                                      : _progressTargetCups()))
                              .clamp(0.0, 1.0)
                              .toDouble(),
                          backgroundColor: Colors.grey[200],
                          valueColor:
                              AlwaysStoppedAnimation<Color>(AppColors.deepTeal),
                          minHeight: 8,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Text(
            _session.bootstrapError ??
                "*Promo or free drinks don't earn cups and don't count toward rewards or tier upgrades.",
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontFamily: 'Afacad',
              fontSize: 10,
              color: Colors.black54,
            ),
          ),
        ],
      ),
    );
  }

  int _getMaxCupsForTier() {
    return _progressTargetCups();
  }

  String _getTierProgressLabel() {
    final nextTier = _nextTier();
    if (nextTier == null) {
      return 'Max tier reached';
    }

    return '${_session.cupsLast180d} / ${_getMaxCupsForTier()} cups to ${nextTier.name}';
  }

  Widget _buildActionCards() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Row(
        children: [
          Expanded(
            child: GestureDetector(
              onTap: () {
                InteractiveFillingLoader.show(
                  context,
                  targetPage: const MyRewardsPage(),
                );
              },
              child: Container(
                height: 120,
                decoration: BoxDecoration(
                  color: AppColors.surfaceLight,
                  borderRadius: BorderRadius.circular(16),
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
                child: Stack(
                  children: [
                    Positioned(
                      top: 12,
                      left: 0,
                      right: 0,
                      child: Text(
                        'My Rewards',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontFamily: 'Recoleta',
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: AppColors.deepTeal,
                        ),
                      ),
                    ),
                    Positioned(
                      top: 40,
                      bottom: 2,
                      left: 4,
                      right: 4,
                      child: Transform.scale(
                        scale: 1.35,
                        child: Image.asset(
                          'assets/images/Surprise reward gift box with star popping out.png',
                          fit: BoxFit.contain,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: GestureDetector(
              onTap: () {
                InteractiveFillingLoader.show(
                  context,
                  targetPage: const ReferralPage(),
                );
              },
              child: Container(
                height: 120,
                decoration: BoxDecoration(
                  color: AppColors.surfaceLight,
                  borderRadius: BorderRadius.circular(16),
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
                child: Stack(
                  children: [
                    Positioned(
                      top: 12,
                      left: 0,
                      right: 0,
                      child: Text(
                        'Refer a Friend',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontFamily: 'Recoleta',
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: AppColors.deepTeal,
                        ),
                      ),
                    ),
                    Positioned(
                      top: 40,
                      bottom: 2,
                      left: 4,
                      right: 4,
                      child: Transform.scale(
                        scale: 1.35,
                        child: Image.asset(
                          'assets/images/Community friends laughing together waving hands and giving thumbs.png',
                          fit: BoxFit.contain,
                        ),
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

  List<String> _getTierDetails(LoyaltyTier tier) {
    return tier.tierRewards
        .map((reward) => '${reward.name}: ${reward.benefitLabel}')
        .toList();
  }

  Widget _buildTierProgress({
    required LoyaltyTier tier,
    required int selectedIndex,
    required int currentIndex,
  }) {
    final cups = _session.cupsLast180d;
    final nextTier = _nextTier();
    final targetCups = tier.minCups == 0
        ? 1
        : selectedIndex == currentIndex && nextTier != null
            ? nextTier.minCups
            : tier.minCups;
    final collectedCups =
        selectedIndex < currentIndex ? targetCups : cups.clamp(0, targetCups);

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.surfaceLight,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Center(
        child: Text(
          '$collectedCups / $targetCups cups collected',
          style: TextStyle(
            fontFamily: 'Afacad',
            fontSize: 15,
            fontWeight: FontWeight.bold,
            color: AppColors.deepTeal,
          ),
        ),
      ),
    );
  }

  Widget _buildTierSection() {
    final tiers = _availableTiers;
    if (tiers.isEmpty) {
      return Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20),
        child: Text(
          _session.isBootstrapLoading
              ? 'Loading your tier progress...'
              : 'Tier details are not available right now.',
          style: const TextStyle(
            fontFamily: 'Afacad',
            fontSize: 15,
            color: Colors.black54,
          ),
        ),
      );
    }

    final selectedIndex = _selectedTier.clamp(0, tiers.length - 1);
    final selectedTier = tiers[selectedIndex];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Row(
            children: [
              Text(
                'Tier',
                style: TextStyle(
                  fontFamily: 'Recoleta',
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                  color: AppColors.deepTeal,
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Container(
                  height: 1,
                  color: AppColors.border,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        // Pill Buttons Row (Top - Separated)
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Row(
            children: List.generate(tiers.length, (index) {
              final tier = tiers[index];
              return Padding(
                padding: const EdgeInsets.only(right: 8),
                child: _buildTierPill(
                  index,
                  tier,
                  selectedIndex,
                ),
              );
            }),
          ),
        ),
        const SizedBox(height: 14),
        // Information Card (Bottom - Separated)
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: AnimatedSwitcher(
            duration: const Duration(milliseconds: 240),
            switchInCurve: Curves.easeOutCubic,
            switchOutCurve: Curves.easeInCubic,
            child: _buildTierStateContent(
              selectedTier,
              key: ValueKey('tier-${selectedTier.code}'),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildTierPill(int index, LoyaltyTier tier, int selectedIndex) {
    final isSelected = index == selectedIndex;
    final isCurrentActualTier = index == _currentTierIndex();

    // Darker background for current actual tier, subtle tint/white for others
    final Color bgColor = isCurrentActualTier
        ? const Color(0xFFD5E6E3)
        : (isSelected ? AppColors.surfaceLight : Colors.white);

    // Darker rich gold for active/selected tab font
    const Color darkGold = Color(0xFFAD6D15);

    final Color textColor = isSelected ? darkGold : AppColors.textDark;

    return GestureDetector(
      onTap: () {
        setState(() {
          _selectedTier = index;
          _selectedTierCode = tier.code.trim().toLowerCase();
        });
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
        decoration: BoxDecoration(
          color: bgColor,
          borderRadius: BorderRadius.circular(24),
          border: Border.all(
            color: isSelected
                ? const Color(0xFFAD6D15)
                : (isCurrentActualTier
                    ? AppColors.sageTeal
                    : const Color(0xFFE2EBE9)),
            width: isSelected ? 1.5 : 1,
          ),
          boxShadow: [
            if (isSelected)
              BoxShadow(
                color: const Color(0xFFAD6D15).withValues(alpha: 0.12),
                blurRadius: 6,
                offset: const Offset(0, 2),
              ),
          ],
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (isCurrentActualTier) ...[
              Container(
                width: 6,
                height: 6,
                decoration: BoxDecoration(
                  color: AppColors.deepTeal,
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: 6),
            ],
            Text(
              tier.name,
              style: TextStyle(
                fontFamily: 'Recoleta',
                fontSize: 14,
                fontWeight: isSelected ? FontWeight.bold : FontWeight.w600,
                color: textColor,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTierStateContent(LoyaltyTier tier, {Key? key}) {
    final currentIndex = _currentTierIndex();
    final selectedIndex = _selectedTier;
    final isCurrent = selectedIndex == currentIndex;
    final isUnlocked = selectedIndex < currentIndex;
    final details = _getTierDetails(tier);

    return Container(
      key: key,
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.border, width: 1),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    tier.name,
                    style: TextStyle(
                      fontFamily: 'Recoleta',
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: AppColors.deepTeal,
                    ),
                  ),
                ],
              ),
              if (isCurrent)
                _buildStateChip(
                  'CURRENT TIER',
                  AppColors.deepTeal,
                  icon: Icons.check_circle_rounded,
                )
              else if (isUnlocked)
                _buildStateChip(
                  'UNLOCKED',
                  AppColors.sageTeal,
                )
              else
                _buildStateChip(
                  tier.minCups - _session.cupsLast180d > 0
                      ? '${tier.minCups - _session.cupsLast180d} CUPS TO UNLOCK'
                      : 'LOCKED',
                  const Color(0xFFAD6D15),
                  icon: Icons.lock_outline_rounded,
                ),
            ],
          ),
          const SizedBox(height: 14),
          Container(
            height: 1,
            color: AppColors.surfaceLight,
          ),
          const SizedBox(height: 14),
          _buildTierProgress(
            tier: tier,
            selectedIndex: selectedIndex,
            currentIndex: currentIndex,
          ),
          if (details.isNotEmpty) ...[
            const SizedBox(height: 18),
            Text(
              'Vouchers',
              style: TextStyle(
                fontFamily: 'Recoleta',
                fontSize: 15,
                fontWeight: FontWeight.bold,
                color: AppColors.textDark,
              ),
            ),
            const SizedBox(height: 10),
          ],
          ...details.map(
            (detail) => Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    margin: const EdgeInsets.only(top: 2),
                    padding: const EdgeInsets.all(3),
                    decoration: BoxDecoration(
                      color: const Color(0xFFAD6D15).withValues(alpha: 0.12),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.check_rounded,
                      size: 12,
                      color: Color(0xFFAD6D15),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      detail,
                      style: const TextStyle(
                        fontFamily: 'Afacad',
                        fontSize: 14,
                        fontWeight: FontWeight.w500,
                        color: Colors.black87,
                        height: 1.3,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStateChip(String label, Color color, {IconData? icon}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 13, color: color),
            const SizedBox(width: 4),
          ],
          Text(
            label,
            style: TextStyle(
              fontFamily: 'Afacad',
              fontSize: 11,
              fontWeight: FontWeight.bold,
              color: color,
              letterSpacing: 0.4,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFaqsCard() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: GestureDetector(
        onTap: () {
          _scaffoldKey.currentState?.openEndDrawer();
        },
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: AppColors.border,
              width: 1,
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.03),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.surfaceLight,
                  shape: BoxShape.circle,
                ),
                child: Icon(Icons.help_outline, color: orangeColor, size: 24),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'FAQS',
                      style: TextStyle(
                        fontFamily: 'Recoleta',
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        color: AppColors.deepTeal,
                      ),
                    ),
                    const Text(
                      'Learn how it works',
                      style: TextStyle(
                        fontFamily: 'Afacad',
                        fontSize: 12,
                        color: Colors.grey,
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: AppColors.surfaceLight,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(
                    color: AppColors.border,
                    width: 1,
                  ),
                ),
                child: AnimatedRotation(
                  turns: _isFaqsOpen ? 0.25 : 0,
                  duration: const Duration(milliseconds: 300),
                  child: Icon(Icons.chevron_right,
                      color: AppColors.deepTeal, size: 20),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildFaqsDrawer() {
    return Drawer(
      backgroundColor: Colors.white,
      width: MediaQuery.of(context).size.width * 0.85,
      child: Column(
        children: [
          // Header
          Padding(
            padding:
                const EdgeInsets.only(top: 60, left: 20, right: 20, bottom: 20),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: orangeColor.withValues(alpha: 0.1),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(Icons.help_outline, color: orangeColor, size: 24),
                ),
                const SizedBox(width: 16),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'FAQS',
                      style: TextStyle(
                        fontFamily: 'Recoleta',
                        fontSize: 24,
                        fontWeight: FontWeight.bold,
                        color: AppColors.deepTeal,
                      ),
                    ),
                    const Text(
                      'Learn how it works',
                      style: TextStyle(
                        fontFamily: 'Afacad',
                        fontSize: 14,
                        color: Colors.grey,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const Divider(height: 1),
          // Questions
          Expanded(
            child: ListView(
              padding: const EdgeInsets.only(bottom: 60),
              children: [
                _buildExpansionTile(
                  'How do I place an order?',
                  'Browse the menu, select your preferred drink, customize it to your liking, and tap Add to Cart. Proceed to checkout and confirm your order using C2 Tokens.',
                ),
                const Divider(height: 1),
                _buildExpansionTile(
                  'What is Barista Craft?',
                  'Barista Craft is our signature service where you can choose specific barista-level customizations for your handcrafted beverage.',
                ),
                const Divider(height: 1),
                _buildExpansionTile(
                  'How do I earn reward tokens & cups?',
                  'You earn 1 cup for every qualifying handcrafted beverage collected. Collect enough cups to level up your tier (Kawan → Dilamun → Ketagih → Legend) and unlock exclusive benefits and vouchers!',
                ),
                const Divider(height: 1),
                _buildExpansionTile(
                  'Can I cancel my order?',
                  'You can edit your cart before checkout. Once an order is submitted to the store queue, customer self-cancellation is not available in the app. Contact support if you need help with an order.',
                ),
                const Divider(height: 1),
                _buildExpansionTile(
                  'What is the order pickup lead time?',
                  'Standard pickup preparation lead time is approximately 15 minutes. Uncollected orders will be held safely before disposal according to food safety standards.',
                ),
                const Divider(height: 1),
                _buildExpansionTile(
                  'Are C2 Tokens refundable or transferable?',
                  'Per Section 5 of our Terms & Conditions, C2 Token is a closed-loop prepaid balance intended strictly for store purchases. Tokens cannot be exchanged for cash or transferred between accounts, and top-ups are non-refundable except for verified technical billing errors.',
                ),
                const Divider(height: 1),
                _buildExpansionTile(
                  'How do I submit a billing or payment claim?',
                  'As stated in Section 8.3 of our Terms & Conditions, billing and payment discrepancy claims must be submitted to C2 Support with your transaction reference within fourteen (14) days of the transaction date.',
                ),
                const Divider(height: 1),
              ],
            ),
          ),
          const SizedBox(height: 20),
        ],
      ),
    );
  }

  Widget _buildExpansionTile(String title, String content) {
    return Theme(
      data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
      child: ExpansionTile(
        title: Text(
          title,
          style: const TextStyle(
            fontFamily: 'Afacad',
            fontSize: 14,
            fontWeight: FontWeight.bold,
            color: Colors.black87,
          ),
        ),
        iconColor: Colors.black87,
        collapsedIconColor: Colors.black87,
        childrenPadding: const EdgeInsets.only(left: 16, right: 16, bottom: 16),
        expandedAlignment: Alignment.centerLeft,
        children: [
          Text(
            content,
            style: const TextStyle(
              fontFamily: 'Afacad',
              fontSize: 12,
              color: Colors.black54,
              height: 1.4,
            ),
          ),
        ],
      ),
    );
  }
}
