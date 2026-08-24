import 'package:flutter/material.dart';
import '../main.dart';

class ActiveBaristaProfile extends StatelessWidget {
  final String baristaName;
  final VoidCallback? onTap;
  
  const ActiveBaristaProfile({
    super.key,
    this.baristaName = 'Nur', // Default mock name
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    const Color darkGreen = Color(0xFF304A3A);

    return ValueListenableBuilder<String>(
      valueListenable: globalActiveBarista,
      builder: (context, activeName, _) {
        return InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(24.0),
          child: Padding(
            padding: const EdgeInsets.all(4.0),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      activeName,
                      style: const TextStyle(
                        color: darkGreen,
                        fontWeight: FontWeight.bold,
                        fontSize: 16,
                      ),
                    ),
                    Text(
                      'Active',
                      style: TextStyle(
                        color: darkGreen.withValues(alpha: 0.7),
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
                const SizedBox(width: 12),
                CircleAvatar(
                  radius: 20,
                  backgroundColor: darkGreen.withValues(alpha: 0.1),
                  child: const Icon(
                    Icons.person,
                    color: darkGreen,
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
