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

    return SizedBox(
      width: width + 24,
      height: height + 24,
      child: AnimatedBuilder(
        animation: _controller,
        builder: (context, child) {
          double value = _controller.value;
          // Smooth non-linear progress for liquid rising
          double progress = 0.5 - 0.5 * math.cos(value * math.pi);

          return Stack(
            alignment: Alignment.center,
            children: [
              // 1. Soft Ambient Backlight Glow behind the cup
              Container(
                width: width * 1.1,
                height: height * 0.9,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: AppColors.deepTeal.withValues(alpha: 0.35),
                      blurRadius: 28,
                      spreadRadius: 4,
                    ),
                    BoxShadow(
                      color: const Color(0xFFC89662).withValues(alpha: 0.15),
                      blurRadius: 20,
                      spreadRadius: 2,
                    ),
                  ],
                ),
              ),

              // 2. Main Glass Cup & Fluid Fill Container (No Pouring Stream)
              SizedBox(
                width: width,
                height: height,
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    // Smooth Dual-Layer Fluid & Crema Fill
                    CustomPaint(
                      size: Size(width, height),
                      painter: AestheticFluidPainter(
                        progress: progress,
                        animValue: value,
                      ),
                    ),

                    // Elegant C² Brand Stamp (ALWAYS WHITE)
                    Text(
                      "C²",
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: width * 0.30,
                        fontWeight: FontWeight.w900,
                        fontFamily: 'Recoleta',
                        shadows: [
                          Shadow(
                            color: Colors.black.withValues(alpha: 0.4),
                            blurRadius: 4,
                            offset: const Offset(0, 1),
                          ),
                        ],
                      ),
                    ),

                    // User's C2 Cup Glass Image Outline (Clean Transparent PNG)
                    Image.asset(
                      'assets/images/c2_cup_outline_transparent.png',
                      width: width,
                      height: height,
                      fit: BoxFit.fill,
                    ),
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class AestheticFluidPainter extends CustomPainter {
  final double progress;
  final double animValue;

  AestheticFluidPainter({
    required this.progress,
    required this.animValue,
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

    // Rich Coffee Gradient Fill
    Paint coffeePaint = Paint()
      ..shader = LinearGradient(
        begin: Alignment.bottomCenter,
        end: Alignment.topCenter,
        colors: const [
          Color(0xFF23130C), // Dark Espresso
          Color(0xFF4A2B18), // Medium Roast
          Color(0xFF6F4326), // Artisan Coffee
          Color(0xFF9E6538), // Golden Amber
        ],
      ).createShader(Rect.fromLTWH(0, liquidY, w, fillHeight + 10));

    canvas.drawRect(
      Rect.fromLTWH(0, liquidY, w, fillHeight + 12),
      coffeePaint,
    );

    // Dynamic Dual-Layer Waves at Top of Liquid
    if (fillHeight > 1.5) {
      // 1. Back Foam Layer (Golden Amber Crema)
      Paint backFoamPaint = Paint()..color = const Color(0xFFE9C46A);
      Path backWave = Path();
      backWave.moveTo(0, liquidY);
      for (double x = 0; x <= w; x += 1) {
        backWave.lineTo(
          x,
          liquidY +
              math.sin((x / w * 2 * math.pi) + (animValue * math.pi * 4)) * 1.8 -
              0.5,
        );
      }
      backWave.lineTo(w, h);
      backWave.lineTo(0, h);
      backWave.close();
      canvas.drawPath(backWave, backFoamPaint);

      // 2. Front Foam Layer (Silky Velvet Foam)
      Paint frontFoamPaint = Paint()..color = const Color(0xFFD4A373);
      Path frontWave = Path();
      frontWave.moveTo(0, liquidY);
      for (double x = 0; x <= w; x += 1) {
        frontWave.lineTo(
          x,
          liquidY +
              math.sin((x / w * 2 * math.pi) - (animValue * math.pi * 3) + 1.2) *
                  2.2,
        );
      }
      frontWave.lineTo(w, h);
      frontWave.lineTo(0, h);
      frontWave.close();
      canvas.drawPath(frontWave, frontFoamPaint);
    }

    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant AestheticFluidPainter oldDelegate) {
    return oldDelegate.progress != progress ||
        oldDelegate.animValue != animValue;
  }
}
