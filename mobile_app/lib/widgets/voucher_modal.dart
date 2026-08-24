import 'package:flutter/material.dart';
import '../services/cart_service.dart';
import '../services/customer_data_service.dart';
import '../services/secure_session_service.dart';
import '../utils/app_colors.dart';

class VoucherModal {
  static Future<void> show(
    BuildContext context, {
    int? selectedVoucherId,
    CartSnapshot? cartSnapshot,
    required ValueChanged<RewardVoucher?> onVoucherSelected,
  }) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) {
        return _VoucherModalContent(
          selectedVoucherId: selectedVoucherId,
          cartSnapshot: cartSnapshot,
          onVoucherSelected: onVoucherSelected,
        );
      },
    );
  }
}

class _VoucherModalContent extends StatefulWidget {
  final int? selectedVoucherId;
  final CartSnapshot? cartSnapshot;
  final ValueChanged<RewardVoucher?> onVoucherSelected;

  const _VoucherModalContent({
    required this.selectedVoucherId,
    required this.cartSnapshot,
    required this.onVoucherSelected,
  });

  @override
  State<_VoucherModalContent> createState() => _VoucherModalContentState();
}

class _VoucherModalContentState extends State<_VoucherModalContent> {
  bool _isLoading = true;
  String? _error;
  List<RewardVoucher> _vouchers = [];

  @override
  void initState() {
    super.initState();
    _loadVouchers();
  }

  Future<void> _loadVouchers() async {
    try {
      final accessToken =
          await SecureSessionService.instance.getValidAccessToken();
      if (accessToken == null || accessToken.isEmpty) {
        throw Exception('Missing access token.');
      }

      final list = await CustomerDataService.instance.getRewardVouchers(
        accessToken: accessToken,
        onlyActive: true,
      );

      if (mounted) {
        setState(() {
          _vouchers = list;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = 'Unable to load vouchers.';
          _isLoading = false;
        });
      }
    }
  }

  String _formatDiscount(RewardVoucher voucher) {
    final t = voucher.template;
    if (t.benefitLabel == 'Free Food') {
      return '1 Free Food Item';
    }
    if (t.benefitLabel == 'Birthday Voucher') {
      return 'Birthday Treat';
    }
    switch (t.discountMode) {
      case 'fixed_rm':
        return 'RM ${t.discountValue} Off';
      case 'percent_rm':
        return '${t.discountValue}% Off Total';
      case 'fixed_token':
        return '${t.tokenValue ?? t.discountValue} Tokens Off';
      case 'free_drink':
        return '1 Free Drink';
      default:
        return t.name;
    }
  }

  @override
  Widget build(BuildContext context) {
    final brandColor = AppColors.deepTeal;

    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.75,
      ),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: EdgeInsets.only(
        top: 16,
        left: 20,
        right: 20,
        bottom: 20 + MediaQuery.paddingOf(context).bottom,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Drag handle
          Center(
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.grey.shade300,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 16),
          // Header
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: AppColors.gold.withValues(alpha: 0.15),
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  Icons.confirmation_num_outlined,
                  color: AppColors.gold,
                  size: 24,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Apply Voucher',
                      style: TextStyle(
                        fontFamily: 'Recoleta',
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: brandColor,
                      ),
                    ),
                    const Text(
                      'Only vouchers that match this order can be applied here.',
                      style: TextStyle(
                        fontFamily: 'Afacad',
                        fontSize: 13,
                        color: Colors.black54,
                      ),
                    ),
                  ],
                ),
              ),
              IconButton(
                icon: const Icon(Icons.close, color: Colors.grey),
                onPressed: () => Navigator.pop(context),
              ),
            ],
          ),
          const SizedBox(height: 16),
          // Content
          Flexible(
            child: _buildBody(),
          ),
        ],
      ),
    );
  }

  Widget _buildBody() {
    if (_isLoading) {
      return const SizedBox(
        height: 180,
        child: Center(
          child: CircularProgressIndicator(),
        ),
      );
    }

    if (_error != null) {
      return SizedBox(
        height: 180,
        child: Center(
          child: Text(
            _error!,
            style: const TextStyle(
              fontFamily: 'Afacad',
              fontSize: 14,
              color: Colors.black54,
            ),
          ),
        ),
      );
    }

    final tokenCheckoutVouchers = _vouchers.where((v) {
      if (!v.isTokenCheckoutEligible) return false;
      final snapshot = widget.cartSnapshot;
      if (snapshot == null) return true;
      return v.template.matchesCartSnapshot(snapshot);
    }).toList();
    final nonTokenCheckoutVouchers =
        _vouchers.where((v) => !tokenCheckoutVouchers.contains(v)).toList();

    if (tokenCheckoutVouchers.isEmpty && nonTokenCheckoutVouchers.isEmpty) {
      return _buildEmptyState(
        title: 'No vouchers available',
        message:
            'Check back soon or earn rewards from eligible orders and campaigns.',
      );
    }

    if (tokenCheckoutVouchers.isEmpty) {
      return SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildNoticeCard(
              title: 'No vouchers can be applied right now',
              message:
                  'You currently have vouchers, but none match this order right now.',
            ),
            const SizedBox(height: 14),
            if (nonTokenCheckoutVouchers.isNotEmpty) ...[
              _buildVoucherSection(
                title: 'Other rewards',
                subtitle:
                    'Visible in rewards history, not selectable at checkout.',
                vouchers: nonTokenCheckoutVouchers,
                enabled: false,
              ),
            ],
          ],
        ),
      );
    }

    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (widget.selectedVoucherId != null) ...[
            InkWell(
              onTap: () {
                widget.onVoucherSelected(null);
                Navigator.pop(context);
              },
              borderRadius: BorderRadius.circular(12),
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                decoration: BoxDecoration(
                  color: Colors.red.shade50,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.red.shade200),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.remove_circle_outline,
                        size: 18, color: Colors.red.shade700),
                    const SizedBox(width: 8),
                    Text(
                      'Remove Applied Voucher',
                      style: TextStyle(
                        fontFamily: 'Afacad',
                        fontWeight: FontWeight.bold,
                        fontSize: 14,
                        color: Colors.red.shade700,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),
          ],
          _buildVoucherSection(
            title: 'Ready to use',
            subtitle: 'These vouchers can be applied to the current order.',
            vouchers: tokenCheckoutVouchers,
            enabled: true,
          ),
          if (nonTokenCheckoutVouchers.isNotEmpty) ...[
            const SizedBox(height: 14),
            _buildVoucherSection(
              title: 'Other rewards',
              subtitle:
                  'Visible in rewards history, not selectable at checkout.',
              vouchers: nonTokenCheckoutVouchers,
              enabled: false,
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildVoucherSection({
    required String title,
    required String subtitle,
    required List<RewardVoucher> vouchers,
    required bool enabled,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: TextStyle(
            fontFamily: 'Recoleta',
            fontSize: 16,
            fontWeight: FontWeight.bold,
            color: AppColors.deepTeal,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          subtitle,
          style: const TextStyle(
            fontFamily: 'Afacad',
            fontSize: 12,
            color: Colors.black54,
            height: 1.3,
          ),
        ),
        const SizedBox(height: 10),
        for (var i = 0; i < vouchers.length; i++) ...[
          _buildVoucherTile(vouchers[i], enabled: enabled),
          if (i < vouchers.length - 1) const SizedBox(height: 10),
        ],
      ],
    );
  }

  Widget _buildVoucherTile(
    RewardVoucher voucher, {
    required bool enabled,
  }) {
    final isSelected = widget.selectedVoucherId == voucher.id;
    final canApply = enabled && voucher.isTokenCheckoutEligible;
    final isApplied = isSelected && canApply;
    final tileBackground =
        isApplied ? Colors.grey.shade100 : AppColors.surfaceLight;
    final tileBorderColor = isApplied ? Colors.grey.shade300 : AppColors.border;
    final titleColor = isApplied ? Colors.grey.shade700 : AppColors.deepTeal;
    final discountColor = isApplied ? Colors.grey.shade600 : AppColors.gold;
    final metaColor = isApplied ? Colors.grey.shade500 : Colors.black45;
    final iconBackground = isApplied
        ? Colors.grey.shade200
        : AppColors.deepTeal.withValues(alpha: 0.12);

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: tileBackground,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: tileBorderColor,
          width: isApplied ? 1.5 : 1,
        ),
      ),
      child: Row(
        children: [
          Container(
            width: 50,
            height: 50,
            decoration: BoxDecoration(
              color: iconBackground,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Center(
              child: Image.asset(
                'assets/images/voucher.png',
                width: 36,
                height: 36,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  voucher.template.displayLabel,
                  style: TextStyle(
                    fontFamily: 'Afacad',
                    fontSize: 15,
                    fontWeight: FontWeight.bold,
                    color: titleColor,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  _formatDiscount(voucher),
                  style: TextStyle(
                    fontFamily: 'Afacad',
                    fontSize: 13,
                    fontWeight: FontWeight.bold,
                    color: discountColor,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  voucher.visibilityLabel,
                  style: TextStyle(
                    fontFamily: 'Afacad',
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: metaColor,
                  ),
                ),
                if (voucher.template.minSpendRm != null)
                  Text(
                    'Min spend RM ${voucher.template.minSpendRm}',
                    style: const TextStyle(
                      fontFamily: 'Afacad',
                      fontSize: 11,
                      color: Colors.black45,
                    ),
                  ),
                const SizedBox(height: 4),
                Text(
                  'Applies to: ${voucher.template.eligibilityLabel}',
                  style: const TextStyle(
                    fontFamily: 'Afacad',
                    fontSize: 11,
                    color: Colors.black45,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  'Benefit: ${voucher.template.benefitLabel}',
                  style: const TextStyle(
                    fontFamily: 'Afacad',
                    fontSize: 11,
                    color: Colors.black45,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  'Available: ${voucher.template.availabilityLabel}',
                  style: const TextStyle(
                    fontFamily: 'Afacad',
                    fontSize: 11,
                    color: Colors.black45,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          ElevatedButton(
            onPressed: canApply
                ? () {
                    widget.onVoucherSelected(voucher);
                    Navigator.pop(context);
                  }
                : null,
            style: ElevatedButton.styleFrom(
              backgroundColor:
                  isApplied ? Colors.grey.shade400 : AppColors.deepTeal,
              disabledBackgroundColor: Colors.grey.shade300,
              elevation: 0,
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(20),
              ),
            ),
            child: Text(
              canApply ? (isApplied ? 'Applied' : 'Apply') : 'Unavailable',
              style: TextStyle(
                fontFamily: 'Afacad',
                fontWeight: FontWeight.bold,
                fontSize: 13,
                color: isApplied ? Colors.white : Colors.white,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildNoticeCard({
    required String title,
    required String message,
  }) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surfaceLight,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border, width: 1),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: TextStyle(
              fontFamily: 'Recoleta',
              fontSize: 16,
              fontWeight: FontWeight.bold,
              color: AppColors.deepTeal,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            message,
            style: const TextStyle(
              fontFamily: 'Afacad',
              fontSize: 13,
              color: Colors.black54,
              height: 1.35,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyState({
    required String title,
    required String message,
  }) {
    return SizedBox(
      height: 180,
      child: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.card_giftcard,
              size: 48,
              color: Colors.grey.shade400,
            ),
            const SizedBox(height: 8),
            Text(
              title,
              style: const TextStyle(
                fontFamily: 'Recoleta',
                fontSize: 16,
                fontWeight: FontWeight.bold,
                color: Colors.black87,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 4),
            Text(
              message,
              style: const TextStyle(
                fontFamily: 'Afacad',
                fontSize: 13,
                color: Colors.black54,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}
