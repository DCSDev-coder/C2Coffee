import 'package:flutter/material.dart';

class AppColors {
  static const Color primary = Color(0xFF2E5E58); // Deep Teal
  static const Color secondary = Color(0xFF6F9F96); // Sage Teal
  static const Color accent = Color(0xFFE0715F); // Terracotta
  static const Color surfaceLight = Color(0xFFEDF4F3);
  static const Color background = Colors.white;
  static const Color charcoal = Color(0xFF2C2C2C);
  
  static ThemeData getThemeData() {
    return ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.fromSeed(
        seedColor: primary,
        primary: primary,
        secondary: secondary,
        surface: background,
      ),
      scaffoldBackgroundColor: background,
      appBarTheme: const AppBarTheme(
        backgroundColor: primary,
        foregroundColor: Colors.white,
        elevation: 0,
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: primary,
          foregroundColor: Colors.white,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
        )
      ),
    );
  }
}
