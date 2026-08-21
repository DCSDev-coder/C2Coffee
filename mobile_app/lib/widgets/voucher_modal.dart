import 'package:flutter/material.dart';
import '../services/customer_data_service.dart';
import '../services/secure_session_service.dart';
import '../utils/app_colors.dart';

class VoucherModal {
  static Future<void> show(
    BuildContext context, {
    int? selectedVoucherId,
    required ValueChanged<RewardVoucher?> onVoucherSelected,
  }) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) {
        return _VoucherModalContent(
          selectedVoucherId: selectedVoucherId,
          onVoucherSelected: onVoucherSelected,
        );
      },
    );
  }
}

class _VoucherModalContent extends StatefulWidget {
  final int? selectedVoucherId;
  final ValueChanged<RewardVoucher?> onVoucherSelected;

  const _VoucherModalContent({
    required this.selectedVoucherId,
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
      final accessToken = await SecureSessionService.instance.getValidAccessToken();
      if (accessToken == null || accessToken.isEmpty) {
        throw Exception('Missing access token.');
      }

      final list = await CustomerDataService.instance.getRewardVouchers(
        accessToken: accessToken,
      );

      if (mounted) {
        setState(() {
          _vouchers = list
              .where((v) => v.isActive)
              .where((v) => v.template.voucherType != 'campaign_direct_pay')
              .toList();
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
                      'Select an active voucher for your order',
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

    if (_vouchers.isEmpty) {
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
              const Text(
                'No active vouchers available',
                style: TextStyle(
                  fontFamily: 'Recoleta',
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: Colors.black87,
                ),
              ),
              const SizedBox(height: 4),
              const Text(
                'Check back soon or earn vouchers from rewards!',
                style: TextStyle(
                  fontFamily: 'Afacad',
                  fontSize: 13,
                  color: Colors.black54,
                ),
              ),
            ],
          ),
        ),
      );
    }

    return SingleChildScrollView(
      child: Column(
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
          for (final voucher in _vouchers) ...[
            _buildVoucherTile(voucher),
            const SizedBox(height: 10),
          ],
        ],
      ),
    );
  }

  Widget _buildVoucherTile(RewardVoucher voucher) {
    final isSelected = widget.selectedVoucherId == voucher.id;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: isSelected
            ? AppColors.deepTeal.withValues(alpha: 0.06)
            : AppColors.surfaceLight,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isSelected
              ? AppColors.deepTeal
              : AppColors.border,
          width: isSelected ? 1.8 : 1,
        ),
      ),
      child: Row(
        children: [
          Container(
            width: 50,
            height: 50,
            decoration: BoxDecoration(
              color: AppColors.deepTeal.withValues(alpha: 0.12),
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
                  voucher.template.name,
                  style: TextStyle(
                    fontFamily: 'Afacad',
                    fontSize: 15,
                    fontWeight: FontWeight.bold,
                    color: AppColors.deepTeal,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  _formatDiscount(voucher),
                  style: TextStyle(
                    fontFamily: 'Afacad',
                    fontSize: 13,
                    fontWeight: FontWeight.bold,
                    color: AppColors.gold,
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
              ],
            ),
          ),
          const SizedBox(width: 8),
          ElevatedButton(
            onPressed: () {
              widget.onVoucherSelected(voucher);
              Navigator.pop(context);
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: isSelected ? AppColors.gold : AppColors.deepTeal,
              disabledBackgroundColor: Colors.grey.shade300,
              elevation: 0,
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(20),
              ),
            ),
            child: Text(
              isSelected ? 'Applied' : 'Apply',
              style: const TextStyle(
                fontFamily: 'Afacad',
                fontWeight: FontWeight.bold,
                fontSize: 13,
                color: Colors.white,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
