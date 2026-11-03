import 'package:flutter/material.dart';
import '../utils/app_colors.dart';

class TokenPricePair extends StatelessWidget {
  final int tokenValue;
  final double tokenFontSize;
  final FontWeight tokenFontWeight;
  final Color tokenColor;
  final bool asBadge;

  const TokenPricePair({
    super.key,
    required this.tokenValue,
    this.tokenFontSize = 14,
    this.tokenFontWeight = FontWeight.bold,
    this.tokenColor = const Color(0xFF2E5E58),
    this.asBadge = false,
  });

  @override
  Widget build(BuildContext context) {
    if (asBadge) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3.5),
        decoration: BoxDecoration(
          color: const Color(0xFFFFF7ED), // Warm amber tint
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: const Color(0xFFFDBA74).withValues(alpha: 0.65),
            width: 1,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            const Icon(
              Icons.stars_rounded,
              size: 13,
              color: Color(0xFFD97706),
            ),
            const SizedBox(width: 4),
            Text(
              '$tokenValue tokens',
              style: TextStyle(
                fontFamily: 'Afacad',
                fontSize: tokenFontSize > 0 ? tokenFontSize : 12.5,
                fontWeight: FontWeight.bold,
                color: const Color(0xFF9A3412),
                height: 1.1,
              ),
            ),
          ],
        ),
      );
    }

    return Row(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Text(
          '$tokenValue tokens',
          style: TextStyle(
            fontFamily: 'Afacad',
            fontSize: tokenFontSize,
            fontWeight: tokenFontWeight,
            color: tokenColor,
            height: 1,
          ),
        ),
      ],
    );
  }
}

class RmPriceChip extends StatelessWidget {
  final String price;
  final double fontSize;

  const RmPriceChip({
    super.key,
    required this.price,
    this.fontSize = 12.5,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3.5),
      decoration: BoxDecoration(
        color: AppColors.primary.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: AppColors.primary.withValues(alpha: 0.2),
          width: 1,
        ),
      ),
      child: Text(
        price,
        style: TextStyle(
          fontFamily: 'Afacad',
          fontSize: fontSize,
          fontWeight: FontWeight.bold,
          color: AppColors.primary,
          height: 1.1,
        ),
      ),
    );
  }
}
