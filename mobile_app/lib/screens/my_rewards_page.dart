import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../services/app_session_service.dart';
import '../services/auth_api_service.dart';
import '../services/catalog_api_service.dart';
import '../services/customer_data_service.dart';
import '../services/secure_session_service.dart';
import '../services/voucher_intent_service.dart';
import '../utils/app_colors.dart';
import '../widgets/app_page_shell.dart';
import '../widgets/catalog_product_image.dart';
import '../widgets/custom_bottom_nav.dart';
import '../widgets/order_status_banner.dart';
import 'loading_order_page.dart';
import 'menu_page.dart';

enum _RewardFilter { all, available, history }

class MyRewardsPage extends StatefulWidget {
  final String? focusVoucherCode;

  const MyRewardsPage({super.key, this.focusVoucherCode});

  @override
  State<MyRewardsPage> createState() => _MyRewardsPageState();
}

class _MyRewardsPageState extends State<MyRewardsPage>
    with SingleTickerProviderStateMixin {
  static const int _initialVoucherLimit = 5;
  static const int _voucherPageStep = 5;

  final AppSessionService _session = AppSessionService.instance;
  final ScrollController _scrollController = ScrollController();
  late final AnimationController _cardCircleController = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 3600),
  )..repeat(reverse: true);

  bool _isRewardsLoading = true;
  String? _rewardsError;
  List<RewardVoucher> _vouchers = const [];
  List<TierRewardEntitlement> _claimableTierRewards = const [];
  final Set<int> _expandedVoucherIds = <int>{};
  _RewardFilter _selectedFilter = _RewardFilter.all;
  int _voucherDisplayLimit = _initialVoucherLimit;
  bool _showScrollToTop = false;

  @override
  void initState() {
    super.initState();
    _session.addListener(_handleSessionChanged);
    _scrollController.addListener(_handleScroll);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadRewards();
    });
  }

  @override
  void dispose() {
    _session.removeListener(_handleSessionChanged);
    _scrollController.removeListener(_handleScroll);
    _cardCircleController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _handleScroll() {
    final shouldShow =
        _scrollController.hasClients && _scrollController.offset > 300;
    if (shouldShow != _showScrollToTop && mounted) {
      setState(() => _showScrollToTop = shouldShow);
    }
  }

  Future<void> _scrollToTop() async {
    if (!_scrollController.hasClients) return;
    await _scrollController.animateTo(
      0,
      duration: const Duration(milliseconds: 450),
      curve: Curves.easeOutCubic,
    );
  }

  void _handleSessionChanged() {
    if (mounted) {
      setState(() {});
    }
  }

  String get _normalizedFocusVoucherCode =>
      widget.focusVoucherCode?.trim().toLowerCase() ?? '';

  bool _isFocusedVoucher(RewardVoucher voucher) =>
      _normalizedFocusVoucherCode.isNotEmpty &&
      voucher.template.code.trim().toLowerCase() == _normalizedFocusVoucherCode;

  RewardVoucher? _findFocusedVoucher(Iterable<RewardVoucher> vouchers) {
    for (final voucher in vouchers) {
      if (_isFocusedVoucher(voucher)) return voucher;
    }
    return null;
  }

  void _startOrderWithVoucher(RewardVoucher voucher) {
    VoucherIntentService.instance.remember(voucher.template.code);
    CustomBottomNav.switchTab(context, const MenuPage());
  }

  Future<void> _loadRewards({bool forceSessionReload = false}) async {
    setState(() {
      _isRewardsLoading = true;
      _rewardsError = null;
    });

    try {
      await _session.loadAuthenticatedState(force: forceSessionReload);
      final accessToken =
          await SecureSessionService.instance.getValidAccessToken();
      if (accessToken == null || accessToken.isEmpty) {
        throw ApiException(
          'Missing access token.',
          code: 'missing_access_token',
        );
      }

      final rewards = await CustomerDataService.instance.getRewardsCenter(
        accessToken: accessToken,
      );
      final focusedVoucher = _findFocusedVoucher(rewards.vouchers);

      if (!mounted) return;
      setState(() {
        _vouchers = rewards.vouchers;
        _claimableTierRewards = rewards.claimableTierRewards;
        _expandedVoucherIds.removeWhere(
          (voucherId) =>
              !rewards.vouchers.any((voucher) => voucher.id == voucherId),
        );
        if (focusedVoucher != null) {
          _expandedVoucherIds.add(focusedVoucher.id);
          _selectedFilter = focusedVoucher.isActive
              ? _RewardFilter.available
              : _RewardFilter.all;
        }
        _isRewardsLoading = false;
      });
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _rewardsError = _friendlyMessage(error);
        _isRewardsLoading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _rewardsError = 'Unable to load rewards right now.';
        _isRewardsLoading = false;
      });
    }
  }

  String _friendlyMessage(ApiException error) {
    switch (error.code) {
      case 'missing_access_token':
      case 'missing_bearer_token':
      case 'invalid_access_token':
      case 'session_not_found':
      case 'session_version_mismatch':
      case 'user_not_active':
        return 'Your session has expired. Please log in again.';
      default:
        return friendlyCustomerErrorMessage(
          error,
          fallback: 'Unable to load rewards right now.',
        );
    }
  }

  @override
  Widget build(BuildContext context) {
    final activeVoucherCount = _vouchers.where((v) => v.isActive).length;
    final visibleRewardCount =
        activeVoucherCount + _claimableTierRewards.length;

    return AppPageShell(
      title: 'MY REWARDS',
      onBack: () => InteractiveFillingLoader.showPop(context),
      backgroundColor: Colors.white,
      scrollController: _scrollController,
      onRefresh: () => _loadRewards(forceSessionReload: true),
      bodyPadding: const EdgeInsets.only(bottom: 130),
      overlay: Stack(
        children: [
          OrderStatusBanner(
            bottomOffset: 90 + MediaQuery.paddingOf(context).bottom,
          ),
          if (_showScrollToTop)
            Positioned(
              right: 18,
              bottom: 24 + MediaQuery.paddingOf(context).bottom,
              child: Semantics(
                button: true,
                label: 'Back to top',
                child: Material(
                  color: AppColors.deepTeal,
                  elevation: 5,
                  shadowColor: Colors.black26,
                  shape: const CircleBorder(),
                  child: InkWell(
                    customBorder: const CircleBorder(),
                    onTap: _scrollToTop,
                    child: const SizedBox(
                      width: 48,
                      height: 48,
                      child: Icon(
                        Icons.keyboard_arrow_up_rounded,
                        color: Colors.white,
                        size: 30,
                      ),
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
      child: Column(
        children: [
          Container(
            color: Colors.white,
            padding: const EdgeInsets.all(20),
            child: Column(
              children: [
                _buildRewardsHeroCard(visibleRewardCount),
              ],
            ),
          ),
          Divider(height: 1, color: AppColors.border, thickness: 1),
          Padding(
            padding: const EdgeInsets.all(20),
            child: _buildRewardsContent(),
          ),
        ],
      ),
    );
  }

  Widget _buildRewardsHeroCard(int visibleRewardCount) {
    return Container(
      width: double.infinity,
      clipBehavior: Clip.hardEdge,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            AppColors.deepTeal,
            AppColors.deepTeal.withValues(alpha: 0.88),
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(22),
        boxShadow: [
          BoxShadow(
            color: AppColors.deepTeal.withValues(alpha: 0.18),
            blurRadius: 16,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Stack(
        children: [
          AnimatedBuilder(
            animation: _cardCircleController,
            builder: (context, child) {
              final double t = Curves.easeInOutSine.transform(
                _cardCircleController.value,
              );
              return Positioned(
                right: -22 + (t * 20),
                top: -24 + (t * 16),
                child: Transform.scale(
                  scale: 0.94 + (t * 0.12),
                  child: child,
                ),
              );
            },
            child: Container(
              width: 112,
              height: 112,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.white.withValues(alpha: 0.08),
              ),
            ),
          ),
          AnimatedBuilder(
            animation: _cardCircleController,
            builder: (context, child) {
              final double t = Curves.easeInOutSine.transform(
                _cardCircleController.value,
              );
              return Positioned(
                right: 78 - (t * 18),
                bottom: -34 + (t * 12),
                child: Transform.scale(
                  scale: 1.04 - (t * 0.10),
                  child: child,
                ),
              );
            },
            child: Container(
              width: 76,
              height: 76,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: AppColors.gold.withValues(alpha: 0.12),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(18),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 6,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: const Text(
                          'Rewards hub',
                          style: TextStyle(
                            fontFamily: 'Afacad',
                            fontSize: 15,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                          ),
                        ),
                      ),
                      const SizedBox(height: 14),
                      const Text(
                        'Your rewards, all in one place',
                        style: TextStyle(
                          fontFamily: 'Recoleta',
                          fontSize: 24,
                          fontWeight: FontWeight.bold,
                          color: Colors.white,
                          height: 1.15,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Tier rewards appear here automatically and can be claimed during checkout.',
                        style: TextStyle(
                          fontFamily: 'Afacad',
                          fontSize: 16,
                          color: Colors.white.withValues(alpha: 0.88),
                          height: 1.35,
                        ),
                      ),
                      const SizedBox(height: 14),
                      Wrap(
                        spacing: 10,
                        runSpacing: 10,
                        children: [
                          _buildHeroStatChip(
                            '$visibleRewardCount',
                            'Reward${visibleRewardCount == 1 ? '' : 's'}',
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 14),
                Image.asset(
                  'assets/images/voucher.png',
                  width: 90,
                  height: 90,
                  fit: BoxFit.contain,
                  color: Colors.white,
                  colorBlendMode: BlendMode.srcIn,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHeroStatChip(String value, String label) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withValues(alpha: 0.16)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            value,
            style: const TextStyle(
              fontFamily: 'Recoleta',
              fontSize: 20,
              fontWeight: FontWeight.bold,
              color: Colors.white,
            ),
          ),
          const SizedBox(width: 8),
          Text(
            label,
            style: TextStyle(
              fontFamily: 'Afacad',
              fontSize: 15,
              fontWeight: FontWeight.w600,
              color: Colors.white.withValues(alpha: 0.9),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRewardsContent() {
    if (_isRewardsLoading) {
      return _buildMessageCard(
        title: 'Loading your rewards...',
        message: 'Please wait while we refresh your loyalty data.',
        showSpinner: true,
      );
    }

    if (_rewardsError != null) {
      return _buildMessageCard(
        title: 'Unable to load rewards',
        message: _rewardsError!,
        actionLabel: 'Try Again',
        onPressed: () => _loadRewards(forceSessionReload: true),
      );
    }

    final sortedVouchers = List<RewardVoucher>.from(_vouchers)
      ..sort((a, b) {
        final aFocused = _isFocusedVoucher(a);
        final bFocused = _isFocusedVoucher(b);
        if (aFocused != bFocused) return aFocused ? -1 : 1;
        if (a.isActive != b.isActive) {
          return a.isActive ? -1 : 1;
        }
        return b.issuedAt.compareTo(a.issuedAt);
      });
    final focusedVoucher = _findFocusedVoucher(sortedVouchers);

    if (sortedVouchers.isEmpty && _claimableTierRewards.isEmpty) {
      return _buildMessageCard(
        title: 'No rewards yet',
        message:
            'You do not have any vouchers at the moment. Earn rewards or wait for an admin campaign to receive one.',
      );
    }

    final filteredVouchers = sortedVouchers.where((v) {
      switch (_selectedFilter) {
        case _RewardFilter.all:
          return true;
        case _RewardFilter.available:
          return v.isActive;
        case _RewardFilter.history:
          return !v.isActive;
      }
    }).toList();

    final birthdayTierVouchers = filteredVouchers
        .where((voucher) => voucher.rewardKind == 'tier_birthday')
        .toList();
    final regularVouchers = filteredVouchers
        .where((voucher) => voucher.rewardKind != 'tier_birthday')
        .toList();
    final showClaimableTier = _selectedFilter != _RewardFilter.history &&
        _claimableTierRewards.isNotEmpty;

    final availableCount = sortedVouchers.where((v) => v.isActive).length +
        _claimableTierRewards.length;
    final historyCount = sortedVouchers.where((v) => !v.isActive).length;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (_normalizedFocusVoucherCode.isNotEmpty) ...[
          _buildFocusedVoucherNotice(focusedVoucher),
          const SizedBox(height: 20),
        ],
        _buildFilterPills(
          totalCount: sortedVouchers.length + _claimableTierRewards.length,
          availableCount: availableCount,
          historyCount: historyCount,
        ),
        const SizedBox(height: 20),
        if (!showClaimableTier &&
            birthdayTierVouchers.isEmpty &&
            regularVouchers.isEmpty)
          _buildMessageCard(
            title: _selectedFilter == _RewardFilter.available
                ? 'No active rewards right now'
                : 'No past rewards yet',
            message: _selectedFilter == _RewardFilter.available
                ? 'All your active vouchers and claimable tier rewards will appear here.'
                : 'Used or expired vouchers will be listed here for your reference.',
          )
        else ...[
          if (showClaimableTier) ...[
            _buildClaimableTierRewardsSection(),
            if (birthdayTierVouchers.isNotEmpty || regularVouchers.isNotEmpty)
              const SizedBox(height: 24),
          ],
          if (birthdayTierVouchers.isNotEmpty) ...[
            _buildRewardsSection(
              title: 'Birthday Tier Reward',
              subtitle: 'Available this month for your current loyalty tier.',
              vouchers: birthdayTierVouchers,
              accentColor: AppColors.gold,
              paginated: false,
            ),
            if (regularVouchers.isNotEmpty) const SizedBox(height: 24),
          ],
          if (regularVouchers.isNotEmpty)
            _buildRewardsSection(
              title: 'Vouchers',
              subtitle: _selectedFilter == _RewardFilter.history
                  ? 'Your used and expired vouchers.'
                  : 'Your vouchers, ready to apply at checkout.',
              vouchers: regularVouchers,
              accentColor: AppColors.deepTeal,
              paginated: true,
            ),
        ],
      ],
    );
  }

  Widget _buildFocusedVoucherNotice(RewardVoucher? voucher) {
    final isAvailable = voucher?.isActive ?? false;
    final title = isAvailable
        ? 'Your voucher is ready'
        : voucher == null
            ? 'Promotion unavailable'
            : 'This voucher is no longer available';
    final message = isAvailable
        ? 'How to use: ${voucher!.template.usageInstructions}'
        : voucher == null
            ? 'This promotion is not currently available in your wallet.'
            : 'This offer has already been used or has expired.';

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.surfaceLight,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.primary, width: 1.6),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(Icons.local_offer_rounded, color: AppColors.primary),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: TextStyle(
                        fontFamily: 'Recoleta',
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                        color: AppColors.deepTeal,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      message,
                      style: const TextStyle(
                        fontFamily: 'Afacad',
                        fontSize: 15.5,
                        height: 1.35,
                        color: Colors.black87,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (isAvailable) ...[
            const SizedBox(height: 14),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: () => _startOrderWithVoucher(voucher!),
                icon: const Icon(Icons.shopping_bag_outlined),
                label: const Text('Start order'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 13),
                  textStyle: const TextStyle(
                    fontFamily: 'Afacad',
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildFilterPills({
    required int totalCount,
    required int availableCount,
    required int historyCount,
  }) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          _buildFilterChip(
            label: 'All ($totalCount)',
            filter: _RewardFilter.all,
          ),
          const SizedBox(width: 8),
          _buildFilterChip(
            label: 'Available ($availableCount)',
            filter: _RewardFilter.available,
          ),
          const SizedBox(width: 8),
          _buildFilterChip(
            label: 'Used / Expired ($historyCount)',
            filter: _RewardFilter.history,
          ),
        ],
      ),
    );
  }

  Widget _buildFilterChip({
    required String label,
    required _RewardFilter filter,
  }) {
    final isSelected = _selectedFilter == filter;
    final brandColor = AppColors.deepTeal;

    return GestureDetector(
      onTap: () {
        setState(() {
          _selectedFilter = filter;
          _voucherDisplayLimit = _initialVoucherLimit;
        });
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(horizontal: 15, vertical: 8),
        decoration: BoxDecoration(
          color: isSelected ? brandColor : AppColors.surfaceLight,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isSelected ? brandColor : AppColors.border,
            width: 1.2,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontFamily: 'Afacad',
            fontSize: 14.5,
            fontWeight: FontWeight.w700,
            color: isSelected ? Colors.white : Colors.black87,
          ),
        ),
      ),
    );
  }

  Widget _buildClaimableTierRewardsSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              'Available Tier Rewards',
              style: TextStyle(
                fontFamily: 'Recoleta',
                fontSize: 21,
                fontWeight: FontWeight.bold,
                color: AppColors.deepTeal,
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
              decoration: BoxDecoration(
                color: AppColors.gold.withValues(alpha: 0.2),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(
                '${_claimableTierRewards.length} ready',
                style: TextStyle(
                  fontFamily: 'Afacad',
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: AppColors.deepTeal,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 4),
        const Text(
          'These rewards follow your current cup-progress tier. Claim one when you are ready to use it at checkout.',
          style: TextStyle(
            fontFamily: 'Afacad',
            fontSize: 15,
            color: Colors.black54,
            height: 1.35,
          ),
        ),
        const SizedBox(height: 12),
        for (var i = 0; i < _claimableTierRewards.length; i++) ...[
          _buildClaimableTierRewardCard(_claimableTierRewards[i]),
          if (i < _claimableTierRewards.length - 1) const SizedBox(height: 12),
        ],
      ],
    );
  }

  Widget _buildClaimableTierRewardCard(TierRewardEntitlement reward) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            AppColors.surfaceLight,
            Colors.white,
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: AppColors.gold.withValues(alpha: 0.65),
          width: 1.4,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (reward.template.imageUrl?.trim().isNotEmpty ?? false) ...[
            ClipRRect(
              borderRadius: BorderRadius.circular(14),
              child: AspectRatio(
                aspectRatio: 2 / 1,
                child: CatalogProductImage(
                  imageUrl: resolveCatalogImageSource(reward.template.imageUrl),
                  fit: BoxFit.cover,
                ),
              ),
            ),
            const SizedBox(height: 14),
          ],
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: AppColors.gold.withValues(alpha: 0.22),
                  borderRadius: BorderRadius.circular(13),
                ),
                child: Icon(
                  Icons.workspace_premium_rounded,
                  color: AppColors.deepTeal,
                  size: 24,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      reward.template.displayLabel,
                      style: TextStyle(
                        fontFamily: 'Recoleta',
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                        color: AppColors.deepTeal,
                        height: 1.15,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      reward.template.benefitLabel,
                      style: const TextStyle(
                        fontFamily: 'Afacad',
                        fontSize: 15.5,
                        fontWeight: FontWeight.w600,
                        color: Colors.black87,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
            decoration: BoxDecoration(
              color: AppColors.deepTeal.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(999),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  Icons.check_circle_outline_rounded,
                  size: 16,
                  color: AppColors.deepTeal,
                ),
                const SizedBox(width: 6),
                Text(
                  'Available to claim at checkout',
                  style: TextStyle(
                    fontFamily: 'Afacad',
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                    color: AppColors.deepTeal,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRewardsSection({
    required String title,
    required String subtitle,
    required List<RewardVoucher> vouchers,
    required Color accentColor,
    required bool paginated,
  }) {
    final visibleCount = !paginated
        ? vouchers.length
        : (vouchers.length < _voucherDisplayLimit
            ? vouchers.length
            : _voucherDisplayLimit);
    final visibleVouchers = vouchers.sublist(0, visibleCount);
    final remainingCount = vouchers.length - visibleCount;
    final canCollapse = paginated &&
        vouchers.length > _initialVoucherLimit &&
        visibleCount > _initialVoucherLimit;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Text(
              title,
              style: TextStyle(
                fontFamily: 'Recoleta',
                fontSize: 22,
                fontWeight: FontWeight.bold,
                color: AppColors.deepTeal,
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
              decoration: BoxDecoration(
                color: AppColors.surfaceLight,
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(
                '${vouchers.length} total',
                style: TextStyle(
                  fontFamily: 'Afacad',
                  fontSize: 13.5,
                  fontWeight: FontWeight.w700,
                  color: AppColors.deepTeal,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 4),
        Text(
          subtitle,
          style: const TextStyle(
            fontFamily: 'Afacad',
            fontSize: 15,
            color: Colors.black54,
            height: 1.35,
          ),
        ),
        const SizedBox(height: 14),
        for (var i = 0; i < visibleVouchers.length; i++) ...[
          _buildVoucherCard(visibleVouchers[i], accentColor: accentColor),
          if (i < visibleVouchers.length - 1) const SizedBox(height: 14),
        ],
        if (remainingCount > 0 || canCollapse) ...[
          const SizedBox(height: 14),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (remainingCount > 0)
                Flexible(
                  child: TextButton(
                    onPressed: () {
                      setState(() {
                        _voucherDisplayLimit += _voucherPageStep;
                      });
                    },
                    style: TextButton.styleFrom(
                      backgroundColor: AppColors.surfaceLight,
                      padding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 10,
                      ),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(20),
                        side: BorderSide(color: AppColors.border),
                      ),
                    ),
                    child: FittedBox(
                      fit: BoxFit.scaleDown,
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            Icons.keyboard_arrow_down_rounded,
                            color: AppColors.deepTeal,
                            size: 20,
                          ),
                          const SizedBox(width: 4),
                          Text(
                            'Show More ($remainingCount more)',
                            style: TextStyle(
                              fontFamily: 'Afacad',
                              fontSize: 15,
                              fontWeight: FontWeight.w700,
                              color: AppColors.deepTeal,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              if (remainingCount > 0 && canCollapse) const SizedBox(width: 8),
              if (canCollapse)
                Flexible(
                  child: TextButton(
                    onPressed: () {
                      setState(() {
                        _voucherDisplayLimit = _initialVoucherLimit;
                      });
                    },
                    style: TextButton.styleFrom(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 10,
                      ),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(20),
                      ),
                    ),
                    child: const FittedBox(
                      fit: BoxFit.scaleDown,
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            Icons.keyboard_arrow_up_rounded,
                            color: Colors.black54,
                            size: 19,
                          ),
                          SizedBox(width: 4),
                          Text(
                            'Show Less',
                            style: TextStyle(
                              fontFamily: 'Afacad',
                              fontSize: 15,
                              fontWeight: FontWeight.w700,
                              color: Colors.black54,
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
      ],
    );
  }

  Widget _buildVoucherCard(
    RewardVoucher voucher, {
    required Color accentColor,
  }) {
    final expiryLabel = voucher.validityLabel.trim().isNotEmpty
        ? voucher.validityLabel
        : voucher.hasFixedExpiry
            ? 'Redeem by ${DateFormat('dd MMM yyyy').format(voucher.expiresAt.toUtc().add(const Duration(hours: 8)))}'
            : 'Valid while your current tier remains active';
    final isActive = voucher.isActive;
    final cardAccentColor = isActive ? accentColor : Colors.grey.shade400;
    final isExpanded = _expandedVoucherIds.contains(voucher.id);
    final isFocused = _isFocusedVoucher(voucher);
    final badgeLabel = _voucherBadge(voucher);

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: isActive ? Colors.white : const Color(0xFFFAFAFB),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: isFocused
              ? AppColors.primary
              : isActive
                  ? AppColors.border
                  : Colors.grey.shade300,
          width: isFocused ? 2.2 : 1.4,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (voucher.template.imageUrl?.trim().isNotEmpty ?? false) ...[
            ClipRRect(
              borderRadius: BorderRadius.circular(14),
              child: AspectRatio(
                // Match the menu banner and Admin voucher artwork ratio.
                aspectRatio: 2 / 1,
                child: CatalogProductImage(
                  imageUrl:
                      resolveCatalogImageSource(voucher.template.imageUrl),
                  fit: BoxFit.cover,
                ),
              ),
            ),
            const SizedBox(height: 16),
          ],
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 5,
                height: 52,
                decoration: BoxDecoration(
                  color: cardAccentColor,
                  borderRadius: BorderRadius.circular(999),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Text(
                            voucher.template.displayLabel,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontFamily: 'Recoleta',
                              fontSize: 20,
                              height: 1.15,
                              fontWeight: FontWeight.bold,
                              color: isActive
                                  ? AppColors.deepTeal
                                  : Colors.black54,
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 4,
                          ),
                          decoration: BoxDecoration(
                            color: isActive
                                ? const Color(0xFFE8F5E9)
                                : Colors.grey.shade200,
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Text(
                            badgeLabel,
                            style: TextStyle(
                              fontFamily: 'Afacad',
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                              color: isActive
                                  ? const Color(0xFF2E7D32)
                                  : Colors.grey.shade700,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.surfaceLight,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            Icons.local_offer_outlined,
                            size: 14,
                            color: cardAccentColor,
                          ),
                          const SizedBox(width: 5),
                          Flexible(
                            child: Text(
                              voucher.template.benefitLabel,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                fontFamily: 'Afacad',
                                fontSize: 14,
                                fontWeight: FontWeight.w700,
                                color: AppColors.deepTeal,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 10),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        const Icon(
                          Icons.schedule_rounded,
                          size: 15,
                          color: Colors.black45,
                        ),
                        const SizedBox(width: 6),
                        Expanded(
                          child: Text(
                            expiryLabel,
                            style: const TextStyle(
                              fontFamily: 'Afacad',
                              fontSize: 14.5,
                              fontWeight: FontWeight.w600,
                              color: Colors.black54,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    InkWell(
                      onTap: () {
                        setState(() {
                          if (isExpanded) {
                            _expandedVoucherIds.remove(voucher.id);
                          } else {
                            _expandedVoucherIds.add(voucher.id);
                          }
                        });
                      },
                      borderRadius: BorderRadius.circular(10),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(vertical: 4),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              isExpanded
                                  ? Icons.keyboard_arrow_up_rounded
                                  : Icons.keyboard_arrow_down_rounded,
                              size: 19,
                              color: cardAccentColor,
                            ),
                            const SizedBox(width: 4),
                            Text(
                              isExpanded ? 'Hide details' : 'Show details',
                              style: TextStyle(
                                fontFamily: 'Afacad',
                                fontSize: 15,
                                fontWeight: FontWeight.w700,
                                color: cardAccentColor,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    AnimatedCrossFade(
                      duration: const Duration(milliseconds: 180),
                      crossFadeState: isExpanded
                          ? CrossFadeState.showSecond
                          : CrossFadeState.showFirst,
                      firstChild: const SizedBox.shrink(),
                      secondChild: Padding(
                        padding: const EdgeInsets.only(top: 8),
                        child: Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF8F9FA),
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(color: Colors.grey.shade200),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              _buildInfoRow('Code', voucher.template.code),
                              _buildInfoRow(
                                'Availability',
                                voucher.template.availabilityLabel,
                              ),
                              _buildInfoRow(
                                'Benefit',
                                voucher.template.benefitLabel,
                              ),
                              _buildInfoRow(
                                'How to use',
                                voucher.template.usageInstructions,
                                isLast: false,
                              ),
                              _buildInfoRow(
                                'Checkout',
                                'Automatically available in Checkout when eligible.',
                                isLast: voucher.template.minSpendRm == null,
                              ),
                              if (voucher.template.minSpendRm != null)
                                _buildInfoRow(
                                  'Min spend',
                                  'RM ${voucher.template.minSpendRm}',
                                  isLast: true,
                                ),
                            ],
                          ),
                        ),
                      ),
                    ),
                    if (isActive) ...[
                      const SizedBox(height: 14),
                      Text(
                        'This voucher is automatically available in Checkout when eligible.',
                        style: TextStyle(
                          fontFamily: 'Afacad',
                          fontSize: 14.5,
                          height: 1.3,
                          fontWeight: FontWeight.w600,
                          color: Colors.grey.shade700,
                        ),
                      ),
                      const SizedBox(height: 10),
                      SizedBox(
                        width: double.infinity,
                        child: OutlinedButton.icon(
                          onPressed: () => _startOrderWithVoucher(voucher),
                          icon: const Icon(Icons.shopping_bag_outlined),
                          label: const Text('Start order'),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: AppColors.deepTeal,
                            side: BorderSide(color: AppColors.deepTeal),
                            padding: const EdgeInsets.symmetric(vertical: 12),
                            textStyle: const TextStyle(
                              fontFamily: 'Afacad',
                              fontSize: 15.5,
                              fontWeight: FontWeight.w700,
                            ),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(13),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildInfoRow(String label, String value, {bool isLast = false}) {
    return Padding(
      padding: EdgeInsets.only(bottom: isLast ? 0 : 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: const TextStyle(
              fontFamily: 'Afacad',
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: Colors.black54,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              value,
              textAlign: TextAlign.right,
              style: const TextStyle(
                fontFamily: 'Afacad',
                fontSize: 14.5,
                fontWeight: FontWeight.w700,
                color: Colors.black87,
              ),
            ),
          ),
        ],
      ),
    );
  }

  String _voucherBadge(RewardVoucher voucher) {
    if (voucher.isRedeemed) {
      return 'Used';
    }
    return voucher.isActive ? 'Available' : _voucherStatusLabel(voucher);
  }

  String _voucherStatusLabel(RewardVoucher voucher) {
    if (voucher.isRedeemed) {
      return 'Used';
    }
    if (voucher.revokedAt != null || voucher.status == 'revoked') {
      return 'Revoked';
    }
    if (!voucher.isActive) {
      return 'Expired';
    }
    return _capitalize(voucher.status);
  }

  String _capitalize(String value) {
    if (value.isEmpty) return value;
    return '${value[0].toUpperCase()}${value.substring(1)}';
  }

  Widget _buildMessageCard({
    required String title,
    required String message,
    bool showSpinner = false,
    String? actionLabel,
    VoidCallback? onPressed,
  }) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.border, width: 1.4),
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
          if (showSpinner) ...[
            CircularProgressIndicator(color: AppColors.deepTeal),
            const SizedBox(height: 16),
          ] else ...[
            Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(
                color: AppColors.surfaceLight,
                shape: BoxShape.circle,
              ),
              child: Icon(
                Icons.card_giftcard_outlined,
                size: 32,
                color: AppColors.deepTeal,
              ),
            ),
            const SizedBox(height: 14),
          ],
          Text(
            title,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontFamily: 'Recoleta',
              fontSize: 23,
              fontWeight: FontWeight.bold,
              color: AppColors.deepTeal,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            message,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontFamily: 'Afacad',
              fontSize: 16,
              color: Colors.black54,
              height: 1.35,
            ),
          ),
          if (actionLabel != null && onPressed != null) ...[
            const SizedBox(height: 18),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: onPressed,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.deepTeal,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
                child: Text(
                  actionLabel,
                  style: const TextStyle(
                    fontFamily: 'Recoleta',
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
