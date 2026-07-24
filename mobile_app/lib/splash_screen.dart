import 'package:flutter/material.dart';

class SplashScreen extends StatelessWidget {
  const SplashScreen({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF121814),
      body: Stack(
        children: [
          // Background Image
          Container(
            width: double.infinity,
            height: double.infinity,
            decoration: const BoxDecoration(
              image: DecorationImage(
                image: AssetImage('assets/splash_bg.jpg'),
                fit: BoxFit.cover,
              ),
            ),
          ),
          
          // Gradient Overlay
          Container(
            width: double.infinity,
            height: double.infinity,
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  Color(0x73141E18), // rgba(20, 30, 24, 0.45)
                  Color(0xBF0F1914), // rgba(15, 25, 20, 0.75)
                ],
              ),
            ),
          ),
          
          // Content
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.only(top: 40, left: 24, right: 24, bottom: 36),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Spacer(),
                  
                  // Center Logo Wrap
                  Container(
                    width: 250,
                    height: 250,
                    alignment: Alignment.center,
                    child: Image.asset(
                      'assets/c2_logo.png',
                      fit: BoxFit.contain,
                      // The filter: drop-shadow isn't directly 1:1 in Flutter for images
                      // without using specialized widgets, but we can approximate or leave it.
                    ),
                  ),
                  
                  const Spacer(),
                  
                  // Bottom Section
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8.0),
                    child: SizedBox(
                      width: MediaQuery.of(context).size.width * 0.88,
                      height: 48,
                      child: ElevatedButton(
                        onPressed: () {
                          // Navigate to step 1
                          Navigator.pushNamed(context, '/step1');
                        },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF264330),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(24),
                          ),
                          elevation: 8,
                          shadowColor: Colors.black.withOpacity(0.35),
                        ),
                        child: const Text(
                          'Get Started',
                          style: TextStyle(
                            fontFamily: 'Playfair Display',
                            fontWeight: FontWeight.w700,
                            fontSize: 15,
                            letterSpacing: 0.5,
                            color: Colors.white,
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
