import 'package:flutter/material.dart';

// Import all screens
import 'splash_screen.dart';
import 'home_screen.dart';
import 'login_screen.dart';
import 'step1_screen.dart';
import 'step2_screen.dart';
import 'otp_screen.dart';

void main() {
  runApp(const C2CoffeeApp());
}

class C2CoffeeApp extends StatelessWidget {
  const C2CoffeeApp({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'C² Coffee',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        primaryColor: const Color(0xFFE56000),
        scaffoldBackgroundColor: Colors.white,
        fontFamily: 'DM Sans', // Default body font
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFFE56000)),
      ),
      // Set the initial route to Splash Screen
      initialRoute: '/',
      routes: {
        '/': (context) => const SplashScreen(),
        '/home': (context) => const HomeScreen(),
        '/login': (context) => const LoginScreen(),
        '/step1': (context) => const Step1Screen(),
        '/step2': (context) => const Step2Screen(),
        '/otp': (context) => const OtpScreen(),
      },
    );
  }
}
