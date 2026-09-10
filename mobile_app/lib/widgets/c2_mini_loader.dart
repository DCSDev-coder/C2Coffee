import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../utils/app_colors.dart';

class C2MiniLoader extends StatefulWidget {
  final double size;
  final VoidCallback? onComplete;
  final Duration duration;

  const C2MiniLoader({
    super.key,
    this.size = 54.0,
    this.onComplete,
    this.duration = const Duration(milliseconds: 750),
  });

  @override
  State<C2MiniLoader> createState() => _C2MiniLoaderState();
}

class _C2MiniLoaderState extends State<C2MiniLoader>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: widget.duration,
    );

    if (widget.onComplete != null) {
      _controller.addStatusListener((status) {
        if (status == AnimationStatus.completed) {
          widget.onComplete!();
        }
      });
      _controller.forward();
    } else {
      _controller.repeat();
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // Aspect ratio matching C2 glass cup (1 : 1.32)
    final width = widget.size;
    final height = width * 1.32;
    // The loader is a brand illustration, not a primary-action control.
    // Keep it tied to the supporting colour so primary action changes do not
    // unexpectedly recolour the launch experience.
    final supportingColor = AppColors.secondary;

    return SizedBox(
      width: width,
      height: height,
      child: AnimatedBuilder(
        animation: _controller,
        builder: (context, child) {
          double value = _controller.value;
          // Smooth non-linear progress for liquid rising
          double progress = 0.5 - 0.5 * math.cos(value * math.pi);

          return SizedBox(
            width: width,
            height: height,
            child: Stack(
              alignment: Alignment.center,
              children: [
                // Fluid & Wave Fill strictly using supporting color
                CustomPaint(
                  size: Size(width, height),
                  painter: AestheticFluidPainter(
                    progress: progress,
                    animValue: value,
                    supportingColor: supportingColor,
                  ),
                ),

                // C2 Brand Logo
                Image.asset(
                  'assets/images/c2_logo.png',
                  width: width * 0.45,
                  fit: BoxFit.contain,
                ),

                // C2 Cup Glass Image Outline (Clean Transparent PNG)
                Image.asset(
                  'assets/images/c2_cup_outline_transparent.png',
                  width: width,
                  height: height,
                  fit: BoxFit.fill,
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class AestheticFluidPainter extends CustomPainter {
  final double progress;
  final double animValue;
  final Color supportingColor;

  AestheticFluidPainter({
    required this.progress,
    required this.animValue,
    required this.supportingColor,
  });

  @override
  void paint(Canvas canvas, Size size) {
    double w = size.width;
    double h = size.height;

    // Cup interior clipping path strictly inside C2 cup contour
    Path innerCupPath = Path();
    innerCupPath.moveTo(w * 0.08, h * 0.04);
    innerCupPath.quadraticBezierTo(w * 0.10, h * 0.20, w * 0.13, h * 0.65);
    innerCupPath.cubicTo(
      w * 0.15,
      h * 0.94,
      w * 0.85,
      h * 0.94,
      w * 0.87,
      h * 0.65,
    );
    innerCupPath.quadraticBezierTo(w * 0.90, h * 0.20, w * 0.92, h * 0.04);
    innerCupPath.close();

    canvas.save();
    canvas.clipPath(innerCupPath);

    // Fill up to ~72% of the cup height so the drink doesn't fill up all the way to the top
    double maxFillHeight = h * 0.72;
    double fillHeight = maxFillHeight * progress;
    double liquidY = (h * 0.95) - fillHeight;

    // Fluid body using the supporting brand colour with natural gradient depth
    Paint liquidPaint = Paint()
      ..shader = LinearGradient(
        begin: Alignment.bottomCenter,
        end: Alignment.topCenter,
        colors: [
          Color.lerp(supportingColor, Colors.black, 0.18)!,
          supportingColor,
          Color.lerp(supportingColor, Colors.white, 0.15)!,
        ],
      ).createShader(Rect.fromLTWH(0, liquidY, w, fillHeight + 10));

    canvas.drawRect(
      Rect.fromLTWH(0, liquidY, w, fillHeight + 12),
      liquidPaint,
    );

    // Dynamic Dual-Layer Waves at Top of Liquid
    if (fillHeight > 1.5) {
      // 1. Back Wave Layer (Slightly lighter tint of supporting color)
      Paint backWavePaint = Paint()
        ..color = Color.lerp(supportingColor, Colors.white, 0.32)!;
      Path backWave = Path();
      backWave.moveTo(0, liquidY);
      for (double x = 0; x <= w; x += 1) {
        backWave.lineTo(
          x,
          liquidY +
              math.sin((x / w * 2 * math.pi) + (animValue * math.pi * 4)) *
                  1.8 -
              0.5,
        );
      }
      backWave.lineTo(w, h);
      backWave.lineTo(0, h);
      backWave.close();
      canvas.drawPath(backWave, backWavePaint);

      // 2. Front Wave Layer (Vibrant supporting color highlight)
      Paint frontWavePaint = Paint()
        ..color = Color.lerp(supportingColor, Colors.black, 0.06)!;
      Path frontWave = Path();
      frontWave.moveTo(0, liquidY);
      for (double x = 0; x <= w; x += 1) {
        frontWave.lineTo(
          x,
          liquidY +
              math.sin(
                      (x / w * 2 * math.pi) - (animValue * math.pi * 3) + 1.2) *
                  2.2,
        );
      }
      frontWave.lineTo(w, h);
      frontWave.lineTo(0, h);
      frontWave.close();
      canvas.drawPath(frontWave, frontWavePaint);
    }

    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant AestheticFluidPainter oldDelegate) {
    return oldDelegate.progress != progress ||
        oldDelegate.animValue != animValue ||
        oldDelegate.supportingColor != supportingColor;
  }
}
