import 'package:flutter/material.dart';

import '../main.dart';

class ActiveBaristaProfile extends StatelessWidget {
  final String baristaName;
  final VoidCallback? onTap;

  const ActiveBaristaProfile({super.key, this.baristaName = '', this.onTap});

  @override
  Widget build(BuildContext context) {
    const Color darkGreen = Color(0xFF304A3A);

    return ValueListenableBuilder<String>(
      valueListenable: globalActiveBarista,
      builder: (context, activeName, _) {
        final displayName = activeName.isNotEmpty ? activeName : baristaName;
        final initial = displayName.isNotEmpty
            ? displayName[0].toUpperCase()
            : '?';
        return InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(24.0),
          child: Padding(
            padding: const EdgeInsets.all(4.0),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                CircleAvatar(
                  radius: 20,
                  backgroundColor: darkGreen.withValues(alpha: 0.1),
                  child: Text(
                    initial,
                    style: const TextStyle(
                      color: darkGreen,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
