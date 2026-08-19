import 'package:flutter/material.dart';
import '../utils/app_colors.dart';
import '../widgets/app_page_shell.dart';

class AboutUsPage extends StatelessWidget {
  const AboutUsPage({super.key});

  @override
  Widget build(BuildContext context) {
    return AppPageShell(
      title: 'ABOUT US',
      onBack: () => Navigator.pop(context),
      backgroundColor: Colors.white,
      child: Column(
        children: [
          SizedBox(height: MediaQuery.sizeOf(context).height * 0.15),
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
          SizedBox(height: MediaQuery.sizeOf(context).height * 0.25),
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
