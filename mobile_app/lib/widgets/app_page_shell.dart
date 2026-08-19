import 'package:flutter/material.dart';
import '../utils/app_colors.dart';

class AppPageShell extends StatelessWidget {
  final String title;
  final Widget child;
  final VoidCallback onBack;
  final Color backgroundColor;
  final Color? headerColor;
  final EdgeInsetsGeometry? bodyPadding;
  final EdgeInsetsGeometry? headerPadding;
  final Widget? trailing;
  final bool showBackButton;

  const AppPageShell({
    super.key,
    required this.title,
    required this.child,
    required this.onBack,
    this.backgroundColor = Colors.white,
    this.headerColor,
    this.bodyPadding,
    this.headerPadding,
    this.trailing,
    this.showBackButton = true,
  });

  @override
  Widget build(BuildContext context) {
    final mediaQuery = MediaQuery.paddingOf(context);
    final effectiveBodyPadding = bodyPadding ??
        EdgeInsets.fromLTRB(
          20,
          20,
          20,
          mediaQuery.bottom + 28,
        );
    final effectiveHeaderColor = headerColor ?? AppColors.deepTeal;
    final effectiveHeaderPadding = headerPadding ??
        EdgeInsets.only(
          top: mediaQuery.top + 14,
          bottom: 16,
          left: 20,
          right: 20,
        );

    return ColoredBox(
      color: backgroundColor,
      child: Column(
        children: [
          Container(
            width: double.infinity,
            padding: effectiveHeaderPadding,
            decoration: BoxDecoration(
              color: effectiveHeaderColor,
              borderRadius: const BorderRadius.only(
                bottomLeft: Radius.circular(20),
                bottomRight: Radius.circular(20),
              ),
            ),
            child: SizedBox(
              height: 48,
              child: Stack(
                alignment: Alignment.center,
                children: [
                  if (showBackButton)
                    Align(
                      alignment: Alignment.centerLeft,
                      child: GestureDetector(
                        onTap: onBack,
                        child: const Icon(
                          Icons.arrow_back_ios,
                          color: Colors.white,
                          size: 20,
                        ),
                      ),
                    ),
                  Center(
                    child: Text(
                      title,
                      style: const TextStyle(
                        fontFamily: 'Recoleta',
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                        letterSpacing: 1.0,
                      ),
                    ),
                  ),
                  if (trailing != null)
                    Align(
                      alignment: Alignment.centerRight,
                      child: trailing!,
                    ),
                ],
              ),
            ),
          ),
          Expanded(
            child: SafeArea(
              top: false,
              child: SingleChildScrollView(
                keyboardDismissBehavior:
                    ScrollViewKeyboardDismissBehavior.onDrag,
                padding: effectiveBodyPadding,
                child: child,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
