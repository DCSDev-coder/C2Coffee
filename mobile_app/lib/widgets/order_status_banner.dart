import 'package:flutter/material.dart';
import '../utils/global_state.dart';
import '../screens/order_status_detail_page.dart';

class OrderStatusBanner extends StatefulWidget {
  final double? bottomOffset;
  final double? leftOffset;
  final double? rightOffset;

  const OrderStatusBanner({
    super.key,
    this.bottomOffset,
    this.leftOffset,
    this.rightOffset,
  });

  @override
  State<OrderStatusBanner> createState() => _OrderStatusBannerState();
}

class _OrderStatusBannerState extends State<OrderStatusBanner>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<Offset> _slideAnimation;
  late Animation<double> _fadeAnimation;

  final Color orangeColor = const Color(0xFF2E5E58);

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 400),
    );

    _slideAnimation = Tween<Offset>(
      begin: const Offset(0.0, 1.0),
      end: Offset.zero,
    ).animate(CurvedAnimation(
      parent: _controller,
      curve: Curves.easeOutCubic,
    ));

    _fadeAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeIn),
    );

    // Initial check
    if (globalOrderStatusVisible.value) {
      _controller.forward();
    }

    _controller.addStatusListener((status) {
      if (mounted) {
        setState(() {});
      }
    });

    globalOrderStatusVisible.addListener(_onGlobalStateChanged);
  }

  void _onGlobalStateChanged() {
    if (globalOrderStatusVisible.value) {
      _controller.forward();
    } else {
      _controller.reverse();
    }
  }

  @override
  void dispose() {
    globalOrderStatusVisible.removeListener(_onGlobalStateChanged);
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final effectiveBottomOffset = widget.bottomOffset ??
        (84 + MediaQuery.paddingOf(context).bottom);
    final effectiveLeftOffset = widget.leftOffset ?? 16.0;
    final effectiveRightOffset = widget.rightOffset ?? 16.0;

    return ValueListenableBuilder<bool>(
      valueListenable: globalOrderStatusVisible,
      builder: (context, isVisible, child) {
        if (!isVisible && _controller.isDismissed) {
          return const SizedBox.shrink();
        }

        return Positioned(
          bottom: effectiveBottomOffset,
          left: effectiveLeftOffset,
          right: effectiveRightOffset,
          child: IgnorePointer(
            ignoring: !isVisible ||
                _controller.status == AnimationStatus.dismissed ||
                _controller.status == AnimationStatus.reverse,
            child: SlideTransition(
              position: _slideAnimation,
              child: FadeTransition(
                opacity: _fadeAnimation,
                child: Stack(
                  clipBehavior: Clip.none,
                children: [
                  GestureDetector(
                    onTap: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (context) => const OrderStatusDetailPage(),
                        ),
                      );
                    },
                    child: Container(
                      height: 60,
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(18),
                        border: Border.all(color: orangeColor, width: 1.5),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.1),
                            blurRadius: 15,
                            offset: const Offset(0, 5),
                          ),
                        ],
                      ),
                      padding: const EdgeInsets.symmetric(
                          horizontal: 14, vertical: 8),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Order being prepared',
                            style: TextStyle(
                              fontFamily: 'Recoleta',
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF2E5E58),
                              height: 1.2,
                            ),
                          ),
                          Row(
                            children: const [
                              Text(
                                'Est. time: ',
                                style: TextStyle(
                                  fontFamily: 'Afacad',
                                  fontSize: 10,
                                  color: Colors.black54,
                                  height: 1.2,
                                ),
                              ),
                              Text(
                                '5 min',
                                style: TextStyle(
                                  fontFamily: 'Afacad',
                                  fontSize: 10,
                                  fontWeight: FontWeight.bold,
                                  fontStyle: FontStyle.italic,
                                  color: Color(0xFF2E5E58),
                                  height: 1.2,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),

                  // Close Button
                  Positioned(
                    top: -8,
                    right: -8,
                    child: GestureDetector(
                      onTap: () {
                        globalOrderStatusVisible.value = false;
                      },
                      child: Container(
                        padding: const EdgeInsets.all(4),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          shape: BoxShape.circle,
                          border: Border.all(color: Colors.grey.shade300),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.1),
                              blurRadius: 4,
                            ),
                          ],
                        ),
                        child: Icon(
                          Icons.close,
                          size: 16,
                          color: Colors.grey.shade600,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      );
    },
  );
}
}
