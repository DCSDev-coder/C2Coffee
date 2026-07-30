import 'package:flutter/material.dart';
import 'dart:math' as math;

class InteractiveFillingLoader extends StatefulWidget {
  final Widget? targetPage;
  const InteractiveFillingLoader({super.key, this.targetPage});

  @override
  State<InteractiveFillingLoader> createState() =>
      _InteractiveFillingLoaderState();
}

class _InteractiveFillingLoaderState extends State<InteractiveFillingLoader>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _progressAnimation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 4),
    );

    _progressAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeInOutQuart),
    );

    _controller.addStatusListener((status) {
      if (status == AnimationStatus.completed) {
        if (widget.targetPage != null) {
          // Navigate to the target page smoothly once the animation finishes
          Navigator.pushReplacement(
            context,
            MaterialPageRoute(
              builder: (context) => widget.targetPage!,
            ),
          );
        } else {
          // If no target page is provided, simply pop the loader
          Navigator.pop(context);
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
    // Design System Colors: Artisan Roast
    const backgroundColor = Color(0xFFFAF9F6);
    const primaryColor = Color(0xFF1B3323); // Dark Green

    return Scaffold(
      backgroundColor: backgroundColor,
      body: AnimatedBuilder(
        animation: _controller,
        builder: (context, child) {
          double progress = _progressAnimation.value;
          int percentage = (progress * 100).toInt();

          return Stack(
            children: [
              // Main Content
              Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // Takeaway Cup & Liquid Container
                    SizedBox(
                      width: 200,
                      height: 260,
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.end,
                        children: [
                          // Plastic Lid
                          Container(
                            width: 130,
                            height: 12,
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.8),
                              borderRadius: const BorderRadius.vertical(
                                  top: Radius.circular(8)),
                              border: Border.all(
                                  color: Colors.grey.withValues(alpha: 0.3),
                                  width: 1.5),
                            ),
                          ),
                          Container(
                            width: 145,
                            height: 6,
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.85),
                              borderRadius: BorderRadius.circular(3),
                              border: Border.all(
                                  color: Colors.grey.withValues(alpha: 0.3),
                                  width: 1.5),
                            ),
                          ),
                          Container(
                            width: 170,
                            height: 10,
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.9),
                              borderRadius: BorderRadius.circular(5),
                              border: Border.all(
                                  color: Colors.grey.withValues(alpha: 0.3),
                                  width: 2),
                            ),
                          ),
                          // Cup Body
                          Container(
                            width: 160,
                            height: 220,
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.1),
                              borderRadius: const BorderRadius.vertical(
                                  bottom: Radius.circular(80)),
                              border: Border.all(
                                  color: Colors.grey.withValues(alpha: 0.3),
                                  width: 3),
                            ),
                            child: ClipRRect(
                              borderRadius: const BorderRadius.vertical(
                                  bottom: Radius.circular(77)),
                              child: Stack(
                                alignment: Alignment.bottomCenter,
                                children: [
                                  // Drink Gradient Fill
                                  FractionallySizedBox(
                                    widthFactor: 1.0,
                                    heightFactor: progress,
                                    child: Container(
                                      decoration: BoxDecoration(
                                        gradient: LinearGradient(
                                          begin: Alignment.bottomCenter,
                                          end: Alignment.topCenter,
                                          colors: [
                                            const Color(
                                                0xFFE84258), // Strawberry at bottom
                                            Colors.white.withValues(
                                                alpha: 0.95), // Milk in middle
                                            const Color(
                                                0xFF387F25), // Matcha green at top
                                          ],
                                          stops: const [0.25, 0.5, 1.0],
                                        ),
                                      ),
                                    ),
                                  ),

                                  // Wave Effect at the top of the liquid
                                  Positioned(
                                    bottom: 220 * progress - 10,
                                    child: CustomPaint(
                                      size: const Size(160, 20),
                                      painter: WavePainter(
                                          progress, const Color(0xFF387F25)),
                                    ),
                                  ),

                                  // Actual C2 Logo on Cup
                                  Center(
                                    child: Image.asset(
                                      'assets/images/c2_logo.png',
                                      width: 120,
                                      height: 120,
                                      fit: BoxFit.contain,
                                      color: Colors.black,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 40),

                    // Percentage Text
                    Text(
                      '$percentage%',
                      style: const TextStyle(
                        fontSize: 48,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFFE94E28),
                        fontFamily: 'Recoleta',
                      ),
                    ),

                    const SizedBox(height: 12),

                    // Status Text
                    const Text(
                      'SIP THE CALM',
                      style: TextStyle(
                        fontSize: 14,
                        letterSpacing: 2,
                        fontWeight: FontWeight.w600,
                        color: primaryColor,
                        fontFamily: 'Recoleta',
                      ),
                    ),

                    const SizedBox(height: 16),

                    // Animated Dots
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: List.generate(3, (index) {
                        return Container(
                          margin: const EdgeInsets.symmetric(horizontal: 4),
                          width: 8,
                          height: 8,
                          decoration: BoxDecoration(
                            color: const Color(0xFFE94E28).withValues(
                                alpha:
                                    _getDotOpacity(index, _controller.value)),
                            shape: BoxShape.circle,
                          ),
                        );
                      }),
                    ),
                  ],
                ),
              ),

              // Bottom Quote
              const Positioned(
                bottom: 60,
                left: 40,
                right: 40,
                child: Text(
                  '"A LATTE LOVE MAKES PERFECT SENSE."',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontStyle: FontStyle.italic,
                    fontSize: 14,
                    color: Colors.black54,
                    fontFamily: 'Afacad',
                    height: 1.5,
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  double _getDotOpacity(int index, double value) {
    double phase = (value * 3) % 1.0;
    double target = (index / 3.0);
    double diff = (phase - target).abs();
    return (1.0 - diff).clamp(0.2, 1.0);
  }
}

class WavePainter extends CustomPainter {
  final double progress;
  final Color color;

  WavePainter(this.progress, this.color);

  @override
  void paint(Canvas canvas, Size size) {
    if (progress <= 0 || progress >= 1) return;

    Paint paint = Paint()..color = color;
    Path path = Path();

    path.moveTo(0, size.height / 2);
    for (double i = 0; i <= size.width; i++) {
      path.lineTo(
        i,
        size.height / 2 +
            math.sin((i / size.width * 2 * math.pi) + (progress * 10)) * 5,
      );
    }
    path.lineTo(size.width, size.height);
    path.lineTo(0, size.height);
    path.close();

    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(CustomPainter oldDelegate) => true;
}
