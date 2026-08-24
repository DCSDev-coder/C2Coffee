import 'package:flutter/material.dart';
import '../services/app_session_service.dart';
import '../services/cart_service.dart';
import 'loading_order_page.dart';
import '../utils/app_colors.dart';
import '../widgets/catalog_product_image.dart';
import '../widgets/token_price_pair.dart';

class SimpleProductDetailPage extends StatefulWidget {
  final Map<String, dynamic> item;
  final int? initialQuantity;

  const SimpleProductDetailPage({
    super.key,
    required this.item,
    this.initialQuantity,
  });

  @override
  State<SimpleProductDetailPage> createState() =>
      _SimpleProductDetailPageState();
}

class _SimpleProductDetailPageState extends State<SimpleProductDetailPage> {
  final AppSessionService _session = AppSessionService.instance;
  int quantity = 1;
  bool _showTokenPrice = false;

  @override
  void initState() {
    super.initState();
    if (widget.initialQuantity != null && widget.initialQuantity! > 0) {
      quantity = widget.initialQuantity!;
    }
  }

  String get _itemName => widget.item['name']?.toString() ?? 'Item';
  bool get _isDrink => widget.item['isDrink'] == true;
  bool get _isFood => widget.item['isFood'] == true;
  bool get _isMerchandise => widget.item['isMerchandise'] == true;
  bool get _isCandle => widget.item['isCandle'] == true;

  bool get _isPastry {
    return _isFood;
  }

  double get _imageScale {
    if (_isPastry) return 1.35;
    if (_isCandle) return 1.15;
    if (_isMerchandise) return 1.15;
    return 1.1;
  }

  double get _itemBasePrice {
    final raw = widget.item['price']?.toString() ?? '0.00';
    final clean = raw.replaceAll('RM', '').replaceAll(r'$', '').trim();
    final parsed = double.tryParse(clean) ?? 0.0;
    if (_isPastry) {
      return parsed;
    } else if (_isMerchandise || _isCandle) {
      return AppColors.getDiscountedMerchPrice(parsed);
    } else if (_isDrink) {
      return AppColors.getDiscountedDrinkPrice(parsed);
    } else {
      return parsed;
    }
  }

  int get _tokenPrice {
    final itemId = widget.item['id'];
    if (itemId is! int) return _itemBasePrice.round();
    final catalogItem = _session.allMenuItems.cast<dynamic>().firstWhere(
          (item) => item?.id == itemId,
          orElse: () => null,
        );
    if (catalogItem == null) return _itemBasePrice.round();
    final tierPrice = catalogItem.tokenPrices[_session.tier];
    if (tierPrice != null) return tierPrice;
    final baseTokenPrice = catalogItem.basePriceToken as int?;
    if (baseTokenPrice != null && baseTokenPrice > 0) return baseTokenPrice;
    return _itemBasePrice.round();
  }

  String get _rmPriceText {
    final rawPrice = widget.item['price']?.toString() ?? '0.00';
    return AppColors.formatDiscountedPrice(
      rawPrice,
      isDrink: _isDrink,
      isMerchandise: _isMerchandise || _isCandle,
    );
  }

  String get _displayTotalText {
    if (_showTokenPrice) {
      return '${_tokenPrice * quantity} tokens';
    }
    return 'RM ${(_itemBasePrice * quantity).toStringAsFixed(2)}';
  }

  Widget _buildExchangeButton() {
    return GestureDetector(
      onTap: () => setState(() => _showTokenPrice = !_showTokenPrice),
      child: Container(
        width: 34,
        height: 34,
        decoration: BoxDecoration(
          color: _showTokenPrice
              ? const Color(0xFFE5A93C)
              : const Color(0xFFFAF7F2),
          shape: BoxShape.circle,
          border: Border.all(
            color: _showTokenPrice ? const Color(0xFFE5A93C) : AppColors.border,
            width: 1,
          ),
        ),
        child: Icon(
          Icons.swap_horiz_rounded,
          size: 18,
          color: _showTokenPrice ? Colors.white : AppColors.deepTeal,
        ),
      ),
    );
  }

  String get _itemDescription {
    if (widget.item['desc'] != null &&
        widget.item['desc'].toString().isNotEmpty) {
      return widget.item['desc'].toString();
    }
    if (_itemName.toLowerCase().contains('curry puff')) {
      return 'Crispy, golden pastry crust packed with savory spiced minced lamb filling. Freshly baked daily.';
    }
    if (_isMerchandise) {
      return 'Premium durable tumbler designed for daily coffee rituals, maintaining your beverage temperature effortlessly.';
    }
    if (_isCandle) {
      if (_itemName.toLowerCase().contains('gunung')) {
        return 'Earthy cedar and forest pine notes inspired by the misty Broga peaks. Hand-poured natural soy wax.';
      } else if (_itemName.toLowerCase().contains('lime')) {
        return 'Zesty citrus lime blended with crisp sea salt minerals for a refreshing, revitalizing ambience.';
      } else if (_itemName.toLowerCase().contains('sage')) {
        return 'Calming herbal sage paired with coastal driftwood notes for a serene, relaxing space.';
      } else if (_itemName.toLowerCase().contains('tobacco')) {
        return 'Warm aromatic tobacco leaf layered with creamy vanilla and subtle spices for a cozy aroma.';
      }
      return 'Handcrafted soy scented candle formulated with fine fragrance oils to elevate your everyday sanctuary.';
    }
    return 'Crafted with premium ingredients for the ultimate C2 experience.';
  }

  @override
  Widget build(BuildContext context) {
    Color orangeColor = AppColors.deepTeal;
    const Color bgColor = Colors.white;

    return Scaffold(
      backgroundColor: bgColor,
      body: CustomScrollView(
        slivers: [
          SliverAppBar(
            backgroundColor: bgColor,
            elevation: 0,
            pinned: true,
            leading: const SizedBox.shrink(),
            actions: [
              IconButton(
                icon: Icon(Icons.close, color: AppColors.deepTeal),
                onPressed: () => InteractiveFillingLoader.showPop(context),
              ),
            ],
          ),
          SliverToBoxAdapter(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(
                  child: Transform.scale(
                    scale: _imageScale,
                    child: CatalogProductImage(
                      assetPath: null,
                      imageUrl: widget.item['image_url']?.toString(),
                      height: 200,
                      fit: BoxFit.contain,
                    ),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.all(20.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        _itemName,
                        style: const TextStyle(
                          fontFamily: 'Recoleta',
                          fontSize: 28,
                          fontWeight: FontWeight.w900,
                          color: Colors.black,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        _itemDescription,
                        style: const TextStyle(
                          fontFamily: 'Afacad',
                          fontSize: 14,
                          color: Colors.black87,
                        ),
                      ),
                      const SizedBox(height: 16),
                      Container(
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        decoration: BoxDecoration(
                          border: Border(
                            bottom: BorderSide(
                                color: Colors.black.withValues(alpha: 0.1)),
                          ),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            AnimatedSwitcher(
                              duration: const Duration(milliseconds: 200),
                              child: _showTokenPrice
                                  ? TokenPricePair(
                                      key: const ValueKey('tokenPrice'),
                                      tokenValue: _tokenPrice,
                                      tokenFontSize: 14,
                                      tokenColor: Colors.black87,
                                    )
                                  : Text(
                                      _rmPriceText,
                                      key: const ValueKey('rmPrice'),
                                      style: const TextStyle(
                                        fontFamily: 'Afacad',
                                        fontSize: 14,
                                        fontWeight: FontWeight.bold,
                                        color: Colors.black87,
                                      ),
                                    ),
                            ),
                            _buildExchangeButton(),
                          ],
                        ),
                      ),
                      const SizedBox(height: 20),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
      bottomNavigationBar: Container(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
        decoration: BoxDecoration(
          color: Colors.white,
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.05),
              blurRadius: 10,
              offset: const Offset(0, -5),
            ),
          ],
        ),
        child: SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Total',
                    style: TextStyle(
                        fontFamily: 'Recoleta',
                        fontSize: 16,
                        fontWeight: FontWeight.bold),
                  ),
                  AnimatedSwitcher(
                    duration: const Duration(milliseconds: 200),
                    child: _showTokenPrice
                        ? TokenPricePair(
                            key: const ValueKey('totalTokenPrice'),
                            tokenValue: _tokenPrice * quantity,
                            tokenFontSize: 12,
                            tokenColor: Colors.black87,
                          )
                        : Text(
                            _displayTotalText,
                            key: const ValueKey('totalRmPrice'),
                            style: const TextStyle(
                              fontFamily: 'Afacad',
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                              color: Colors.black87,
                            ),
                          ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Container(
                    decoration: BoxDecoration(
                      border: Border.all(color: orangeColor),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Row(
                      children: [
                        IconButton(
                          icon: const Icon(Icons.remove, size: 18),
                          constraints:
                              const BoxConstraints(minWidth: 36, minHeight: 36),
                          padding: EdgeInsets.zero,
                          color: Colors.black54,
                          onPressed: () {
                            if (quantity > 1) {
                              setState(() => quantity--);
                            }
                          },
                        ),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 10.0),
                          child: Text(
                            quantity.toString(),
                            style: const TextStyle(
                                fontFamily: 'Recoleta',
                                fontSize: 16,
                                fontWeight: FontWeight.bold),
                          ),
                        ),
                        IconButton(
                          icon: const Icon(Icons.add, size: 18),
                          constraints:
                              const BoxConstraints(minWidth: 36, minHeight: 36),
                          padding: EdgeInsets.zero,
                          color: Colors.black54,
                          onPressed: () {
                            setState(() => quantity++);
                          },
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: ElevatedButton(
                      onPressed: () {
                        final selectedStore = _session.selectedStore;
                        if (selectedStore == null) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content:
                                  const Text('Please select a store first.'),
                              backgroundColor: orangeColor,
                            ),
                          );
                          return;
                        }

                        CartService.instance.addItem(
                          storeId: selectedStore.id,
                          storeName: selectedStore.name,
                          item: CartItem(
                            id: '${widget.item['code'] ?? _itemName}-${DateTime.now().microsecondsSinceEpoch}',
                            menuItemId:
                                (widget.item['id'] as num?)?.toInt() ?? 0,
                            menuItemCode:
                                widget.item['code']?.toString() ?? _itemName,
                            name: _itemName,
                            categoryCode: widget.item['categoryCode']?.toString(),
                            categoryName: widget.item['category']?.toString(),
                            subcategoryCode: widget.item['subcategoryCode']?.toString(),
                            subcategoryName: widget.item['subcategory']?.toString(),
                            productKindCode: widget.item['productKindCode']?.toString(),
                            productKindName: widget.item['productKind']?.toString(),
                            imageAssetPath: null,
                            imageUrl: widget.item['image_url']?.toString(),
                            basePriceRm: _itemBasePrice,
                            tokenPrice: _tokenPrice,
                            quantity: quantity,
                            remarks: null,
                            displayDetails: null,
                          ),
                        );
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content:
                                Text('Added $quantity x $_itemName to cart!'),
                            duration: const Duration(seconds: 2),
                            backgroundColor: orangeColor,
                            behavior: SnackBarBehavior.floating,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                          ),
                        );
                        InteractiveFillingLoader.showPop(context);
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: orangeColor,
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(20),
                        ),
                      ),
                      child: const Text(
                        'ADD TO CART',
                        style: TextStyle(
                          fontFamily: 'Recoleta',
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                          color: Colors.white,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
