import 'package:flutter/material.dart';
import '../utils/global_state.dart';
import '../screens/order_status_detail_page.dart';

class OrderStatusBanner extends StatefulWidget {
  final double bottomOffset;

  const OrderStatusBanner({
    super.key,
    this.bottomOffset = 120, // Default to float just above the bottom nav
  });

  @override
  State<OrderStatusBanner> createState() => _OrderStatusBannerState();
}

class _OrderStatusBannerState extends State<OrderStatusBanner>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<Offset> _slideAnimation;
  late Animation<double> _fadeAnimation;

  final Color orangeColor = const Color(0xFFE66B00);

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
    return ValueListenableBuilder<bool>(
      valueListenable: globalOrderStatusVisible,
      builder: (context, isVisible, child) {
        return Positioned(
          bottom: widget.bottomOffset,
          left: 16,
          right: 16,
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
                      width: double.infinity,
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(24),
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
                          horizontal: 16, vertical: 8),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Text(
                                  'Your order is being prepared',
                                  style: TextStyle(
                                    fontFamily: 'Recoleta',
                                    fontSize: 14,
                                    fontWeight: FontWeight.bold,
                                    color: Color(0xFFE66B00),
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Row(
                                  children: const [
                                    Text(
                                      'Estimated preparation time : ',
                                      style: TextStyle(
                                        fontFamily: 'Afacad',
                                        fontSize: 10,
                                        fontWeight: FontWeight.bold,
                                        color: Colors.black87,
                                      ),
                                    ),
                                    Text(
                                      '5 min',
                                      style: TextStyle(
                                        fontFamily: 'Afacad',
                                        fontSize: 13,
                                        fontWeight: FontWeight.bold,
                                        fontStyle: FontStyle.italic,
                                        color: Color(0xFFE66B00),
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                          Image.asset(
                            'assets/images/pour.png',
                            width: 55,
                            height: 55,
                            fit: BoxFit.contain,
                          ),
                          const SizedBox(width: 8), // space for close button
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
        );
      },
    );
  }
}
