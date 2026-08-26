import 'package:flutter/material.dart';
import '../services/app_session_service.dart';
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
  int _selectedTier = 1;
  bool _isFaqsOpen = false;

  @override
  void initState() {
    super.initState();
    _syncTierFromSession();
    _session.addListener(_handleSessionChanged);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _session.loadAuthenticatedState();
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
    _selectedTier = _tierToIndex(_session.tier);
  }

  int _tierToIndex(String tier) {
    switch (tier.toLowerCase()) {
      case 'kawan':
        return 0;
      case 'dilamun':
        return 1;
      case 'ketagih':
        return 2;
      case 'legend':
        return 3;
      default:
        return 0;
    }
  }

  String _tierLabel(int index) {
    switch (index) {
      case 0:
        return 'Kawan';
      case 1:
        return 'Dilamun';
      case 2:
        return 'Ketagih';
      case 3:
        return 'Legend';
      default:
        return 'Kawan';
    }
  }

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
            _tierLabel(_tierToIndex(_session.tier)).toUpperCase(),
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
      onBack: () {}, showBackButton: false,
      backgroundColor: beigeBg,
      scrollController: _scrollController,
      bodyPadding: const EdgeInsets.only(bottom: 130),
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
                          value: (_session.cupsLast180d / _getMaxCupsForTier()).clamp(0.0, 1.0).toDouble(),
                          backgroundColor: Colors.grey[200],
                          valueColor: AlwaysStoppedAnimation<Color>(AppColors.deepTeal),
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
    switch (_tierToIndex(_session.tier)) {
      case 0:
        return 10; // Kawan -> Dilamun
      case 1:
        return 30; // Dilamun -> Ketagih
      case 2:
        return 50; // Ketagih -> Legend
      case 3:
        return 50; // Legend (max tier)
      default:
        return 10;
    }
  }

  String _getTierProgressLabel() {
    final currentTier = _tierToIndex(_session.tier);
    if (currentTier >= 3) {
      return 'Max tier reached';
    }

    final nextTier = _tierLabel(currentTier + 1);
    return '${_session.cupsLast180d} / ${_getMaxCupsForTier()} cups to $nextTier';
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

  Widget _buildTierSection() {
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
        const SizedBox(height: 16),
        // Tab Headers
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Row(
            children: [
              Expanded(child: _buildTierTab(0, 'Tier 1', 'Kawan', 0 > _tierToIndex(_session.tier))),
              Expanded(child: _buildTierTab(1, 'Tier 2', 'Dilamun', 1 > _tierToIndex(_session.tier))),
              Expanded(child: _buildTierTab(2, 'Tier 3', 'Ketagih', 2 > _tierToIndex(_session.tier))),
              Expanded(child: _buildTierTab(3, 'Tier 4', 'Legend', 3 > _tierToIndex(_session.tier))),
            ],
          ),
        ),
        // Tab Content
        Container(
          margin: const EdgeInsets.symmetric(horizontal: 20),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            border: Border.all(
              color: AppColors.border,
              width: 1,
            ),
            borderRadius: const BorderRadius.only(
              bottomLeft: Radius.circular(16),
              bottomRight: Radius.circular(16),
              topRight: Radius.circular(16),
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.03),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: AnimatedCrossFade(
            duration: const Duration(milliseconds: 280),
            sizeCurve: Curves.easeInOutCubic,
            firstCurve: Curves.easeIn,
            secondCurve: Curves.easeOut,
            crossFadeState: _selectedTier == 0
                ? CrossFadeState.showFirst
                : CrossFadeState.showSecond,
            firstChild: Column(
              key: const ValueKey('tier0'),
              mainAxisSize: MainAxisSize.min,
              children: [
                _buildRewardListItem(
                  'RM1 Off Every Order',
                  'Enjoy RM1 discount on all handcrafted drinks',
                  icon: Icons.local_offer_outlined,
                ),
                const Divider(height: 12),
                _buildRewardListItem(
                  '10 Bonus Tokens on Reload',
                  'Earn 10 bonus tokens when topping up your wallet',
                  icon: Icons.monetization_on_outlined,
                ),
                const Divider(height: 12),
                _buildRewardListItem(
                  'Complimentary Welcome Drink',
                  'Enjoy 1 free handcrafted beverage on your first visit',
                  icon: Icons.local_cafe_outlined,
                ),
              ],
            ),
            secondChild: AnimatedSwitcher(
              duration: const Duration(milliseconds: 250),
              child: _selectedTier == 1
                  ? Column(
                      key: const ValueKey('tier1'),
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        _buildRewardListItem(
                          'RM2 Off Every Order',
                          'Enjoy RM2 discount on all handcrafted drinks',
                          icon: Icons.local_offer_outlined,
                        ),
                        const Divider(height: 12),
                        _buildRewardListItem(
                          'Birthday Treat: 1 Free Drink',
                          '1 complimentary drink on your birthday (bring a friend)',
                          icon: Icons.cake_outlined,
                        ),
                        const Divider(height: 12),
                        _buildRewardListItem(
                          '1 Free Complimentary Drink',
                          '1 free handcrafted drink of your choice (any drink)',
                          icon: Icons.local_cafe_outlined,
                        ),
                        const Divider(height: 12),
                        _buildRewardListItem(
                          '5% Off Merchandise',
                          'Get 5% discount on official C² cups & merchandise',
                          icon: Icons.shopping_bag_outlined,
                        ),
                      ],
                    )
                  : _selectedTier == 2
                      ? Column(
                          key: const ValueKey('tier2'),
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            _buildRewardListItem(
                              'RM3 Off Every Order',
                              'Enjoy RM3 discount on all handcrafted drinks',
                              icon: Icons.local_offer_outlined,
                            ),
                            const Divider(height: 12),
                            _buildRewardListItem(
                              'Birthday Treat: 1 Free Drink',
                              '1 complimentary drink on your birthday (bring a friend)',
                              icon: Icons.cake_outlined,
                            ),
                            const Divider(height: 12),
                            _buildRewardListItem(
                              '1 Free Complimentary Drink',
                              '1 free handcrafted drink of your choice (any drink)',
                              icon: Icons.local_cafe_outlined,
                            ),
                            const Divider(height: 12),
                            _buildRewardListItem(
                              '10% Off Merchandise',
                              'Get 10% discount on all official C² merchandise',
                              icon: Icons.shopping_bag_outlined,
                            ),
                          ],
                        )
                      : Column(
                          key: const ValueKey('tier3'),
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            _buildRewardListItem(
                              'Complimentary C² Cup (Nude Colour)',
                              'Receive an exclusive official C² signature cup in nude colour',
                              icon: Icons.card_giftcard_outlined,
                            ),
                            const Divider(height: 12),
                            _buildRewardListItem(
                              'RM4 Off Every Order',
                              'Enjoy RM4 discount on all handcrafted drinks',
                              icon: Icons.local_offer_outlined,
                            ),
                            const Divider(height: 12),
                            _buildRewardListItem(
                              'Birthday Treat: 1 Free Drink',
                              '1 complimentary drink on your birthday (bring a friend)',
                              icon: Icons.cake_outlined,
                            ),
                            const Divider(height: 12),
                            _buildRewardListItem(
                              '1 Free Complimentary Drink',
                              '1 free handcrafted drink of your choice (any drink)',
                              icon: Icons.local_cafe_outlined,
                            ),
                            const Divider(height: 12),
                            _buildRewardListItem(
                              '20% Off Merchandise',
                              'Get 20% discount on all official C² merchandise',
                              icon: Icons.shopping_bag_outlined,
                            ),
                          ],
                        ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildTierTab(int index, String title, String subtitle, bool locked) {
    bool isSelected = index == _selectedTier;
    bool isCurrentActualTier = index == _tierToIndex(_session.tier);
    
    Color bgColor = locked
        ? AppColors.surfaceLight
        : (isSelected ? AppColors.surfaceLight : Colors.white);
    Color textColor = locked
        ? Colors.grey.shade400
        : (isSelected ? AppColors.gold : Colors.black87);

    return GestureDetector(
      onTap: () {
        if (!locked) {
          setState(() {
            _selectedTier = index;
          });
        }
      },
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Container(
            margin: const EdgeInsets.only(right: 1),
            padding: const EdgeInsets.symmetric(horizontal: 1, vertical: 12),
            decoration: BoxDecoration(
              color: bgColor,
              border: Border.all(
                color: isSelected ? AppColors.border : AppColors.surfaceLight,
                width: 1,
              ),
              borderRadius: const BorderRadius.only(
                topLeft: Radius.circular(16),
                topRight: Radius.circular(16),
              ),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                if (locked) Icon(Icons.lock, size: 12, color: textColor),
                if (locked) const SizedBox(width: 2),
                Flexible(
                  child: Column(
                    children: [
                      Text(
                        title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontFamily: 'Afacad',
                          fontSize: 12.5,
                          color: textColor,
                        ),
                      ),
                      Text(
                        subtitle,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontFamily: 'Recoleta',
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          color: textColor,
                        ),
                      ),
                    ],
                  ),
                ),
                if (locked) const SizedBox(width: 14),
              ],
            ),
          ),
          if (isCurrentActualTier)
            Positioned(
              top: -8,
              left: 0,
              right: 0,
              child: Center(
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: AppColors.deepTeal,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Text(
                    'Current',
                    style: TextStyle(
                      fontFamily: 'Afacad',
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildRewardListItem(String title, String subtitle,
      {IconData icon = Icons.coffee}) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () {
        _showRewardDetailDialog(title, subtitle, icon);
      },
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: AppColors.surfaceLight,
                shape: BoxShape.circle,
              ),
              child: icon == Icons.local_offer_outlined
                  ? Image.asset(
                      'assets/images/voucher.png',
                      width: 32,
                      height: 32,
                    )
                  : Icon(icon, color: AppColors.gold, size: 20),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      fontFamily: 'Afacad',
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                      color: AppColors.deepTeal,
                    ),
                  ),
                  if (subtitle.isNotEmpty)
                    Text(
                      subtitle,
                      style: TextStyle(
                        fontFamily: 'Afacad',
                        fontSize: 12,
                        color: Colors.grey.shade700,
                      ),
                    ),
                ],
              ),
            ),
            Icon(
              Icons.chevron_right,
              color: Colors.grey.shade400,
              size: 20,
            ),
          ],
        ),
      ),
    );
  }

  void _showRewardDetailDialog(String title, String subtitle, IconData icon) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => Padding(
        padding: EdgeInsets.only(
          top: 24,
          left: 24,
          right: 24,
          bottom: 24 + MediaQuery.paddingOf(context).bottom,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.surfaceLight,
                    shape: BoxShape.circle,
                  ),
                  child: icon == Icons.local_offer_outlined
                      ? Image.asset(
                          'assets/images/voucher.png',
                          width: 44,
                          height: 44,
                        )
                      : Icon(icon, color: orangeColor, size: 28),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Text(
                    title,
                    style: TextStyle(
                      fontFamily: 'Recoleta',
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: AppColors.deepTeal,
                    ),
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close, color: Colors.grey),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
            const SizedBox(height: 16),
            Text(
              subtitle,
              style: const TextStyle(
                fontFamily: 'Afacad',
                fontSize: 14,
                color: Colors.black87,
                height: 1.4,
              ),
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: () {
                Navigator.pop(context);
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.deepTeal,
                minimumSize: const Size(double.infinity, 48),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              child: const Text(
                'CLAIM REWARD NOW',
                style: TextStyle(
                  fontFamily: 'Afacad',
                  fontWeight: FontWeight.bold,
                  fontSize: 15,
                  color: Colors.white,
                ),
              ),
            ),
          ],
        ),
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
                  'Browse the menu, select your preferred drink, customize it to your liking, and tap Add to Cart. Proceed to checkout, choose your payment method, and confirm your order.',
                ),
                const Divider(height: 1),
                _buildExpansionTile(
                  'What is Barista Craft?',
                  'Barista Craft is our signature service where you can choose specific barista-level customizations for your handcrafted beverage.',
                ),
                const Divider(height: 1),
                _buildExpansionTile(
                  'How do I earn reward tokens & cups?',
                  'You earn 1 cup for every handcrafted beverage purchased. Collect enough cups to level up your tier (Kawan → Dilamun → Ketagih → Legend) and unlock exclusive benefits and vouchers!',
                ),
                const Divider(height: 1),
                _buildExpansionTile(
                  'Can I cancel my order?',
                  'Orders can be cancelled through the app within 2 minutes of placing them. After the barista begins brewing, cancellation is no longer possible.',
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
