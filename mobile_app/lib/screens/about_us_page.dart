import 'package:flutter/material.dart';

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
            padding: const EdgeInsets.only(top: 60, bottom: 20, left: 20, right: 20),
            decoration: const BoxDecoration(
              color: Color(0xFFE66B00),
              borderRadius: BorderRadius.only(
                bottomLeft: Radius.circular(30),
                bottomRight: Radius.circular(30),
              ),
            ),
            child: Stack(
              alignment: Alignment.center,
              children: [
                Align(
                  alignment: Alignment.centerLeft,
                  child: GestureDetector(
                    onTap: () => Navigator.pop(context),
                    child: const Icon(Icons.arrow_back_ios, color: Colors.white, size: 24),
                  ),
                ),
                const Text(
                  'ABOUT US',
                  style: TextStyle(
                    fontFamily: 'Recoleta',
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
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
            decoration: const BoxDecoration(
              color: Color(0xFFE66B00),
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
          const Text(
            'Sip The Calm',
            style: TextStyle(
              fontFamily: 'Recoleta',
              fontSize: 24,
              fontWeight: FontWeight.bold,
              color: Color(0xFFE66B00),
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
