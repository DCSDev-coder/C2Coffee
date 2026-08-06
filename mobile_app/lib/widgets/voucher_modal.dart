import 'package:flutter/material.dart';
import '../utils/app_colors.dart';

class VoucherModal {
  static void show(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) {
        return Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          padding: EdgeInsets.only(
            top: 20,
            left: 20,
            right: 20,
            bottom: 24 + MediaQuery.paddingOf(context).bottom,
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
                      Icons.monetization_on_rounded,
                      color: AppColors.gold,
                      size: 26,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Available Token Vouchers',
                          style: TextStyle(
                            fontFamily: 'Recoleta',
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                            color: AppColors.deepTeal,
                          ),
                        ),
                        const Text(
                          'Claim exclusive rewards using your tokens',
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
              const SizedBox(height: 20),
              // Voucher List
              Flexible(
                child: SingleChildScrollView(
                  child: Column(
                    children: [
                      _buildVoucherCard(
                        context,
                        title: 'Buy 1 Free 1 Any Coffee',
                        tokens: '50 tokens',
                        code: 'C2-B1F1-50',
                        color: AppColors.deepTeal,
                      ),
                      const SizedBox(height: 12),
                      _buildVoucherCard(
                        context,
                        title: 'RM 5 Off Any Drink',
                        tokens: '30 tokens',
                        code: 'C2-RM5-OFF',
                        color: AppColors.gold,
                      ),
                      const SizedBox(height: 12),
                      _buildVoucherCard(
                        context,
                        title: '10% Off Total Order',
                        tokens: '40 tokens',
                        code: 'C2-10PERCENT',
                        color: AppColors.accent,
                      ),
                      const SizedBox(height: 12),
                      _buildVoucherCard(
                        context,
                        title: 'Free Pastry With Beverage',
                        tokens: '60 tokens',
                        code: 'C2-FREE-PASTRY',
                        color: AppColors.deepTeal,
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  static Widget _buildVoucherCard(
    BuildContext context, {
    required String title,
    required String tokens,
    required String code,
    required Color color,
  }) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surfaceLight,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border, width: 1),
      ),
      child: Row(
        children: [
          Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Center(
              child: Image.asset(
                'assets/images/voucher.png',
                width: 40,
                height: 40,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyle(
                    fontFamily: 'Afacad',
                    fontSize: 15,
                    fontWeight: FontWeight.bold,
                    color: AppColors.deepTeal,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  tokens,
                  style: TextStyle(
                    fontFamily: 'Afacad',
                    fontSize: 13,
                    fontWeight: FontWeight.bold,
                    color: AppColors.gold,
                  ),
                ),
              ],
            ),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(context);
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: color,
              elevation: 0,
              padding:
                  const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(20),
              ),
            ),
            child: const Text(
              'Claim',
              style: TextStyle(
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
