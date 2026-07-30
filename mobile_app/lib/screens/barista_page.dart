import 'package:flutter/material.dart';

class BaristaPage extends StatelessWidget {
  final String title;
  final String heroImage;
  final List<Map<String, dynamic>> drinks;

  const BaristaPage({
    super.key,
    required this.title,
    required this.heroImage,
    required this.drinks,
  });

  @override
  Widget build(BuildContext context) {
    const orangeColor = Color(0xFFE86A12); // Extracted from UI
    const backgroundColor = Color(0xFFF7F7F7);

    return Scaffold(
      backgroundColor: backgroundColor,
      body: SingleChildScrollView(
        child: Column(
          children: [
            // Custom Header matching other pages (but flattened bottom to merge with image)
            Container(
              padding: const EdgeInsets.only(top: 60, bottom: 20, left: 20, right: 20),
              decoration: const BoxDecoration(
                color: orangeColor,
              ),
              child: Row(
                children: [
                  GestureDetector(
                    onTap: () => Navigator.pop(context),
                    child: const Icon(Icons.arrow_back_ios, color: Colors.white, size: 24),
                  ),
                  Expanded(
                    child: Center(
                      child: FittedBox(
                        fit: BoxFit.scaleDown,
                        child: Text(
                          title.toUpperCase(),
                          style: const TextStyle(
                            fontFamily: 'Recoleta',
                            fontSize: 24,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                          ),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 24), // Balance the flex for centering
                ],
              ),
            ),
            // Hero Image Carousel (mocked with single image and dots)
            Container(
              decoration: const BoxDecoration(
                color: backgroundColor,
                borderRadius: BorderRadius.only(
                  bottomLeft: Radius.circular(24),
                  bottomRight: Radius.circular(24),
                ),
              ),
              child: Stack(
                  alignment: Alignment.bottomCenter,
                  children: [
                    ClipRRect(
                      borderRadius: const BorderRadius.only(
                        bottomLeft: Radius.circular(24),
                        bottomRight: Radius.circular(24),
                      ),
                      child: Image.asset(
                        heroImage,
                        width: double.infinity,
                        height: 200,
                        fit: BoxFit.cover,
                        errorBuilder: (context, error, stackTrace) {
                          // Fallback to another image if banner doesn't exist
                          return Image.asset(
                            'assets/images/FKP01925.jpg',
                            width: double.infinity,
                            height: 200,
                            fit: BoxFit.cover,
                          );
                        },
                      ),
                    ),
                    // Dots
                    Positioned(
                      bottom: 8,
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Container(
                            width: 6,
                            height: 6,
                            margin: const EdgeInsets.symmetric(horizontal: 3),
                            decoration: const BoxDecoration(
                              color: orangeColor,
                              shape: BoxShape.circle,
                            ),
                          ),
                          Container(
                            width: 6,
                            height: 6,
                            margin: const EdgeInsets.symmetric(horizontal: 3),
                            decoration: const BoxDecoration(
                              color: Colors.white,
                              shape: BoxShape.circle,
                            ),
                          ),
                          Container(
                            width: 6,
                            height: 6,
                            margin: const EdgeInsets.symmetric(horizontal: 3),
                            decoration: const BoxDecoration(
                              color: Colors.white,
                              shape: BoxShape.circle,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
            ),
            const SizedBox(height: 24),
            
            // Drink Grid
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16.0),
              child: LayoutBuilder(
                builder: (context, constraints) {
                  // Calculate the width of each item for 2 columns with 12 spacing
                  final itemWidth = (constraints.maxWidth - 12) / 2;
                  return Wrap(
                    spacing: 12,
                    runSpacing: 12,
                    alignment: WrapAlignment.center,
                    children: drinks.map((drink) {
                      return SizedBox(
                        width: itemWidth,
                        height: itemWidth, // keeping aspect ratio 1.0
                        child: _buildDrinkCard(drink),
                      );
                    }).toList(),
                  );
                },
              ),
            ),
            const SizedBox(height: 40),
          ],
        ),
      ),
    );
  }

  Widget _buildDrinkCard(Map<String, dynamic> item) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          // Image
          Expanded(
            child: Padding(
              padding:
                  const EdgeInsets.only(top: 12, bottom: 8, left: 8, right: 8),
              child: Image.asset(
                item['image'],
                fit: BoxFit.contain,
              ),
            ),
          ),

          // Details
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8),
            child: Text(
              item['name'],
              textAlign: TextAlign.center,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontFamily: 'Afacad',
                fontSize: 14,
                fontWeight: FontWeight.bold,
                color: Colors.black87,
                height: 1.1,
              ),
            ),
          ),
          const SizedBox(height: 4),
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Text(
              item['price'] ?? '',
              style: TextStyle(
                fontFamily: 'Afacad',
                fontSize: 13,
                fontWeight: FontWeight.w500,
                color: Colors.grey.shade600,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
