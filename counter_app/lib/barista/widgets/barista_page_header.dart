import 'package:flutter/material.dart';

class BaristaPageHeader extends StatelessWidget {
  final String title;
  final String subtitle;
  final VoidCallback? onRefresh;
  final String? refreshTooltip;
  final Widget? trailing;
  final Widget? bottom;

  const BaristaPageHeader({
    super.key,
    required this.title,
    required this.subtitle,
    this.onRefresh,
    this.refreshTooltip,
    this.trailing,
    this.bottom,
  });

  static const Color ink = Color(0xFF203E32);

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      color: ink,
                      fontSize: 34,
                      height: 1.05,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    subtitle,
                    style: TextStyle(
                      color: ink.withValues(alpha: 0.65),
                      fontSize: 16,
                      height: 1.4,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 16),
            if (trailing != null)
              trailing!
            else if (onRefresh != null)
              IconButton.filledTonal(
                tooltip: refreshTooltip ?? 'Refresh',
                onPressed: onRefresh,
                icon: const Icon(Icons.refresh_rounded),
              ),
          ],
        ),
        if (bottom != null) ...[
          const SizedBox(height: 12),
          bottom!,
        ],
      ],
    );
  }
}
