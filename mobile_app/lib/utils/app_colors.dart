import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// C2 Coffee & Candle — Dynamic Tier-Based Brand Colour Palette
///
/// Tier 1 & 2 (Standard Theme):
///   Deep Teal   #2E5E58
///   Sage Teal   #6F9F96
///   Terracotta  #E0715F
///   Soft Gold   #D4AF7A
///   White       #FFFFFF
///
/// Tier 3 & 4 (VIP / Legend Theme):
///   Deep Forest #1F3A34
///   Sage Green  #A8C4A2
///   Amber Gold  #AD6D15
///   White       #FFFFFF
class AppColors {
  AppColors._();

  // ── Reactive Tier State ───────────────────────────────────────────
  static const String _tierPrefKey = 'selected_user_tier';

  /// 0 = Tier 1 (Novice), 1 = Tier 2 (Explorer), 2 = Tier 3 (Master), 3 = Tier 4 (Legend)
  static final ValueNotifier<int> currentTier = ValueNotifier<int>(1);

  static bool get isTier3Or4 => currentTier.value >= 2;

  static Future<void> loadTier() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final savedTier = prefs.getInt(_tierPrefKey) ?? 1;
      currentTier.value = savedTier.clamp(0, 3);
    } catch (_) {}
  }

  static void setTier(int tierIndex) {
    final clamped = tierIndex.clamp(0, 3);
    if (currentTier.value != clamped) {
      currentTier.value = clamped;
      SharedPreferences.getInstance().then((prefs) {
        prefs.setInt(_tierPrefKey, clamped);
      }).catchError((_) {});
    }
  }

  // ── Dynamic Tier Discounts ─────────────────────────────────────────

  /// Drink discount amount in RM according to current tier:
  /// - Tier 1: RM 1.00 OFF
  /// - Tier 2: RM 2.00 OFF
  /// - Tier 3: RM 3.00 OFF
  /// - Tier 4: RM 4.00 OFF
  static double get tierDrinkDiscount => (currentTier.value + 1).toDouble();

  /// Merchandise discount percentage:
  /// - Tier 1: 0%
  /// - Tier 2: 5% (0.05)
  /// - Tier 3: 10% (0.10)
  /// - Tier 4: 20% (0.20)
  static double get tierMerchDiscountPercent {
    switch (currentTier.value) {
      case 1:
        return 0.05;
      case 2:
        return 0.10;
      case 3:
        return 0.20;
      default:
        return 0.0;
    }
  }

  /// Calculates the discounted price for a drink (RM 1/2/3/4 off)
  static double getDiscountedDrinkPrice(double originalPrice) {
    final discounted = originalPrice - tierDrinkDiscount;
    return discounted > 0 ? discounted : 0.0;
  }

  /// Calculates the discounted price for merchandise (0%/5%/10%/20% off)
  static double getDiscountedMerchPrice(double originalPrice) {
    final discounted = originalPrice * (1.0 - tierMerchDiscountPercent);
    return discounted > 0 ? discounted : 0.0;
  }

  /// Formats a raw price string (e.g. "RM 16.90") to the discounted price string.
  /// Only DRINKS and MERCHANDISE receive tier discounts.
  /// Pastries and other non-drink/non-merch items are NOT discounted.
  static String formatDiscountedPrice(
    String? rawPrice, {
    bool isDrink = false,
    bool isMerchandise = false,
  }) {
    if (rawPrice == null || rawPrice.isEmpty) return '';
    final cleanPrice =
        rawPrice.replaceAll('RM', '').replaceAll(r'$', '').trim();
    final val = double.tryParse(cleanPrice);
    if (val == null) return rawPrice;

    double finalPrice = val;
    if (isDrink) {
      finalPrice = getDiscountedDrinkPrice(val);
    } else if (isMerchandise) {
      finalPrice = getDiscountedMerchPrice(val);
    } else {
      // Pastries and all other non-drink / non-merch items remain at original price
      finalPrice = val;
    }
    return 'RM ${finalPrice.toStringAsFixed(2)}';
  }

  /// Formats the stored RM base price without applying any tier discount.
  static String formatRmPrice(String? rawPrice) {
    if (rawPrice == null || rawPrice.isEmpty) return '';
    final cleanPrice =
        rawPrice.replaceAll('RM', '').replaceAll(r'$', '').trim();
    final val = double.tryParse(cleanPrice);
    if (val == null) return rawPrice;
    return 'RM ${val.toStringAsFixed(2)}';
  }

  // ── Static Theme 1 Constants (Tier 1 & 2) ──────────────────────────
  static const Color t1DeepTeal = Color(0xFF2E5E58);
  static const Color t1SageTeal = Color(0xFF6F9F96);
  static const Color t1Terracotta = Color(0xFFE0715F);
  static const Color t1SoftGold = Color(0xFFD4AF7A);
  static const Color t1SurfaceLight = Color(0xFFEDF4F3);
  static const Color t1SurfaceMid = Color(0xFFE4EEEC);
  static const Color t1Border = Color(0xFFCFDEDB);
  static const Color t1NavInactive = Color(0xFFADB9B7);

  // ── Static Theme 2 Constants (Tier 3 & 4) ──────────────────────────
  static const Color t2DeepForest = Color(0xFF1F3A34);
  static const Color t2SageGreen = Color(0xFFA8C4A2);
  static const Color t2AmberGold = Color(0xFFAD6D15);
  static const Color t2SurfaceLight = Color(0xFFEFF5EE);
  static const Color t2SurfaceMid = Color(0xFFE4EDE3);
  static const Color t2Border = Color(0xFFC8DBC6);
  static const Color t2NavInactive = Color(0xFFA5B6A3);

  // ── Shared Neutral Constants ──────────────────────────────────────
  static const Color charcoal = Color(0xFF2C2C2C);
  static const Color white = Color(0xFFFFFFFF);
  static const Color textMuted = Color(0xFF6B7280);

  // ── Dynamic Dynamic Theme Getters ─────────────────────────────────

  /// Primary deep teal brand color (#2E5E58 in Tier 1&2, #1F3A34 in Tier 3&4)
  static Color get primary => isTier3Or4 ? t2DeepForest : t1DeepTeal;
  static Color get deepTeal => primary;

  /// Secondary sage teal color (#6F9F96 in Tier 1&2, #A8C4A2 in Tier 3&4)
  static Color get secondary => isTier3Or4 ? t2SageGreen : t1SageTeal;
  static Color get sageTeal => secondary;

  /// Accent CTA color (#E0715F in Tier 1&2, #AD6D15 in Tier 3&4)
  static Color get accent => isTier3Or4 ? t2AmberGold : t1Terracotta;
  static Color get terracotta => accent;

  /// Loyalty / gold badge color (#D4AF7A in Tier 1&2, #AD6D15 in Tier 3&4)
  static Color get gold => isTier3Or4 ? t2AmberGold : t1SoftGold;
  static Color get softGold => gold;

  /// Body & heading text
  static Color get textDark => charcoal;

  /// Page / scaffold background
  static Color get background => white;

  /// Light tinted card / chip background
  static Color get surfaceLight => isTier3Or4 ? t2SurfaceLight : t1SurfaceLight;

  /// Slightly richer tint
  static Color get surfaceMid => isTier3Or4 ? t2SurfaceMid : t1SurfaceMid;

  /// Border / divider colour
  static Color get border => isTier3Or4 ? t2Border : t1Border;

  /// Inactive nav icon
  static Color get navInactive => isTier3Or4 ? t2NavInactive : t1NavInactive;

  // ── Gradient helpers ─────────────────────────────────────────────

  /// Dynamic Header gradient: deep teal → sage teal
  static LinearGradient get headerGradient => LinearGradient(
        colors: isTier3Or4
            ? const [t2DeepForest, t2SageGreen]
            : const [t1DeepTeal, t1SageTeal],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      );

  /// Dynamic Gold gradient for premium cards
  static LinearGradient get goldGradient => LinearGradient(
        colors: isTier3Or4
            ? const [Color(0xFFAD6D15), Color(0xFFE5A93C)]
            : const [Color(0xFFD4AF7A), Color(0xFFF0D9A8)],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      );

  /// Builds a ThemeData tailored to the current tier
  static ThemeData getThemeData() {
    final prim = primary;
    return ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.fromSeed(
        seedColor: prim,
        primary: prim,
        secondary: secondary,
        surface: background,
      ),
      scaffoldBackgroundColor: background,
      appBarTheme: AppBarTheme(
        backgroundColor: prim,
        foregroundColor: Colors.white,
        elevation: 0,
      ),
      fontFamily: 'Afacad',
    );
  }
}
