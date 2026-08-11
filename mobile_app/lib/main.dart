import 'package:flutter/material.dart';
import 'package:c2_coffee/authorization/login.dart';
import 'package:c2_coffee/screens/home_page.dart';
import 'package:c2_coffee/screens/splash_screen.dart';
import 'package:c2_coffee/utils/app_colors.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await AppColors.loadTier();
  runApp(const C2CoffeeApp());
}

class C2CoffeeApp extends StatelessWidget {
  const C2CoffeeApp({super.key});

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<int>(
      valueListenable: AppColors.currentTier,
      builder: (context, tier, child) {
        return MaterialApp(
          title: 'C² Coffee',
          debugShowCheckedModeBanner: false,
          theme: AppColors.getThemeData(),
          home: const SplashScreen(),
          routes: {
            '/login': (context) => const LoginPage(),
            '/login_backup': (context) => const LoginPage(),
            '/home': (context) => const HomePage(),
            '/splash': (context) => const SplashScreen(),
          },
        );
      },
    );
  }
}
