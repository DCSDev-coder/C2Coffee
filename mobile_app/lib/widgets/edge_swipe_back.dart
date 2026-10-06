import 'package:flutter/material.dart';

class EdgeSwipeBack extends StatefulWidget {
  final Widget child;
  final VoidCallback onBack;

  const EdgeSwipeBack({
    super.key,
    required this.child,
    required this.onBack,
  });

  @override
  State<EdgeSwipeBack> createState() => _EdgeSwipeBackState();
}

class _EdgeSwipeBackState extends State<EdgeSwipeBack> {
  static const _edgeWidth = 32.0;
  static const _minimumSwipeDistance = 72.0;
  double? _startX;
  double _dragDistance = 0;

  bool get _canPop => Navigator.of(context).canPop();

  @override
  Widget build(BuildContext context) {
    return Listener(
      onPointerDown: (event) {
        _startX = event.position.dx;
        _dragDistance = 0;
      },
      onPointerCancel: (_) => _resetGesture(),
      child: GestureDetector(
        behavior: HitTestBehavior.translucent,
        onHorizontalDragUpdate: (details) {
          if (_startX == null || _startX! > _edgeWidth || !_canPop) return;
          _dragDistance = (_dragDistance + details.delta.dx).clamp(0, 500);
        },
        onHorizontalDragEnd: (details) {
          final shouldPop = _startX != null &&
              _startX! <= _edgeWidth &&
              _canPop &&
              (_dragDistance >= _minimumSwipeDistance ||
                  (details.primaryVelocity ?? 0) > 700);
          _resetGesture();
          if (shouldPop) widget.onBack();
        },
        child: widget.child,
      ),
    );
  }

  void _resetGesture() {
    _startX = null;
    _dragDistance = 0;
  }
}
