import 'dart:math';
import 'package:flutter/material.dart';

enum ConfettiShape { rectangle, circle, ribbon }

class ConfettiParticle {
  double x;
  double y;
  double vx;
  double vy;
  double rotation;
  double rotationSpeed;
  double width;
  double height;
  Color color;
  ConfettiShape shape;
  double opacity;

  ConfettiParticle({
    required this.x,
    required this.y,
    required this.vx,
    required this.vy,
    required this.rotation,
    required this.rotationSpeed,
    required this.width,
    required this.height,
    required this.color,
    required this.shape,
    this.opacity = 1.0,
  });
}

class ConfettiWidget extends StatefulWidget {
  final int particleCount;
  final Duration duration;
  final bool autoStart;
  final VoidCallback? onFinished;

  const ConfettiWidget({
    super.key,
    this.particleCount = 70,
    this.duration = const Duration(milliseconds: 2500),
    this.autoStart = true,
    this.onFinished,
  });

  @override
  State<ConfettiWidget> createState() => _ConfettiWidgetState();
}

class _ConfettiWidgetState extends State<ConfettiWidget>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  final List<ConfettiParticle> _particles = [];
  final Random _random = Random();

  final List<Color> _colors = const [
    Color(0xFF2E5E58), // C2 Forest Green
    Color(0xFFFFB300), // Golden Amber
    Color(0xFFFFD54F), // Bright Yellow
    Color(0xFFFF7043), // Coral
    Color(0xFF4CAF50), // Fresh Green
    Color(0xFF26A69A), // Teal
    Color(0xFFAB47BC), // Purple
    Color(0xFFE91E63), // Pink
  ];

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: widget.duration,
    );

    _controller.addListener(() {
      _updateParticles();
    });

    _controller.addStatusListener((status) {
      if (status == AnimationStatus.completed) {
        widget.onFinished?.call();
      }
    });

    if (widget.autoStart) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _spawnParticles();
        _controller.forward(from: 0.0);
      });
    }
  }

  void _spawnParticles() {
    final size = MediaQuery.of(context).size;
    final startX = size.width / 2;
    final startY = size.height * 0.35; // Originates around center/upper region

    _particles.clear();
    for (int i = 0; i < widget.particleCount; i++) {
      final angle = _random.nextDouble() * 2 * pi;
      final speed = 250 + _random.nextDouble() * 450;
      final vx = cos(angle) * speed;
      final vy = sin(angle) * speed - 200; // upward boost

      _particles.add(
        ConfettiParticle(
          x: startX + (_random.nextDouble() - 0.5) * 60,
          y: startY + (_random.nextDouble() - 0.5) * 40,
          vx: vx,
          vy: vy,
          rotation: _random.nextDouble() * 2 * pi,
          rotationSpeed: (_random.nextDouble() - 0.5) * 12,
          width: 8 + _random.nextDouble() * 10,
          height: 6 + _random.nextDouble() * 8,
          color: _colors[_random.nextInt(_colors.length)],
          shape: ConfettiShape.values[_random.nextInt(ConfettiShape.values.length)],
        ),
      );
    }
  }

  void _updateParticles() {
    final progress = _controller.value;
    final dt = 0.016; // Approx 60fps delta time

    for (final p in _particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 650 * dt; // Gravity
      p.vx *= 0.985; // Air drag
      p.rotation += p.rotationSpeed * dt;

      // Fade out smoothly during the last 30% of animation
      if (progress > 0.7) {
        p.opacity = (1.0 - (progress - 0.7) / 0.3).clamp(0.0, 1.0);
      }
    }
    setState(() {});
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!_controller.isAnimating && _controller.isCompleted) {
      return const SizedBox.shrink();
    }

    return IgnorePointer(
      child: CustomPaint(
        size: Size.infinite,
        painter: _ConfettiPainter(_particles),
      ),
    );
  }
}

class _ConfettiPainter extends CustomPainter {
  final List<ConfettiParticle> particles;

  _ConfettiPainter(this.particles);

  @override
  void paint(Canvas canvas, Size size) {
    for (final p in particles) {
      if (p.opacity <= 0.0) continue;

      final paint = Paint()
        ..color = p.color.withValues(alpha: p.opacity)
        ..style = PaintingStyle.fill;

      canvas.save();
      canvas.translate(p.x, p.y);
      canvas.rotate(p.rotation);

      // Ribbon 3D flip effect using cos(rotation)
      final flipScale = cos(p.rotation * 1.5).abs();

      if (p.shape == ConfettiShape.circle) {
        canvas.drawCircle(Offset.zero, p.width / 2, paint);
      } else if (p.shape == ConfettiShape.ribbon) {
        final rect = Rect.fromCenter(
          center: Offset.zero,
          width: p.width * flipScale,
          height: p.height * 1.6,
        );
        canvas.drawRRect(
          RRect.fromRectAndRadius(rect, const Radius.circular(2)),
          paint,
        );
      } else {
        final rect = Rect.fromCenter(
          center: Offset.zero,
          width: p.width * flipScale,
          height: p.height,
        );
        canvas.drawRect(rect, paint);
      }

      canvas.restore();
    }
  }

  @override
  bool shouldRepaint(covariant _ConfettiPainter oldDelegate) => true;
}
