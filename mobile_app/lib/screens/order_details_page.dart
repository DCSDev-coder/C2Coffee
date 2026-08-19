import 'package:flutter/material.dart';
import 'loading_order_page.dart';
import 'product_detail_page.dart';
import '../utils/app_colors.dart';
import '../widgets/app_page_shell.dart';

class OrderDetailsPage extends StatelessWidget {
  final Map<String, dynamic> item;

  const OrderDetailsPage({super.key, required this.item});

  void _handleOrderAgain(BuildContext context) {
    final detailsStr = item['details']?.toString() ?? '';

    // Parse Bean Blend
    String bean = 'Dato Blend';
    if (detailsStr.contains('Datin Blend')) {
      bean = 'Datin Blend';
    } else if (detailsStr.contains('Dato Blend')) {
      bean = 'Dato Blend';
    }

    // Parse Temperature
    String temp = 'Hot';
    if (detailsStr.contains('Cold') || detailsStr.contains('Iced')) {
      temp = 'Cold';
    } else if (detailsStr.contains('Hot')) {
      temp = 'Hot';
    }

    // Parse Milk
    String milk = 'Fresh Milk';
    if (detailsStr.contains('Oat Milk')) {
      milk = 'Oat Milk';
    } else if (detailsStr.contains('Fresh Milk')) {
      milk = 'Fresh Milk';
    }

    // Parse Sweetness
    String sweetness = 'Regular Sweet';
    if (detailsStr.contains('No Sugar')) {
      sweetness = 'No Sugar';
    } else if (detailsStr.contains('Less Sweet')) {
      sweetness = 'Less Sweet';
    } else if (detailsStr.contains('Reg. Sweet') ||
        detailsStr.contains('Regular Sweet')) {
      sweetness = 'Regular Sweet';
    }

    // Parse Ice Level
    String iceLevel = 'Regular Ice';
    if (detailsStr.contains('Less Ice')) {
      iceLevel = 'Less Ice';
    } else if (detailsStr.contains('Reg. Ice') ||
        detailsStr.contains('Regular Ice')) {
      iceLevel = 'Regular Ice';
    }

    // Parse Order Type
    String orderType = 'Dine In';
    if (detailsStr.contains('Take Away')) {
      orderType = 'Take Away';
    } else if (detailsStr.contains('Dine In')) {
      orderType = 'Dine In';
    }

    final int qty = (item['quantity'] is int) ? item['quantity'] as int : 1;
    final String remarks = item['remarks']?.toString() ?? '';

    final Map<String, dynamic> drinkItem = {
      'name': item['name'] ?? 'Mont Broga',
      'image': item['image'] ?? 'assets/images/drinks/MONT BROGA.png',
      'price': AppColors.getDiscountedDrinkPrice(16.90).toStringAsFixed(2),
      'desc': 'Black coffee layered with orangey cold foam and orange zest.',
    };

    InteractiveFillingLoader.show(
      context,
      targetPage: ProductDetailPage(
        item: drinkItem,
        initialBean: bean,
        initialTemperature: temp,
        initialMilk: milk,
        initialSweetness: sweetness,
        initialIceLevel: iceLevel,
        initialOrderType: orderType,
        initialRemarks: remarks,
        initialQuantity: qty,
        isReorder: true,
      ),
    );
  }

  void _navigateBackToPurchaseHistory(BuildContext context) {
    InteractiveFillingLoader.showPop(context);
  }

  @override
  Widget build(BuildContext context) {
    Color orangeColor = AppColors.deepTeal;
    const Color bgColor = Colors.white;

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) {
        if (didPop) return;
        _navigateBackToPurchaseHistory(context);
      },
      child: AppPageShell(
        title: 'ORDER DETAILS',
        onBack: () => _navigateBackToPurchaseHistory(context),
        backgroundColor: bgColor,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.all(20.0),
              child: Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                    color: AppColors.border,
                    width: 1,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.03),
                      blurRadius: 8,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Image.asset(
                          item['image'],
                          width: 55,
                          height: 75,
                          fit: BoxFit.contain,
                        ),
                        const SizedBox(width: 16),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                '${item['date']} . ${item['time']}',
                                style: const TextStyle(
                                  fontFamily: 'Afacad',
                                  fontSize: 12,
                                  color: Colors.black54,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Row(
                                mainAxisAlignment:
                                    MainAxisAlignment.spaceBetween,
                                children: [
                                  Text(
                                    item['name'],
                                    style: TextStyle(
                                      fontFamily: 'Recoleta',
                                      fontSize: 20,
                                      fontWeight: FontWeight.bold,
                                      color: AppColors.deepTeal,
                                    ),
                                  ),
                                  Text(
                                    'x${item['quantity']}',
                                    style: TextStyle(
                                      fontFamily: 'Afacad',
                                      fontSize: 22,
                                      fontWeight: FontWeight.bold,
                                      color: orangeColor,
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 8),
                              Text(
                                item['details'],
                                style: const TextStyle(
                                  fontFamily: 'Afacad',
                                  fontSize: 14,
                                  color: Colors.black87,
                                  height: 1.2,
                                ),
                              ),
                              const SizedBox(height: 16),
                              Text(
                                'Remarks: ${item['remarks']}',
                                style: const TextStyle(
                                  fontFamily: 'Afacad',
                                  fontSize: 14,
                                  color: Colors.black87,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 24),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.end,
                      children: [
                        Text(
                          '${item['quantity']} item  ',
                          style: const TextStyle(
                            fontFamily: 'Afacad',
                            fontSize: 14,
                            color: Colors.black87,
                          ),
                        ),
                        Text(
                          'RM${AppColors.getDiscountedDrinkPrice(16.90).toStringAsFixed(2)}',
                          style: TextStyle(
                            fontFamily: 'Afacad',
                            fontSize: 14,
                            fontWeight: FontWeight.bold,
                            color: AppColors.deepTeal,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            // Moved higher right below the details card
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: SizedBox(
                width: double.infinity,
                height: 50,
                child: ElevatedButton(
                  onPressed: () => _handleOrderAgain(context),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.surfaceLight,
                    foregroundColor: orangeColor,
                    side: BorderSide(color: AppColors.border),
                    elevation: 0,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(25),
                    ),
                  ),
                  child: Text(
                    'Order Again',
                    style: TextStyle(
                      fontFamily: 'Recoleta',
                      fontSize: 16,
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
