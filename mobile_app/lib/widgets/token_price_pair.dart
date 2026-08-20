import 'package:flutter/material.dart';

class TokenPricePair extends StatelessWidget {
  final int tokenValue;
  final double tokenFontSize;
  final FontWeight tokenFontWeight;
  final Color tokenColor;

  const TokenPricePair({
    super.key,
    required this.tokenValue,
    this.tokenFontSize = 14,
    this.tokenFontWeight = FontWeight.bold,
    this.tokenColor = const Color(0xFF2E5E58),
  });

  @override
  Widget build(BuildContext context) {
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
