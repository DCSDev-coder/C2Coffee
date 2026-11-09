import 'package:flutter/material.dart';

class BaristaCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry padding;
  final EdgeInsetsGeometry? margin;
  final Color backgroundColor;
  final Color? borderColor;
  final double borderRadius;

  const BaristaCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(18),
    this.margin,
    this.backgroundColor = Colors.white,
    this.borderColor,
    this.borderRadius = 18.0,
  });

  static const Color ink = Color(0xFF203E32);

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: margin,
      padding: padding,
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(borderRadius),
        border: Border.all(
          color: borderColor ?? ink.withValues(alpha: 0.10),
          width: 1.0,
        ),
      ),
      child: child,
    );
  }
}

class BaristaSectionLabel extends StatelessWidget {
  final String label;

  const BaristaSectionLabel({super.key, required this.label});

  @override
  Widget build(BuildContext context) {
    return Text(
      label,
      style: TextStyle(
        color: const Color(0xFF203E32).withValues(alpha: 0.48),
        fontSize: 11,
        letterSpacing: 1.6,
        fontWeight: FontWeight.w800,
      ),
    );
  }
}
