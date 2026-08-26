import 'package:flutter/material.dart';
import 'package:flutter/material.dart';

enum NavPage { history, currentOrder, settings }

class FloatingBottomNav extends StatelessWidget {
  final NavPage activePage;
  final Function(int) onTabSelected;
  final PageController pageController;

  const FloatingBottomNav({
    super.key, 
    required this.activePage,
    required this.onTabSelected,
    required this.pageController,
  });

  @override
  Widget build(BuildContext context) {
    const Color darkGreen = Color(0xFF304A3A);
    
    final double screenWidth = MediaQuery.of(context).size.width;
    double barWidth = screenWidth - 48.0;
    if (barWidth > 600.0) {
      barWidth = 600.0;
    }
    final double horizontalOffset = (screenWidth - barWidth) / 2;

    return Positioned(
      left: horizontalOffset,
      right: horizontalOffset,
      bottom: 24.0,
      child: AnimatedBuilder(
        animation: pageController,
        builder: (context, child) {
          // Determine exact scroll position (0.0 to 2.0)
          double scrollPosition = 1.0; // default to center
          if (pageController.hasClients && pageController.position.haveDimensions) {
            scrollPosition = pageController.page ?? 1.0;
          } else {
            // Fallback for first frame before layout is complete
            if (activePage == NavPage.history) scrollPosition = 0.0;
            if (activePage == NavPage.currentOrder) scrollPosition = 1.0;
            if (activePage == NavPage.settings) scrollPosition = 2.0;
          }

          // Calculate exact X center based on scroll position
          // index 0 -> 1/6
          // index 1 -> 3/6 (1/2)
          // index 2 -> 5/6
          final double fabXCenter = barWidth * (1 / 6 + (scrollPosition * 2 / 6));
          final double fabLeft = fabXCenter - 32.0;

          return Stack(
            clipBehavior: Clip.none,
            children: [
              // 1. A soft drop shadow for the entire bar
              Container(
                height: 70,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(35.0),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.15),
                      blurRadius: 30,
                      offset: const Offset(0, 10),
                    )
                  ],
                ),
              ),

              // 2. The clipped glassmorphic pill background with a dynamically positioned notch
              ClipPath(
                clipper: _NotchedClipper(notchCenterPoint: fabXCenter),
                child: Container(
                  height: 70,
                  decoration: BoxDecoration(
                    color: darkGreen, // Solid color for performance
                    border: Border.all(
                      color: Colors.white.withOpacity(0.2), 
                      width: 1.5,
                    ),
                    borderRadius: BorderRadius.circular(35.0),
                  ),
                  child: Row(
                    children: [
                        Expanded(
                          child: activePage == NavPage.history
                              ? const SizedBox.shrink()
                              : _buildSideButton(
                                  icon: Icons.history,
                                  label: 'History',
                                  onTap: () => onTabSelected(0),
                                ),
                        ),
                        Expanded(
                          child: activePage == NavPage.currentOrder
                              ? const SizedBox.shrink()
                              : _buildSideButton(
                                  icon: Icons.shopping_basket,
                                  label: 'Orders',
                                  onTap: () => onTabSelected(1),
                                ),
                        ),
                        Expanded(
                          child: activePage == NavPage.settings
                              ? const SizedBox.shrink()
                              : _buildSideButton(
                                  icon: Icons.settings,
                                  label: 'Settings',
                                  onTap: () => onTabSelected(2),
                                ),
                        ),
                      ],
                    ),
                  ),
                ),
              
              // 3. Floating Center Button synced with notch
              Positioned(
                left: fabLeft,
                top: -24,
                child: Transform.translate(
                  offset: const Offset(0, -8),
                  child: Container(
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.15),
                          blurRadius: 15,
                          offset: const Offset(0, 8),
                        )
                      ]
                    ),
                    child: Material(
                      elevation: 0,
                      shape: const CircleBorder(),
                      color: Colors.white, // Make it pop in white
                      child: SizedBox(
                        height: 64,
                        width: 64,
                        child: IconButton(
                          icon: AnimatedSwitcher(
                            duration: const Duration(milliseconds: 200),
                            child: Icon(
                              activePage == NavPage.history
                                  ? Icons.history
                                  : (activePage == NavPage.currentOrder
                                      ? Icons.shopping_basket
                                      : Icons.settings),
                              key: ValueKey(activePage),
                              color: darkGreen, // High contrast with beige bubble
                              size: 30,
                            ),
                          ),
                          onPressed: () {}, // Handled by pageView swipe or can be left empty
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ],
          );
        },
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
          Icon(icon, color: Colors.white70),
          const SizedBox(height: 4),
          Text(
            label,
            style: const TextStyle(color: Colors.white70, fontSize: 13, fontFamily: 'Afacad', fontWeight: FontWeight.bold),
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
