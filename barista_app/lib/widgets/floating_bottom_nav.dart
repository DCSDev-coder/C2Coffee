import 'package:flutter/material.dart';
import '../screens/current_order_page.dart';
import '../screens/history_page.dart';

enum NavPage { history, currentOrder, settings }

class FloatingBottomNav extends StatelessWidget {
  final NavPage activePage;

  const FloatingBottomNav({super.key, required this.activePage});

  @override
  Widget build(BuildContext context) {
    const Color darkGreen = Color(0xFF304A3A);
    
    final double screenWidth = MediaQuery.of(context).size.width;
    // The bar has horizontal padding of 24 on each side, so width is screenWidth - 48
    final double barWidth = screenWidth - 48.0;

    // Calculate the center X coordinate for the active tab (1/6th, 1/2, or 5/6th)
    double fabXCenter;
    switch (activePage) {
      case NavPage.history:
        fabXCenter = barWidth / 6;
        break;
      case NavPage.currentOrder:
        fabXCenter = barWidth / 2;
        break;
      case NavPage.settings:
        fabXCenter = barWidth * 5 / 6;
        break;
    }

    // The FAB is 64x64, so its left offset is center - 32
    final double fabLeft = fabXCenter - 32.0;

    return Positioned(
      left: 24.0,
      right: 24.0,
      bottom: 24.0,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          // The clipped pill background with a transparent notch
          ClipPath(
            clipper: _NotchedClipper(notchCenterPoint: fabXCenter),
            child: Container(
              height: 70,
              color: darkGreen,
              child: Row(
                children: [
                  Expanded(
                    child: activePage == NavPage.history
                        ? const SizedBox.shrink()
                        : _buildSideButton(
                            icon: Icons.history,
                            label: 'History',
                            onTap: () {
                              Navigator.pushReplacement(
                                context,
                                PageRouteBuilder(
                                  pageBuilder: (context, animation, secondaryAnimation) => const HistoryPage(),
                                  transitionsBuilder: (context, animation, secondaryAnimation, child) {
                                    return FadeTransition(opacity: animation, child: child);
                                  },
                                ),
                              );
                            },
                          ),
                  ),
                  Expanded(
                    child: activePage == NavPage.currentOrder
                        ? const SizedBox.shrink()
                        : _buildSideButton(
                            icon: Icons.shopping_basket,
                            label: 'Orders',
                            onTap: () {
                              Navigator.pushReplacement(
                                context,
                                PageRouteBuilder(
                                  pageBuilder: (context, animation, secondaryAnimation) => const CurrentOrderPage(),
                                  transitionsBuilder: (context, animation, secondaryAnimation, child) {
                                    return FadeTransition(opacity: animation, child: child);
                                  },
                                ),
                              );
                            },
                          ),
                  ),
                  Expanded(
                    child: activePage == NavPage.settings
                        ? const SizedBox.shrink()
                        : _buildSideButton(
                            icon: Icons.settings,
                            label: 'Settings',
                            onTap: () {},
                          ),
                  ),
                ],
              ),
            ),
          ),
          
          // Floating Center Button
          Positioned(
            left: fabLeft,
            top: -24,
            child: Transform.translate(
              offset: const Offset(0, -8),
              child: Material(
                elevation: 8,
                shape: const CircleBorder(),
                color: darkGreen,
                child: SizedBox(
                  height: 64,
                  width: 64,
                  child: IconButton(
                    icon: Icon(
                      activePage == NavPage.history
                          ? Icons.history
                          : (activePage == NavPage.currentOrder
                              ? Icons.shopping_basket
                              : Icons.settings),
                      color: Colors.white,
                      size: 28,
                    ),
                    onPressed: () {},
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSideButton({required IconData icon, required String label, required VoidCallback onTap}) {
    return InkWell(
      onTap: onTap,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, color: Colors.white),
          const SizedBox(height: 4),
          Text(
            label,
            style: const TextStyle(color: Colors.white, fontSize: 12),
          ),
        ],
      ),
    );
  }
}

class _NotchedClipper extends CustomClipper<Path> {
  final double notchCenterPoint;

  _NotchedClipper({required this.notchCenterPoint});

  @override
  Path getClip(Size size) {
    final host = Rect.fromLTWH(0, 0, size.width, size.height);
    final guest = Rect.fromCenter(
      center: Offset(notchCenterPoint, 0),
      width: 80, // FAB size (64) + total notch margin (16)
      height: 80,
    );
    
    // 1. Get the path with the top notch
    final notchedPath = const CircularNotchedRectangle().getOuterPath(host, guest);
    
    // 2. Get the path with rounded corners
    final rrectPath = Path()..addRRect(RRect.fromRectAndRadius(host, const Radius.circular(35.0)));
    
    // 3. Intersect them to get a rounded rectangle with a top notch
    return Path.combine(PathOperation.intersect, notchedPath, rrectPath);
  }

  @override
  bool shouldReclip(covariant _NotchedClipper oldClipper) => 
      oldClipper.notchCenterPoint != notchCenterPoint;
}
