import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../services/app_session_service.dart';
import '../services/auth_api_service.dart';
import '../services/customer_data_service.dart';
import '../services/secure_session_service.dart';
import '../utils/app_colors.dart';
import '../widgets/order_status_banner.dart';
import 'loading_order_page.dart';

class MyRewardsPage extends StatefulWidget {
  const MyRewardsPage({super.key});

  @override
  State<MyRewardsPage> createState() => _MyRewardsPageState();
}

class _MyRewardsPageState extends State<MyRewardsPage> {
  final AppSessionService _session = AppSessionService.instance;
  int _selectedSubTab = 0;
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
      final accessToken = await SecureSessionService.instance.getAccessToken();
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
    return Scaffold(
      backgroundColor: Colors.white,
      body: Stack(
        children: [
          SingleChildScrollView(
            child: Column(
              children: [
                Container(
                  width: double.infinity,
                  padding: EdgeInsets.only(
                    top: MediaQuery.paddingOf(context).top + 14,
                    bottom: 16,
                    left: 20,
                    right: 20,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.deepTeal,
                    borderRadius: const BorderRadius.only(
                      bottomLeft: Radius.circular(20),
                      bottomRight: Radius.circular(20),
                    ),
                  ),
                  child: Stack(
                    alignment: Alignment.center,
                    children: [
                      Align(
                        alignment: Alignment.centerLeft,
                        child: GestureDetector(
                          onTap: () => InteractiveFillingLoader.showPop(context),
                          child: const Icon(
                            Icons.arrow_back_ios,
                            color: Colors.white,
                            size: 20,
                          ),
                        ),
                      ),
                      const Text(
                        'MY REWARDS',
                        style: TextStyle(
                          fontFamily: 'Recoleta',
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                          color: Colors.white,
                          letterSpacing: 1.0,
                        ),
                      ),
                    ],
                  ),
                ),
                Container(
                  color: Colors.white,
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    children: [
                      _buildTokensCard(),
                      const SizedBox(height: 20),
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          _buildTabPill(0, 'Active'),
                          const SizedBox(width: 12),
                          _buildTabPill(1, 'Past'),
                        ],
                      ),
                    ],
                  ),
                ),
                Divider(height: 1, color: AppColors.border, thickness: 1),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(20),
                  child: _selectedSubTab == 0
                      ? _buildActiveRewards()
                      : _buildPastRewards(),
                ),
              ],
            ),
          ),
          OrderStatusBanner(
            bottomOffset: 90 + MediaQuery.paddingOf(context).bottom,
          ),
        ],
      ),
    );
  }

  Widget _buildTokensCard() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
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
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            'Reward tokens',
            style: TextStyle(
              fontFamily: 'Afacad',
              fontSize: 16,
              color: AppColors.deepTeal,
              fontWeight: FontWeight.w600,
            ),
          ),
          Row(
            children: [
              Image.asset(
                'assets/images/coin.png',
                width: 32,
                height: 32,
              ),
              const SizedBox(width: 8),
              Text(
                '${_session.tokenBalance}',
                style: TextStyle(
                  fontFamily: 'Recoleta',
                  fontSize: 48,
                  fontWeight: FontWeight.normal,
                  color: AppColors.deepTeal,
                  height: 1.0,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildTabPill(int index, String label) {
    final selected = _selectedSubTab == index;
    return GestureDetector(
      onTap: () => setState(() => _selectedSubTab = index),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 10),
        decoration: BoxDecoration(
          color: selected ? AppColors.deepTeal : AppColors.surfaceLight,
          borderRadius: BorderRadius.circular(50),
          border: Border.all(
            color: selected ? AppColors.deepTeal : AppColors.border,
            width: 1,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontFamily: 'Afacad',
            fontSize: 14,
            fontWeight: FontWeight.bold,
            color: selected ? Colors.white : AppColors.deepTeal,
          ),
        ),
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

    final activeVouchers = _vouchers.where((voucher) => voucher.isActive).toList();
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

  Widget _buildPastRewards() {
    if (_isRewardsLoading) {
      return _buildMessageCard(
        title: 'Loading reward history...',
        message: 'Please wait while we refresh your rewards.',
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

    final pastVouchers = _vouchers.where((voucher) => !voucher.isActive).toList();
    if (pastVouchers.isNotEmpty) {
      return Column(
        children: [
          for (var i = 0; i < pastVouchers.length; i++) ...[
            _buildVoucherCard(pastVouchers[i]),
            if (i < pastVouchers.length - 1) const SizedBox(height: 12),
          ],
        ],
      );
    }

    return _buildMessageCard(
      title: 'No past rewards found',
      message: 'Used, expired, or revoked rewards will appear here.',
    );
  }

  Widget _buildVoucherCard(RewardVoucher voucher) {
    final expiryLabel = DateFormat('dd MMM yyyy, h:mm a').format(voucher.expiresAt);
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
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
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: AppColors.surfaceLight,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  _voucherBadge(voucher),
                  style: TextStyle(
                    fontFamily: 'Recoleta',
                    fontSize: 13,
                    fontWeight: FontWeight.bold,
                    color: AppColors.deepTeal,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      voucher.template.name,
                      style: TextStyle(
                        fontFamily: 'Recoleta',
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: AppColors.deepTeal,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Status: ${_capitalize(voucher.status)}',
                      style: const TextStyle(
                        fontFamily: 'Afacad',
                        fontSize: 13,
                        color: Colors.black54,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Text(
            'Code: ${voucher.template.code}',
            style: const TextStyle(
              fontFamily: 'Afacad',
              fontSize: 14,
              color: Colors.black87,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Expires: $expiryLabel',
            style: const TextStyle(
              fontFamily: 'Afacad',
              fontSize: 14,
              color: Colors.black54,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Issued reason: ${voucher.issuedReason}',
            style: const TextStyle(
              fontFamily: 'Afacad',
              fontSize: 14,
              color: Colors.black54,
            ),
          ),
          if (voucher.template.minSpendRm != null) ...[
            const SizedBox(height: 4),
            Text(
              'Min spend: RM ${voucher.template.minSpendRm}',
              style: const TextStyle(
                fontFamily: 'Afacad',
                fontSize: 14,
                color: Colors.black54,
              ),
            ),
          ],
        ],
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
