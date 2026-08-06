import 'package:flutter/material.dart';
import '../utils/app_colors.dart';

class AboutUsPage extends StatelessWidget {
  const AboutUsPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: Column(
        children: [
          // Header
          Container(
            width: double.infinity,
            padding: EdgeInsets.only(
                top: MediaQuery.paddingOf(context).top + 14,
                bottom: 16,
                left: 20,
                right: 20),
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
                    onTap: () => Navigator.pop(context),
                    child: const Icon(Icons.arrow_back_ios, color: Colors.white, size: 20),
                  ),
                ),
                const Text(
                  'ABOUT US',
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
          const Spacer(),
          // Content
          Container(
            height: 140,
            width: 140,
            decoration: BoxDecoration(
              color: AppColors.deepTeal,
              shape: BoxShape.circle,
            ),
            padding: const EdgeInsets.all(24),
            child: Image.asset(
              'assets/images/c2_logo.png',
              fit: BoxFit.contain,
              color: Colors.white,
            ),
          ),
          const SizedBox(height: 16),
          Text(
            'Sip The Calm',
            style: TextStyle(
              fontFamily: 'Recoleta',
              fontSize: 24,
              fontWeight: FontWeight.bold,
              color: AppColors.deepTeal,
            ),
          ),
          const SizedBox(height: 24),
          const Text(
            'version:v1.4.35_1471',
            style: TextStyle(
              fontFamily: 'Afacad',
              fontSize: 14,
              color: Colors.black54,
            ),
          ),
          const Spacer(),
          // Footer
          const Padding(
            padding: EdgeInsets.only(bottom: 40),
            child: Text(
              'Copyright © 2023 c2coffee.com',
              style: TextStyle(
                fontFamily: 'Afacad',
                fontSize: 12,
                color: Colors.black54,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
