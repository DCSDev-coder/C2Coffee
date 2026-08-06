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
    const primaryColor = Color(0xFF2E5E58); // Deep Forest Green

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
                    // Coffee Mug & Liquid Container
                    SizedBox(
                      width: 240,
                      height: 160,
                      child: Stack(
                        alignment: Alignment.center,
                        children: [
                          // Handle
                          Positioned(
                            left: 186,
                            top: 40,
                            child: Container(
                              width: 50,
                              height: 60,
                              decoration: BoxDecoration(
                                border: Border(
                                  top: BorderSide(
                                      color: const Color(0xFF3E2723), width: 4),
                                  right: BorderSide(
                                      color: const Color(0xFF3E2723), width: 4),
                                  bottom: BorderSide(
                                      color: const Color(0xFF3E2723), width: 4),
                                ),
                                borderRadius: const BorderRadius.horizontal(
                                    right: Radius.circular(30)),
                              ),
                            ),
                          ),
                          // Cup Body
                          Positioned(
                            left: 30,
                            child: Container(
                              width: 160,
                              height: 140,
                              decoration: BoxDecoration(
                                color: Colors.white.withValues(alpha: 0.1),
                                borderRadius: const BorderRadius.vertical(
                                    bottom: Radius.circular(40)),
                                border: Border.all(
                                    color: const Color(0xFF3E2723), width: 4),
                              ),
                              child: ClipRRect(
                                borderRadius: const BorderRadius.vertical(
                                    bottom: Radius.circular(36)),
                                child: Stack(
                                  alignment: Alignment.bottomCenter,
                                  children: [
                                    // Drink Gradient Fill
                                    FractionallySizedBox(
                                      widthFactor: 1.0,
                                      heightFactor: progress,
                                      child: Container(
                                        decoration: const BoxDecoration(
                                          gradient: LinearGradient(
                                            begin: Alignment.bottomCenter,
                                            end: Alignment.topCenter,
                                            colors: [
                                              Color(0xFF3E2723), // Dark Coffee
                                              Color(
                                                  0xFF5D4037), // Medium Coffee
                                              Color(0xFF8D6E63), // Light Foam
                                            ],
                                          ),
                                        ),
                                      ),
                                    ),

                                    // Wave Effect at the top of the liquid
                                    Positioned(
                                      bottom: 140 * progress - 10,
                                      child: CustomPaint(
                                        size: const Size(160, 20),
                                        painter: WavePainter(
                                            progress, const Color(0xFF8D6E63)),
                                      ),
                                    ),

                                    // Actual C2 Logo on Cup
                                    Center(
                                      child: Image.asset(
                                        'assets/images/c2_logo.png',
                                        width: 80,
                                        height: 80,
                                        fit: BoxFit.contain,
                                        color: progress > 0.4
                                            ? Colors.white
                                                .withValues(alpha: 0.8)
                                            : Colors.black
                                                .withValues(alpha: 0.8),
                                      ),
                                    ),
                                  ],
                                ),
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
                        color: Color(0xFF2E5E58),
                        fontFamily: 'Recoleta',
                      ),
                    ),

                    const SizedBox(height: 12),

                    // Status Text
                    const Text(
                      'SIP THE CALM ༄',
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
                            color: const Color(0xFF2E5E58).withValues(
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
                  '"A LATTE LOVE MAKES PERFECT SENSE ☕︎♡"',
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
