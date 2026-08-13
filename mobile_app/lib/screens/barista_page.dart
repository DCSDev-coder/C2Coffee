import 'dart:async';
import 'package:flutter/material.dart';
import 'loading_order_page.dart';
import 'product_detail_page.dart';
import '../utils/app_colors.dart';

class BaristaPage extends StatefulWidget {
  final String title;
  final String? heroImage;
  final List<String>? heroImages;
  final List<Map<String, dynamic>> drinks;

  const BaristaPage({
    super.key,
    required this.title,
    this.heroImage,
    this.heroImages,
    required this.drinks,
  });

  @override
  State<BaristaPage> createState() => _BaristaPageState();
}

class _BaristaPageState extends State<BaristaPage> {
  late final PageController _pageController;
  Timer? _carouselTimer;
  int _currentImageIndex = 0;
  late final List<String> _images;

  @override
  void initState() {
    super.initState();
    _pageController = PageController();

    if (widget.heroImages != null && widget.heroImages!.isNotEmpty) {
      _images = List<String>.from(widget.heroImages!);
    } else if (widget.heroImage != null && widget.heroImage!.isNotEmpty) {
      _images = [
        widget.heroImage!,
        'assets/images/barista_craft_banner.png',
        'assets/images/c2_poster.png',
      ];
    } else {
      _images = [
        'assets/images/FKP01925.jpg',
        'assets/images/barista_craft_banner.png',
        'assets/images/c2_poster.png',
      ];
    }

    if (_images.length > 1) {
      _carouselTimer = Timer.periodic(const Duration(seconds: 4), (timer) {
        if (!mounted) return;
        final nextIndex = (_currentImageIndex + 1) % _images.length;
        if (_pageController.hasClients) {
          _pageController.animateToPage(
            nextIndex,
            duration: const Duration(milliseconds: 400),
            curve: Curves.easeInOut,
          );
        }
      });
    }
  }

  @override
  void dispose() {
    _carouselTimer?.cancel();
    _pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    Color orangeColor = AppColors.deepTeal;
    const backgroundColor = Color(0xFFF7F7F7);

    return Scaffold(
      backgroundColor: backgroundColor,
      body: SingleChildScrollView(
        child: Column(
          children: [
            // Custom Header matching other pages (but flattened bottom to merge with image)
            Container(
              width: double.infinity,
              padding: EdgeInsets.only(
                  top: MediaQuery.paddingOf(context).top + 14,
                  bottom: 16,
                  left: 20,
                  right: 20),
              decoration: BoxDecoration(
                color: orangeColor,
              ),
              child: Row(
                children: [
                  GestureDetector(
                    onTap: () => InteractiveFillingLoader.showPop(context),
                    child: const Icon(Icons.arrow_back_ios,
                        color: Colors.white, size: 20),
                  ),
                  Expanded(
                    child: Center(
                      child: FittedBox(
                        fit: BoxFit.scaleDown,
                        child: Text(
                          widget.title.toUpperCase(),
                          style: const TextStyle(
                            fontFamily: 'Recoleta',
                            fontSize: 20,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                            letterSpacing: 1.0,
                          ),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 20), // Balance the flex for centering
                ],
              ),
            ),
            // Hero Image Carousel (Auto-sliding PageView with animated indicator dots)
            Container(
              height: 200,
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
                  PageView.builder(
                    controller: _pageController,
                    onPageChanged: (int index) {
                      setState(() {
                        _currentImageIndex = index;
                      });
                    },
                    itemCount: _images.length,
                    itemBuilder: (context, index) {
                      return ClipRRect(
                        borderRadius: const BorderRadius.only(
                          bottomLeft: Radius.circular(24),
                          bottomRight: Radius.circular(24),
                        ),
                        child: Image.asset(
                          _images[index],
                          width: double.infinity,
                          height: 200,
                          fit: BoxFit.cover,
                          errorBuilder: (context, error, stackTrace) {
                            return Image.asset(
                              'assets/images/FKP01925.jpg',
                              width: double.infinity,
                              height: 200,
                              fit: BoxFit.cover,
                            );
                          },
                        ),
                      );
                    },
                  ),
                  // Dots
                  Positioned(
                    bottom: 8,
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: List.generate(
                        _images.length,
                        (index) => AnimatedContainer(
                          duration: const Duration(milliseconds: 300),
                          width: _currentImageIndex == index ? 16 : 6,
                          height: 6,
                          margin: const EdgeInsets.symmetric(horizontal: 3),
                          decoration: BoxDecoration(
                            color: _currentImageIndex == index
                                ? orangeColor
                                : Colors.white,
                            borderRadius: BorderRadius.circular(3),
                          ),
                        ),
                      ),
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
                    children: widget.drinks.map((drink) {
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
    return GestureDetector(
      onTap: () {
        InteractiveFillingLoader.show(
          context,
          targetPage: ProductDetailPage(item: item),
        );
      },
      child: Container(
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
                padding: const EdgeInsets.only(
                    top: 12, bottom: 8, left: 8, right: 8),
                child: Transform.scale(
                  scale: item['scale'] as double? ?? 1.0,
                  child: Image.asset(
                    item['image'],
                    fit: BoxFit.contain,
                  ),
                ),
              ),
            ),

            // Details
            SizedBox(
              height: 34,
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 8),
                child: Center(
                  child: Text(
                    item['name'],
                    textAlign: TextAlign.center,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontFamily: 'Afacad',
                      fontSize: 14,
                      fontWeight: FontWeight.normal,
                      color: Colors.black87,
                      height: 1.15,
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 2),
            SizedBox(
              height: 24,
              child: Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: Center(
                  child: Text(
                    AppColors.formatDiscountedPrice(item['price'],
                        isDrink: true),
                    style: TextStyle(
                      fontFamily: 'Afacad',
                      fontSize: 13.5,
                      fontWeight: FontWeight.bold,
                      color: AppColors.deepTeal,
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
