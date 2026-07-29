import 'package:flutter/material.dart';
import 'package:c2_coffee/authorization_backup/startup_selector.dart';
import 'package:c2_coffee/authorization_backup/loginbackup.dart';
import 'package:c2_coffee/screens/home_page.dart';

import 'package:c2_coffee/screens/splash_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const C2CoffeeApp());
}

class C2CoffeeApp extends StatelessWidget {
  const C2CoffeeApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'C² Coffee',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        fontFamily: 'Afacad',
        scaffoldBackgroundColor: const Color(0xFFFAF4EE),
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF2E5B4E),
        ),
      ),
      home: const SplashScreen(),
      routes: {
        '/login_backup': (context) => const LoginBackup(),
        '/home': (context) => const HomePage(),
      },
    );
  }
}
