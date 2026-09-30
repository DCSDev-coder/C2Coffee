import 'package:flutter/material.dart';

const Color datoAvatarBackground = Color(0xFFA9CCF5);
const Color datinAvatarBackground = Color(0xFFF4B6CF);

Color profilePlaceholderBackground({String? gender, String? presetPath}) {
  final normalizedGender = gender?.trim().toLowerCase();
  final normalizedPath = presetPath?.trim().toLowerCase() ?? '';
  return normalizedGender == 'female' || normalizedPath.endsWith('datin.png')
      ? datinAvatarBackground
      : datoAvatarBackground;
}
