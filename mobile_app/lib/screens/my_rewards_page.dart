import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../services/app_session_service.dart';
import '../services/auth_api_service.dart';
import '../services/customer_data_service.dart';
import '../services/secure_session_service.dart';
import '../utils/app_colors.dart';
import '../widgets/order_status_banner.dart';
import 'loading_order_page.dart';
import '../widgets/app_page_shell.dart';

class MyRewardsPage extends StatefulWidget {
  const MyRewardsPage({super.key});

  @override
  State<MyRewardsPage> createState() => _MyRewardsPageState();
}

class _MyRewardsPageState extends State<MyRewardsPage> {
  final AppSessionService _session = AppSessionService.instance;
  bool _isRewardsLoading = true;
  String? _rewardsError;
  List<RewardVoucher> _vouchers = const [];

  @override
  void initState() {
    super.initState();
    _session.addListener(_handleSessionChanged);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadRewards();
    });
  }

  @override
  void dispose() {
    _session.removeListener(_handleSessionChanged);
    super.dispose();
  }

  void _handleSessionChanged() {
    if (mounted) {
      setState(() {});
    }
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

      final vouchers = await CustomerDataService.instance.getRewardVouchers(
        accessToken: accessToken,
      );

      if (!mounted) return;
      setState(() {
        _vouchers = vouchers;
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
        return error.message;
    }
  }

  @override
  Widget build(BuildContext context) {
    final activeCount = _vouchers.where((voucher) => voucher.isActive).length;

    return AppPageShell(
      title: 'MY REWARDS',
      onBack: () => InteractiveFillingLoader.showPop(context),
      backgroundColor: Colors.white,
      bodyPadding: EdgeInsets.zero,
      overlay: OrderStatusBanner(
        bottomOffset: 90 + MediaQuery.paddingOf(context).bottom,
      ),
      child: Column(
        children: [
          Container(
            color: Colors.white,
            padding: const EdgeInsets.all(20),
            child: Column(
              children: [
                _buildRewardsHeroCard(activeCount),
              ],
            ),
          ),
          Divider(height: 1, color: AppColors.border, thickness: 1),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(20),
            child: _buildActiveRewards(),
          ),
        ],
      ),
    );
  }

  Widget _buildRewardsHeroCard(int activeCount) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
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
          Positioned(
            right: -10,
            top: -12,
            child: Container(
              width: 92,
              height: 92,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.white.withValues(alpha: 0.08),
              ),
            ),
          ),
          Positioned(
            right: 72,
            bottom: -30,
            child: Container(
              width: 70,
              height: 70,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: AppColors.gold.withValues(alpha: 0.12),
              ),
            ),
          ),
          Row(
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
                          fontSize: 13,
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
                        fontSize: 22,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                        height: 1.15,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Active vouchers stay aligned with checkout and reward history.',
                      style: TextStyle(
                        fontFamily: 'Afacad',
                        fontSize: 14,
                        color: Colors.white.withValues(alpha: 0.88),
                        height: 1.35,
                      ),
                    ),
                    const SizedBox(height: 14),
                    Wrap(
                      spacing: 10,
                      runSpacing: 10,
                      children: [
                        _buildHeroStatChip('$activeCount',
                            'Active voucher${activeCount == 1 ? '' : 's'}'),
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
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: Colors.white,
            ),
          ),
          const SizedBox(width: 8),
          Text(
            label,
            style: TextStyle(
              fontFamily: 'Afacad',
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: Colors.white.withValues(alpha: 0.9),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildActiveRewards() {
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

    final activeVouchers =
        _vouchers.where((voucher) => voucher.isActive).toList();
    if (activeVouchers.isNotEmpty) {
      return Column(
        children: [
          for (var i = 0; i < activeVouchers.length; i++) ...[
            _buildVoucherCard(activeVouchers[i]),
            if (i < activeVouchers.length - 1) const SizedBox(height: 12),
          ],
        ],
      );
    }

    return _buildMessageCard(
      title: 'No active rewards yet',
      message: 'You do not have any active reward vouchers at the moment.',
    );
  }

  Widget _buildVoucherCard(RewardVoucher voucher) {
    final expiryLabel = DateFormat('dd MMM yyyy').format(voucher.expiresAt);
    final isActive = voucher.isActive;
    final statusColor = isActive ? AppColors.deepTeal : Colors.grey.shade600;
    final accentColor = isActive ? AppColors.gold : AppColors.border;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: isActive ? Colors.white : AppColors.surfaceLight,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: isActive
              ? AppColors.deepTeal.withValues(alpha: 0.18)
              : AppColors.border,
          width: 1,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 10,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 6,
                height: 56,
                decoration: BoxDecoration(
                  color: accentColor,
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
                            voucher.template.name,
                            style: TextStyle(
                              fontFamily: 'Recoleta',
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                              color: AppColors.deepTeal,
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 6,
                          ),
                          decoration: BoxDecoration(
                            color: isActive
                                ? AppColors.surfaceLight
                                : Colors.white,
                            borderRadius: BorderRadius.circular(999),
                            border: Border.all(color: accentColor, width: 1),
                          ),
                          child: Text(
                            _voucherBadge(voucher),
                            style: TextStyle(
                              fontFamily: 'Afacad',
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                              color: AppColors.deepTeal,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Status: ${_capitalize(voucher.status)}',
                      style: TextStyle(
                        fontFamily: 'Afacad',
                        fontSize: 13,
                        color: statusColor,
                      ),
                    ),
                    const SizedBox(height: 10),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        _buildInfoChip('Code', voucher.template.code),
                        _buildInfoChip('Expires', expiryLabel),
                        if (voucher.template.minSpendRm != null)
                          _buildInfoChip(
                            'Min spend',
                            'RM ${voucher.template.minSpendRm}',
                          ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.border, width: 1),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Issued for',
                  style: TextStyle(
                    fontFamily: 'Afacad',
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    color: Colors.black45,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  voucher.issuedReason,
                  style: const TextStyle(
                    fontFamily: 'Afacad',
                    fontSize: 14,
                    color: Colors.black87,
                    height: 1.35,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),
          Text(
            isActive
                ? 'Use this voucher during checkout.'
                : voucher.redeemedAt != null
                    ? 'This voucher has already been redeemed.'
                    : 'This voucher is part of your reward history.',
            style: const TextStyle(
              fontFamily: 'Afacad',
              fontSize: 13,
              color: Colors.black54,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInfoChip(String label, String value) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      decoration: BoxDecoration(
        color: AppColors.surfaceLight,
        borderRadius: BorderRadius.circular(999),
      ),
      child: RichText(
        text: TextSpan(
          style: TextStyle(
            fontFamily: 'Afacad',
            fontSize: 12,
            color: Colors.black87,
          ),
          children: [
            TextSpan(
              text: '$label: ',
              style: const TextStyle(fontWeight: FontWeight.bold),
            ),
            TextSpan(text: value),
          ],
        ),
      ),
    );
  }

  String _voucherBadge(RewardVoucher voucher) {
    switch (voucher.template.discountMode) {
      case 'fixed_rm':
        return 'RM ${voucher.template.discountValue}';
      case 'percent_rm':
        return '${voucher.template.discountValue}%';
      case 'fixed_token':
        return '${voucher.template.tokenValue ?? 0} TOKENS';
      case 'free_drink':
        return 'FREE DRINK';
      default:
        return voucher.template.voucherType.toUpperCase();
    }
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
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border, width: 1),
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
            Icon(
              Icons.card_giftcard_outlined,
              size: 40,
              color: AppColors.gold,
            ),
            const SizedBox(height: 14),
          ],
          Text(
            title,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontFamily: 'Recoleta',
              fontSize: 22,
              fontWeight: FontWeight.bold,
              color: AppColors.deepTeal,
            ),
          ),
          const SizedBox(height: 10),
          Text(
            message,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontFamily: 'Afacad',
              fontSize: 15,
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
                  padding: const EdgeInsets.symmetric(vertical: 16),
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
