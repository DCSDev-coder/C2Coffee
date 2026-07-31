import 'package:flutter/material.dart';

class SuccessPage extends StatefulWidget {
  final String title;
  final String subtitle;
  final VoidCallback onDone;

  const SuccessPage({
    super.key,
    required this.title,
    required this.subtitle,
    required this.onDone,
  });

  @override
  State<SuccessPage> createState() => _SuccessPageState();
}

class _SuccessPageState extends State<SuccessPage>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _scaleAnimation;
  late Animation<double> _opacityAnimation;

  final Color orangeColor = const Color(0xFFE66B00);
  final Color beigeBg = const Color(0xFFFAF4EE);

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );

    _scaleAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _controller, curve: Curves.elasticOut),
    );

    _opacityAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _controller,
        curve: const Interval(0.0, 0.5, curve: Curves.easeIn),
      ),
    );

    _controller.forward();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: beigeBg,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 24.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const SizedBox(height: 40), // Spacer at the top
              
              // Center Content
              Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  AnimatedBuilder(
                    animation: _controller,
                    builder: (context, child) {
                      return Transform.scale(
                        scale: _scaleAnimation.value,
                        child: Opacity(
                          opacity: _opacityAnimation.value,
                          child: child,
                        ),
                      );
                    },
                    child: Container(
                      width: 120,
                      height: 120,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: orangeColor,
                          width: 8,
                        ),
                      ),
                      child: Center(
                        child: Icon(
                          Icons.check,
                          color: orangeColor,
                          size: 80,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 32),
                  AnimatedOpacity(
                    opacity: 1.0,
                    duration: const Duration(milliseconds: 500),
                    child: Text(
                      widget.title,
                      style: const TextStyle(
                        fontFamily: 'Recoleta',
                        fontSize: 28,
                        fontWeight: FontWeight.bold,
                        color: Colors.black87,
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  AnimatedOpacity(
                    opacity: 1.0,
                    duration: const Duration(milliseconds: 500),
                    child: Text(
                      widget.subtitle,
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontFamily: 'Afacad',
                        fontSize: 16,
                        color: Colors.grey.shade600,
                      ),
                    ),
                  ),
                ],
              ),
              
              // Bottom Button
              SizedBox(
                width: double.infinity,
                height: 56,
                child: ElevatedButton(
                  onPressed: widget.onDone,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: orangeColor,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    elevation: 0,
                  ),
                  child: const Text(
                    'DONE',
                    style: TextStyle(
                      fontFamily: 'Afacad',
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
