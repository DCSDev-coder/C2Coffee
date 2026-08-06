import 'package:flutter/material.dart';
import '../widgets/c2_mini_loader.dart';

class InteractiveFillingLoader extends StatefulWidget {
  final Widget? targetPage;
  const InteractiveFillingLoader({super.key, this.targetPage});

  /// Helper to show loader directly over current screen without black background,
  /// then transition smoothly to targetPage when navigating forward.
  static void show(BuildContext context, {Widget? targetPage}) {
    if (targetPage == null) return;

    showDialog(
      context: context,
      barrierDismissible: false,
      useRootNavigator: true,
      barrierColor: Colors.black.withValues(alpha: 0.45),
      builder: (dialogContext) {
        return PopScope(
          canPop: false,
          child: Dialog(
            backgroundColor: Colors.transparent,
            elevation: 0,
            insetPadding: EdgeInsets.zero,
            child: Center(
              child: C2MiniLoader(
                size: 60.0,
                duration: const Duration(milliseconds: 850),
                onComplete: () {
                  if (dialogContext.mounted) {
                    Navigator.of(dialogContext, rootNavigator: true).pop();
                    if (context.mounted) {
                      Navigator.push(
                        context,
                        PageRouteBuilder(
                          transitionDuration: const Duration(milliseconds: 250),
                          pageBuilder: (context, animation, secondaryAnimation) =>
                              FadeTransition(
                            opacity: CurvedAnimation(
                              parent: animation,
                              curve: Curves.easeOut,
                            ),
                            child: targetPage,
                          ),
                        ),
                      );
                    }
                  }
                },
              ),
            ),
          ),
        );
      },
    );
  }

  /// Helper to show loader directly over current screen when clicking "go back",
  /// then pop back to the previous screen.
  static void showPop(BuildContext context) {
    showDialog(
      context: context,
      barrierDismissible: false,
      useRootNavigator: true,
      barrierColor: Colors.black.withValues(alpha: 0.45),
      builder: (dialogContext) {
        return PopScope(
          canPop: false,
          child: Dialog(
            backgroundColor: Colors.transparent,
            elevation: 0,
            insetPadding: EdgeInsets.zero,
            child: Center(
              child: C2MiniLoader(
                size: 60.0,
                duration: const Duration(milliseconds: 650),
                onComplete: () {
                  if (dialogContext.mounted) {
                    Navigator.of(dialogContext, rootNavigator: true).pop();
                    if (context.mounted) {
                      Navigator.of(context).pop();
                    }
                  }
                },
              ),
            ),
          ),
        );
      },
    );
  }

  @override
  State<InteractiveFillingLoader> createState() =>
      _InteractiveFillingLoaderState();
}

class _InteractiveFillingLoaderState extends State<InteractiveFillingLoader>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1800),
    );

    _controller.addStatusListener((status) {
      if (status == AnimationStatus.completed) {
        if (mounted) {
          if (widget.targetPage != null) {
            Navigator.pushReplacement(
              context,
              PageRouteBuilder(
                transitionDuration: const Duration(milliseconds: 300),
                pageBuilder: (context, animation, secondaryAnimation) =>
                    FadeTransition(
                        opacity: animation, child: widget.targetPage!),
              ),
            );
          } else {
            Navigator.pop(context);
          }
        }
      }
    });

    _controller.forward();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: Colors.transparent,
      elevation: 0,
      insetPadding: EdgeInsets.zero,
      child: const Center(
        child: C2MiniLoader(size: 55.0),
      ),
    );
  }
}
