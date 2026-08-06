import 'package:flutter/material.dart';

/// C2 Coffee & Candle — Brand Colour Palette
///
/// Sage Teal   #6F9F96
/// Deep Teal   #2E5E58
/// Charcoal    #2C2C2C
/// Terracotta  #E0715F
/// Soft Gold   #D4AF7A
/// White       #FFFFFF
class AppColors {
  AppColors._();

  // ── Core brand ────────────────────────────────────────────────────
  static const Color sageTeal    = Color(0xFF6F9F96);
  static const Color deepTeal    = Color(0xFF2E5E58);
  static const Color charcoal    = Color(0xFF2C2C2C);
  static const Color terracotta  = Color(0xFFE0715F);
  static const Color softGold    = Color(0xFFD4AF7A);
  static const Color white       = Color(0xFFFFFFFF);

  // ── Derived / semantic aliases ────────────────────────────────────

  /// Main brand colour (replaces the old dark-forest-green 0xFF1D2415).
  static const Color primary       = deepTeal;

  /// Secondary / supporting teal used for icons, highlights, tags.
  static const Color secondary     = sageTeal;

  /// Bold CTA — buttons, badges, highlights that need to pop.
  static const Color accent        = terracotta;

  /// Premium / loyalty gold — tier badges, star ratings, gold member.
  static const Color gold          = softGold;

  /// Body & heading text.
  static const Color textDark      = charcoal;

  /// Muted helper / caption text.
  static const Color textMuted     = Color(0xFF6B7280);

  /// Page / scaffold background.
  static const Color background    = white;

  // ── Surface / card tints (replaces the old grey-green tints) ─────

  /// Light teal-tinted card / chip background.
  static const Color surfaceLight  = Color(0xFFEDF4F3);

  /// Slightly richer teal tint (replaces 0xFFF2F4F2).
  static const Color surfaceMid    = Color(0xFFE4EEEC);

  /// Border / divider colour.
  static const Color border        = Color(0xFFCFDEDB);

  // ── Bottom-nav / status bar tints ────────────────────────────────

  /// Inactive nav icon.
  static const Color navInactive   = Color(0xFFADB9B7);

  // ── Gradient helpers ─────────────────────────────────────────────

  /// Header gradient: deep teal → sage teal.
  static const LinearGradient headerGradient = LinearGradient(
    colors: [deepTeal, sageTeal],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  /// Gold gradient for premium cards.
  static const LinearGradient goldGradient = LinearGradient(
    colors: [Color(0xFFD4AF7A), Color(0xFFF0D9A8)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );
}
